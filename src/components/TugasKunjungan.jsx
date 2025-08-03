import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, runTransaction, addDoc } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';
import CameraBarcodeScanner from './CameraBarcodeScanner'; // Kita butuh scanner untuk retur

// --- Komponen Modal untuk Proses Retur ---
const ModalRetur = ({ order, userProfile, onClose }) => {
    const [items, setItems] = useState([]);
    const [returnItems, setReturnItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [pcsQty, setPcsQty] = useState(0);
    const [isGoodCondition, setIsGoodCondition] = useState(true);
    const [expireDate, setExpireDate] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Ambil master barang untuk form retur
        const masterItemsRef = collection(firestoreDb, 'master_items');
        const unsubscribe = onSnapshot(masterItemsRef, (snapshot) => {
            const itemList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setItems(itemList);
        });
        return () => unsubscribe();
    }, []);

    const handleAddItemToReturn = () => {
        if (!selectedItem || pcsQty <= 0) {
            return toast.error("Pilih barang dan isi jumlah Pcs.");
        }
        if (isGoodCondition && !expireDate) {
            return toast.error("Untuk retur baik, tanggal kedaluwarsa wajib diisi.");
        }

        setReturnItems([...returnItems, {
            id: selectedItem.id,
            name: selectedItem.name,
            quantityInPcs: Number(pcsQty),
            displayQty: `0.0.${pcsQty}`, // Retur di lapangan biasanya Pcs
            isGood: isGoodCondition,
            expireDate: isGoodCondition ? expireDate : null,
        }]);
        setSelectedItem(null);
        setSearchTerm('');
        setPcsQty(0);
    };

    const handleSaveReturn = async () => {
        if (returnItems.length === 0) {
            return toast.error("Tambahkan minimal satu barang retur.");
        }
        setIsSubmitting(true);
        toast.loading("Memproses retur...", { id: "return-toast" });

        try {
            // Logika ini mirip seperti di ManajemenRetur, tapi disederhanakan untuk sopir
            const returnType = isGoodCondition ? 'Retur Baik' : 'Retur Rusak';
            
            // Simpan log transaksi retur
            const transactionsRef = collection(firestoreDb, `depots/${userProfile.depotId}/transactions`);
            await addDoc(transactionsRef, {
                type: returnType,
                fromStore: order.storeName,
                invoiceNumber: order.invoiceNumber, // Menautkan ke faktur pengiriman
                items: returnItems,
                user: userProfile.fullName,
                timestamp: serverTimestamp()
            });

            // Update stok (akan dijalankan oleh Admin Gudang saat validasi retur)
            // Untuk sopir, cukup mencatat saja agar cepat.

            toast.dismiss("return-toast");
            toast.success("Data retur berhasil dicatat!");
            onClose();

        } catch (error) {
            toast.dismiss("return-toast");
            toast.error("Gagal mencatat retur: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredItems = searchTerm ? items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())) : [];

    return (
        <div className="modal modal-open">
            {showScanner && <CameraBarcodeScanner onScan={(code) => {
                const found = items.find(i => i.barcodePcs === code || i.barcodeDos === code);
                if(found) { setSelectedItem(found); setSearchTerm(found.name); }
                setShowScanner(false);
            }} onClose={() => setShowScanner(false)} />}
            <div className="modal-box w-11/12 max-w-2xl">
                <h3 className="font-bold text-lg">Proses Retur dari: {order.storeName}</h3>
                <div className="form-control mt-4">
                    <label className="label cursor-pointer">
                        <span className="label-text">Kondisi Barang Retur:</span>
                        <div className="join">
                            <button className={`btn join-item ${isGoodCondition ? 'btn-success' : ''}`} onClick={() => setIsGoodCondition(true)}>Baik</button>
                            <button className={`btn join-item ${!isGoodCondition ? 'btn-error' : ''}`} onClick={() => setIsGoodCondition(false)}>Rusak</button>
                        </div>
                    </label>
                </div>
                <div className="divider">Tambah Barang Retur</div>
                <div className="p-2 border rounded-md bg-base-200 space-y-2">
                    <div className="join w-full">
                        <input type="text" value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setSelectedItem(null);}} placeholder="Cari atau Scan Barang..." className="input input-bordered join-item w-full" />
                        <button onClick={() => setShowScanner(true)} className="btn btn-primary join-item">Scan</button>
                    </div>
                    {filteredItems.length > 0 && !selectedItem && (
                        <ul className="menu bg-base-100 w-full rounded-box max-h-32 overflow-y-auto">
                            {filteredItems.slice(0,5).map(item => <li key={item.id}><a onClick={() => {setSelectedItem(item); setSearchTerm(item.name);}}>{item.name}</a></li>)}
                        </ul>
                    )}
                    {selectedItem && (
                        <div className="grid grid-cols-2 gap-2 items-end">
                            <div className="form-control">
                                <label className="label-text">Jumlah (Pcs)</label>
                                <input type="number" value={pcsQty} onChange={e => setPcsQty(e.target.value)} className="input input-bordered" />
                            </div>
                            {isGoodCondition && (
                                <div className="form-control">
                                    <label className="label-text">Tgl. Kedaluwarsa</label>
                                    <input type="date" value={expireDate} onChange={e => setExpireDate(e.target.value)} className="input input-bordered" />
                                </div>
                            )}
                            <button onClick={handleAddItemToReturn} className="btn btn-secondary col-span-2">Tambah ke Daftar</button>
                        </div>
                    )}
                </div>
                <div className="divider">Daftar Barang Retur</div>
                <ul className="list-disc list-inside">
                    {returnItems.map((item, index) => <li key={index}>{item.name} - {item.quantityInPcs} Pcs ({item.isGood ? 'Baik' : 'Rusak'})</li>)}
                </ul>
                <div className="modal-action">
                    <button onClick={onClose} className="btn btn-ghost" disabled={isSubmitting}>Batal</button>
                    <button onClick={handleSaveReturn} className="btn btn-primary" disabled={isSubmitting || returnItems.length === 0}>
                        {isSubmitting ? <span className="loading loading-spinner"></span> : "Simpan Data Retur"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Komponen Utama untuk Sopir/Helper ---
function TugasKunjungan({ userProfile }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState({ type: null, order: null }); // type: 'rejection' atau 'return'
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!userProfile?.depotId) {
        setLoading(false);
        return;
    };

    const ordersRef = collection(firestoreDb, `depots/${userProfile.depotId}/salesOrders`);
    const q = query(ordersRef, where('status', '==', 'Dalam Pengiriman'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const deliveryList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDeliveries(deliveryList.sort((a,b) => a.createdAt.toMillis() - b.createdAt.toMillis()));
      setLoading(false);
    }, (error) => {
        toast.error("Gagal memuat data pengiriman.");
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
      if (modalState.type) setModalState({ type: null, order: null });
    } catch (error) {
      toast.error("Gagal memperbarui status: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openModal = (type, order) => {
    setModalState({ type, order });
    if (type === 'rejection') setRejectionReason('');
  };

  if (loading) {
    return <div className="p-8 text-center"><span className="loading loading-spinner loading-lg"></span></div>;
  }

  return (
    <>
      <div className="p-4 sm:p-8">
        <h1 className="text-3xl font-bold mb-6">Tugas Kunjungan Hari Ini</h1>
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
                    <button onClick={() => openModal('rejection', order)} className="btn btn-sm btn-error">Ditolak</button>
                    <button onClick={() => openModal('return', order)} className="btn btn-sm btn-accent">Proses Retur</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalState.type === 'rejection' && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Alasan Penolakan</h3>
            <p className="py-2 text-sm">Untuk Order: <strong>{modalState.order.orderNumber}</strong></p>
            <div className="form-control mt-4">
              <textarea className="textarea textarea-bordered" placeholder="Toko tutup, pembayaran bermasalah, dll." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}></textarea>
            </div>
            <div className="modal-action">
              <button onClick={() => setModalState({ type: null, order: null })} className="btn" disabled={isSubmitting}>Batal</button>
              <button onClick={() => handleUpdateStatus(modalState.order.id, 'Ditolak Pelanggan', rejectionReason)} className="btn btn-primary" disabled={!rejectionReason || isSubmitting}>
                {isSubmitting ? <span className="loading loading-spinner"></span> : 'Simpan Alasan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalState.type === 'return' && (
        <ModalRetur order={modalState.order} userProfile={userProfile} onClose={() => setModalState({ type: null, order: null })} />
      )}
    </>
  );
}

export default TugasKunjungan;
