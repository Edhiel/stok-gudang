import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, getDoc, doc, runTransaction, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import toast from 'react-hot-toast';

function StokKeluar({ userProfile }) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [storeId, setStoreId] = useState(''); // Ganti storeName jadi storeId
  const [driverName, setDriverName] = useState('');
  const [licensePlate, setLicensePlate] = useState('');

  const [tokoList, setTokoList] = useState([]);
  const [masterItems, setMasterItems] = useState({});
  const [stockData, setStockData] = useState({});

  const [tokoSearchTerm, setTokoSearchTerm] = useState('');
  const [isTokoSelected, setIsTokoSelected] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemStock, setItemStock] = useState(0);
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  const [transactionItems, setTransactionItems] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!userProfile.depotId) return;

    // Ambil data Toko & Master Barang dari Firestore
    const unsubToko = onSnapshot(collection(firestoreDb, 'master_toko'), (snap) => {
        setTokoList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    getDocs(collection(firestoreDb, 'master_items')).then(snap => {
        const items = snap.docs.reduce((acc, doc) => {
            acc[doc.id] = { id: doc.id, ...doc.data() };
            return acc;
        }, {});
        setMasterItems(items);
    });

    // Ambil data Stok dari Firestore
    const unsubStock = onSnapshot(collection(firestoreDb, `depots/${userProfile.depotId}/stock`), (snap) => {
        const stocks = snap.docs.reduce((acc, doc) => {
            acc[doc.id] = doc.data().totalStockInPcs || 0;
            return acc;
        }, {});
        setStockData(stocks);
    });

    return () => {
        unsubToko();
        unsubStock();
    };
  }, [userProfile.depotId]);

  const handleBarcodeDetected = (scannedBarcode) => {
    const availableItems = Object.keys(stockData)
        .filter(id => stockData[id] > 0)
        .map(id => masterItems[id])
        .filter(Boolean); // Hapus item yg mungkin belum termuat di masterItems
    const foundItem = availableItems.find(item => item.barcodePcs === scannedBarcode || item.barcodeDos === scannedBarcode);
    
    if (foundItem) {
      handleSelectItem(foundItem);
    } else {
      toast.error("Barang tidak ditemukan atau stok kosong.");
    }
    setShowScanner(false);
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setSearchTerm(item.name);
    setItemStock(stockData[item.id] || 0);
  };
  
  const handleSelectToko = (toko) => {
      setStoreId(toko.id);
      setTokoSearchTerm(toko.namaToko);
      setIsTokoSelected(true);
  };

  const handleAddItemToList = (isBonus = false) => {
    if (!selectedItem) { toast.error("Pilih barang dulu."); return; }
    
    const dosInPcs = selectedItem.conversions?.Dos?.inPcs || 1;
    const packInPcs = selectedItem.conversions?.Pack?.inPcs || 1;
    const totalPcs = (Number(dosQty) * dosInPcs) + (Number(packQty) * packInPcs) + (Number(pcsQty));

    if (totalPcs <= 0) { toast.error("Masukkan jumlah yang valid."); return; }
    if (totalPcs > itemStock) {
        toast.error(`Stok tidak cukup! Sisa stok hanya ${itemStock} Pcs.`);
        return;
    }
    const newItem = {
      id: selectedItem.id, name: selectedItem.name, quantityInPcs: totalPcs,
      displayQty: `${dosQty}.${packQty}.${pcsQty}`, isBonus: isBonus
    };
    setTransactionItems([...transactionItems, newItem]);
    setSelectedItem(null); setSearchTerm(''); setDosQty(0); setPackQty(0); setPcsQty(0);
  };

  const handleRemoveFromList = (indexToRemove) => {
    setTransactionItems(transactionItems.filter((_, index) => index !== indexToRemove));
  };
  
  const handleSaveTransaction = async () => {
    if (!invoiceNumber || !storeId || transactionItems.length === 0) {
      return toast.error("No. Faktur, Nama Toko, dan minimal 1 barang wajib diisi.");
    }
    setIsSubmitting(true);
    toast.loading('Memproses transaksi...', { id: 'stok-keluar' });

    try {
      const allDeductions = [];
      const selectedToko = tokoList.find(t => t.id === storeId);

      for (const transItem of transactionItems) {
        const stockDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/stock/${transItem.id}`);
        
        await runTransaction(firestoreDb, async (transaction) => {
            const stockDoc = await transaction.get(stockDocRef);
            if (!stockDoc.exists() || !stockDoc.data().batches || stockDoc.data().totalStockInPcs < transItem.quantityInPcs) {
                throw new Error(`Stok untuk ${transItem.name} tidak mencukupi.`);
            }

            let currentStockData = stockDoc.data();
            const sortedBatches = Object.keys(currentStockData.batches)
                .map(key => ({ batchId: key, ...currentStockData.batches[key] }))
                .sort((a, b) => new Date(a.expireDate) - new Date(b.expireDate));
          
            let quantityToDeduct = transItem.quantityInPcs;
            let deductionsForThisItem = [];

            for (const batch of sortedBatches) {
                if (quantityToDeduct <= 0) break;
                const amountToTake = Math.min(quantityToDeduct, batch.quantity);
                
                const batchInDb = currentStockData.batches[batch.batchId];
                if (batchInDb) {
                    batchInDb.quantity -= amountToTake;
                    if (batchInDb.quantity <= 0) delete currentStockData.batches[batch.batchId];
                }
                quantityToDeduct -= amountToTake;
                
                deductionsForThisItem.push({
                    batchId: batch.batchId, deductedQty: amountToTake, expireDate: batch.expireDate
                });
            }

            if (quantityToDeduct > 0) {
                throw new Error(`Kalkulasi stok FEFO gagal untuk ${transItem.name}.`);
            }
          
            currentStockData.totalStockInPcs -= transItem.quantityInPcs;
            transaction.set(stockDocRef, currentStockData);
            allDeductions.push({itemId: transItem.id, name: transItem.name, deductions: deductionsForThisItem});
        });
      }

      const transactionsRef = collection(firestoreDb, `depots/${userProfile.depotId}/transactions`);
      await addDoc(transactionsRef, {
        type: 'Stok Keluar (Manual)', 
        invoiceNumber, storeId, storeName: selectedToko.namaToko, driverName, licensePlate, 
        items: transactionItems,
        deductionDetails: allDeductions,
        user: userProfile.fullName, 
        timestamp: serverTimestamp()
      });

      toast.dismiss('stok-keluar');
      toast.success("Transaksi stok keluar berhasil disimpan!");
      setInvoiceNumber(''); setStoreId(''); setDriverName(''); setLicensePlate('');
      setTransactionItems([]); setTokoSearchTerm(''); setIsTokoSelected(false);
    } catch (err) {
      toast.dismiss('stok-keluar');
      toast.error(`Gagal menyimpan: ${err.message}`);
      console.error(err);
    } finally {
        setIsSubmitting(false);
    }
  };

  const availableItemsForSearch = Object.keys(stockData)
    .filter(id => stockData[id] > 0 && masterItems[id])
    .map(id => masterItems[id]);

  const filteredItems = searchTerm.length > 0 
    ? availableItemsForSearch.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  const filteredToko = tokoSearchTerm.length > 0
    ? tokoList.filter(toko => toko.namaToko.toLowerCase().includes(tokoSearchTerm.toLowerCase()))
    : [];

  return (
    <>
      {showScanner && <CameraBarcodeScanner onScan={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
      <div className="p-8">
        <div className="card bg-white shadow-lg w-full">
          <div className="card-body">
            <h2 className="card-title text-2xl">Form Stok Keluar</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 border rounded-lg">
              <div className="form-control">
                <label className="label"><span className="label-text font-bold">No. Faktur</span></label>
                <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="input input-bordered" />
              </div>
              <div className="form-control dropdown">
                <label className="label"><span className="label-text font-bold">Nama Toko Tujuan</span></label>
                <input type="text" value={tokoSearchTerm} onChange={(e) => { setTokoSearchTerm(e.target.value); setStoreId(''); setIsTokoSelected(false); }} placeholder="Ketik nama toko..." className="input input-bordered w-full" />
                {filteredToko.length > 0 && !isTokoSelected && (
                  <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                    {filteredToko.slice(0, 5).map(toko => (
                      <li key={toko.id}><a onClick={() => handleSelectToko(toko)}>{toko.namaToko}</a></li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Nama Sopir</span></label>
                <input type="text" value={driverName} onChange={(e) => setDriverName(e.target.value)} className="input input-bordered" />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">No. Polisi Kendaraan</span></label>
                <input type="text" value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} className="input input-bordered" />
              </div>
            </div>
            <div className="divider">Detail Barang</div>
            <div className="p-4 border rounded-lg bg-base-200">
              <div className="form-control dropdown">
                <label className="label"><span className="label-text">Cari Barang (Scan atau Ketik Nama)</span></label>
                <div className="join w-full">
                  <input type="text" placeholder="Hanya barang dengan stok tersedia akan muncul" className="input input-bordered join-item w-full" value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setSelectedItem(null);}}/>
                  <button type="button" onClick={() => setShowScanner(true)} className="btn btn-primary join-item">Scan</button>
                </div>
                {filteredItems.length > 0 && !selectedItem && (
                  <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                    {filteredItems.slice(0, 5).map(item => (
                      <li key={item.id}><a onClick={() => handleSelectItem(item)}>{item.name}</a></li>
                    ))}
                  </ul>
                )}
              </div>
              {selectedItem && (
                <div className="mt-4">
                    <p className="font-bold">Barang Terpilih: {selectedItem.name}</p>
                    <p className="text-sm">Sisa Stok: <span className='font-bold text-lg'>{itemStock}</span> Pcs</p>
                    <div className="mt-2 grid grid-cols-3 md:grid-cols-4 gap-4 items-end">
                        <div className="form-control"><label className="label-text">DOS</label><input type="number" value={dosQty} onChange={(e) => setDosQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div>
                        <div className="form-control"><label className="label-text">PACK</label><input type="number" value={packQty} onChange={(e) => setPackQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div>
                        <div className="form-control"><label className="label-text">PCS</label><input type="number" value={pcsQty} onChange={(e) => setPcsQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => handleAddItemToList(false)} className="btn btn-secondary">Tambah</button>
                            <button type="button" onClick={() => handleAddItemToList(true)} className="btn btn-accent">Bonus</button>
                        </div>
                    </div>
                </div>
              )}
            </div>
            <div className="divider">Barang dalam Transaksi Ini</div>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead><tr><th>Nama Barang</th><th>Jumlah Keluar</th><th>Aksi</th></tr></thead>
                <tbody>
                  {transactionItems.map((item, index) => (
                    <tr key={index}>
                      <td>{item.name} {item.isBonus && <span className="badge badge-info badge-sm ml-2">Bonus</span>}</td>
                      <td>{item.displayQty}</td>
                      <td><button onClick={() => handleRemoveFromList(index)} className="btn btn-xs btn-error">Hapus</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-control mt-6">
              <button type="button" onClick={handleSaveTransaction} className="btn btn-primary btn-lg" disabled={isSubmitting || transactionItems.length === 0}>
                {isSubmitting ? <span className="loading loading-spinner"></span> : 'Simpan Seluruh Transaksi'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default StokKeluar;
