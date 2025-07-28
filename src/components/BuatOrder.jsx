import React, { useState, useEffect } from 'react';
// --- 1. IMPORT BARU DARI FIRESTORE ---
import { collection, query, where, onSnapshot, getDoc, doc, runTransaction, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import { addOrderToQueue, getQueuedOrders, removeOrderFromQueue } from '../offlineDb';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import toast from 'react-hot-toast';

const DaftarOrder = ({ userProfile, setView, setEditingOrder, pendingSyncCount }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userProfile || !userProfile.depotId || !userProfile.fullName) return;
        
        const ordersRef = collection(firestoreDb, `depots/${userProfile.depotId}/salesOrders`);
        const salesQuery = query(ordersRef, where('salesName', '==', userProfile.fullName));
        
        const unsubscribe = onSnapshot(salesQuery, (snapshot) => {
            const orderList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a,b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
            setOrders(orderList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userProfile]);

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="card-title text-2xl">Daftar Order Saya</h2>
                <button onClick={() => setView('create')} className="btn btn-primary">+ Buat Order Baru</button>
            </div>
            {pendingSyncCount > 0 && 
                <div role="alert" className="alert alert-warning mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span>Ada {pendingSyncCount} order yang dibuat offline dan menunggu untuk disinkronkan.</span>
                </div>
            }
            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="table w-full">
                    <thead><tr><th>No. Order</th><th>Nama Toko</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr></thead>
                    <tbody>
                        {loading ?
                        (<tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>)
                        : orders.length === 0 ?
                        (<tr><td colSpan="5" className="text-center">Belum ada order dibuat.</td></tr>)
                        : (orders.map(order => (
                            <tr key={order.id}>
                                <td className="font-semibold">{order.orderNumber}</td>
                                <td>{order.storeName}</td>
                                <td>{order.createdAt?.toDate().toLocaleDateString('id-ID')}</td>
                                <td><span className={`badge ${order.status === 'Menunggu Approval Admin' ? 'badge-warning' : 'badge-success'}`}>{order.status}</span></td>
                                <td>
                                    {order.status === 'Menunggu Approval Admin' && (
                                        <button onClick={() => { setEditingOrder(order); setView('edit'); }} className="btn btn-xs btn-info">
                                            Edit
                                        </button>
                                    )}
                                </td>
                            </tr>
                        )))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const FormOrder = ({ userProfile, setView, existingOrder, syncOfflineOrders }) => {
  const [orderNumber, setOrderNumber] = useState(existingOrder?.orderNumber || '');
  const [storeId, setStoreId] = useState(existingOrder?.storeId || '');
  const [tokoList, setTokoList] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemStock, setItemStock] = useState(0);
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  const [orderItems, setOrderItems] = useState(existingOrder?.items || []);
  const [showScanner, setShowScanner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = !!existingOrder;

  useEffect(() => {
    if (!userProfile.depotId) return;

    // Ambil data Toko dari Firestore
    const unsubToko = onSnapshot(collection(firestoreDb, 'master_toko'), (snapshot) => {
        const loadedToko = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTokoList(loadedToko.sort((a, b) => a.namaToko.localeCompare(b.namaToko)));
    });

    // Ambil data master barang dari Firestore
    const masterItemsRef = collection(firestoreDb, 'master_items');
    getDocs(masterItemsRef).then((masterSnapshot) => {
      const masterItems = masterSnapshot.docs.reduce((acc, doc) => {
          acc[doc.id] = { id: doc.id, ...doc.data() };
          return acc;
      }, {});

      // Ambil data stok dari sub-koleksi di Firestore
      const stockRef = collection(firestoreDb, `depots/${userProfile.depotId}/stock`);
      const unsubStock = onSnapshot(stockRef, (stockSnapshot) => {
        const available = stockSnapshot.docs
          .filter(doc => (doc.data().totalStockInPcs || 0) > 0)
          .map(doc => ({ 
              id: doc.id, 
              ...masterItems[doc.id], 
              totalStockInPcs: doc.data().totalStockInPcs 
          }));
        setAvailableItems(available);
      });
      return unsubStock;
    });

    return () => {
        unsubToko();
    };
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
  
  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setSearchTerm(item.name);
    setItemStock(item.totalStockInPcs);
  };

  const handleAddItemToList = () => {
    if (!selectedItem) { toast.error("Pilih barang dulu."); return; }
    const totalPcs = (Number(dosQty) * (selectedItem.conversions.Dos?.inPcs || 1)) + (Number(packQty) * (selectedItem.conversions.Pack?.inPcs || 1)) + (Number(pcsQty));
    if (totalPcs <= 0) { toast.error("Masukkan jumlah yang valid."); return; }
    if (totalPcs > itemStock) { toast.error(`Stok tidak cukup! Sisa stok hanya ${itemStock} Pcs.`); return; }
    
    setOrderItems([...orderItems, { 
        id: selectedItem.id, 
        name: selectedItem.name, 
        quantityInPcs: totalPcs, 
        displayQty: `${dosQty}.${packQty}.${pcsQty}` 
    }]);
    setSelectedItem(null); setSearchTerm(''); setDosQty(0); setPackQty(0); setPcsQty(0);
  };

  const handleRemoveFromList = (indexToRemove) => {
    setOrderItems(orderItems.filter((_, index) => index !== indexToRemove));
  };

  const handleSaveOrder = async () => {
    if (!orderNumber || !storeId || orderItems.length === 0) {
      return toast.error("No. Order, Nama Toko, dan minimal 1 barang wajib diisi.");
    }
    setIsSubmitting(true);

    const selectedToko = tokoList.find(t => t.id === storeId);

    const orderData = {
      orderNumber, 
      storeId,
      storeName: selectedToko.namaToko, 
      items: orderItems,
      depotId: userProfile.depotId, 
      salesName: userProfile.fullName,
      status: 'Menunggu Approval Admin',
      ...(isEditMode && { orderId: existingOrder.id, oldItems: existingOrder.items })
    };

    if (navigator.onLine) {
      await syncOfflineOrders([orderData], true);
    } else {
      const success = await addOrderToQueue(orderData);
      if (success) {
        toast.success("Koneksi offline. Order disimpan lokal & akan disinkronkan otomatis.");
        setView('list');
      } else {
        toast.error("Gagal menyimpan order di penyimpanan lokal.");
      }
    }
    setIsSubmitting(false);
  };
  
  const filteredItems = searchTerm.length > 0
    ? availableItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  return (
    <>
      {showScanner && <CameraBarcodeScanner onScan={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
      <div className="p-4 md:p-8">
        <div className="card bg-white shadow-lg w-full">
          <div className="card-body">
            <div className="flex justify-between items-center">
                <h2 className="card-title text-2xl">{isEditMode ? 'Edit Order Penjualan' : 'Buat Order Penjualan'}</h2>
                <button onClick={() => setView('list')} className="btn btn-ghost">Kembali ke Daftar</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 border rounded-lg">
              <div className="form-control"><label className="label"><span className="label-text font-bold">No. Order / PO</span></label><input type="text" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className="input input-bordered" /></div>
              <div className="form-control"><label className="label"><span className="label-text font-bold">Nama Toko</span></label>
                <select className="select select-bordered" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                    <option value="">Pilih Toko</option>
                    {tokoList.map(toko => <option key={toko.id} value={toko.id}>{toko.namaToko}</option>)}
                </select>
              </div>
            </div>
            <div className="divider">Detail Barang</div>
            <div className="p-4 border rounded-lg bg-base-200">
              <div className="form-control dropdown"><label className="label"><span className="label-text">Cari Barang (Scan atau Ketik Nama)</span></label><div className="join w-full"><input type="text" placeholder="Hanya barang dengan stok tersedia akan muncul" className="input input-bordered join-item w-full" value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setSelectedItem(null);}}/><button type="button" onClick={() => setShowScanner(true)} className="btn btn-primary join-item">Scan</button></div>
                {filteredItems.length > 0 && !selectedItem && (
                  <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                    {filteredItems.slice(0, 5).map(item => ( <li key={item.id}><a onClick={() => handleSelectItem(item)}>{item.name} (Stok: {item.totalStockInPcs})</a></li> ))}
                  </ul>
                )}
              </div>
              {selectedItem && (
                <div className="mt-4"><p className="font-bold">Barang Terpilih: {selectedItem.name}</p><p className="text-sm">Sisa Stok Tersedia: <span className='font-bold text-lg'>{itemStock}</span> Pcs</p><div className="mt-2 grid grid-cols-3 md:grid-cols-4 gap-4 items-end"><div className="form-control"><label className="label-text">DOS</label><input type="number" value={dosQty} onChange={(e) => setDosQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div><div className="form-control"><label className="label-text">PACK</label><input type="number" value={packQty} onChange={(e) => setPackQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div><div className="form-control"><label className="label-text">PCS</label><input type="number" value={pcsQty} onChange={(e) => setPcsQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div><button type="button" onClick={handleAddItemToList} className="btn btn-secondary">Tambah ke Order</button></div></div>
              )}
            </div>
            <div className="divider">Barang dalam Order Ini</div>
            <div className="overflow-x-auto"><table className="table w-full"><thead><tr><th>Nama Barang</th><th>Jumlah Dipesan</th><th>Aksi</th></tr></thead><tbody>{orderItems.map((item, index) => (<tr key={index}><td>{item.name}</td><td>{item.displayQty}</td><td><button onClick={() => handleRemoveFromList(index)} className="btn btn-xs btn-error">Hapus</button></td></tr>))}</tbody></table></div>
            <div className="form-control mt-6">
                <button onClick={handleSaveOrder} className="btn btn-primary btn-lg" disabled={orderItems.length === 0 || isSubmitting}>
                    {isSubmitting ? <span className="loading loading-spinner"></span> : 'Simpan Order'}
                </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
function BuatOrder({ userProfile }) {
  const [view, setView] = useState('list');
  const [editingOrder, setEditingOrder] = useState(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncOfflineOrders = async (ordersToSync, isOnlineSave = false) => {
      if(isSyncing && !isOnlineSave) return;
      setIsSyncing(true);
      
      let successCount = 0;
      for (const order of ordersToSync) {
          try {
              // --- 2. LOGIKA TRANSAKSI BARU UNTUK FIRESTORE ---
              await runTransaction(firestoreDb, async (transaction) => {
                  // Jika ini mode edit, kembalikan stok lama dulu
                  if (order.orderId && order.oldItems) {
                      for (const oldItem of order.oldItems) {
                          const stockDocRef = doc(firestoreDb, `depots/${order.depotId}/stock/${oldItem.id}`);
                          const stockDoc = await transaction.get(stockDocRef);
                          if (stockDoc.exists()) {
                              const newAllocated = (stockDoc.data().allocatedStockInPcs || 0) - oldItem.quantityInPcs;
                              const newTotal = (stockDoc.data().totalStockInPcs || 0) + oldItem.quantityInPcs;
                              transaction.update(stockDocRef, { allocatedStockInPcs: newAllocated, totalStockInPcs: newTotal });
                          }
                      }
                  }

                  // Alokasikan stok baru
                  for (const item of order.items) {
                      const stockDocRef = doc(firestoreDb, `depots/${order.depotId}/stock/${item.id}`);
                      const stockDoc = await transaction.get(stockDocRef);
                      if (!stockDoc.exists() || (stockDoc.data().totalStockInPcs || 0) < item.quantityInPcs) {
                          throw new Error(`Stok ${item.name} tidak cukup.`);
                      }
                      const newTotal = stockDoc.data().totalStockInPcs - item.quantityInPcs;
                      const newAllocated = (stockDoc.data().allocatedStockInPcs || 0) + item.quantityInPcs;
                      transaction.update(stockDocRef, { totalStockInPcs: newTotal, allocatedStockInPcs: newAllocated });
                  }

                  // Simpan/Update data order ke Firestore
                  const dataToSave = {
                      orderNumber: order.orderNumber, storeId: order.storeId, storeName: order.storeName, 
                      items: order.items, status: order.status, salesName: order.salesName, 
                      createdAt: serverTimestamp()
                  };

                  if (order.orderId) { // Mode Edit
                      const orderDocRef = doc(firestoreDb, `depots/${order.depotId}/salesOrders/${order.orderId}`);
                      transaction.update(orderDocRef, dataToSave);
                  } else { // Mode Create
                      const newOrderRef = doc(collection(firestoreDb, `depots/${order.depotId}/salesOrders`));
                      transaction.set(newOrderRef, dataToSave);
                  }
              });

              if (order.localId) {
                  await removeOrderFromQueue(order.localId);
              }
              successCount++;
          } catch (err) {
              toast.error(`Gagal sinkronisasi order ${order.orderNumber}: ${err.message}`);
              // Di Firestore, transaksi bersifat atomik. Jika gagal, tidak ada perubahan yang disimpan, jadi tidak perlu mengembalikan stok secara manual.
              break;
          }
      }
      
      if(successCount > 0) toast.success(`${successCount} order berhasil disinkronkan ke server.`);
      checkPendingOrders();
      setIsSyncing(false);

      if(isOnlineSave) setView('list');
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

  useEffect(() => {
    checkPendingOrders();
    window.addEventListener('online', checkPendingOrders);
    return () => window.removeEventListener('online', checkPendingOrders);
  }, []);

  const renderView = () => {
    switch(view) {
        case 'create':
            return <FormOrder userProfile={userProfile} setView={setView} syncOfflineOrders={syncOfflineOrders} />;
        case 'edit':
            return <FormOrder userProfile={userProfile} setView={setView} existingOrder={editingOrder} syncOfflineOrders={syncOfflineOrders} />;
        default:
            return <DaftarOrder userProfile={userProfile} setView={setView} setEditingOrder={setEditingOrder} pendingSyncCount={pendingSyncCount} />;
    }
  };

  return <>{renderView()}</>;
}

export default BuatOrder;
