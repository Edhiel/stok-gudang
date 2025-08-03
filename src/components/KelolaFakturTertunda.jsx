import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, runTransaction, addDoc, serverTimestamp } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';

function KelolaFakturTertunda({ userProfile }) {
  const [pendingReceipts, setPendingReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!userProfile?.depotId) {
        setLoading(false);
        return;
    };
    
    // Mengambil data dari koleksi 'tandaTerima' yang baru
    const receiptsRef = collection(firestoreDb, `depots/${userProfile.depotId}/tandaTerima`);
    const q = query(receiptsRef, where('status', '==', 'pending'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const receiptList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPendingReceipts(receiptList.sort((a,b) => a.createdAt.toMillis() - b.createdAt.toMillis()));
      setLoading(false);
    }, (error) => {
        toast.error("Gagal memuat data Tanda Terima.");
        setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile]);

  const handleOpenModal = (receipt) => {
    setSelectedReceipt(receipt);
    setInvoiceNumber('');
    setIsModalOpen(true);
  };

  const handleProcessReceipt = async () => {
    if (!invoiceNumber) {
      return toast.error("Nomor faktur resmi wajib diisi.");
    }
    if (!window.confirm("Anda yakin ingin memproses Tanda Terima ini? Stok akan dipotong secara permanen dari gudang.")) return;

    setIsSubmitting(true);
    toast.loading("Memproses faktur dan memotong stok...", { id: "process-receipt" });

    try {
      await runTransaction(firestoreDb, async (transaction) => {
        // 1. Memotong stok untuk setiap item di dalam Tanda Terima
        for (const item of selectedReceipt.items) {
          const stockDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/stock/${item.id}`);
          const stockDoc = await transaction.get(stockDocRef);
          if (!stockDoc.exists()) throw new Error(`Stok untuk ${item.name} tidak ditemukan.`);
          
          let currentStockData = stockDoc.data();
          if ((currentStockData.totalStockInPcs || 0) < item.quantityInPcs) {
            throw new Error(`Stok untuk ${item.name} tidak cukup.`);
          }
          
          currentStockData.totalStockInPcs -= item.quantityInPcs;
          transaction.set(stockDocRef, currentStockData);
        }

        // 2. Update status Tanda Terima menjadi 'completed'
        const receiptDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/tandaTerima`, selectedReceipt.id);
        transaction.update(receiptDocRef, {
          status: 'completed',
          invoiceNumber: invoiceNumber,
          processedBy: userProfile.fullName,
          processedAt: serverTimestamp()
        });
      });

      // 3. Buat log transaksi "Stok Keluar" untuk pelacakan
      const transactionsRef = collection(firestoreDb, `depots/${userProfile.depotId}/transactions`);
      await addDoc(transactionsRef, {
          type: 'Stok Keluar (Faktur Tertunda)',
          invoiceNumber: invoiceNumber,
          tandaTerimaNumber: selectedReceipt.tandaTerimaNumber,
          storeName: selectedReceipt.storeName,
          items: selectedReceipt.items,
          user: userProfile.fullName,
          timestamp: serverTimestamp()
      });

      toast.dismiss("process-receipt");
      toast.success("Faktur berhasil diproses dan stok telah dipotong!");
      setIsModalOpen(false);
      setSelectedReceipt(null);
    } catch (error) {
      toast.dismiss("process-receipt");
      toast.error("Gagal memproses: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><span className="loading loading-spinner loading-lg"></span></div>;

  return (
    <>
      <div className="p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-6">Kelola Faktur Tertunda (Proses Tanda Terima)</h1>
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="table w-full">
            <thead className="bg-gray-200">
              <tr>
                <th>Tgl Dibuat</th>
                <th>No. Tanda Terima</th>
                <th>Nama Toko</th>
                <th>Dibuat Oleh</th>
                <th className="text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pendingReceipts.length === 0 ? (
                <tr><td colSpan="5" className="text-center p-8">Tidak ada Tanda Terima yang perlu diproses.</td></tr>
              ) : (
                pendingReceipts.map(receipt => (
                  <tr key={receipt.id} className="hover">
                    <td>{receipt.createdAt?.toDate().toLocaleDateString('id-ID')}</td>
                    <td className="font-bold">{receipt.tandaTerimaNumber}</td>
                    <td>{receipt.storeName}</td>
                    <td>{receipt.createdBy}</td>
                    <td className="text-center">
                      <button onClick={() => handleOpenModal(receipt)} className="btn btn-sm btn-primary">Proses Sekarang</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && selectedReceipt && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Proses Tanda Terima</h3>
            <p className="py-2 text-sm">No. TT: <strong>{selectedReceipt.tandaTerimaNumber}</strong></p>
            <p className="text-sm">Toko: <strong>{selectedReceipt.storeName}</strong></p>
            <div className="form-control mt-4">
              <label className="label"><span className="label-text font-bold">Masukkan No. Faktur Resmi (ND6)</span></label>
              <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="input input-bordered" />
            </div>
            <div className="modal-action">
              <button onClick={() => setIsModalOpen(false)} className="btn" disabled={isSubmitting}>Batal</button>
              <button onClick={handleProcessReceipt} className="btn btn-success" disabled={isSubmitting || !invoiceNumber}>
                {isSubmitting ? <span className="loading loading-spinner"></span> : "Proses & Potong Stok"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default KelolaFakturTertunda;
