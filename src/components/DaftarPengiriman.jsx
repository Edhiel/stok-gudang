import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';

function DaftarPengiriman({ userProfile }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!userProfile?.depotId) {
        setLoading(false);
        return;
    };

    const ordersRef = collection(firestoreDb, `depots/${userProfile.depotId}/salesOrders`);
    
    // Query ini mengambil semua order dengan status "Dalam Pengiriman" di depo ini
    const q = query(ordersRef, 
        where('status', '==', 'Dalam Pengiriman')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const deliveryList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDeliveries(deliveryList.sort((a,b) => a.createdAt.toMillis() - b.createdAt.toMillis()));
      setLoading(false);
    }, (error) => {
        toast.error("Gagal memuat data pengiriman.");
        console.error("Error fetching deliveries: ", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile]);

  const handleUpdateStatus = async (orderId, newStatus, reason = '') => {
    if (!window.confirm(`Anda yakin ingin mengubah status order menjadi "${newStatus}"?`)) return;

    setIsSubmitting(true);
    const orderDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/salesOrders`, orderId);

    try {
      await updateDoc(orderDocRef, {
        status: newStatus,
        rejectionReason: reason,
        finalizedBy: userProfile.fullName,
        finalizedAt: serverTimestamp()
      });
      toast.success(`Status order berhasil diubah menjadi ${newStatus}.`);
      if (isModalOpen) {
        setIsModalOpen(false);
        setSelectedOrder(null);
      }
    } catch (error) {
      toast.error("Gagal memperbarui status: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRejectionModal = (order) => {
    setSelectedOrder(order);
    setRejectionReason('');
    setIsModalOpen(true);
  };

  if (loading) {
    return <div className="p-8 text-center"><span className="loading loading-spinner loading-lg"></span></div>;
  }

  return (
    <>
      <div className="p-4 sm:p-8">
        <h1 className="text-3xl font-bold mb-6">Daftar Pengiriman Tim</h1>
        {deliveries.length === 0 ? (
          <div className="text-center p-10 bg-white rounded-lg shadow">
            <p className="text-2xl">👍</p>
            <p className="font-semibold mt-2">Tidak ada pengiriman yang perlu diantar saat ini.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {deliveries.map(order => (
              <div key={order.id} className="card bg-white shadow-md">
                <div className="card-body p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-gray-500">No. Order: {order.orderNumber}</p>
                      <h2 className="card-title text-lg">{order.storeName}</h2>
                      <p className="text-sm font-semibold">Faktur: {order.invoiceNumber}</p>
                      <p className="text-sm text-gray-600">Sopir PJ: {order.driverName}</p>
                    </div>
                    <span className="badge badge-info">Dalam Pengiriman</span>
                  </div>
                  <div className="divider my-2"></div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button onClick={() => handleUpdateStatus(order.id, 'Terkirim')} className="btn btn-sm btn-success">Terkirim</button>
                    <button onClick={() => openRejectionModal(order)} className="btn btn-sm btn-error">Ditolak</button>
                    <button onClick={() => handleUpdateStatus(order.id, 'Masalah Pengiriman')} className="btn btn-sm btn-warning">Masalah</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && selectedOrder && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Alasan Penolakan</h3>
            <p className="py-2 text-sm">Untuk Order: <strong>{selectedOrder.orderNumber}</strong></p>
            <div className="form-control mt-4">
              <textarea 
                className="textarea textarea-bordered" 
                placeholder="Toko tutup, barang tidak sesuai, pembayaran bermasalah, dll."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              ></textarea>
            </div>
            <div className="modal-action">
              <button onClick={() => setIsModalOpen(false)} className="btn" disabled={isSubmitting}>Batal</button>
              <button 
                onClick={() => handleUpdateStatus(selectedOrder.id, 'Ditolak Pelanggan', rejectionReason)} 
                className="btn btn-primary"
                disabled={!rejectionReason || isSubmitting}
              >
                {isSubmitting ? <span className="loading loading-spinner"></span> : 'Simpan Alasan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DaftarPengiriman;
