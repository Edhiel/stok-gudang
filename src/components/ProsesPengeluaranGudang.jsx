import React, { useState, useEffect } from 'react';
import { ref, onValue, get, update, push, serverTimestamp, runTransaction, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '../firebaseConfig';
import toast from 'react-hot-toast';

function ProsesPengeluaranGudang({ userProfile }) {
  const [readyOrders, setReadyOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // State baru untuk menyimpan rencana pengambilan (picking plan)
  const [pickingPlan, setPickingPlan] = useState([]);

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

  // --- LOGIKA UTAMA FEFO DIMULAI DI SINI ---
  const generatePickingPlan = async (order) => {
    const plan = [];
    let isStockAvailable = true;

    for (const item of order.items) {
        const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${item.id}`);
        const snapshot = await get(stockRef);

        if (!snapshot.exists() || !snapshot.val().batches) {
            toast.error(`Stok batch untuk ${item.name} tidak ditemukan!`);
            isStockAvailable = false;
            break;
        }

        const batches = snapshot.val().batches;
        const sortedBatches = Object.keys(batches)
            .map(key => ({ batchId: key, ...batches[key] }))
            .sort((a, b) => new Date(a.expireDate) - new Date(b.expireDate));

        let quantityToPick = item.quantityInPcs;
        let pickedFromBatches = [];

        for (const batch of sortedBatches) {
            if (quantityToPick <= 0) break;

            const pickAmount = Math.min(quantityToPick, batch.quantity);
            
            pickedFromBatches.push({
                ...batch,
                qtyToPick: pickAmount
            });

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

    if (isStockAvailable) {
        setPickingPlan(plan);
        setSelectedOrder(order);
        setIsModalOpen(true);
    } else {
        setPickingPlan([]);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!window.confirm(`Konfirmasi pengeluaran barang untuk faktur ${selectedOrder.invoiceNumber}? Stok akan dipotong secara permanen.`)) return;

    try {
      // 1. Kurangi stok dari setiap batch yang ada di picking plan
      for (const planItem of pickingPlan) {
        const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${planItem.itemId}`);
        
        await runTransaction(stockRef, (currentStock) => {
          if (currentStock && currentStock.batches) {
            for (const pickedBatch of planItem.pickedFromBatches) {
              const batchInDb = currentStock.batches[pickedBatch.batchId];
              if (batchInDb) {
                batchInDb.quantity -= pickedBatch.qtyToPick;
                if (batchInDb.quantity <= 0) {
                  // Hapus batch jika stoknya habis
                  delete currentStock.batches[pickedBatch.batchId];
                }
              }
            }
            // Kurangi juga stok yang dialokasikan
            const orderItem = selectedOrder.items.find(i => i.id === planItem.itemId);
            currentStock.allocatedStockInPcs = (currentStock.allocatedStockInPcs || 0) - orderItem.quantityInPcs;
          }
          return currentStock;
        });
      }

      // 2. Buat log transaksi "Stok Keluar"
      const transactionsRef = ref(db, `depots/${userProfile.depotId}/transactions`);
      await push(transactionsRef, {
        type: 'Stok Keluar (FEFO)',
        invoiceNumber: selectedOrder.invoiceNumber,
        storeName: selectedOrder.storeName,
        items: selectedOrder.items,
        pickingPlan: pickingPlan, // Simpan juga picking plan untuk audit
        user: userProfile.fullName,
        timestamp: serverTimestamp()
      });

      // 3. Update status order menjadi "Selesai"
      const orderRef = ref(db, `depots/${userProfile.depotId}/salesOrders/${selectedOrder.id}`);
      await update(orderRef, { status: 'Selesai' });

      toast.success("Barang berhasil dikeluarkan dan transaksi selesai.");
      setIsModalOpen(false);
      setPickingPlan([]);
      setSelectedOrder(null);

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
            {loading 
            ? (<tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>) 
            : readyOrders.length === 0 ? (<tr><td colSpan="5" className="text-center">Tidak ada barang yang siap untuk dikeluarkan.</td></tr>)
            : (readyOrders.map(order => (
                <tr key={order.id} className="hover">
                  <td>{new Date(order.createdAt).toLocaleDateString('id-ID')}</td>
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
                <button onClick={() => setIsModalOpen(false)} className="btn btn-ghost">Batal</button>
                <button onClick={handleConfirmDispatch} className="btn btn-primary">Konfirmasi & Selesaikan Pengeluaran</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProsesPengeluaranGudang;
