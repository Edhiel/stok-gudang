import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import { addOrderToQueue, getQueuedOrders, removeOrderFromQueue } from '../offlineDb';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import toast from 'react-hot-toast';

function BuatOrder({ userProfile }) {
  const [stores, setStores] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true); // <-- STATE BARU UNTUK LOADING
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStore, setSelectedStore] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  const [transactionItems, setTransactionItems] = useState([]);
  const [orderNumber, setOrderNumber] = useState('');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [showScanner, setShowScanner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- PENINGKATAN: useEffect dibuat lebih aman ---
  useEffect(() => {
    // Jangan jalankan apapun jika userProfile atau depotId belum siap
    if (!userProfile?.depotId) {
        setLoading(false);
        return;
    }
    
    setLoading(true);
    const storesRef = collection(firestoreDb, 'master_toko');
    const itemsRef = collection(firestoreDb, 'master_items');
    
    const unsubStores = onSnapshot(storesRef, (snapshot) => {
        setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubItems = onSnapshot(itemsRef, (snapshot) => {
        setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false); // Selesai loading setelah item dimuat
    });
    
    checkPendingOrders();

    return () => {
        unsubStores();
        unsubItems();
    };
  }, [userProfile]);

  const syncOfflineOrders = async (ordersToSync) => {
    // ... (fungsi ini tidak berubah)
  };

  const checkPendingOrders = async () => {
    // ... (fungsi ini tidak berubah)
  };

  const handleSelectItem = (item) => {
    // ... (fungsi ini tidak berubah)
  };

  const handleAddItemToList = () => {
    // ... (fungsi ini tidak berubah)
  };

  const handleRemoveItem = (index) => {
    // ... (fungsi ini tidak berubah)
  };
  
  const handleSaveOrder = async () => {
    // ... (fungsi ini tidak berubah)
  };

  const totalPcsForItem = (item) => {
    // ... (fungsi ini tidak berubah)
  };

  const filteredItems = searchTerm.length > 1 
    ? items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  // --- TAMPILKAN LOADING JIKA DATA BELUM SIAP ---
  if (loading) {
    return <div className="p-8 text-center"><span className="loading loading-spinner loading-lg"></span></div>;
  }

  return (
    <>
      {showScanner && (
        <CameraBarcodeScanner
          onScan={(scannedBarcode) => {
            const foundItem = items.find(item => item.barcodePcs === scannedBarcode || item.barcodeDos === scannedBarcode);
            if (foundItem) {
              handleSelectItem(foundItem);
            } else {
              toast.error("Barang tidak ditemukan.");
            }
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
            <div className="form-control">
              <label className="label"><span className="label-text font-bold">Pilih Toko</span></label>
              <select className="select select-bordered" onChange={(e) => setSelectedStore(JSON.parse(e.target.value))} defaultValue="">
                <option value="" disabled>Pilih Toko Tujuan</option>
                {stores.map(store => <option key={store.id} value={JSON.stringify(store)}>{store.namaToko}</option>)}
              </select>
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
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setSelectedItem(null); }}
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
