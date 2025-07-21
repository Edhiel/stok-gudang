import React, { useState, useEffect } from 'react';
import { ref, onValue, update, push, serverTimestamp, runTransaction } from 'firebase/database';
import { db } from '../firebaseConfig';
// import TombolKembali from './TombolKembali'; // <-- Baris ini dihapus

function ProsesPengeluaranGudang({ userProfile, setPage }) {
  const [readyOrders, setReadyOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile.depotId) return;

    const ordersRef = ref(db, `depots/${userProfile.depotId}/salesOrders`);
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const loadedOrders = Object.keys(data)
        .map(key => ({ id: key, ...data[key] }))
        .filter(order => order.status === 'Siap Kirim (Sudah Difakturkan)'); // Hanya tampilkan yang siap kirim

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

      alert("Barang berhasil dikeluarkan dan transaksi selesai.");

    } catch (error) {
      console.error("Gagal konfirmasi pengeluaran:", error);
      alert("Terjadi kesalahan saat konfirmasi.");
    }
  };

  return (
    <div className="p-8">
      {/* <TombolKembali setPage={setPage} /> <-- Baris ini dihapus */}
      <h1 className="text-3xl font-bold mb-6">Daftar Pengeluaran Barang (Gudang)</h1>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="table w-full">
          <thead className="bg-gray-200">
            <tr>
              <th>Tgl Order</th>
              <th>No. Faktur</th>
              <th>Nama Toko</th>
              <th>Diproses oleh Admin</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>
            ) : (
              readyOrders.map(order => (
                <tr key={order.id}>
                  <td>{new Date(order.createdAt).toLocaleDateString('id-ID')}</td>
                  <td className="font-bold">{order.invoiceNumber}</td>
                  <td>{order.storeName}</td>
                  <td>{order.processedBy}</td>
                  <td>
                    <button 
                      onClick={() => handleConfirmShipment(order)} 
                      className="btn btn-sm btn-primary"
                    >
                      Konfirmasi Barang Keluar
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
    </div>
  );
}

export default ProsesPengeluaranGudang;