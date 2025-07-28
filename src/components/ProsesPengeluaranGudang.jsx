import React, { useState, useEffect } from 'react';
// --- 1. IMPORT BARU DARI FIRESTORE ---
import { collection, query, where, onSnapshot, doc, getDoc, runTransaction, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';

function ProsesPengeluaranGudang({ userProfile }) {
  const [readyOrders, setReadyOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [pickingPlan, setPickingPlan] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false); // Penyempurnaan: Tambah state submitting

  // --- 2. LOGIKA BARU MENGAMBIL DATA DARI FIRESTORE ---
  useEffect(() => {
    if (!userProfile.depotId) return;

    const ordersRef = collection(firestoreDb, `depots/${userProfile.depotId}/salesOrders`);
    const q = query(ordersRef, where('status', '==', 'Siap Dikirim (Sudah Difakturkan)'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReadyOrders(loadedOrders.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile.depotId]);

  const generatePickingPlan = async (order) => {
    toast.loading('Membuat rencana ambil barang...', { id: 'picking-plan' });
    const plan = [];
    let isStockAvailable = true;

    for (const item of order.items) {
        const stockDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/stock/${item.id}`);
        const snapshot = await getDoc(stockDocRef);

        if (!snapshot.exists() || !snapshot.data().batches) {
            toast.error(`Stok batch untuk ${item.name} tidak ditemukan!`);
            isStockAvailable = false;
            break;
        }

        const batches = snapshot.data().batches;
        const sortedBatches = Object.keys(batches)
            .map(key => ({ batchId: key, ...batches[key] }))
            .sort((a, b) => new Date(a.expireDate) - new Date(b.expireDate));

        let quantityToPick = item.quantityInPcs;
        let pickedFromBatches = [];

        for (const batch of sortedBatches) {
            if (quantityToPick <= 0) break;
            const pickAmount = Math.min(quantityToPick, batch.quantity);
            
            pickedFromBatches.push({ ...batch, qtyToPick: pickAmount });
            quantityToPick -= pickAmount;
        }

        if (quantityToPick > 0) {
            toast.error(`Stok tidak cukup untuk ${item.name}. Butuh ${item.quantityInPcs}, hanya tersedia ${item.quantityInPcs - quantityToPick}.`);
            isStockAvailable = false;
            break;
        }

        plan.push({
            itemId: item.id,
            itemName: item.name,
            totalToPick: item.quantityInPcs,
            pickedFromBatches: pickedFromBatches
        });
    }

    toast.dismiss('picking-plan');
    if (isStockAvailable) {
        setPickingPlan(plan);
        setSelectedOrder(order);
        setIsModalOpen(true);
    } else {
        setPickingPlan([]);
    }
  };

  // --- 3. LOGIKA BARU KONFIRMASI PENGELUARAN DENGAN TRANSAKSI FIRESTORE ---
  const handleConfirmDispatch = async () => {
    if (!window.confirm(`Konfirmasi pengeluaran barang untuk faktur ${selectedOrder.invoiceNumber}? Stok akan dipotong secara permanen.`)) return;
    setIsSubmitting(true);
    toast.loading('Memproses pengeluaran stok...', { id: 'dispatch-confirm' });

    try {
        await runTransaction(firestoreDb, async (transaction) => {
            // 1. Kurangi stok dari setiap batch
            for (const planItem of pickingPlan) {
                const stockDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/stock/${planItem.itemId}`);
                const stockDoc = await transaction.get(stockDocRef);

                if (!stockDoc.exists()) {
                    throw new Error(`Stok untuk ${planItem.itemName} tidak ditemukan.`);
                }
                
                let currentStockData = stockDoc.data();
                
                for (const pickedBatch of planItem.pickedFromBatches) {
                    const batchInDb = currentStockData.batches[pickedBatch.batchId];
                    if (batchInDb && batchInDb.quantity >= pickedBatch.qtyToPick) {
                        batchInDb.quantity -= pickedBatch.qtyToPick;
                        if (batchInDb.quantity <= 0) {
                            delete currentStockData.batches[pickedBatch.batchId];
                        }
                    } else {
                        throw new Error(`Stok batch untuk ${planItem.itemName} tidak konsisten.`);
                    }
                }
                
                const orderItem = selectedOrder.items.find(i => i.id === planItem.itemId);
                currentStockData.allocatedStockInPcs = (currentStockData.allocatedStockInPcs || 0) - orderItem.quantityInPcs;
                
                transaction.set(stockDocRef, currentStockData);
            }

            // 2. Update status order menjadi "Selesai"
            const orderDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/salesOrders/${selectedOrder.id}`);
            transaction.update(orderDocRef, { status: 'Selesai' });
        });

      // 3. Buat log transaksi "Stok Keluar" (setelah transaksi utama sukses)
      const transactionsRef = collection(firestoreDb, `depots/${userProfile.depotId}/transactions`);
      await addDoc(transactionsRef, {
        type: 'Stok Keluar (FEFO)',
        invoiceNumber: selectedOrder.invoiceNumber,
        storeName: selectedOrder.storeName,
        storeId: selectedOrder.storeId,
        items: selectedOrder.items,
        pickingPlan: pickingPlan,
        user: userProfile.fullName,
        timestamp: serverTimestamp()
      });

      toast.dismiss('dispatch-confirm');
      toast.success("Barang berhasil dikeluarkan dan transaksi selesai.");
      setIsModalOpen(false);
      setPickingPlan([]);
      setSelectedOrder(null);

    } catch (error) {
      toast.dismiss('dispatch-confirm');
      toast.error(`Gagal konfirmasi: ${error.message}`);
      console.error(error);
    } finally {
        setIsSubmitting(false);
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
            {loading 
            ? (<tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>) 
            : readyOrders.length === 0 ? (<tr><td colSpan="5" className="text-center">Tidak ada barang yang siap untuk dikeluarkan.</td></tr>)
            : (readyOrders.map(order => (
                <tr key={order.id} className="hover">
                  <td>{order.createdAt.toDate().toLocaleDateString('id-ID')}</td>
                  <td className="font-bold">{order.invoiceNumber}</td>
                  <td>{order.storeName}</td>
                  <td>{order.processedBy}</td>
                  <td className="text-center">
                    <button onClick={() => generatePickingPlan(order)} className="btn btn-sm btn-primary">Proses Pengeluaran</button>
                  </td>
                </tr>
              )))}
          </tbody>
        </table>
      </div>
      
      {isModalOpen && selectedOrder && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-4xl">
            <h3 className="font-bold text-lg">Rencana Ambil Barang (FEFO): {selectedOrder.invoiceNumber}</h3>
            <p className="py-2 text-sm"><strong>Toko:</strong> {selectedOrder.storeName}</p>
            <div className="divider my-2">Ikuti daftar di bawah untuk mengambil barang:</div>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
              {pickingPlan.map(planItem => (
                  <div key={planItem.itemId} className="card card-compact bg-base-200 p-4">
                    <h4 className="font-bold text-base mb-2">{planItem.itemName} (Total: {planItem.totalToPick} Pcs)</h4>
                    <div className="overflow-x-auto">
                        <table className="table table-xs w-full">
                            <thead>
                                <tr>
                                    <th>Lokasi</th>
                                    <th>Tgl. Kedaluwarsa</th>
                                    <th>Jumlah Ambil</th>
                                </tr>
                            </thead>
                            <tbody>
                                {planItem.pickedFromBatches.map(batch => (
                                    <tr key={batch.batchId}>
                                        <td className="font-semibold">{batch.locationId}</td>
                                        <td className="text-red-600 font-semibold">{new Date(batch.expireDate).toLocaleDateString('id-ID')}</td>
                                        <td className="font-semibold">{batch.qtyToPick} Pcs</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                  </div>
              ))}
            </div>

            <div className="modal-action mt-6">
                <button onClick={() => setIsModalOpen(false)} className="btn btn-ghost" disabled={isSubmitting}>Batal</button>
                <button onClick={handleConfirmDispatch} className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? <span className="loading loading-spinner"></span> : 'Konfirmasi & Selesaikan'}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProsesPengeluaranGudang;
