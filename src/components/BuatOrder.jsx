import React, { useState, useEffect } from 'react';
import { ref, onValue, get, runTransaction, push, serverTimestamp, query, orderByChild, equalTo, update } from 'firebase/database';
import { db as firebaseDb } from '../firebaseConfig';
import { db as offlineDb, addOrderToQueue, getQueuedOrders, removeOrderFromQueue } from '../offlineDb';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import toast from 'react-hot-toast';

// Komponen untuk menampilkan daftar order yang sudah dibuat
const DaftarOrder = ({ userProfile, setView, setEditingOrder, pendingSyncCount }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ordersRef = ref(firebaseDb, `depots/${userProfile.depotId}/salesOrders`);
        const salesQuery = query(ordersRef, orderByChild('salesName'), equalTo(userProfile.fullName));
        
        onValue(salesQuery, (snapshot) => {
            const data = snapshot.val() || {};
            const orderList = Object.keys(data).map(key => ({ id: key, ...data[key] })).sort((a,b) => b.createdAt - a.createdAt);
            setOrders(orderList);
            setLoading(false);
        });
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
                        {loading ? (<tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>)
                        : orders.length === 0 ? (<tr><td colSpan="5" className="text-center">Belum ada order dibuat.</td></tr>)
                        : (orders.map(order => (
                            <tr key={order.id}>
                                <td className="font-semibold">{order.orderNumber}</td>
                                <td>{order.storeName}</td>
                                <td>{new Date(order.createdAt).toLocaleDateString('id-ID')}</td>
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

// Komponen untuk Form membuat dan mengedit order
const FormOrder = ({ userProfile, setView, existingOrder, syncOfflineOrders }) => {
  const [orderNumber, setOrderNumber] = useState(existingOrder?.orderNumber || '');
  const [storeName, setStoreName] = useState(existingOrder?.storeName || '');
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
    const masterItemsRef = ref(firebaseDb, 'master_items');
    get(masterItemsRef).then((masterSnapshot) => {
      const masterItems = masterSnapshot.val() || {};
      const stockRef = ref(firebaseDb, `depots/${userProfile.depotId}/stock`);
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
    setOrderItems([...orderItems, { id: selectedItem.id, name: selectedItem.name, quantityInPcs: totalPcs, displayQty: `${dosQty}.${packQty}.${pcsQty}` }]);
    setSelectedItem(null); setSearchTerm(''); setDosQty(0); setPackQty(0); setPcsQty(0);
  };

  const handleRemoveFromList = (indexToRemove) => {
    setOrderItems(orderItems.filter((_, index) => index !== indexToRemove));
  };
  
  const handleSaveOrder = async () => {
    if (!orderNumber || !storeName || orderItems.length === 0) {
      return toast.error("No. Order, Nama Toko, dan minimal 1 barang wajib diisi.");
    }
    setIsSubmitting(true);

    const orderData = {
      orderNumber, storeName, items: orderItems,
      depotId: userProfile.depotId, salesName: userProfile.fullName,
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
              <div className="form-control"><label className="label"><span className="label-text font-bold">Nama Toko</span></label><input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} className="input input-bordered" /></div>
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
// Komponen Utama
function BuatOrder({ userProfile }) {
  const [view, setView] = useState('list'); // list, create, edit
  const [editingOrder, setEditingOrder] = useState(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fungsi untuk sinkronisasi order offline ke Firebase
  const syncOfflineOrders = async (ordersToSync, isOnlineSave = false) => {
      if(isSyncing && !isOnlineSave) return;
      setIsSyncing(true);
      
      let successCount = 0;
      for (const order of ordersToSync) {
          try {
              // Jika ini mode edit, kembalikan stok lama dulu
              if (order.orderId && order.oldItems) {
                  for (const oldItem of order.oldItems) {
                      const stockRef = ref(firebaseDb, `depots/${order.depotId}/stock/${oldItem.id}`);
                      await runTransaction(stockRef, (stock) => {
                          if (stock) {
                              stock.allocatedStockInPcs = (stock.allocatedStockInPcs || 0) - oldItem.quantityInPcs;
                              stock.totalStockInPcs = (stock.totalStockInPcs || 0) + oldItem.quantityInPcs;
                          }
                          return stock;
                      });
                  }
              }
              // Alokasikan stok baru
              for (const item of order.items) {
                  const stockRef = ref(firebaseDb, `depots/${order.depotId}/stock/${item.id}`);
                  await runTransaction(stockRef, (stock) => {
                      if (stock && (stock.totalStockInPcs || 0) >= item.quantityInPcs) {
                          stock.totalStockInPcs -= item.quantityInPcs;
                          stock.allocatedStockInPcs = (stock.allocatedStockInPcs || 0) + item.quantityInPcs;
                          return stock;
                      } else {
                          throw new Error(`Stok ${item.name} tidak cukup.`);
                      }
                  });
              }

              // Simpan/Update data order ke Firebase
              const dataToSave = {
                  orderNumber: order.orderNumber, storeName: order.storeName, items: order.items,
                  status: order.status, salesName: order.salesName, createdAt: serverTimestamp()
              };

              if (order.orderId) { // Mode Edit
                  const orderRef = ref(firebaseDb, `depots/${order.depotId}/salesOrders/${order.orderId}`);
                  await update(orderRef, dataToSave);
              } else { // Mode Create
                  const ordersRef = ref(firebaseDb, `depots/${order.depotId}/salesOrders`);
                  await push(ordersRef, dataToSave);
              }

              // Jika ini dari antrean offline, hapus dari IndexedDB
              if (order.localId) {
                  await removeOrderFromQueue(order.localId);
              }
              successCount++;
          } catch (err) {
              toast.error(`Gagal sinkronisasi order ${order.orderNumber}: ${err.message}`);
              // PENTING: Jika gagal, stok yang sudah terlanjur dialokasikan harus dikembalikan
              // Logika ini bisa ditambahkan untuk membuatnya lebih tangguh
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
