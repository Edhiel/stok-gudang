import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, runTransaction, addDoc, serverTimestamp } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';

function KelolaFakturTertunda({ userProfile }) {
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (!userProfile.depotId) return;

    const pendingRef = collection(firestoreDb, `depots/${userProfile.depotId}/pendingInvoices`);
    const q = query(pendingRef, where('status', '==', 'Menunggu Faktur'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedInvoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      setPendingInvoices(loadedInvoices);
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
        await runTransaction(firestoreDb, async (transaction) => {
            // 1. Potong stok menggunakan logika FEFO untuk setiap item
            for (const item of invoice.items) {
                const stockDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/stock/${item.id}`);
                const stockDoc = await transaction.get(stockDocRef);

                if (!stockDoc.exists() || !stockDoc.data().batches || stockDoc.data().totalStockInPcs < item.quantityInPcs) {
                    throw new Error(`Stok untuk ${item.name} tidak mencukupi.`);
                }

                let currentStockData = stockDoc.data();
                const sortedBatches = Object.keys(currentStockData.batches)
                    .map(key => ({ batchId: key, ...currentStockData.batches[key] }))
                    .sort((a, b) => new Date(a.expireDate) - new Date(b.expireDate));
                
                let quantityToDeduct = item.quantityInPcs;

                for (const batch of sortedBatches) {
                    if (quantityToDeduct <= 0) break;
                    const amountToTake = Math.min(quantityToDeduct, batch.quantity);
                    
                    const batchInDb = currentStockData.batches[batch.batchId];
                    if (batchInDb) {
                        batchInDb.quantity -= amountToTake;
                        if (batchInDb.quantity <= 0) {
                            delete currentStockData.batches[batch.batchId];
                        }
                    }
                    quantityToDeduct -= amountToTake;
                }

                if (quantityToDeduct > 0) {
                    throw new Error(`Terjadi masalah kalkulasi stok FEFO untuk ${item.name}.`);
                }
                
                currentStockData.totalStockInPcs -= item.quantityInPcs;
                transaction.set(stockDocRef, currentStockData); // set menimpa seluruh dokumen dengan data baru
            }

            // 2. Update status faktur tertunda menjadi "Selesai"
            const pendingDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/pendingInvoices/${invoice.id}`);
            transaction.update(pendingDocRef, {
                status: 'Selesai',
                processedBy: userProfile.fullName,
                processedAt: serverTimestamp()
            });
        });

      // 3. Buat log transaksi Stok Keluar (dilakukan setelah transaksi stok berhasil)
      const transactionsRef = collection(firestoreDb, `depots/${userProfile.depotId}/transactions`);
      await addDoc(transactionsRef, {
        type: 'Stok Keluar',
        invoiceNumber: invoice.invoiceNumber || `TT-${invoice.id.slice(-4)}`,
        storeName: invoice.storeName,
        storeId: invoice.storeId,
        items: invoice.items,
        user: userProfile.fullName,
        timestamp: serverTimestamp(),
        salesName: invoice.salesName,
        driverName: invoice.driverName,
        licensePlate: invoice.licensePlate,
        refDoc: invoice.id
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
                  <td>{invoice.createdAt.toDate().toLocaleString('id-ID')}</td>
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
