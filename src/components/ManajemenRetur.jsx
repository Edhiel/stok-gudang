import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, getDocs, doc, updateDoc, addDoc, serverTimestamp, runTransaction, query, orderBy } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import { addReturnToQueue, getQueuedReturns, removeReturnFromQueue } from '../offlineDb';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import toast from 'react-hot-toast';

const TabReturBaik = ({ userProfile, locations, syncOfflineReturns, setActiveTab }) => {
  const [items, setItems] = useState([]);
  const [stores, setStores] = useState([]);
  
  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const [filteredStores, setFilteredStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [expireDate, setExpireDate] = useState('');
  const [transactionItems, setTransactionItems] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!userProfile.depotId) return;
    const masterItemsRef = collection(firestoreDb, 'master_items');
    const unsubItems = onSnapshot(masterItemsRef, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const storesRef = collection(firestoreDb, 'master_toko');
    const unsubStores = onSnapshot(storesRef, (snapshot) => {
        setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubItems(); unsubStores(); };
  }, [userProfile.depotId]);

  useEffect(() => {
      if (storeSearchTerm.length > 1) {
          setFilteredStores(stores.filter(s => s.namaToko.toLowerCase().includes(storeSearchTerm.toLowerCase())));
      } else {
          setFilteredStores([]);
      }
  }, [storeSearchTerm, stores]);

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
    if (!selectedItem || !selectedLocation || !expireDate) { 
        toast.error("Barang, Lokasi Simpan, dan Tgl. Kedaluwarsa wajib diisi.");
        return; 
    }
    const totalPcs = (Number(dosQty) * (selectedItem.conversions.Dos?.inPcs || 1)) + (Number(packQty) * (selectedItem.conversions.Pack?.inPcs || 1)) + (Number(pcsQty));
    if (totalPcs <= 0) { toast.error("Masukkan jumlah yang valid."); return; }
    
    setTransactionItems([...transactionItems, { 
        id: selectedItem.id, name: selectedItem.name, 
        quantityInPcs: totalPcs, displayQty: `${dosQty}.${packQty}.${pcsQty}`,
        locationId: selectedLocation,
        expireDate: expireDate
    }]);
    setSelectedItem(null); setSearchTerm(''); setDosQty(0); setPackQty(0); setPcsQty(0); setSelectedLocation(''); setExpireDate('');
  };
  
  const handleRemoveFromList = (indexToRemove) => {
    setTransactionItems(transactionItems.filter((_, index) => index !== indexToRemove));
  };

  const handleSaveTransaction = async () => {
    if (transactionItems.length === 0 || !selectedStore) { 
      return toast.error("Pilih Toko dan tambahkan minimal 1 barang retur.");
    }
    setIsSubmitting(true);
    
    const returnData = {
        type: 'Retur Baik', fromStore: selectedStore.namaToko, invoiceNumber, items: transactionItems,
        depotId: userProfile.depotId, user: userProfile.fullName
    };

    if(navigator.onLine) {
        await syncOfflineReturns([returnData], true);
        setTransactionItems([]); 
        setSelectedStore(null); 
        setStoreSearchTerm(''); 
        setInvoiceNumber('');
    } else {
        const success = await addReturnToQueue(returnData);
        if (success) {
            toast.success("Koneksi offline. Retur disimpan lokal.");
            setTransactionItems([]);
            setSelectedStore(null); 
            setStoreSearchTerm(''); 
            setInvoiceNumber('');
            if (setActiveTab) setActiveTab('riwayat');
        } else {
            toast.error("Gagal menyimpan retur di penyimpanan lokal.");
        }
    }
    setIsSubmitting(false);
  };
  
  const filteredItems = searchTerm.length > 1
    ? items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  return (
    <>
      {showScanner && <CameraBarcodeScanner onScan={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
      <div className="p-4 space-y-4">
        <div className="p-4 border rounded-lg bg-base-200 space-y-4">
          <h4 className="font-bold">Informasi Retur</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control"><label className="label"><span className="label-text font-bold">No. Faktur Asal</span></label><input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="No. Faktur penjualan" className="input input-bordered" /></div>
            <div className="form-control dropdown">
              <label className="label"><span className="label-text font-bold">Cari Toko Asal</span></label>
              <input type="text" value={storeSearchTerm} onChange={e => {setStoreSearchTerm(e.target.value); setSelectedStore(null);}} placeholder="Ketik min. 2 huruf nama toko..." className="input input-bordered"/>
               {filteredStores.length > 0 && !selectedStore && (
                <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                    {filteredStores.map(store => (
                        <li key={store.id}><a onClick={() => {setSelectedStore(store); setStoreSearchTerm(store.namaToko);}}>{store.namaToko}</a></li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        <div className="divider">Tambah Barang ke Daftar Retur</div>
        <div className="p-4 border rounded-lg bg-base-200 space-y-4">
          <div className="form-control dropdown">
            <label className="label"><span className="label-text">Scan atau Cari Barang</span></label>
            <div className="join w-full">
              <input type="text" placeholder="Ketik nama barang..." className="input input-bordered join-item w-full" value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setSelectedItem(null);}}/>
              <button type="button" onClick={() => setShowScanner(true)} className="btn btn-primary join-item">Scan</button>
            </div>
             {filteredItems.length > 0 && !selectedItem && (
                <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                    {filteredItems.slice(0, 10).map(item => (<li key={item.id}><a onClick={() => handleSelectItem(item)}>{item.name}</a></li>))}
                </ul>
            )}
          </div>
          {selectedItem && (
            <div className="mt-2 p-2 border rounded-md">
              <p className="font-bold">Barang Terpilih: <span className="text-secondary">{selectedItem.name}</span></p>
              <div className="divider my-2"></div>
              <div className="flex items-end gap-4 flex-wrap">
                <div className="form-control"><label className="label-text">DOS</label><input type="number" value={dosQty} onChange={(e) => setDosQty(e.target.valueAsNumber || 0)} className="input input-bordered input-sm" /></div>
                <div className="form-control"><label className="label-text">PACK</label><input type="number" value={packQty} onChange={(e) => setPackQty(e.target.valueAsNumber || 0)} className="input input-bordered input-sm" /></div>
                <div className="form-control"><label className="label-text">PCS</label><input type="number" value={pcsQty} onChange={(e) => setPcsQty(e.target.valueAsNumber || 0)} className="input input-bordered input-sm" /></div>
                <div className="form-control"><label className="label-text font-bold">Tgl. Kedaluwarsa</label><input type="date" value={expireDate} onChange={e => setExpireDate(e.target.value)} className="input input-sm input-bordered" /></div>
                <div className="form-control flex-grow"><label className="label-text font-bold">Simpan ke Lokasi</label><select className="select select-sm select-bordered" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}><option value="">Pilih Lokasi</option>{locations.map(loc => <option key={loc.id} value={loc.id}>{loc.namaLokasi}</option>)}</select></div>
                <button type="button" onClick={handleAddItemToList} className="btn btn-secondary btn-sm">Tambah</button>
              </div>
            </div>
            )}
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
const TabReturRusak = ({ userProfile, locations, syncOfflineReturns, setActiveTab }) => {
  const [items, setItems] = useState([]);
  const [stores, setStores] = useState([]);
  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const [filteredStores, setFilteredStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  const [returnOrigin, setReturnOrigin] = useState('toko');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [sourceLocation, setSourceLocation] = useState('');
  const [transactionItems, setTransactionItems] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemLocations, setItemLocations] = useState({});

  useEffect(() => {
    if (!userProfile.depotId) return;
    const masterItemsRef = collection(firestoreDb, 'master_items');
    const unsubItems = onSnapshot(masterItemsRef, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const storesRef = collection(firestoreDb, 'master_toko');
    const unsubStores = onSnapshot(storesRef, (snapshot) => {
      setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubItems(); unsubStores(); };
  }, [userProfile.depotId]);

  useEffect(() => {
      if (storeSearchTerm.length > 1) {
          setFilteredStores(stores.filter(s => s.namaToko.toLowerCase().includes(storeSearchTerm.toLowerCase())));
      } else {
          setFilteredStores([]);
      }
  }, [storeSearchTerm, stores]);

  const handleBarcodeDetected = (scannedBarcode) => {
    const foundItem = items.find(item => item.barcodePcs === scannedBarcode || item.barcodeDos === scannedBarcode);
    if (foundItem) handleSelectItem(foundItem); else toast.error("Barang tidak ditemukan.");
    setShowScanner(false);
  };
  
  const handleSelectItem = async (item) => {
    const stockRef = doc(firestoreDb, `depots/${userProfile.depotId}/stock/${item.id}`);
    const snapshot = await getDoc(stockRef);
    if(snapshot.exists()) {
        setItemLocations(snapshot.data().locations || {});
    } else {
        setItemLocations({});
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
        const stockDiLokasi = itemLocations[sourceLocation] || 0;
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
    if (returnOrigin === 'toko' && !selectedStore) { return toast.error("Nama Toko wajib diisi."); }
    setIsSubmitting(true);

    const returnData = {
        type: 'Retur Rusak', origin: returnOrigin, fromStore: selectedStore?.namaToko || '', 
        invoiceNumber, description, items: transactionItems,
        depotId: userProfile.depotId, user: userProfile.fullName
    };

    if (navigator.onLine) {
        await syncOfflineReturns([returnData], true);
        setTransactionItems([]); setDescription(''); setReturnOrigin('toko'); setSelectedStore(null); setStoreSearchTerm(''); setInvoiceNumber('');
    } else {
        const success = await addReturnToQueue(returnData);
        if (success) {
            toast.success("Koneksi offline. Retur disimpan lokal.");
            setTransactionItems([]); setDescription(''); setReturnOrigin('toko'); setSelectedStore(null); setStoreSearchTerm(''); setInvoiceNumber('');
            if (setActiveTab) setActiveTab('riwayat');
        } else {
            toast.error("Gagal menyimpan retur di penyimpanan lokal.");
        }
    }
    setIsSubmitting(false);
  };
  
  const filteredItems = searchTerm.length > 1
    ? items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  return (
    <>
      {showScanner && <CameraBarcodeScanner onScan={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
      <div className="p-4 space-y-4">
        <div className="p-4 border rounded-lg bg-base-200 space-y-4">
          <h4 className="font-bold">Informasi Retur Rusak</h4>
          <div className="form-control"><label className="label"><span className="label-text font-bold">Asal Retur</span></label><select value={returnOrigin} onChange={(e) => setReturnOrigin(e.target.value)} className="select select-bordered"><option value="toko">Retur dari Toko</option><option value="gudang">Rusak di Gudang</option></select></div>
          {returnOrigin === 'toko' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control dropdown"><label className="label"><span className="label-text font-bold">Cari Toko</span></label>
                <input type="text" value={storeSearchTerm} onChange={e => {setStoreSearchTerm(e.target.value); setSelectedStore(null);}} placeholder="Ketik min. 2 huruf..." className="input input-bordered"/>
                {filteredStores.length > 0 && !selectedStore && (
                  <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                    {filteredStores.map(store => (
                      <li key={store.id}><a onClick={() => {setSelectedStore(store); setStoreSearchTerm(store.namaToko);}}>{store.namaToko}</a></li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="form-control"><label className="label"><span className="label-text">No. Faktur Asal</span></label><input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="No. Faktur terkait" className="input input-bordered" /></div>
            </div>
          )}
          <div className="form-control"><label className="label"><span className="label-text">Keterangan Kerusakan</span></label><textarea value={description} onChange={(e) => setDescription(e.target.value)} className="textarea textarea-bordered" placeholder="Contoh: Kemasan sobek..."></textarea></div>
        </div>
        <div className="divider">Tambah Barang Rusak ke Daftar</div>
        <div className="p-4 border rounded-lg bg-base-200 space-y-4">
          <div className="form-control dropdown">
            <label className="label"><span className="label-text">Scan atau Cari Barang</span></label>
            <div className="join w-full">
              <input type="text" placeholder="Ketik nama barang..." className="input input-bordered join-item w-full" value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setSelectedItem(null);}}/>
              <button type="button" onClick={() => setShowScanner(true)} className="btn btn-primary join-item">Scan</button>
            </div>
            {filteredItems.length > 0 && !selectedItem && (
                <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                    {filteredItems.slice(0, 10).map(item => (<li key={item.id}><a onClick={() => handleSelectItem(item)}>{item.name}</a></li>))}
                </ul>
            )}
          </div>
          {selectedItem && (<div className="mt-2 p-2 border rounded-md">
            <p className="font-bold">Barang Terpilih: <span className="text-secondary">{selectedItem.name}</span></p>
            {returnOrigin === 'gudang' && 
                <div className="form-control w-full mt-2">
                    <label className="label-text font-bold">Ambil dari Lokasi</label>
                    <select value={sourceLocation} onChange={e => setSourceLocation(e.target.value)} className="select select-sm select-bordered">
                        <option value="">Pilih Lokasi Asal...</option>
                        {Object.entries(itemLocations).map(([locId, qty]) => qty > 0 && (<option key={locId} value={locId}>{locId} (Stok: {qty})</option>))}
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
    // ... Tidak ada perubahan di sini
};

const TabRiwayat = ({ userProfile }) => {
    // ... Tidak ada perubahan di sini
};

function ManajemenRetur({ userProfile }) {
  const [activeTab, setActiveTab] = useState('returBaik');
  const [locations, setLocations] = useState([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
      if (!userProfile.depotId) return;
      const locationsRef = collection(firestoreDb, `depots/${userProfile.depotId}/locations`);
      const unsub = onSnapshot(locationsRef, (snapshot) => {
          setLocations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsub();
  }, [userProfile]);

  const syncOfflineReturns = async (returnsToSync, isOnlineSave = false) => {
    if (isSyncing && !isOnlineSave) return;
    setIsSyncing(true);
    let successCount = 0;
    
    for (const returnData of returnsToSync) {
        try {
            await runTransaction(firestoreDb, async (transaction) => {
                if (returnData.type === 'Retur Baik') {
                    for (const transItem of returnData.items) {
                        const stockDocRef = doc(firestoreDb, `depots/${returnData.depotId}/stock/${transItem.id}`);
                        const stockDoc = await transaction.get(stockDocRef);
                        
                        let currentStock = stockDoc.exists() ? stockDoc.data() : { totalStockInPcs: 0, batches: {} };
                        const newTotal = (currentStock.totalStockInPcs || 0) + transItem.quantityInPcs;
                        const batchKey = doc(collection(firestoreDb, 'temp')).id;

                        const newBatch = {
                            quantity: transItem.quantityInPcs, expireDate: transItem.expireDate,
                            locationId: transItem.locationId, receivedAt: serverTimestamp(),
                            receiptId: `RETUR-${returnData.fromStore}`
                        };
                        
                        transaction.set(stockDocRef, {
                            totalStockInPcs: newTotal,
                            batches: { ...currentStock.batches, [batchKey]: newBatch },
                        }, { merge: true });
                    }
                } else if (returnData.type === 'Retur Rusak') {
                    for (const transItem of returnData.items) {
                        const stockDocRef = doc(firestoreDb, `depots/${returnData.depotId}/stock/${transItem.id}`);
                        const stockDoc = await transaction.get(stockDocRef);
                        if (!stockDoc.exists() && returnData.origin === 'gudang') throw new Error(`Stok ${transItem.name} tidak ditemukan.`);

                        let currentData = stockDoc.data() || {};
                        let newDamaged = (currentData.damagedStockInPcs || 0) + transItem.quantityInPcs;
                        
                        transaction.set(stockDocRef, { damagedStockInPcs: newDamaged }, { merge: true });

                        if (returnData.origin === 'gudang') {
                           if ((currentData.totalStockInPcs || 0) < transItem.quantityInPcs) { throw new Error(`Stok ${transItem.name} tidak cukup.`); }
                           let newTotal = currentData.totalStockInPcs - transItem.quantityInPcs;
                           let newLocationStock = (currentData.locations?.[transItem.sourceLocationId] || 0) - transItem.quantityInPcs;
                           transaction.update(stockDocRef, { 
                               totalStockInPcs: newTotal,
                               [`locations.${transItem.sourceLocationId}`]: newLocationStock
                           });
                        }
                    }
                }
            });
            
            const transactionsRef = collection(firestoreDb, `depots/${returnData.depotId}/transactions`);
            await addDoc(transactionsRef, { ...returnData, timestamp: serverTimestamp() });

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
