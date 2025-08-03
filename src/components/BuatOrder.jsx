import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import { addOrderToQueue, getQueuedOrders, removeOrderFromQueue } from '../offlineDb';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import toast from 'react-hot-toast';

function BuatOrder({ userProfile }) {
  const [stores, setStores] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const [filteredStores, setFilteredStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);

  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  const [transactionItems, setTransactionItems] = useState([]);
  const [orderNumber, setOrderNumber] = useState('');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [showScanner, setShowScanner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!userProfile?.depotId) {
        setLoading(false);
        return;
    }
    
    setLoading(true);
    const storesRef = collection(firestoreDb, 'master_toko');
    const itemsRef = collection(firestoreDb, 'master_items');
    
    const unsubStores = onSnapshot(storesRef, (snapshot) => {
        const storeList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStores(storeList);
        setFilteredStores(storeList); // <-- PERUBAHAN: Tampilkan semua toko saat pertama kali dimuat
    });
    const unsubItems = onSnapshot(itemsRef, (snapshot) => {
        setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
    });
    
    checkPendingOrders();

    return () => {
        unsubStores();
        unsubItems();
    };
  }, [userProfile]);

  useEffect(() => {
    // --- LOGIKA PENCARIAN YANG DISEMPURNAKAN ---
    // Jika ada yang diketik, filter. Jika kosong, tampilkan semua.
    if (storeSearchTerm) {
        setFilteredStores(
            stores.filter(store => 
                store.namaToko.toLowerCase().includes(storeSearchTerm.toLowerCase())
            )
        );
    } else {
        setFilteredStores(stores); // <-- Kembali tampilkan semua jika pencarian kosong
    }
  }, [storeSearchTerm, stores]);

  const syncOfflineOrders = async (ordersToSync) => {
    let successCount = 0;
    for (const order of ordersToSync) {
      try {
        await addDoc(collection(firestoreDb, `depots/${order.depotId}/salesOrders`), order);
        await removeOrderFromQueue(order.localId);
        successCount++;
      } catch (error) {
        toast.error(`Gagal sinkronisasi order: ${order.orderNumber}`);
        break;
      }
    }
    if (successCount > 0) {
      toast.success(`${successCount} order berhasil disinkronkan.`);
    }
    checkPendingOrders();
  };

  const checkPendingOrders = async () => {
    const pending = await getQueuedOrders();
    setPendingSyncCount(pending.length);
    if (pending.length > 0 && navigator.onLine) {
      toast.loading(`Menyinkronkan ${pending.length} order...`, { id: 'sync-toast' });
      await syncOfflineOrders(pending);
      toast.dismiss('sync-toast');
    }
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setItemSearchTerm(item.name);
  };

  const handleAddItemToList = () => {
    if (!selectedItem) return toast.error("Pilih barang terlebih dahulu.");
    const totalPcs = totalPcsForItem({ dos: dosQty, pack: packQty, pcs: pcsQty });
    if (totalPcs <= 0) return toast.error("Masukkan jumlah yang valid.");

    setTransactionItems([...transactionItems, {
      id: selectedItem.id,
      name: selectedItem.name,
      quantityInPcs: totalPcs,
      displayQty: `${dosQty}.${packQty}.${pcsQty}`,
      conversions: selectedItem.conversions
    }]);
    
    setSelectedItem(null);
    setItemSearchTerm('');
    setDosQty(0); setPackQty(0); setPcsQty(0);
  };

  const handleRemoveItem = (index) => {
    setTransactionItems(transactionItems.filter((_, i) => i !== index));
  };
  
  const handleSaveOrder = async () => {
    if (!selectedStore || transactionItems.length === 0) {
      return toast.error("Pilih toko dan tambahkan minimal satu barang.");
    }
    setIsSubmitting(true);

    const orderData = {
      orderNumber: orderNumber || `SO-${Date.now()}`,
      storeId: selectedStore.id,
      storeName: selectedStore.namaToko,
      items: transactionItems,
      status: 'Menunggu Approval Admin',
      createdAt: serverTimestamp(),
      salesName: userProfile.fullName,
      salesId: userProfile.uid,
      depotId: userProfile.depotId
    };

    if (navigator.onLine) {
      try {
        await addDoc(collection(firestoreDb, `depots/${userProfile.depotId}/salesOrders`), orderData);
        toast.success("Order berhasil disimpan!");
        setTransactionItems([]);
        setOrderNumber('');
        setSelectedStore(null);
        setStoreSearchTerm('');
      } catch (error) {
        toast.error("Gagal menyimpan order: " + error.message);
      }
    } else {
      const success = await addOrderToQueue(orderData);
      if (success) {
        toast.success("Koneksi offline. Order disimpan lokal.");
        setTransactionItems([]);
        setOrderNumber('');
        setSelectedStore(null);
        setStoreSearchTerm('');
      } else {
        toast.error("Gagal menyimpan order di penyimpanan lokal.");
      }
    }
    setIsSubmitting(false);
  };

  const totalPcsForItem = ({ dos, pack, pcs }) => {
    if (!selectedItem) return 0;
    const dosInPcs = selectedItem.conversions?.Dos?.inPcs || 1;
    const packInPcs = selectedItem.conversions?.Pack?.inPcs || 1;
    return (Number(dos) * dosInPcs) + (Number(pack) * packInPcs) + Number(pcs);
  };

  const filteredItems = itemSearchTerm.length > 1 
    ? items.filter(item => item.name.toLowerCase().includes(itemSearchTerm.toLowerCase()))
    : [];

  if (loading) {
    return <div className="p-8 text-center"><span className="loading loading-spinner loading-lg"></span></div>;
  }

  return (
    <>
      {showScanner && (
        <CameraBarcodeScanner
          onScan={(scannedBarcode) => {
            const foundItem = items.find(item => item.barcodePcs === scannedBarcode || item.barcodeDos === scannedBarcode);
            if (foundItem) handleSelectItem(foundItem);
            else toast.error("Barang tidak ditemukan.");
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
      <div className="p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-6">Buat Order Penjualan Baru</h1>
        {pendingSyncCount > 0 && (
          <div role="alert" className="alert alert-info mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>Ada {pendingSyncCount} order yang menunggu untuk disinkronkan.</span>
          </div>
        )}

        <div className="card bg-white shadow-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label"><span className="label-text font-bold">No. Order / PO</span></label>
              <input type="text" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="Masukkan No. PO dari toko" className="input input-bordered" />
            </div>
            <div className="form-control dropdown dropdown-hover">
              <label className="label"><span className="label-text font-bold">Cari & Pilih Toko</span></label>
              <input 
                type="text"
                value={storeSearchTerm}
                onChange={(e) => {
                    setStoreSearchTerm(e.target.value);
                    setSelectedStore(null);
                }}
                placeholder="Ketik nama toko untuk mencari..."
                className="input input-bordered"
              />
              {/* Tampilkan dropdown jika ada toko yang cocok ATAU jika input kosong (untuk menampilkan semua) */}
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
          </div>
        </div>

        <div className="divider my-6">Detail Barang</div>

        <div className="card bg-white shadow-lg p-6">
          <div className="form-control dropdown">
            <label className="label"><span className="label-text">Scan atau Cari Barang</span></label>
            <div className="join w-full">
              <input
                type="text"
                placeholder={selectedStore ? "Ketik nama barang..." : "Pilih toko terlebih dahulu"}
                className="input input-bordered join-item w-full"
                value={itemSearchTerm}
                onChange={(e) => { setItemSearchTerm(e.target.value); setSelectedItem(null); }}
                disabled={!selectedStore}
              />
              <button type="button" onClick={() => setShowScanner(true)} className="btn btn-primary join-item" disabled={!selectedStore}>Scan</button>
            </div>
            {filteredItems.length > 0 && !selectedItem && (
              <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                {filteredItems.slice(0, 10).map(item => <li key={item.id}><a onClick={() => handleSelectItem(item)}>{item.name}</a></li>)}
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
                <button type="button" onClick={handleAddItemToList} className="btn btn-secondary btn-sm">Tambah ke Order</button>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-6">
            <h3 className="text-xl font-bold mb-2">Daftar Orderan</h3>
            <div className="overflow-x-auto bg-white rounded-lg shadow">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Nama Barang</th>
                    <th>Jumlah</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionItems.map((item, index) => (
                    <tr key={index}>
                      <td>{item.name}</td>
                      <td>{item.displayQty}</td>
                      <td><button onClick={() => handleRemoveItem(index)} className="btn btn-xs btn-error">Hapus</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
        
        <div className="mt-6 flex justify-end">
            <button 
                onClick={handleSaveOrder} 
                className="btn btn-success btn-lg" 
                disabled={!selectedStore || transactionItems.length === 0 || isSubmitting}
            >
                {isSubmitting ? <span className="loading loading-spinner"></span> : "Simpan Order"}
            </button>
        </div>
      </div>
    </>
  );
}

export default BuatOrder;
