import React, { useState, useEffect } from 'react';
import { ref, onValue, update, push, serverTimestamp } from 'firebase/database';
import { db } from '../firebaseConfig';

function KelolaFakturTertunda({ userProfile }) {
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile.depotId) return;

    const pendingRef = ref(db, `depots/${userProfile.depotId}/pendingInvoices`);
    const unsubscribe = onValue(pendingRef, (snapshot) => {
      const data = snapshot.val() || {};
      const loadedInvoices = Object.keys(data)
        .map(key => ({ id: key, ...data[key] }))
        .filter(inv => inv.status === 'Menunggu Faktur'); // Hanya tampilkan yang masih pending

      setPendingInvoices(loadedInvoices.sort((a,b) => b.createdAt - a.createdAt));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile.depotId]);

  const handleCompleteInvoice = async (invoice) => {
    if (!window.confirm(`Selesaikan faktur untuk toko ${invoice.storeName}? Stok sudah dikurangi, aksi ini hanya akan membuat log transaksi Stok Keluar.`)) {
      return;
    }

    const pendingRef = ref(db, `depots/${userProfile.depotId}/pendingInvoices/${invoice.id}`);
    const transactionsRef = ref(db, `depots/${userProfile.depotId}/transactions`);

    try {
      // 1. Buat log transaksi Stok Keluar
      await push(transactionsRef, {
        type: 'Stok Keluar',
        invoiceNumber: invoice.invoiceNumber,
        storeName: invoice.storeName,
        items: invoice.items,
        user: userProfile.fullName,
        timestamp: serverTimestamp(),
        // Tambahkan detail lain jika perlu
        salesName: invoice.salesName,
        driverName: invoice.driverName,
        licensePlate: invoice.licensePlate,
      });

      // 2. Update status faktur tertunda menjadi "Selesai"
      await update(pendingRef, {
        status: 'Selesai'
      });

      alert("Transaksi berhasil diselesaikan!");

    } catch (error) {
      console.error("Gagal menyelesaikan transaksi:", error);
      alert("Terjadi kesalahan.");
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Proses Faktur Tertunda</h1>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="table w-full">
          <thead className="bg-gray-200">
            <tr>
              <th>Tanggal Dibuat</th>
              <th>Nama Sales</th>
              <th>Toko Tujuan</th>
              <th>Jumlah Item</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>
            ) : (
              pendingInvoices.map(invoice => (
                <tr key={invoice.id}>
                  <td>{new Date(invoice.createdAt).toLocaleString('id-ID')}</td>
                  <td>{invoice.salesName}</td>
                  <td>{invoice.storeName}</td>
                  <td>{invoice.items.length} jenis</td>
                  <td>
                    <button 
                      onClick={() => handleCompleteInvoice(invoice)} 
                      className="btn btn-sm btn-success"
                    >
                      Selesaikan
                    </button>
                  </td>
                </tr>
              ))
            )}
            { !loading && pendingInvoices.length === 0 && (
                <tr><td colSpan="5" className="text-center">Tidak ada faktur yang menunggu untuk diproses.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default KelolaFakturTertunda;