import React, { useState, useEffect } from 'react';
import { ref, onValue, get, update, push, serverTimestamp, runTransaction } from 'firebase/database';
import { db } from '../firebaseConfig';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import toast from 'react-hot-toast';

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
    if (foundItem) handleSelectItem(foundItem); else toast.error("Barang tidak ditemukan di master.");
    setShowScanner(false);
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setSearchTerm(item.name);
  };
  
  const handleAddItemToList = () => {
    if (!selectedItem) { toast.error("Pilih barang dulu."); return; }
    const totalPcs = (Number(dosQty) * (selectedItem.conversions.Dos?.inPcs || 1)) + (Number(packQty) * (selectedItem.conversions.Pack?.inPcs || 1)) + (Number(pcsQty));
    if (totalPcs <= 0) { toast.error("Masukkan jumlah yang valid."); return; }
    setTransactionItems([...transactionItems, { id: selectedItem.id, name: selectedItem.name, quantityInPcs: totalPcs, displayQty: `${dosQty}.${packQty}.${pcsQty}` }]);
    setSelectedItem(null); setSearchTerm(''); setDosQty(0); setPackQty(0); setPcsQty(0);
  };
  
  const handleRemoveFromList = (indexToRemove) => {
    setTransactionItems(transactionItems.filter((_, index) => index !== indexToRemove));
  };

  const handleSaveTransaction = async () => {
    if (transactionItems.length === 0 || !storeName) { toast.error("Nama Toko dan minimal 1 barang wajib diisi."); return; }
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
      toast.success("Transaksi Retur Baik berhasil disimpan.");
      setTransactionItems([]); setStoreName(''); setInvoiceNumber('');
    } catch(err) { toast.error("Gagal menyimpan transaksi."); console.error(err); }
  };

  return (
    <>
      {showScanner && <CameraBarcodeScanner onScan={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
      <div className="p-4 space-y-4">
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
    if (foundItem) handleSelectItem(foundItem); else toast.error("Barang tidak ditemukan.");
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
    if (!selectedItem) { toast.error("Pilih barang dulu."); return; }
    const totalPcs = (Number(dosQty) * (selectedItem.conversions.Dos?.inPcs || 1)) + (Number(packQty) * (selectedItem.conversions.Pack?.inPcs || 1)) + (Number(pcsQty));
    if (totalPcs <= 0) { toast.error("Masukkan jumlah yang valid."); return; }
    if (returnOrigin === 'gudang' && totalPcs > (selectedItem.totalStockInPcs || 0) ) {
        toast.error(`Stok baik tidak cukup! Sisa stok hanya ${selectedItem.totalStockInPcs || 0} Pcs.`);
        return;
    }
    setTransactionItems([...transactionItems, { id: selectedItem.id, name: selectedItem.name, quantityInPcs: totalPcs, displayQty: `${dosQty}.${packQty}.${pcsQty}` }]);
    setSelectedItem(null); setSearchTerm(''); setDosQty(0); setPackQty(0); setPcsQty(0);
  };

  const handleRemoveFromList = (indexToRemove) => {
    setTransactionItems(transactionItems.filter((_, index) => index !== indexToRemove));
  };
  
  const handleSaveTransaction = async () => {
    if (transactionItems.length === 0) { toast.error("Minimal 1 barang wajib diisi."); return; }
    if (returnOrigin === 'toko' && !storeName) { toast.error("Nama Toko wajib diisi untuk retur dari toko."); return; }
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
      toast.success("Transaksi Retur Rusak berhasil disimpan.");
      setTransactionItems([]); setDescription(''); setReturnOrigin('toko'); setStoreName(''); setInvoiceNumber('');
    } catch(err) { toast.error(`Gagal menyimpan: ${err.message}`); console.error(err); }
  };

  return (
    <>
      {showScanner && <CameraBarcodeScanner onScan={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
      <div className="p-4 space-y-4">
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
const TabKirimPusat = ({ userProfile }) => {
  const [damagedItems, setDamagedItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSupplier, setFilterSupplier] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedForShipment, setSelectedForShipment] = useState({});
  const [showProcessForm, setShowProcessForm] = useState(false);
  const [processAction, setProcessAction] = useState('kirim');
  const [documentNumber, setDocumentNumber] = useState('');
  
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
                .map(itemId => ({ id: itemId, ...(masterItems[itemId] || {}), damagedStockInPcs: stockData[itemId].damagedStockInPcs }));
            setDamagedItems(damagedOnly);
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
  
  useEffect(() => {
    let items = [...damagedItems];
    if (filterSupplier) {
      items = items.filter(item => item.supplierId === filterSupplier);
    }
    if (searchTerm) {
      items = items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    setFilteredItems(items);
  }, [searchTerm, filterSupplier, damagedItems]);

  const handleSelectItem = (itemId) => {
    setSelectedForShipment(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };
  
  const handleProcessSelected = () => {
    const selectedIds = Object.keys(selectedForShipment).filter(key => selectedForShipment[key]);
    if (selectedIds.length === 0) {
        toast.error("Pilih setidaknya satu barang untuk diproses.");
        return;
    }
    setShowProcessForm(true);
  };
  
  const handleSaveFinalAction = async () => {
    if (!documentNumber) {
        toast.error("Nomor Dokumen wajib diisi.");
        return;
    }
    const selectedIds = Object.keys(selectedForShipment).filter(key => selectedForShipment[key]);
    const itemsToAction = damagedItems.filter(item => selectedIds.includes(item.id));
    const actionType = processAction === 'kirim' ? 'Pengiriman BS ke Pusat' : 'Pemusnahan BS';
    try {
        const updates = {};
        const transactionItems = [];
        for (const item of itemsToAction) {
            updates[`/depots/${userProfile.depotId}/stock/${item.id}/damagedStockInPcs`] = 0;
            transactionItems.push({
                id: item.id, name: item.name,
                quantityInPcs: item.damagedStockInPcs,
                displayQty: formatToDPP(item.damagedStockInPcs, item.conversions),
            });
        }
        const transactionsRef = ref(db, `depots/${userProfile.depotId}/transactions`);
        const newTransactionKey = push(transactionsRef).key;
        updates[`/depots/${userProfile.depotId}/transactions/${newTransactionKey}`] = {
            type: actionType, documentNumber: documentNumber, items: transactionItems,
            user: userProfile.fullName, timestamp: serverTimestamp()
        };
        await update(ref(db), updates);
        toast.success(`Aksi '${actionType}' berhasil disimpan.`);
        setShowProcessForm(false);
        setSelectedForShipment({});
        setDocumentNumber('');
    } catch (err) {
        toast.error("Gagal menyimpan aksi final.");
        console.error(err);
    }
  };
  
  const formatToDPP = (totalPcs, conversions) => {
    if (!totalPcs || !conversions) return '0.0.0';
    const dosInPcs = conversions.Dos?.inPcs || (conversions.Pack?.inPcs || 1);
    const packInPcs = conversions.Pack?.inPcs || 1;
    return `${Math.floor(totalPcs / dosInPcs)}.${Math.floor((totalPcs % dosInPcs) / packInPcs)}.${totalPcs % packInPcs}`;
  };

  return (
    <div className="p-4 space-y-4 printable-area">
      
      {/* --- KOP SURAT DINAMIS (HANYA MUNCUL SAAT PRINT) --- */}
      <div className="hidden print:block mb-4">
        <div className="flex items-center justify-center mb-4 border-b-2 border-black pb-2">
            <img src="/logo_bulet_mhm.gif" alt="Logo Perusahaan" className="h-20 w-20 mr-4" />
            <div>
                <h1 className="text-2xl font-bold">PT. Mahameru Mitra Makmur</h1>
                <p className="text-center">Depo: {userProfile.depotId}</p>
            </div>
        </div>
        {processAction === 'kirim' ? (
            <h2 className="text-xl font-semibold mt-4 text-center">SURAT JALAN PENGIRIMAN BARANG RUSAK (BS)</h2>
        ) : (
            <h2 className="text-xl font-semibold mt-4 text-center">BERITA ACARA PEMUSNAHAN BARANG RUSAK (BS)</h2>
        )}
        <div className="flex justify-between text-sm my-4">
            <div><p><strong>No. Dokumen:</strong> {documentNumber || '(Mohon isi di form)'}</p></div>
            <div><p><strong>Tanggal:</strong> {new Date().toLocaleDateString('id-ID')}</p></div>
        </div>
      </div>

      <h3 className="text-xl font-semibold print:hidden">Rekapitulasi Stok Rusak</h3>
      <div className="p-4 border rounded-lg bg-base-200 mb-4 space-y-4 print:hidden">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="form-control">
              <label className="label"><span className="label-text">Cari Nama Barang</span></label>
              <input type="text" placeholder="Ketik untuk mencari..." className="input input-bordered w-full max-w-xs" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="form-control">
              <label className="label"><span className="label-text">Filter per Supplier</span></label>
              <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} className="select select-bordered w-full max-w-xs">
                  <option value="">Semua Supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
          </div>
        </div>
      </div>
      <div className="divider">Daftar Barang Sesuai Filter</div>
      <div className="overflow-x-auto">
        <table className="table w-full">
            <thead className='bg-gray-200'><tr><th><input type="checkbox" className="checkbox print:hidden" onChange={(e) => setSelectedForShipment(filteredItems.reduce((acc, item) => ({...acc, [item.id]: e.target.checked}), {}))} /></th><th>Nama Barang</th><th>Jumlah Rusak</th><th>Supplier</th></tr></thead>
            <tbody>
                {loading ? (<tr><td colSpan="4" className="text-center"><span className="loading loading-dots"></span></td></tr>) : 
                 filteredItems.length === 0 ? (<tr><td colSpan="4" className="text-center">Tidak ada stok rusak.</td></tr>) :
                 (filteredItems.map(item => ( <tr key={item.id}><th><label><input type="checkbox" checked={!!selectedForShipment[item.id]} onChange={() => handleSelectItem(item.id)} className="checkbox print:hidden" /></label></th><td>{item.name}</td><td>{formatToDPP(item.damagedStockInPcs, item.conversions)}</td><td>{item.supplierName}</td></tr> )))}
            </tbody>
        </table>
      </div>

      {/* --- BLOK TANDA TANGAN DINAMIS (HANYA MUNCUL SAAT PRINT) --- */}
      <div className="hidden print:block flex justify-around mt-16 pt-8 text-center text-sm">
        <div>
            <p className="mb-16">(______________________)</p>
            <p>Kepala Depo</p>
        </div>
        <div>
            <p className="mb-16">(______________________)</p>
            <p>Kepala Gudang</p>
        </div>
        <div>
            <p className="mb-16">(______________________)</p>
            {processAction === 'kirim' ? <p>Penerima (Pusat)</p> : <p>Saksi</p>}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-4 print:hidden">
          <button className="btn btn-info" onClick={() => window.print()}>Cetak List</button>
          <button onClick={handleProcessSelected} className="btn btn-secondary">Proses Barang Terpilih</button>
      </div>
      {showProcessForm && (<div className="print:hidden"><div className="divider">Proses Tindak Lanjut</div><div className="p-4 border rounded-lg bg-base-200 mt-4"><h4 className="font-bold">Tindak Lanjut untuk Barang Terpilih</h4><div className="form-control mt-4"><label className="label"><span className="label-text">Pilih Aksi Final</span></label><select value={processAction} onChange={(e) => setProcessAction(e.target.value)} className="select select-bordered"><option value="kirim">Kirim ke Pusat</option><option value="musnahkan">Musnahkan</option></select></div><div className="form-control mt-2"><label className="label"><span className="label-text">No. Dokumen (Untuk Surat Jalan / Berita Acara)</span></label><input type="text" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="Wajib diisi sebelum mencetak..." className="input input-bordered" /></div><div className="mt-4 flex gap-2"><button onClick={handleSaveFinalAction} className="btn btn-success">Simpan Aksi</button><button onClick={() => setShowProcessForm(false)} className="btn btn-ghost">Batal</button></div></div></div>)}
    </div>
  );
};
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