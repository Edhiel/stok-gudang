import React, { useState, useEffect } from 'react';
import { ref, onValue, get, runTransaction, push, serverTimestamp } from 'firebase/database';
import { db } from '../firebaseConfig';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import toast from 'react-hot-toast';

function StokKeluar({ userProfile }) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [storeName, setStoreName] = useState('');
  const [driverName, setDriverName] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [availableItems, setAvailableItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemStock, setItemStock] = useState(0);
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  const [transactionItems, setTransactionItems] = useState([]);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!userProfile.depotId) return;
    const masterItemsRef = ref(db, 'master_items');
    get(masterItemsRef).then((masterSnapshot) => {
      const masterItems = masterSnapshot.val() || {};
      const stockRef = ref(db, `depots/${userProfile.depotId}/stock`);
      onValue(stockRef, (stockSnapshot) => {
        const stockData = stockSnapshot.val() || {};
        const available = Object.keys(stockData)
          .filter(itemId => (stockData[itemId].totalStockInPcs || 0) > 0)
          .map(itemId => ({ id: itemId, ...masterItems[itemId], totalStockInPcs: stockData[itemId].totalStockInPcs }));
        setAvailableItems(available);
      });
    });
  }, [userProfile.depotId]);

  const handleBarcodeDetected = (scannedBarcode) => {
    const foundItem = availableItems.find(item => item.barcodePcs === scannedBarcode || item.barcodeDos === scannedBarcode);
    if (foundItem) {
      handleSelectItem(foundItem);
    } else {
      toast.error("Barang tidak ditemukan atau stok kosong.");
    }
    setShowScanner(false);
  };

  const handleSelectItem = async (item) => {
    setSelectedItem(item);
    setSearchTerm(item.name);
    const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${item.id}/totalStockInPcs`);
    const snapshot = await get(stockRef);
    setItemStock(snapshot.exists() ? snapshot.val() : 0);
  };
  
  const handleAddItemToList = () => {
    if (!selectedItem) { toast.error("Pilih barang dulu."); return; }
    const totalPcs = (Number(dosQty) * (selectedItem.conversions.Dos?.inPcs || 1)) + (Number(packQty) * (selectedItem.conversions.Pack?.inPcs || 1)) + (Number(pcsQty));
    if (totalPcs <= 0) { toast.error("Masukkan jumlah yang valid."); return; }
    if (totalPcs > itemStock) {
        toast.error(`Stok tidak cukup! Sisa stok hanya ${itemStock} Pcs.`);
        return;
    }
    setTransactionItems([...transactionItems, { id: selectedItem.id, name: selectedItem.name, quantityInPcs: totalPcs, displayQty: `${dosQty}.${packQty}.${pcsQty}` }]);
    setSelectedItem(null); setSearchTerm(''); setDosQty(0); setPackQty(0); setPcsQty(0);
  };

  const handleRemoveFromList = (indexToRemove) => {
    setTransactionItems(transactionItems.filter((_, index) => index !== indexToRemove));
  };
  
  const handleSaveTransaction = async () => {
    if (!invoiceNumber || !storeName || transactionItems.length === 0) {
      toast.error("No. Faktur, Nama Toko, dan minimal 1 barang wajib diisi.");
      return;
    }
    try {
      for (const transItem of transactionItems) {
        const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${transItem.id}`);
        await runTransaction(stockRef, (currentStock) => {
          if (currentStock) {
            const currentTotal = currentStock.totalStockInPcs || 0;
            if (currentTotal < transItem.quantityInPcs) { throw new Error(`Stok untuk ${transItem.name} tidak cukup.`); }
            currentStock.totalStockInPcs = currentTotal - transItem.quantityInPcs;
          }
          return currentStock;
        });
      }
      const transactionsRef = ref(db, `depots/${userProfile.depotId}/transactions`);
      await push(transactionsRef, {
        type: 'Stok Keluar', invoiceNumber, storeName, driverName,
        licensePlate, items: transactionItems, user: userProfile.fullName, timestamp: serverTimestamp()
      });
      toast.success("Transaksi stok keluar berhasil disimpan!");
      setInvoiceNumber(''); setStoreName(''); setDriverName(''); setLicensePlate('');
      setTransactionItems([]);
    } catch (err) {
      toast.error(`Gagal menyimpan transaksi: ${err.message}`);
      console.error(err);
    }
  };

  const filteredItems = searchTerm.length > 0 
    ? availableItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
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
              <div className="form-control">
                <label className="label"><span className="label-text font-bold">Nama Toko Tujuan</span></label>
                <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} className="input input-bordered" />
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
                  <input type="text" placeholder="Hanya barang dari supplier teralokasi akan muncul" className="input input-bordered join-item w-full" value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setSelectedItem(null);}}/>
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
                        <button type="button" onClick={handleAddItemToList} className="btn btn-secondary">Tambah ke Daftar</button>
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
                    <tr key={index}><td>{item.name}</td><td>{item.displayQty}</td><td><button onClick={() => handleRemoveFromList(index)} className="btn btn-xs btn-error">Hapus</button></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-control mt-6">
              <button type="button" onClick={handleSaveTransaction} className="btn btn-primary btn-lg" disabled={transactionItems.length === 0}>Simpan Seluruh Transaksi</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
export default StokKeluar;