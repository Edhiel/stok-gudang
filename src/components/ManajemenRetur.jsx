import React, { useState, useEffect } from 'react';
import { ref, onValue, get, update, push, serverTimestamp, runTransaction, query, orderByChild } from 'firebase/database';
import { db as firebaseDb } from '../firebaseConfig';
import { addReturnToQueue, getQueuedReturns, removeReturnFromQueue } from '../offlineDb';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import toast from 'react-hot-toast';

const TabReturBaik = ({ userProfile, locations, syncOfflineReturns, setActiveTab }) => {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  const [storeName, setStoreName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  // --- STATE BARU ---
  const [expireDate, setExpireDate] = useState('');
  const [transactionItems, setTransactionItems] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!userProfile.depotId) return;
    const masterItemsRef = ref(firebaseDb, 'master_items');
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
    // --- VALIDASI BARU ---
    if (!selectedItem || !selectedLocation || !expireDate) { 
        toast.error("Barang, Lokasi Simpan, dan Tgl. Kedaluwarsa wajib diisi.");
        return; 
    }
    const totalPcs = (Number(dosQty) * (selectedItem.conversions.Dos?.inPcs || 1)) + (Number(packQty) * (selectedItem.conversions.Pack?.inPcs || 1)) + (Number(pcsQty));
    if (totalPcs <= 0) { toast.error("Masukkan jumlah yang valid."); return; }
    
    // --- ITEM BARU DENGAN ED ---
    setTransactionItems([...transactionItems, { 
        id: selectedItem.id, name: selectedItem.name, 
        quantityInPcs: totalPcs, displayQty: `${dosQty}.${packQty}.${pcsQty}`,
        locationId: selectedLocation,
        expireDate: expireDate // <-- Data ED ditambahkan
    }]);
    setSelectedItem(null); setSearchTerm(''); setDosQty(0); setPackQty(0); setPcsQty(0); setSelectedLocation(''); setExpireDate('');
  };
  
  const handleRemoveFromList = (indexToRemove) => {
    setTransactionItems(transactionItems.filter((_, index) => index !== indexToRemove));
  };

  const handleSaveTransaction = async () => {
    if (transactionItems.length === 0 || !storeName) { 
      return toast.error("Nama Toko dan minimal 1 barang wajib diisi.");
    }
    setIsSubmitting(true);
    
    const returnData = {
        type: 'Retur Baik', fromStore: storeName, invoiceNumber, items: transactionItems,
        depotId: userProfile.depotId, user: userProfile.fullName
    };

    if(navigator.onLine) {
        await syncOfflineReturns([returnData], true);
        setTransactionItems([]); setStoreName(''); setInvoiceNumber('');
    } else {
        const success = await addReturnToQueue(returnData);
        if (success) {
            toast.success("Koneksi offline. Retur disimpan lokal.");
            setTransactionItems([]);
            setStoreName(''); setInvoiceNumber('');
            if (setActiveTab) setActiveTab('riwayat');
        } else {
            toast.error("Gagal menyimpan retur di penyimpanan lokal.");
        }
    }
    setIsSubmitting(false);
  };

  return (
    <>
      {showScanner && <CameraBarcodeScanner onScan={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
      <div className="p-4 space-y-4">
        <div className="p-4 border rounded-lg bg-base-200 space-y-4">
          <h4 className="font-bold">Informasi Retur</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control"><label className="label"><span className="label-text font-bold">No. Faktur Asal</span></label><input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="No. Faktur penjualan" className="input input-bordered" /></div>
            <div className="form-control"><label className="label"><span className="label-text font-bold">Nama Toko Asal</span></label><input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Toko yang mengembalikan barang" className="input input-bordered" /></div>
          </div>
        </div>
        <div className="divider">Tambah Barang ke Daftar Retur</div>
        <div className="p-4 border rounded-lg bg-base-200 space-y-4">
          <div className="form-control"><label className="label"><span className="label-text">Scan atau Cari Barang</span></label><div className="join w-full"><input type="text" placeholder="Ketik nama barang..." className="input input-bordered join-item w-full" value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setSelectedItem(null);}}/><button type="button" onClick={() => setShowScanner(true)} className="btn btn-primary join-item">Scan</button></div></div>
          {searchTerm.length > 0 && !selectedItem && (<ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">{items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (<li key={item.id}><a onClick={() => handleSelectItem(item)}>{item.name}</a></li>))}</ul>)}
          {selectedItem && (<div className="mt-2 p-2 border rounded-md"><p className="font-bold">Barang Terpilih: <span className="text-secondary">{selectedItem.name}</span></p><div className="divider my-2"></div><div className="flex items-end gap-4 flex-wrap"><div className="form-control"><label className="label-text">DOS</label><input type="number" value={dosQty} onChange={(e) => setDosQty(e.target.valueAsNumber || 0)} className="input input-bordered input-sm" /></div><div className="form-control"><label className="label-text">PACK</label><input type="number" value={packQty} onChange={(e) => setPackQty(e.target.valueAsNumber || 0)} className="input input-bordered input-sm" /></div><div className="form-control"><label className="label-text">PCS</label><input type="number" value={pcsQty} onChange={(e) => setPcsQty(e.target.valueAsNumber || 0)} className="input input-bordered input-sm" /></div>
          {/* --- INPUT ED BARU --- */}
          <div className="form-control"><label className="label-text font-bold">Tgl. Kedaluwarsa</label><input type="date" value={expireDate} onChange={e => setExpireDate(e.target.value)} className="input input-sm input-bordered" /></div>
          <div className="form-control flex-grow"><label className="label-text font-bold">Simpan ke Lokasi</label><select className="select select-sm select-bordered" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}><option value="">Pilih Lokasi</option>{locations.map(loc => <option key={loc.id} value={loc.id}>{loc.namaLokasi}</option>)}</select></div><button type="button" onClick={handleAddItemToList} className="btn btn-secondary btn-sm">Tambah</button></div></div>)}
        </div>
        <div className="divider">Daftar Barang dalam Retur Ini</div>
        <div className="overflow-x-auto"><table className="table w-full"><thead><tr><th>Nama Barang</th><th>Jumlah Retur</th><th>Lokasi</th><th>Tgl. ED</th><th>Aksi</th></tr></thead><tbody>{transactionItems.map((item, index) => (<tr key={index}><td>{item.name}</td><td>{item.displayQty}</td><td>{item.locationId}</td><td>{item.expireDate}</td><td><button onClick={() => handleRemoveFromList(index)} className="btn btn-xs btn-error">Hapus</button></td></tr>))}</tbody></table></div>
        <div className="mt-6 flex justify-end">
            <button onClick={handleSaveTransaction} disabled={isSubmitting} className="btn btn-success btn-lg">
                {isSubmitting ? <span className="loading loading-spinner"></span> : 'Simpan Retur Baik'}
            </button>
        </div>
      </div>
    </>
  );
};

// --- Komponen TabReturRusak dan lainnya tetap sama ---
const TabReturRusak = ({ userProfile, locations, syncOfflineReturns, setActiveTab }) => {
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
  const [sourceLocation, setSourceLocation] = useState('');
  const [transactionItems, setTransactionItems] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!userProfile.depotId) return;
    const masterItemsRef = ref(firebaseDb, 'master_items');
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
    const stockRef = ref(firebaseDb, `depots/${userProfile.depotId}/stock/${item.id}`);
    const snapshot = await get(stockRef);
    if(snapshot.exists()) {
        item.locations = snapshot.val().locations || {};
    } else {
        item.locations = {};
    }
    setSelectedItem(item);
    setSearchTerm(item.name);
  };

  const handleAddItemToList = () => {
    if (!selectedItem) { toast.error("Pilih barang dulu."); return; }
    if (returnOrigin === 'gudang' && !sourceLocation) { toast.error("Pilih lokasi asal barang di gudang."); return; }
    
    const totalPcs = (Number(dosQty) * (selectedItem.conversions.Dos?.inPcs || 1)) + (Number(packQty) * (selectedItem.conversions.Pack?.inPcs || 1)) + (Number(pcsQty));
    if (totalPcs <= 0) { toast.error("Masukkan jumlah yang valid."); return; }
    
    if (returnOrigin === 'gudang') {
        const stockDiLokasi = selectedItem.locations[sourceLocation] || 0;
        if (totalPcs > stockDiLokasi) {
            return toast.error(`Stok di lokasi ${sourceLocation} tidak cukup! Hanya ada ${stockDiLokasi} Pcs.`);
        }
    }
    
    setTransactionItems([...transactionItems, { 
        id: selectedItem.id, name: selectedItem.name, 
        quantityInPcs: totalPcs, displayQty: `${dosQty}.${packQty}.${pcsQty}`,
        sourceLocationId: returnOrigin === 'gudang' ? sourceLocation : null
    }]);
    setSelectedItem(null); setSearchTerm(''); setDosQty(0); setPackQty(0); setPcsQty(0); setSourceLocation('');
  };

  const handleRemoveFromList = (indexToRemove) => {
    setTransactionItems(transactionItems.filter((_, index) => index !== indexToRemove));
  };
  
  const handleSaveTransaction = async () => {
    if (transactionItems.length === 0) { return toast.error("Minimal 1 barang wajib diisi."); }
    if (returnOrigin === 'toko' && !storeName) { return toast.error("Nama Toko wajib diisi."); }
    setIsSubmitting(true);

    const returnData = {
        type: 'Retur Rusak', origin: returnOrigin, fromStore: storeName, 
        invoiceNumber, description, items: transactionItems,
        depotId: userProfile.depotId, user: userProfile.fullName
    };

    if (navigator.onLine) {
        await syncOfflineReturns([returnData], true);
        setTransactionItems([]); setDescription(''); setReturnOrigin('toko'); setStoreName(''); setInvoiceNumber('');
    } else {
        const success = await addReturnToQueue(returnData);
        if (success) {
            toast.success("Koneksi offline. Retur disimpan lokal.");
            setTransactionItems([]);
            setDescription(''); setReturnOrigin('toko'); setStoreName(''); setInvoiceNumber('');
            if (setActiveTab) setActiveTab('riwayat');
        } else {
            toast.error("Gagal menyimpan retur di penyimpanan lokal.");
        }
    }
    setIsSubmitting(false);
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
          {selectedItem && (<div className="mt-2 p-2 border rounded-md">
            <p className="font-bold">Barang Terpilih: <span className="text-secondary">{selectedItem.name}</span></p>
            {returnOrigin === 'gudang' && 
                <div className="form-control w-full mt-2">
                    <label className="label-text font-bold">Ambil dari Lokasi</label>
                    <select value={sourceLocation} onChange={e => setSourceLocation(e.target.value)} className="select select-sm select-bordered">
                        <option value="">Pilih Lokasi Asal...</option>
                        {Object.entries(selectedItem.locations).map(([locId, qty]) => qty > 0 && (<option key={locId} value={locId}>{locId} (Stok: {qty})</option>))}
                    </select>
                </div>
            }
            <div className="divider my-2">Masukkan Jumlah Retur Rusak</div>
            <div className="flex items-end gap-4 flex-wrap">
              <div className="form-control"><label className="label-text">DOS</label><input type="number" value={dosQty} onChange={(e) => setDosQty(e.target.valueAsNumber || 0)} className="input input-bordered input-sm" /></div>
              <div className="form-control"><label className="label-text">PACK</label><input type="number" value={packQty} onChange={(e) => setPackQty(e.target.valueAsNumber || 0)} className="input input-bordered input-sm" /></div>
              <div className="form-control"><label className="label-text">PCS</label><input type="number" value={pcsQty} onChange={(e) => setPcsQty(e.target.valueAsNumber || 0)} className="input input-bordered input-sm" /></div>
              <button type="button" onClick={handleAddItemToList} className="btn btn-secondary btn-sm">Tambah ke Daftar</button>
            </div>
          </div>)}
        </div>
        <div className="divider">Daftar Barang Rusak dalam Transaksi Ini</div>
        <div className="overflow-x-auto"><table className="table w-full"><thead><tr><th>Nama Barang</th><th>Jumlah Rusak</th><th>Dari Lokasi</th><th>Aksi</th></tr></thead><tbody>{transactionItems.map((item, index) => (<tr key={index}><td>{item.name}</td><td>{item.displayQty}</td><td>{item.sourceLocationId || 'Toko'}</td><td><button onClick={() => handleRemoveFromList(index)} className="btn btn-xs btn-error">Hapus</button></td></tr>))}</tbody></table></div>
        <div className="mt-6 flex justify-end">
          <button onClick={handleSaveTransaction} disabled={isSubmitting} className="btn btn-warning btn-lg">
            {isSubmitting ? <span className="loading loading-spinner"></span> : 'Simpan Retur Rusak'}
          </button>
        </div>
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
    const masterItemsRef = ref(firebaseDb, 'master_items');
    get(masterItemsRef).then((masterSnapshot) => {
        const masterItems = masterSnapshot.val() || {};
        const stockRef = ref(firebaseDb, `depots/${userProfile.depotId}/stock`);
        onValue(stockRef, (stockSnapshot) => {
            const stockData = stockSnapshot.val() || {};
            const damagedOnly = Object.keys(stockData)
                .filter(itemId => (stockData[itemId].damagedStockInPcs || 0) > 0)
                .map(itemId => ({ id: itemId, ...(masterItems[itemId] || {}), damagedStockInPcs: stockData[itemId].damagedStockInPcs }));
            setDamagedItems(damagedOnly);
            setLoading(false);
        });
    });
    const suppliersRef = ref(firebaseDb, 'suppliers/');
    onValue(suppliersRef, (snapshot) => {
      const data = snapshot.val();
      const supplierList = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
      setSuppliers(supplierList);
    });
  }, [userProfile.depotId]);
  
  useEffect(() => {
    let items = [...damagedItems];
    if (filterSupplier) { items = items.filter(item => item.supplierId === filterSupplier); }
    if (searchTerm) { items = items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())); }
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
        const transactionsRef = ref(firebaseDb, `depots/${userProfile.depotId}/transactions`);
        const newTransactionKey = push(transactionsRef).key;
        updates[`/depots/${userProfile.depotId}/transactions/${newTransactionKey}`] = {
            type: actionType, documentNumber: documentNumber, items: transactionItems,
            user: userProfile.fullName, timestamp: serverTimestamp()
        };
        await update(ref(firebaseDb), updates);
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
      <div className="hidden print:block mb-4">
        <div className="flex items-center justify-center mb-4 border-b-2 border-black pb-2">
            <img src="/logo_bulet_mhm.gif" alt="Logo Perusahaan" className="h-20 w-20 mr-4" />
            <div><h1 className="text-2xl font-bold">PT. Mahameru Mitra Makmur</h1><p className="text-center">Depo: {userProfile.depotId}</p></div>
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
          <div className="form-control"><label className="label"><span className="label-text">Cari Nama Barang</span></label><input type="text" placeholder="Ketik untuk mencari..." className="input input-bordered w-full max-w-xs" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
          <div className="form-control"><label className="label"><span className="label-text">Filter per Supplier</span></label><select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} className="select select-bordered w-full max-w-xs"><option value="">Semua Supplier</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        </div>
      </div>
      <div className="divider">Daftar Barang Sesuai Filter</div>
      <div className="overflow-x-auto">
        <table className="table w-full">
            <thead className='bg-gray-200'><tr><th><input type="checkbox" className="checkbox print:hidden" onChange={(e) => setSelectedForShipment(filteredItems.reduce((acc, item) => ({...acc, [item.id]: e.target.checked}), {}))} /></th><th>Nama Barang</th><th>Jumlah Rusak</th><th>Supplier</th></tr></thead>
            <tbody>
                {loading 
                ? (<tr><td colSpan="4" className="text-center"><span className="loading loading-dots"></span></td></tr>) : 
                 filteredItems.length === 0 ?
                 (<tr><td colSpan="4" className="text-center">Tidak ada stok rusak.</td></tr>) :
                 (filteredItems.map(item => ( <tr key={item.id}><th><label><input type="checkbox" checked={!!selectedForShipment[item.id]} onChange={() => handleSelectItem(item.id)} className="checkbox print:hidden" /></label></th><td>{item.name}</td><td>{formatToDPP(item.damagedStockInPcs, item.conversions)}</td><td>{item.supplierName}</td></tr> )))}
            </tbody>
        </table>
      </div>
      <div className="hidden print:block flex justify-around mt-16 pt-8 text-center text-sm">
        <div><p className="mb-16">(______________________)</p><p>Kepala Depo</p></div>
        <div><p className="mb-16">(______________________)</p><p>Kepala Gudang</p></div>
        <div><p className="mb-16">(______________________)</p><p>{processAction === 'kirim' ? 'Penerima (Pusat)' : 'Saksi'}</p></div>
      </div>
      <div className="mt-6 flex justify-end gap-4 print:hidden">
          <button className="btn btn-info" onClick={() => window.print()}>Cetak List</button>
          <button onClick={handleProcessSelected} className="btn btn-secondary">Proses Barang Terpilih</button>
      </div>
      {showProcessForm && (<div className="print:hidden"><div className="divider">Proses Tindak Lanjut</div><div className="p-4 border rounded-lg bg-base-200 mt-4"><h4 className="font-bold">Tindak Lanjut Barang Terpilih</h4><div className="form-control mt-4"><label className="label"><span className="label-text">Pilih Aksi Final</span></label><select value={processAction} onChange={(e) => setProcessAction(e.target.value)} className="select select-bordered"><option value="kirim">Kirim ke Pusat</option><option value="musnahkan">Musnahkan</option></select></div><div className="form-control mt-2"><label className="label"><span className="label-text">No. Dokumen</span></label><input type="text" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="Wajib diisi..." className="input input-bordered" /></div><div className="mt-4 flex gap-2"><button onClick={handleSaveFinalAction} className="btn btn-success">Simpan Aksi</button><button onClick={() => setShowProcessForm(false)} className="btn btn-ghost">Batal</button></div></div></div>)}
    </div>
  );
};

const TabRiwayat = ({ userProfile }) => {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState('');
  const transactionTypes = ['Retur Baik', 'Retur Rusak', 'Pengiriman BS ke Pusat', 'Pemusnahan BS'];

  useEffect(() => {
    if (!userProfile.depotId) return;
    setLoading(true);
    const transRef = ref(firebaseDb, `depots/${userProfile.depotId}/transactions`);
    const transQuery = query(transRef, orderByChild('timestamp'));
    onValue(transQuery, (snapshot) => {
      const data = snapshot.val() || {};
      const allTransactions = Object.keys(data).map(key => ({ id: key, ...data[key] })).filter(t => transactionTypes.includes(t.type)).sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(allTransactions);
      setLoading(false);
    });
  }, [userProfile.depotId]);

  useEffect(() => {
    let items = [...transactions];
    if (startDate) { const start = new Date(startDate).setHours(0, 0, 0, 0); items = items.filter(t => t.timestamp >= start); }
    if (endDate) { const end = new Date(endDate).setHours(23, 59, 59, 999); items = items.filter(t => t.timestamp <= end); }
    if (filterType) { items = items.filter(t => t.type === filterType); }
    setFilteredTransactions(items);
  }, [startDate, endDate, filterType, transactions]);

  const handleMonthSelect = (e) => {
    const [year, month] = e.target.value.split('-');
    if (year && month) {
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };
  
  const monthOptions = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('id-ID', { month: 'long', year: 'numeric' }) }; });
  const getBadgeColor = (type) => { switch(type) { case 'Retur Baik': return 'badge-success'; case 'Retur Rusak': return 'badge-warning'; case 'Pengiriman BS ke Pusat': return 'badge-info'; case 'Pemusnahan BS': return 'badge-error'; default: return 'badge-ghost'; } };
  
  return (
    <div className="p-4 space-y-4">
      <div className="p-4 bg-base-200 rounded-lg mb-4 grid grid-cols-1 md:grid-cols-4 gap-4"><div className="form-control"><label className="label-text">Dari Tanggal</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input input-bordered" /></div><div className="form-control"><label className="label-text">Sampai Tanggal</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input input-bordered" /></div><div className="form-control"><label className="label-text">Atau Pilih Bulan</label><select onChange={handleMonthSelect} className="select select-bordered"><option value="">Pilih Bulan...</option>{monthOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div><div className="form-control"><label className="label-text">Filter Tipe</label><select value={filterType} onChange={e => setFilterType(e.target.value)} className="select select-bordered"><option value="">Semua Tipe</option>{transactionTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></div></div>
      <div className="overflow-x-auto"><table className="table table-zebra w-full"><thead><tr><th>Tanggal</th><th>Tipe</th><th>Detail</th><th>Oleh</th></tr></thead><tbody>{loading ? (<tr><td colSpan="4" className="text-center"><span className="loading loading-dots"></span></td></tr>) : filteredTransactions.length === 0 ? (<tr><td colSpan="4" className="text-center">Tidak ada data.</td></tr>) : (filteredTransactions.map(trans => (<tr key={trans.id}><td>{new Date(trans.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short'})}</td><td><span className={`badge ${getBadgeColor(trans.type)}`}>{trans.type}</span></td><td><div className="text-xs">{trans.items.map(item => `${item.name} (${item.displayQty})`).join(', ')}{trans.fromStore && <span className="block">Dari: {trans.fromStore}</span>}{trans.documentNumber && <span className="block">No. Dok: {trans.documentNumber}</span>}</div></td><td>{trans.user}</td></tr>)))}</tbody></table></div>
    </div>
  );
};

function ManajemenRetur({ userProfile }) {
  const [activeTab, setActiveTab] = useState('returBaik');
  const [locations, setLocations] = useState([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
      if (!userProfile.depotId) return;
      const locationsRef = ref(firebaseDb, `depots/${userProfile.depotId}/locations`);
      onValue(locationsRef, (snapshot) => {
          const data = snapshot.val() || {};
          setLocations(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      });
  }, [userProfile]);

  // --- LOGIKA SINKRONISASI BARU ---
  const syncOfflineReturns = async (returnsToSync, isOnlineSave = false) => {
    if (isSyncing && !isOnlineSave) return;
    setIsSyncing(true);
    let successCount = 0;
    for (const returnData of returnsToSync) {
        try {
            if (returnData.type === 'Retur Baik') {
                for (const transItem of returnData.items) {
                    const stockRef = ref(firebaseDb, `depots/${returnData.depotId}/stock/${transItem.id}`);
                    const batchKey = push(ref(firebaseDb, `depots/${returnData.depotId}/stock/${transItem.id}/batches`)).key;
                    await runTransaction(stockRef, (s) => { 
                        if(!s) s = { totalStockInPcs: 0, batches: {} }; 
                        s.batches = s.batches || {};
                        s.totalStockInPcs = (s.totalStockInPcs || 0) + transItem.quantityInPcs; 
                        s.batches[batchKey] = {
                            quantity: transItem.quantityInPcs,
                            expireDate: transItem.expireDate,
                            locationId: transItem.locationId,
                            receivedAt: serverTimestamp(),
                            receiptId: `RETUR-${returnData.fromStore}`
                        };
                        return s; 
                    });
                }
            } else if (returnData.type === 'Retur Rusak') {
                 for (const transItem of returnData.items) {
                    const stockRef = ref(firebaseDb, `depots/${returnData.depotId}/stock/${transItem.id}`);
                    await runTransaction(stockRef, (s) => { 
                        if (!s) s = { totalStockInPcs: 0, damagedStockInPcs: 0, locations: {} }; 
                        s.damagedStockInPcs = (s.damagedStockInPcs || 0) + transItem.quantityInPcs; 
                        if (returnData.origin === 'gudang') { 
                            if ((s.totalStockInPcs || 0) < transItem.quantityInPcs) { throw new Error(`Stok ${transItem.name} tidak cukup.`); } 
                            s.totalStockInPcs -= transItem.quantityInPcs; 
                            s.locations[transItem.sourceLocationId] = (s.locations[transItem.sourceLocationId] || 0) - transItem.quantityInPcs; 
                        } 
                        return s; 
                    });
                }
            }
            const transactionsRef = ref(firebaseDb, `depots/${returnData.depotId}/transactions`);
            await push(transactionsRef, { ...returnData, timestamp: serverTimestamp() });
            if (returnData.localId) { await removeReturnFromQueue(returnData.localId); }
            successCount++;
        } catch (err) {
            toast.error(`Gagal sinkronisasi retur: ${err.message}`);
            break;
        }
    }
    if (successCount > 0) toast.success(`${successCount} data retur disinkronkan.`);
    checkPendingReturns();
    setIsSyncing(false);
  };

  const checkPendingReturns = async () => {
    const pending = await getQueuedReturns();
    setPendingSyncCount(pending.length);
    if (pending.length > 0 && navigator.onLine) {
        toast.loading(`Menyinkronkan ${pending.length} data retur...`, { id: 'sync-toast-return' });
        await syncOfflineReturns(pending);
        toast.dismiss('sync-toast-return');
    }
  };

  useEffect(() => {
    checkPendingReturns();
    window.addEventListener('online', checkPendingReturns);
    return () => window.removeEventListener('online', checkPendingReturns);
  }, []);
  
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6 print:hidden">Manajemen Retur</h1>
      {pendingSyncCount > 0 && <div role="alert" className="alert alert-info mb-4"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span>Ada {pendingSyncCount} data retur yang menunggu untuk disinkronkan.</span></div>}
      <div role="tablist" className="tabs tabs-lifted print:hidden">
        <a role="tab" className={`tab ${activeTab === 'returBaik' ? 'tab-active' : ''}`} onClick={() => setActiveTab('returBaik')}>Retur Baik</a>
        <a role="tab" className={`tab ${activeTab === 'returRusak' ? 'tab-active' : ''}`} onClick={() => setActiveTab('returRusak')}>Retur Rusak</a>
        <a role="tab" className={`tab ${activeTab === 'kirimPusat' ? 'tab-active' : ''}`} onClick={() => setActiveTab('kirimPusat')}>Rekap & Pengiriman</a>
        <a role="tab" className={`tab ${activeTab === 'riwayat' ? 'tab-active' : ''}`} onClick={() => setActiveTab('riwayat')}>Riwayat Retur</a>
      </div>
      <div className="bg-white p-6 rounded-b-lg rounded-tr-lg shadow-lg min-h-96">
        {activeTab === 'returBaik' && <TabReturBaik userProfile={userProfile} locations={locations} syncOfflineReturns={syncOfflineReturns} setActiveTab={setActiveTab}/>}
        {activeTab === 'returRusak' && <TabReturRusak userProfile={userProfile} locations={locations} syncOfflineReturns={syncOfflineReturns} setActiveTab={setActiveTab}/>}
        {activeTab === 'kirimPusat' && <TabKirimPusat userProfile={userProfile} />}
        {activeTab === 'riwayat' && <TabRiwayat userProfile={userProfile} />}
      </div>
    </div>
  );
}

export default ManajemenRetur;
