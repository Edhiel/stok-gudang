import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, getDoc, runTransaction, addDoc, serverTimestamp } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';
import CameraBarcodeScanner from './CameraBarcodeScanner';

function StokKeluar({ userProfile }) {
  const [items, setItems] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  
  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const [filteredStores, setFilteredStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);

  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [transactionItems, setTransactionItems] = useState([]);
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!userProfile?.depotId) {
        setLoading(false);
        return;
    }
    const itemsRef = collection(firestoreDb, 'master_items');
    const storesRef = collection(firestoreDb, 'master_toko');

    const unsubItems = onSnapshot(itemsRef, (snapshot) => {
        setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubStores = onSnapshot(storesRef, (snapshot) => {
        setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    setLoading(false);
    return () => {
        unsubItems();
        unsubStores();
    };
  }, [userProfile]);

  useEffect(() => {
    if (storeSearchTerm.length > 1) {
        setFilteredStores(stores.filter(s => s.namaToko.toLowerCase().includes(storeSearchTerm.toLowerCase())));
    } else {
        setFilteredStores([]);
    }
  }, [storeSearchTerm, stores]);

  const handleAddItem = () => {
    if (!selectedItem) return toast.error("Pilih barang terlebih dahulu.");
    const totalPcs = (Number(dosQty) * (selectedItem.conversions?.Dos?.inPcs || 1)) + 
                     (Number(packQty) * (selectedItem.conversions?.Pack?.inPcs || 1)) + 
                     Number(pcsQty);
    if (totalPcs <= 0) return toast.error("Masukkan jumlah yang valid.");

    setTransactionItems([...transactionItems, {
        id: selectedItem.id,
        name: selectedItem.name,
        quantityInPcs: totalPcs,
        displayQty: `${dosQty}.${packQty}.${pcsQty}`
    }]);

    setItemSearchTerm('');
    setSelectedItem(null);
    setDosQty(0); setPackQty(0); setPcsQty(0);
  };

  const handleRemoveItem = (index) => {
    setTransactionItems(transactionItems.filter((_, i) => i !== index));
  };
  
  const handleSaveTransaction = async () => {
    if (!selectedStore || transactionItems.length === 0) {
        return toast.error("Pilih toko tujuan dan tambahkan minimal satu barang.");
    }
    if (!window.confirm("Anda yakin ingin menyimpan transaksi ini? Stok akan langsung dipotong.")) return;
    setIsSubmitting(true);
    toast.loading("Memproses stok keluar...", { id: "stok-keluar-toast" });

    try {
        const pickingPlan = [];
        await runTransaction(firestoreDb, async (transaction) => {
            for (const item of transactionItems) {
                const stockDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/stock/${item.id}`);
                const stockDoc = await transaction.get(stockDocRef);
                if (!stockDoc.exists()) throw new Error(`Stok untuk ${item.name} tidak ditemukan.`);
                
                let currentStockData = stockDoc.data();
                if ((currentStockData.totalStockInPcs || 0) < item.quantityInPcs) {
                    throw new Error(`Stok untuk ${item.name} tidak cukup.`);
                }

                currentStockData.totalStockInPcs -= item.quantityInPcs;
                transaction.set(stockDocRef, currentStockData);
            }
        });
        
        const transactionsRef = collection(firestoreDb, `depots/${userProfile.depotId}/transactions`);
        await addDoc(transactionsRef, {
            type: 'Stok Keluar (Manual)',
            invoiceNumber: invoiceNumber,
            storeName: selectedStore.namaToko,
            storeId: selectedStore.id,
            driverName: driverName,
            items: transactionItems,
            user: userProfile.fullName,
            timestamp: serverTimestamp()
        });
        
        toast.dismiss("stok-keluar-toast");
        toast.success("Transaksi stok keluar berhasil disimpan!");
        setTransactionItems([]);
        setSelectedStore(null);
        setStoreSearchTerm('');
        setInvoiceNumber('');
        setDriverName('');
        setLicensePlate('');
    } catch (error) {
        toast.dismiss("stok-keluar-toast");
        toast.error("Gagal menyimpan transaksi: " + error.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  const filteredItems = itemSearchTerm.length > 1 ? items.filter(i => i.name.toLowerCase().includes(itemSearchTerm.toLowerCase())) : [];

  if (loading) return <div className="p-8 text-center"><span className="loading loading-spinner loading-lg"></span></div>;

  return (
    <>
      {showScanner && ( <CameraBarcodeScanner onScan={(code) => {
          const found = items.find(i => i.barcodePcs === code);
          if (found) { setSelectedItem(found); setItemSearchTerm(found.name); }
          setShowScanner(false);
        }} onClose={() => setShowScanner(false)} /> )}
      <div className="p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-6">Stok Keluar Manual (Non-Order)</h1>
        
        <div className="card bg-white shadow-lg p-6 mb-6">
          <h3 className="font-bold mb-2">Informasi Pengeluaran</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-control">
                <label className="label"><span className="label-text">No. Referensi / Faktur</span></label>
                <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="input input-bordered" />
            </div>
            <div className="form-control dropdown">
              <label className="label"><span className="label-text font-bold">Cari Toko Tujuan</span></label>
              <input 
                type="text"
                value={storeSearchTerm}
                onChange={(e) => {
                    setStoreSearchTerm(e.target.value);
                    setSelectedStore(null);
                }}
                placeholder="Ketik min. 2 huruf nama toko..."
                className="input input-bordered"
              />
              {filteredStores.length > 0 && !selectedStore && (
                <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                    {filteredStores.map(store => (
                        <li key={store.id}>
                            <a onClick={() => {
                                setSelectedStore(store);
                                setStoreSearchTerm(store.namaToko);
                            }}>{store.namaToko}</a>
                        </li>
                    ))}
                </ul>
              )}
            </div>
            <div className="form-control">
                <label className="label"><span className="label-text">Nama Supir</span></label>
                <input type="text" value={driverName} onChange={(e) => setDriverName(e.target.value)} className="input input-bordered" />
            </div>
          </div>
        </div>

        <div className="card bg-white shadow-lg p-6">
            <div className="form-control dropdown">
                <label className="label"><span className="label-text">Cari Barang</span></label>
                <div className="join w-full">
                    <input type="text" placeholder="Ketik nama barang..." className="input input-bordered join-item w-full" value={itemSearchTerm} onChange={e => {setItemSearchTerm(e.target.value); setSelectedItem(null);}}/>
                    <button onClick={() => setShowScanner(true)} className="btn btn-primary join-item">Scan</button>
                </div>
                {filteredItems.length > 0 && !selectedItem && (
                    <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                        {filteredItems.slice(0,10).map(item => <li key={item.id}><a onClick={() => {setSelectedItem(item); setItemSearchTerm(item.name)}}>{item.name}</a></li>)}
                    </ul>
                )}
            </div>
            {selectedItem && (
                <div className="mt-4 p-4 border rounded-md bg-base-200">
                    <p className="font-bold">Barang Terpilih: <span className="text-secondary">{selectedItem.name}</span></p>
                    <div className="flex items-end gap-4 flex-wrap mt-2">
                        <div className="form-control"><label className="label-text">DOS</label><input type="number" value={dosQty} onChange={(e) => setDosQty(e.target.valueAsNumber || 0)} className="input input-bordered input-sm" /></div>
                        <div className="form-control"><label className="label-text">PACK</label><input type="number" value={packQty} onChange={(e) => setPackQty(e.target.valueAsNumber || 0)} className="input input-bordered input-sm" /></div>
                        <div className="form-control"><label className="label-text">PCS</label><input type="number" value={pcsQty} onChange={(e) => setPcsQty(e.target.valueAsNumber || 0)} className="input input-bordered input-sm" /></div>
                        <button type="button" onClick={handleAddItem} className="btn btn-secondary btn-sm">Tambah</button>
                    </div>
                </div>
            )}
        </div>
        
        <div className="mt-6">
            <h3 className="text-xl font-bold mb-2">Daftar Barang Keluar</h3>
            <div className="overflow-x-auto bg-white rounded-lg shadow">
              <table className="table w-full">
                <thead><tr><th>Nama Barang</th><th>Jumlah</th><th>Aksi</th></tr></thead>
                <tbody>
                  {transactionItems.map((item, index) => (
                    <tr key={index}><td>{item.name}</td><td>{item.displayQty}</td>
                      <td><button onClick={() => handleRemoveItem(index)} className="btn btn-xs btn-error">Hapus</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>

        <div className="mt-6 flex justify-end">
            <button onClick={handleSaveTransaction} className="btn btn-success btn-lg" disabled={isSubmitting || transactionItems.length === 0}>
                {isSubmitting ? <span className="loading loading-spinner"></span> : "Simpan & Potong Stok"}
            </button>
        </div>

      </div>
    </>
  );
}

export default StokKeluar;
