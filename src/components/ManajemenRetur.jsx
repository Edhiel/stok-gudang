import React, { useState, useEffect } from 'react';
import { ref, onValue, get, update, push, serverTimestamp, runTransaction } from 'firebase/database';
import { db } from '../firebaseConfig';
import CameraBarcodeScanner from './CameraBarcodeScanner';

// --- KOMPONEN INTERNAL UNTUK TAB 1: RETUR BAIK ---
const TabReturBaik = ({ userProfile }) => {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  const [storeName, setStoreName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [transactionItems, setTransactionItems] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!userProfile.depotId) return;
    const masterItemsRef = ref(db, 'master_items');
    const unsubscribe = onValue(masterItemsRef, (snapshot) => {
      const data = snapshot.val();
      const itemList = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
      setItems(itemList);
    });
    return () => unsubscribe();
  }, [userProfile.depotId]);

  const handleBarcodeDetected = (scannedBarcode) => {
    const foundItem = items.find(item => item.barcodePcs === scannedBarcode || item.barcodeDos === scannedBarcode);
    if (foundItem) handleSelectItem(foundItem); else alert("Barang tidak ditemukan di master.");
    setShowScanner(false);
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setSearchTerm(item.name);
  };
  
  const handleAddItemToList = () => {
    if (!selectedItem) { alert("Pilih barang dulu."); return; }
    const totalPcs = (Number(dosQty) * (selectedItem.conversions.Dos?.inPcs || 1)) + (Number(packQty) * (selectedItem.conversions.Pack?.inPcs || 1)) + (Number(pcsQty));
    if (totalPcs <= 0) { alert("Masukkan jumlah yang valid."); return; }
    setTransactionItems([...transactionItems, { id: selectedItem.id, name: selectedItem.name, quantityInPcs: totalPcs, displayQty: `${dosQty}.${packQty}.${pcsQty}` }]);
    setSelectedItem(null); setSearchTerm(''); setDosQty(0); setPackQty(0); setPcsQty(0);
  };
  
  const handleRemoveFromList = (indexToRemove) => {
    setTransactionItems(transactionItems.filter((_, index) => index !== indexToRemove));
  };

  const handleSaveTransaction = async () => {
    if (transactionItems.length === 0 || !storeName) { setError("Nama Toko dan minimal 1 barang wajib diisi."); return; }
    setError(''); setSuccess('');
    try {
      for (const transItem of transactionItems) {
        const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${transItem.id}`);
        await runTransaction(stockRef, (currentStock) => {
          if(!currentStock) return { totalStockInPcs: transItem.quantityInPcs, damagedStockInPcs: 0 };
          currentStock.totalStockInPcs = (currentStock.totalStockInPcs || 0) + transItem.quantityInPcs;
          return currentStock;
        });
      }
      const transactionsRef = ref(db, `depots/${userProfile.depotId}/transactions`);
      await push(transactionsRef, { type: 'Retur Baik', fromStore: storeName, invoiceNumber: invoiceNumber, items: transactionItems, user: userProfile.fullName, timestamp: serverTimestamp() });
      setSuccess("Transaksi Retur Baik berhasil disimpan. Stok telah ditambahkan.");
      setTransactionItems([]); setStoreName(''); setInvoiceNumber('');
    } catch(err) { setError("Gagal menyimpan transaksi."); console.error(err); }
  };

  return (
    <>
      {showScanner && <CameraBarcodeScanner onDetected={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
      <div className="p-4 space-y-4">
        {success && <div role="alert" className="alert alert-success"><span>{success}</span></div>}
        {error && <div role="alert" className="alert alert-error"><span>{error}</span></div>}
        <div className="p-4 border rounded-lg bg-base-200 space-y-4">
          <h4 className="font-bold">Informasi Retur</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="form-control"><label className="label"><span className="label-text font-bold">No. Faktur Asal</span></label><input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="No. Faktur penjualan" className="input input-bordered" /></div><div className="form-control"><label className="label"><span className="label-text font-bold">Nama Toko Asal</span></label><input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Toko yang mengembalikan barang" className="input input-bordered" /></div></div>
        </div>
        <div className="divider">Tambah Barang ke Daftar Retur</div>
        <div className="p-4 border rounded-lg bg-base-200 space-y-4">
          <div className="form-control"><label className="label"><span className="label-text">Scan atau Cari Barang</span></label><div className="join w-full"><input type="text" placeholder="Ketik nama barang..." className="input input-bordered join-item w-full" value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setSelectedItem(null);}}/><button type="button" onClick={() => setShowScanner(true)} className="btn btn-primary join-item">Scan</button></div></div>
          {searchTerm.length > 0 && !selectedItem && (<ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">{items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (<li key={item.id}><a onClick={() => handleSelectItem(item)}>{item.name}</a></li>))}</ul>)}
          {selectedItem && (<div className="mt-2"><p className="font-bold">Barang Terpilih: <span className="text-secondary">{selectedItem.name}</span></p><div className="divider">Masukkan Jumlah Retur</div><div className="flex items-end gap-4 flex-wrap"><div className="form-control"><label className="label-text">DOS</label><input type="number" value={dosQty} onChange={(e) => setDosQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div><div className="form-control"><label className="label-text">PACK</label><input type="number" value={packQty} onChange={(e) => setPackQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div><div className="form-control"><label className="label-text">PCS</label><input type="number" value={pcsQty} onChange={(e) => setPcsQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div><button type="button" onClick={handleAddItemToList} className="btn btn-secondary">Tambah ke Daftar</button></div></div>)}
        </div>
        <div className="divider">Daftar Barang dalam Retur Ini</div>
        <div className="overflow-x-auto"><table className="table w-full"><thead><tr><th>Nama Barang</th><th>Jumlah Retur</th><th>Aksi</th></tr></thead><tbody>{transactionItems.map((item, index) => (<tr key={index}><td>{item.name}</td><td>{item.displayQty}</td><td><button onClick={() => handleRemoveFromList(index)} className="btn btn-xs btn-error">Hapus</button></td></tr>))}</tbody></table></div>
        <div className="mt-6 flex justify-end"><button onClick={handleSaveTransaction} className="btn btn-success btn-lg">Simpan Seluruh Retur Baik</button></div>
      </div>
    </>
  );
};
// --- KOMPONEN TAB 2: RETUR RUSAK ---
const TabReturRusak = ({ userProfile }) => {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  const [returnOrigin, setReturnOrigin] = useState('toko');
  const [storeName, setStoreName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [transactionItems, setTransactionItems] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!userProfile.depotId) return;
    const masterItemsRef = ref(db, 'master_items');
    onValue(masterItemsRef, (snapshot) => {
      const data = snapshot.val();
      const itemList = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
      setItems(itemList);
    });
  }, [userProfile.depotId]);
  
  const handleBarcodeDetected = (scannedBarcode) => {
    const foundItem = items.find(item => item.barcodePcs === scannedBarcode || item.barcodeDos === scannedBarcode);
    if (foundItem) handleSelectItem(foundItem); else alert("Barang tidak ditemukan.");
    setShowScanner(false);
  };
  
  const handleSelectItem = async (item) => {
    const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${item.id}`);
    const snapshot = await get(stockRef);
    if(snapshot.exists()) {
        item.totalStockInPcs = snapshot.val().totalStockInPcs || 0;
        item.damagedStockInPcs = snapshot.val().damagedStockInPcs || 0;
    } else {
        item.totalStockInPcs = 0;
        item.damagedStockInPcs = 0;
    }
    setSelectedItem(item);
    setSearchTerm(item.name);
  };
  
  const handleAddItemToList = () => {
    if (!selectedItem) { alert("Pilih barang dulu."); return; }
    const totalPcs = (Number(dosQty) * (selectedItem.conversions.Dos?.inPcs || 1)) + (Number(packQty) * (selectedItem.conversions.Pack?.inPcs || 1)) + (Number(pcsQty));
    if (totalPcs <= 0) { alert("Masukkan jumlah yang valid."); return; }
    if (returnOrigin === 'gudang' && totalPcs > (selectedItem.totalStockInPcs || 0) ) {
        alert(`Stok baik tidak cukup! Sisa stok ${selectedItem.name} hanya ${selectedItem.totalStockInPcs || 0} Pcs.`);
        return;
    }
    setTransactionItems([...transactionItems, { id: selectedItem.id, name: selectedItem.name, quantityInPcs: totalPcs, displayQty: `${dosQty}.${packQty}.${pcsQty}` }]);
    setSelectedItem(null); setSearchTerm(''); setDosQty(0); setPackQty(0); setPcsQty(0);
  };

  const handleRemoveFromList = (indexToRemove) => {
    setTransactionItems(transactionItems.filter((_, index) => index !== indexToRemove));
  };
  
  const handleSaveTransaction = async () => {
    if (transactionItems.length === 0) { setError("Minimal 1 barang wajib diisi."); return; }
    if (returnOrigin === 'toko' && !storeName) { setError("Nama Toko wajib diisi untuk retur dari toko."); return; }
    setError(''); setSuccess('');
    try {
      for (const transItem of transactionItems) {
        const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${transItem.id}`);
        await runTransaction(stockRef, (currentStock) => {
          if (!currentStock) {
            currentStock = { totalStockInPcs: 0, damagedStockInPcs: 0 };
          }
          currentStock.damagedStockInPcs = (currentStock.damagedStockInPcs || 0) + transItem.quantityInPcs;
          if (returnOrigin === 'gudang') {
            if ((currentStock.totalStockInPcs || 0) < transItem.quantityInPcs) { throw new Error(`Stok ${transItem.name} tidak cukup.`); }
            currentStock.totalStockInPcs -= transItem.quantityInPcs;
          }
          return currentStock;
        });
      }
      const transactionsRef = ref(db, `depots/${userProfile.depotId}/transactions`);
      await push(transactionsRef, { type: 'Retur Rusak', origin: returnOrigin, fromStore: storeName, invoiceNumber: invoiceNumber, description: description, items: transactionItems, user: userProfile.fullName, timestamp: serverTimestamp() });
      setSuccess("Transaksi Retur Rusak berhasil disimpan.");
      setTransactionItems([]); setDescription(''); setReturnOrigin('toko'); setStoreName(''); setInvoiceNumber('');
    } catch(err) { setError(`Gagal menyimpan: ${err.message}`); console.error(err); }
  };

  return (
    <>
      {showScanner && <CameraBarcodeScanner onDetected={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
      <div className="p-4 space-y-4">
        {success && <div role="alert" className="alert alert-success"><span>{success}</span></div>}
        {error && <div role="alert" className="alert alert-error"><span>{error}</span></div>}
        <div className="p-4 border rounded-lg bg-base-200 space-y-4">
          <h4 className="font-bold">Informasi Retur Rusak</h4>
          <div className="form-control"><label className="label"><span className="label-text font-bold">Asal Retur</span></label><select value={returnOrigin} onChange={(e) => setReturnOrigin(e.target.value)} className="select select-bordered"><option value="toko">Retur dari Toko</option><option value="gudang">Retur dari Gudang</option></select></div>
          {returnOrigin === 'toko' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control"><label className="label"><span className="label-text font-bold">Nama Toko</span></label><input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Toko yang mengembalikan barang" className="input input-bordered" /></div>
              <div className="form-control"><label className="label"><span className="label-text">No. Faktur Asal</span></label><input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="No. Faktur terkait" className="input input-bordered" /></div>
            </div>
          )}
          <div className="form-control"><label className="label"><span className="label-text">Keterangan Kerusakan</span></label><textarea value={description} onChange={(e) => setDescription(e.target.value)} className="textarea textarea-bordered" placeholder="Contoh: Kemasan sobek..."></textarea></div>
        </div>
        <div className="divider">Tambah Barang Rusak ke Daftar</div>
        <div className="p-4 border rounded-lg bg-base-200 space-y-4">
          <div className="form-control"><label className="label"><span className="label-text">Scan atau Cari Barang</span></label><div className="join w-full"><input type="text" placeholder="Ketik nama barang..." className="input input-bordered join-item w-full" value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setSelectedItem(null);}}/><button type="button" onClick={() => setShowScanner(true)} className="btn btn-primary join-item">Scan</button></div></div>
          {searchTerm.length > 0 && !selectedItem && (<ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">{items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (<li key={item.id}><a onClick={() => handleSelectItem(item)}>{item.name}</a></li>))}</ul>)}
          {selectedItem && (<div className="mt-2"><p className="font-bold">Barang Terpilih: <span className="text-secondary">{selectedItem.name}</span></p><p className="text-sm">Stok Baik: {selectedItem.totalStockInPcs || 0}, Stok Rusak: {selectedItem.damagedStockInPcs || 0}</p><div className="divider">Masukkan Jumlah Retur Rusak</div><div className="flex items-end gap-4 flex-wrap"><div className="form-control"><label className="label-text">DOS</label><input type="number" value={dosQty} onChange={(e) => setDosQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div><div className="form-control"><label className="label-text">PACK</label><input type="number" value={packQty} onChange={(e) => setPackQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div><div className="form-control"><label className="label-text">PCS</label><input type="number" value={pcsQty} onChange={(e) => setPcsQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div><button type="button" onClick={handleAddItemToList} className="btn btn-secondary">Tambah ke Daftar</button></div></div>)}
        </div>
        <div className="divider">Daftar Barang Rusak dalam Transaksi Ini</div>
        <div className="overflow-x-auto"><table className="table w-full"><thead><tr><th>Nama Barang</th><th>Jumlah Rusak</th><th>Aksi</th></tr></thead><tbody>{transactionItems.map((item, index) => (<tr key={index}><td>{item.name}</td><td>{item.displayQty}</td><td><button onClick={() => handleRemoveFromList(index)} className="btn btn-xs btn-error">Hapus</button></td></tr>))}</tbody></table></div>
        <div className="mt-6 flex justify-end"><button onClick={handleSaveTransaction} className="btn btn-warning btn-lg">Simpan Seluruh Retur Rusak</button></div>
      </div>
    </>
  );
};
// --- KOMPONEN TAB 3: REKAP & PENGIRIMAN ---
const TabKirimPusat = ({ userProfile }) => {
  const [damagedItems, setDamagedItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSupplier, setFilterSupplier] = useState('semua');
  const [filterPeriod, setFilterPeriod] = useState('kustom');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [selectedForShipment, setSelectedForShipment] = useState({});
  const [showProcessForm, setShowProcessForm] = useState(false);
  const [processAction, setProcessAction] = useState('kirim');
  const [documentNumber, setDocumentNumber] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!userProfile.depotId) return;
    
    const masterItemsRef = ref(db, 'master_items');
    get(masterItemsRef).then((masterSnapshot) => {
        const masterItems = masterSnapshot.val() || {};
        const stockRef = ref(db, `depots/${userProfile.depotId}/stock`);
        onValue(stockRef, (stockSnapshot) => {
            const stockData = stockSnapshot.val() || {};
            const damagedOnly = Object.keys(stockData)
                .filter(itemId => (stockData[itemId].damagedStockInPcs || 0) > 0)
                .map(itemId => ({
                    id: itemId,
                    ...(masterItems[itemId] || {}),
                    damagedStockInPcs: stockData[itemId].damagedStockInPcs
                }));
            setDamagedItems(damagedOnly);
            setFilteredItems(damagedOnly);
            setLoading(false);
        });
    });

    const suppliersRef = ref(db, 'suppliers/');
    onValue(suppliersRef, (snapshot) => {
      const data = snapshot.val();
      const supplierList = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
      setSuppliers(supplierList);
    });
  }, [userProfile.depotId]);

  const handlePeriodChange = (period) => {
    setFilterPeriod(period);
    if (period === 'kustom') return;

    const end = new Date();
    const start = new Date();
    switch(period) {
        case 'hariIni': break;
        case 'mingguLalu': start.setDate(start.getDate() - 7); break;
        case 'bulanIni': start.setDate(1); break;
        case 'bulanLalu':
            start.setMonth(start.getMonth() - 1);
            start.setDate(1);
            end.setDate(0);
            break;
        default: break;
    }
    const formatDate = (date) => date.toISOString().split('T')[0];
    setFilterStartDate(formatDate(start));
    setFilterEndDate(formatDate(end));
  };
  
  const handleApplyFilter = () => { /* ... Logika filter ... */ };
  const handleSelectItem = (itemId) => { /* ... Logika tidak berubah ... */ };
  const handleProcessSelected = () => { /* ... Logika tidak berubah ... */ };
  const handleSaveFinalAction = async () => { /* ... Logika tidak berubah ... */ };
  const formatToDPP = (totalPcs, conversions) => { /* ... Logika tidak berubah ... */ };

  return (
    <div className="p-4 space-y-4 printable-area">
      <h3 className="text-xl font-semibold">Rekapitulasi Stok Rusak</h3>
      <div className="p-4 border rounded-lg bg-base-200 mb-4 space-y-4 print:hidden">
        <div className="flex flex-wrap gap-4 items-end">
            <div className="form-control"><label className="label"><span className="label-text">Filter per Supplier</span></label><select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} className="select select-bordered w-full max-w-xs"><option value="semua">Semua Supplier</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div className="form-control"><label className="label"><span className="label-text">Periode Cepat</span></label><select value={filterPeriod} onChange={(e) => handlePeriodChange(e.target.value)} className="select select-bordered w-full max-w-xs"><option value="kustom">Rentang Kustom</option><option value="hariIni">Hari Ini</option><option value="mingguLalu">7 Hari Terakhir</option><option value="bulanIni">Bulan Ini</option><option value="bulanLalu">Bulan Lalu</option></select></div>
            <div className="form-control"><label className="label"><span className="label-text">Dari Tanggal</span></label><input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="input input-bordered" disabled={filterPeriod !== 'kustom'} /></div>
            <div className="form-control"><label className="label"><span className="label-text">Sampai Tanggal</span></label><input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="input input-bordered" disabled={filterPeriod !== 'kustom'} /></div>
            <button onClick={handleApplyFilter} className="btn btn-accent">Terapkan</button>
        </div>
      </div>
      <div className="divider">Daftar Barang Sesuai Filter</div>
      <div className="overflow-x-auto">
        <table className="table w-full">
            <thead className='bg-gray-200'><tr><th><input type="checkbox" className="checkbox print:hidden" /></th><th>Nama Barang</th><th>Jumlah Rusak</th><th>Supplier</th></tr></thead>
            <tbody>
                {loading ? (<tr><td colSpan="4" className="text-center"><span className="loading loading-dots"></span></td></tr>) : 
                 (filteredItems.map(item => ( <tr key={item.id}><th><label><input type="checkbox" checked={!!selectedForShipment[item.id]} onChange={() => handleSelectItem(item.id)} className="checkbox print:hidden" /></label></th><td>{item.name}</td><td>{formatToDPP(item.damagedStockInPcs, item.conversions)}</td><td>{item.supplierName}</td></tr> )))}
            </tbody>
        </table>
      </div>
      <div className="mt-6 flex justify-end gap-4 print:hidden">
          <button className="btn btn-info" onClick={() => window.print()}>Cetak List</button>
          <button onClick={handleProcessSelected} className="btn btn-secondary">Proses Barang Terpilih</button>
      </div>
      {showProcessForm && (<div className="print:hidden"><div className="divider">Proses Tindak Lanjut</div><div className="p-4 border rounded-lg bg-base-200 mt-4"><h4 className="font-bold">Tindak Lanjut untuk Barang Terpilih</h4><div className="form-control mt-4"><label className="label"><span className="label-text">Pilih Aksi Final</span></label><select value={processAction} onChange={(e) => setProcessAction(e.target.value)} className="select select-bordered"><option value="kirim">Kirim ke Pusat</option><option value="musnahkan">Musnahkan</option></select></div><div className="form-control mt-2"><label className="label"><span className="label-text">No. Dokumen</span></label><input type="text" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="No. Surat Jalan / Berita Acara" className="input input-bordered" /></div><div className="mt-4 flex gap-2"><button onClick={handleSaveFinalAction} className="btn btn-success">Simpan Aksi</button><button onClick={() => setShowProcessForm(false)} className="btn btn-ghost">Batal</button></div></div></div>)}
    </div>
  );
};


// --- KOMPONEN UTAMA MANAJEMEN RETUR ---
function ManajemenRetur({ userProfile }) {
  const [activeTab, setActiveTab] = useState('returBaik');

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6 print:hidden">Manajemen Retur</h1>
      <div role="tablist" className="tabs tabs-lifted print:hidden">
        <a role="tab" className={`tab ${activeTab === 'returBaik' ? 'tab-active' : ''}`} onClick={() => setActiveTab('returBaik')}>Retur Baik</a>
        <a role="tab" className={`tab ${activeTab === 'returRusak' ? 'tab-active' : ''}`} onClick={() => setActiveTab('returRusak')}>Retur Rusak</a>
        <a role="tab" className={`tab ${activeTab === 'kirimPusat' ? 'tab-active' : ''}`} onClick={() => setActiveTab('kirimPusat')}>Rekap & Pengiriman</a>
      </div>

      <div className="bg-white p-6 rounded-b-lg rounded-tr-lg shadow-lg min-h-96">
        {activeTab === 'returBaik' && <TabReturBaik userProfile={userProfile} />}
        {activeTab === 'returRusak' && <TabReturRusak userProfile={userProfile} />}
        {activeTab === 'kirimPusat' && <TabKirimPusat userProfile={userProfile} />}
      </div>
    </div>
  );
}
export default ManajemenRetur;