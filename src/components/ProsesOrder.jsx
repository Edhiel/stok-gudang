import React, { useState, useEffect } from 'react';
import { ref, onValue, update, push, serverTimestamp } from 'firebase/database';
import { db } from '../firebaseConfig';
// import TombolKembali from './TombolKembali'; // <-- Baris ini dihapus

function ProsesOrder({ userProfile, setPage }) { // <-- setPage tetap ada, tidak masalah
  const [salesOrders, setSalesOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');

  useEffect(() => {
    if (!userProfile.depotId) return;

    const ordersRef = ref(db, `depots/${userProfile.depotId}/salesOrders`);
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const loadedOrders = Object.keys(data)
        .map(key => ({ id: key, ...data[key] }))
        .filter(order => order.status === 'Menunggu Approval Admin'); 

      setSalesOrders(loadedOrders.sort((a,b) => b.createdAt - a.createdAt));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile.depotId]);

  const handleOpenModal = (order) => {
    setSelectedOrder(order);
    setInvoiceNumber('');
    document.getElementById('proses_order_modal').showModal();
  };

  const handleProcessOrder = async () => {
    if (!selectedOrder || !invoiceNumber) {
      alert("Nomor faktur wajib diisi.");
      return;
    }
    
    const orderRef = ref(db, `depots/${userProfile.depotId}/salesOrders/${selectedOrder.id}`);
    try {
      await update(orderRef, {
        status: 'Siap Kirim (Sudah Difakturkan)',
        invoiceNumber: invoiceNumber,
        processedBy: userProfile.fullName
      });
      document.getElementById('proses_order_modal').close();
      alert("Order berhasil diproses menjadi faktur.");
    } catch (error) {
      console.error("Gagal memproses order:", error);
      alert("Terjadi kesalahan.");
    }
  };

  return (
    <>
      <div className="p-8">
        {/* <TombolKembali setPage={setPage} /> <-- Baris ini dihapus */}
        <h1 className="text-3xl font-bold mb-6">Proses Order Penjualan</h1>
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="table w-full">
            <thead className="bg-gray-200">
              <tr>
                <th>Tgl Order</th>
                <th>No. Order</th>
                <th>Nama Sales</th>
                <th>Toko Tujuan</th>
                <th>Jumlah Item</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center"><span className="loading loading-dots"></span></td></tr>
              ) : (
                salesOrders.map(order => (
                  <tr key={order.id}>
                    <td>{new Date(order.createdAt).toLocaleString('id-ID')}</td>
                    <td>{order.orderNumber}</td>
                    <td>{order.salesName}</td>
                    <td>{order.storeName}</td>
                    <td>{order.items.length} jenis</td>
                    <td><button onClick={() => handleOpenModal(order)} className="btn btn-sm btn-success">Proses Faktur</button></td>
                  </tr>
                ))
              )}
              {!loading && salesOrders.length === 0 && (
                  <tr><td colSpan="6" className="text-center">Tidak ada order baru yang perlu diproses.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal untuk proses order */}
      <dialog id="proses_order_modal" className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">Proses Order untuk: {selectedOrder?.storeName}</h3>
          <p className="py-2 text-sm">Salin data dari order ini ke aplikasi ND6 untuk membuat faktur, lalu masukkan nomor faktur resmi di bawah ini.</p>
          <div className="form-control w-full mt-4">
            <label className="label"><span className="label-text">Masukkan No. Faktur dari ND6</span></label>
            <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="No. Faktur Resmi" className="input input-bordered" />
          </div>
          <div className="modal-action">
            <button className="btn btn-primary" onClick={handleProcessOrder}>Simpan & Konfirmasi Faktur</button>
            <form method="dialog"><button className="btn">Batal</button></form>
          </div>
        </div>
      </dialog>
    </>
  );
}

export default ProsesOrder;