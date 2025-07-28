import React, { useState, useEffect } from 'react';
import { ref, onValue, update, push, serverTimestamp, runTransaction } from 'firebase/database';
import { db } from '../firebaseConfig';
import toast from 'react-hot-toast';

function KelolaFakturTertunda({ userProfile }) {
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null); // State untuk melacak item yang sedang diproses

  useEffect(() => {
    if (!userProfile.depotId) return;

    const pendingRef = ref(db, `depots/${userProfile.depotId}/pendingInvoices`);
    const unsubscribe = onValue(pendingRef, (snapshot) => {
      const data = snapshot.val() || {};
      const loadedInvoices = Object.keys(data)
        .map(key => ({ id: key, ...data[key] }))
        .filter(inv => inv.status === 'Menunggu Faktur');

      setPendingInvoices(loadedInvoices.sort((a,b) => b.createdAt - a.createdAt));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile.depotId]);

  const handleCompleteInvoice = async (invoice) => {
    if (!window.confirm(`Selesaikan faktur untuk toko ${invoice.storeName}? Stok akan dipotong dari gudang berdasarkan FEFO.`)) {
      return;
    }

    setProcessingId(invoice.id);
    toast.loading('Memproses dan memotong stok...', { id: 'complete-invoice' });

    try {
      // 1. Potong stok menggunakan logika FEFO untuk setiap item
      for (const item of invoice.items) {
        const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${item.id}`);
        await runTransaction(stockRef, (currentStock) => {
          if (!currentStock || !currentStock.batches || currentStock.totalStockInPcs < item.quantityInPcs) {
            throw new Error(`Stok untuk ${item.name} tidak mencukupi.`);
          }

          const sortedBatches = Object.keys(currentStock.batches)
            .map(key => ({ batchId: key, ...currentStock.batches[key] }))
            .sort((a, b) => new Date(a.expireDate) - new Date(b.expireDate));
          
          let quantityToDeduct = item.quantityInPcs;

          for (const batch of sortedBatches) {
            if (quantityToDeduct <= 0) break;
            const amountToTake = Math.min(quantityToDeduct, batch.quantity);
            
            batch.quantity -= amountToTake;
            quantityToDeduct -= amountToTake;
          }

          if (quantityToDeduct > 0) {
             throw new Error(`Terjadi masalah kalkulasi stok FEFO untuk ${item.name}.`);
          }
          
          currentStock.totalStockInPcs -= item.quantityInPcs;

          sortedBatches.forEach(batch => {
              if (batch.quantity <= 0) {
                  delete currentStock.batches[batch.batchId];
              } else {
                  currentStock.batches[batch.batchId].quantity = batch.quantity;
              }
          });
          
          return currentStock;
        });
      }

      // 2. Buat log transaksi Stok Keluar
      const transactionsRef = ref(db, `depots/${userProfile.depotId}/transactions`);
      await push(transactionsRef, {
        type: 'Stok Keluar',
        invoiceNumber: invoice.invoiceNumber || `TT-${invoice.id.slice(-4)}`, // Generate No jika kosong
        storeName: invoice.storeName,
        items: invoice.items,
        user: userProfile.fullName,
        timestamp: serverTimestamp(),
        salesName: invoice.salesName,
        driverName: invoice.driverName,
        licensePlate: invoice.licensePlate,
        refDoc: invoice.id
      });
      
      // 3. Update status faktur tertunda menjadi "Selesai"
      const pendingRef = ref(db, `depots/${userProfile.depotId}/pendingInvoices/${invoice.id}`);
      await update(pendingRef, {
        status: 'Selesai',
        processedBy: userProfile.fullName,
        processedAt: serverTimestamp()
      });
      
      toast.dismiss('complete-invoice');
      toast.success("Transaksi berhasil diselesaikan dan stok telah dipotong!");

    } catch (error) {
      toast.dismiss('complete-invoice');
      toast.error(`Gagal menyelesaikan transaksi: ${error.message}`);
      console.error("Gagal menyelesaikan transaksi:", error);
    } finally {
        setProcessingId(null);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Proses Tanda Terima / Faktur Tertunda</h1>
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
                      disabled={processingId === invoice.id}
                    >
                      {processingId === invoice.id ? <span className="loading loading-spinner loading-xs"></span> : 'Selesaikan'}
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
