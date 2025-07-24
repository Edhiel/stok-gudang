import React, { useState, useEffect } from 'react';
import { ref, onValue, update, push, serverTimestamp, runTransaction } from 'firebase/database';
import { db } from '../firebaseConfig';
import toast from 'react-hot-toast'; // Menggunakan toast untuk notifikasi

function ProsesPengeluaranGudang({ userProfile }) {
  const [readyOrders, setReadyOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!userProfile.depotId) return;

    const ordersRef = ref(db, `depots/${userProfile.depotId}/salesOrders`);
    // Query order yang sudah difakturkan dan siap dikeluarkan
    const readyToShipQuery = query(ordersRef, orderByChild('status'), equalTo('Siap Dikirim (Sudah Difakturkan)'));
    
    const unsubscribe = onValue(readyToShipQuery, (snapshot) => {
      const data = snapshot.val() || {};
      const loadedOrders = Object.keys(data)
        .map(key => ({ id: key, ...data[key] }));

      setReadyOrders(loadedOrders.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile.depotId]);

  const handleConfirmShipment = async (order) => {
    if (!window.confirm(`Konfirmasi pengeluaran barang untuk faktur ${order.invoiceNumber}? Stok yang di-booking akan dikurangi secara permanen.`)) {
      return;
    }

    try {
      // 1. Kurangi stok yang dialokasikan (allocatedStock)
      for (const item of order.items) {
        const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${item.id}`);
        await runTransaction(stockRef, (currentStock) => {
          if (currentStock) {
            currentStock.allocatedStockInPcs = (currentStock.allocatedStockInPcs || 0) - item.quantityInPcs;
          }
          return currentStock;
        });
      }

      // 2. Buat log transaksi "Stok Keluar" yang resmi
      const transactionsRef = ref(db, `depots/${userProfile.depotId}/transactions`);
      await push(transactionsRef, {
        type: 'Stok Keluar',
        invoiceNumber: order.invoiceNumber,
        storeName: order.storeName,
        items: order.items,
        user: userProfile.fullName,
        timestamp: serverTimestamp()
      });

      // 3. Update status order menjadi "Selesai"
      const orderRef = ref(db, `depots/${userProfile.depotId}/salesOrders/${order.id}`);
      await update(orderRef, {
        status: 'Selesai'
      });

      toast.success("Barang berhasil dikeluarkan dan transaksi selesai.");

    } catch (error) {
      console.error("Gagal konfirmasi pengeluaran:", error);
      toast.error("Terjadi kesalahan saat konfirmasi.");
    }
  };
  
  const openDetailModal = (order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Daftar Pengeluaran Barang (Gudang)</h1>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="table w-full">
          <thead className="bg-gray-200">
            <tr>
              <th>Tgl Order</th>
              <th>No. Faktur</th>
              <th>Nama Toko</th>
              <th>Admin Faktur</th>
              <th className="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>
            ) : (
              readyOrders.map(order => (
                <tr key={order.id} className="hover">
                  <td>{new Date(order.createdAt).toLocaleDateString('id-ID')}</td>
                  <td className="font-bold">{order.invoiceNumber}</td>
                  <td>{order.storeName}</td>
                  <td>{order.processedBy}</td>
                  <td className="flex justify-center gap-2">
                    <button 
                      onClick={() => openDetailModal(order)}
                      className="btn btn-xs btn-outline btn-info"
                    >
                      Detail
                    </button>
                    <button 
                      onClick={() => handleConfirmShipment(order)} 
                      className="btn btn-xs btn-primary"
                    >
                      Konfirmasi Keluar
                    </button>
                  </td>
                </tr>
              ))
            )}
            {!loading && readyOrders.length === 0 && (
                <tr><td colSpan="5" className="text-center">Tidak ada barang yang siap untuk dikeluarkan.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Modal untuk Detail Order */}
      {isModalOpen && selectedOrder && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-lg">
            <h3 className="font-bold text-lg">Detail Faktur: {selectedOrder.invoiceNumber}</h3>
            <p className="py-2 text-sm"><strong>Toko:</strong> {selectedOrder.storeName}</p>
            <p className="text-sm"><strong>Sales:</strong> {selectedOrder.salesName}</p>
            <div className="divider my-2">Barang Keluar</div>
            <div className="overflow-x-auto max-h-60 bg-base-200 rounded-lg">
                <table className="table table-compact w-full">
                    <thead><tr><th>Nama Barang</th><th>Jumlah (D.P.P)</th></tr></thead>
                    <tbody>
                        {selectedOrder.items.map((item, index) => (
                            <tr key={index}>
                                <td>{item.name}</td>
                                <td>{item.displayQty}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="modal-action">
                <button onClick={() => setIsModalOpen(false)} className="btn">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProsesPengeluaranGudang;
