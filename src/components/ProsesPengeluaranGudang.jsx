import React, { useState, useEffect } from 'react';
import { ref, onValue, get, update, push, serverTimestamp, runTransaction, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '../firebaseConfig';
import toast from 'react-hot-toast';

function ProsesPengeluaranGudang({ userProfile }) {
  const [readyOrders, setReadyOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk modal proses
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [stockLocations, setStockLocations] = useState({});
  const [dispatchPlan, setDispatchPlan] = useState({});

  useEffect(() => {
    if (!userProfile.depotId) return;

    const ordersRef = ref(db, `depots/${userProfile.depotId}/salesOrders`);
    const readyToShipQuery = query(ordersRef, orderByChild('status'), equalTo('Siap Dikirim (Sudah Difakturkan)'));
    
    const unsubscribe = onValue(readyToShipQuery, (snapshot) => {
      const data = snapshot.val() || {};
      const loadedOrders = Object.keys(data).map(key => ({ id: key, ...data[key] }));
      setReadyOrders(loadedOrders.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile.depotId]);

  const openDispatchModal = async (order) => {
    setSelectedOrder(order);
    
    // Ambil data stok terkini untuk semua item dalam order
    const locationsData = {};
    for (const item of order.items) {
      const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${item.id}`);
      const snapshot = await get(stockRef);
      if (snapshot.exists()) {
        locationsData[item.id] = snapshot.val().locations || {};
      } else {
        locationsData[item.id] = {};
      }
    }
    setStockLocations(locationsData);
    setDispatchPlan({}); // Reset rencana dispatch
    setIsModalOpen(true);
  };

  const handleDispatchQtyChange = (itemId, locationId, qty) => {
    const newQty = Number(qty);
    setDispatchPlan(prev => ({
        ...prev,
        [itemId]: {
            ...prev[itemId],
            [locationId]: newQty > 0 ? newQty : undefined
        }
    }));
  };

  const handleConfirmDispatch = async () => {
    // Validasi
    for(const item of selectedOrder.items) {
        const totalPicked = Object.values(dispatchPlan[item.id] || {}).reduce((sum, qty) => sum + qty, 0);
        if (totalPicked !== item.quantityInPcs) {
            return toast.error(`Jumlah pengambilan untuk ${item.name} tidak sesuai! Dibutuhkan: ${item.quantityInPcs}, Diambil: ${totalPicked}`);
        }
    }

    if (!window.confirm(`Konfirmasi pengeluaran barang untuk faktur ${selectedOrder.invoiceNumber}?`)) return;

    try {
      // 1. Kurangi stok dari total, alokasi, dan lokasi spesifik
      for (const itemId in dispatchPlan) {
        const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${itemId}`);
        await runTransaction(stockRef, (currentStock) => {
          if (currentStock) {
            const picks = dispatchPlan[itemId];
            let totalPicked = 0;
            for (const locationId in picks) {
                const pickedQty = picks[locationId];
                currentStock.locations[locationId] = (currentStock.locations[locationId] || 0) - pickedQty;
                totalPicked += pickedQty;
            }
            const orderItem = selectedOrder.items.find(i => i.id === itemId);
            currentStock.allocatedStockInPcs = (currentStock.allocatedStockInPcs || 0) - orderItem.quantityInPcs;
          }
          return currentStock;
        });
      }

      // 2. Buat log transaksi "Stok Keluar"
      const transactionsRef = ref(db, `depots/${userProfile.depotId}/transactions`);
      await push(transactionsRef, {
        type: 'Stok Keluar', invoiceNumber: selectedOrder.invoiceNumber,
        storeName: selectedOrder.storeName, items: selectedOrder.items,
        user: userProfile.fullName, timestamp: serverTimestamp()
      });

      // 3. Update status order menjadi "Selesai"
      const orderRef = ref(db, `depots/${userProfile.depotId}/salesOrders/${selectedOrder.id}`);
      await update(orderRef, { status: 'Selesai' });

      toast.success("Barang berhasil dikeluarkan dan transaksi selesai.");
      setIsModalOpen(false);

    } catch (error) {
      toast.error(`Gagal konfirmasi: ${error.message}`);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Daftar Pengeluaran Barang (Gudang)</h1>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="table w-full">
          <thead className="bg-gray-200">
            <tr><th>Tgl Order</th><th>No. Faktur</th><th>Nama Toko</th><th>Admin Faktur</th><th className="text-center">Aksi</th></tr>
          </thead>
          <tbody>
            {loading ? (<tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>) 
            : readyOrders.length === 0 ? (<tr><td colSpan="5" className="text-center">Tidak ada barang yang siap untuk dikeluarkan.</td></tr>)
            : (readyOrders.map(order => (
                <tr key={order.id} className="hover">
                  <td>{new Date(order.createdAt).toLocaleDateString('id-ID')}</td>
                  <td className="font-bold">{order.invoiceNumber}</td>
                  <td>{order.storeName}</td>
                  <td>{order.processedBy}</td>
                  <td className="text-center">
                    <button onClick={() => openDispatchModal(order)} className="btn btn-sm btn-primary">Proses Pengeluaran</button>
                  </td>
                </tr>
              )))}
          </tbody>
        </table>
      </div>
      
      {isModalOpen && selectedOrder && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-3xl">
            <h3 className="font-bold text-lg">Proses Pengeluaran: {selectedOrder.invoiceNumber}</h3>
            <p className="py-2 text-sm"><strong>Toko:</strong> {selectedOrder.storeName}</p>
            <div className="divider my-2">Detail Pengambilan Barang</div>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {selectedOrder.items.map(item => {
                const availableLocs = stockLocations[item.id] || {};
                const totalPicked = Object.values(dispatchPlan[item.id] || {}).reduce((sum, qty) => sum + qty, 0);
                const remaining = item.quantityInPcs - totalPicked;
                return (
                  <div key={item.id} className="card bg-base-200 p-4">
                    <div className="flex justify-between items-center font-bold">
                      <span>{item.name}</span>
                      <span className={`badge ${remaining === 0 ? 'badge-success' : 'badge-error'}`}>
                        Dibutuhkan: {item.quantityInPcs} Pcs | Diambil: {totalPicked} Pcs
                      </span>
                    </div>
                    <div className="text-xs mt-2">Lokasi Tersedia:</div>
                    <div className="space-y-2 mt-1">
                      {Object.keys(availableLocs).length > 0 ? Object.entries(availableLocs).map(([locId, qty]) => (
                        <div key={locId} className="flex items-center gap-2">
                          <label className="label flex-1">
                            <span className="label-text">{locId} <span className="text-gray-500">(Stok: {qty})</span></span>
                          </label>
                          <input 
                            type="number" 
                            placeholder="Qty"
                            className="input input-sm input-bordered w-24"
                            max={qty}
                            min={0}
                            onChange={(e) => handleDispatchQtyChange(item.id, locId, e.target.value)}
                          />
                        </div>
                      )) : <div className="text-xs text-error">Stok untuk item ini tidak ditemukan di lokasi manapun.</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="modal-action mt-6">
                <button onClick={() => setIsModalOpen(false)} className="btn">Batal</button>
                <button onClick={handleConfirmDispatch} className="btn btn-primary">Konfirmasi & Selesaikan Pengeluaran</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProsesPengeluaranGudang;
