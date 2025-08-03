import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';

function FakturTertunda({ userProfile, setPage }) {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State untuk form
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);

  // State untuk pencarian toko
  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const [filteredStores, setFilteredStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);

  useEffect(() => {
    if (!userProfile?.depotId) {
      setLoading(false);
      return;
    }
    const storesRef = collection(firestoreDb, 'master_toko');
    const unsubStores = onSnapshot(storesRef, (snapshot) => {
        setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
    });
    return () => unsubStores();
  }, [userProfile]);

  useEffect(() => {
    if (storeSearchTerm.length > 1) {
        setFilteredStores(
            stores.filter(store => 
                store.namaToko.toLowerCase().includes(storeSearchTerm.toLowerCase())
            )
        );
    } else {
        setFilteredStores([]);
    }
  }, [storeSearchTerm, stores]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStore || !invoiceNumber || !invoiceDate || !dueDate || totalAmount <= 0) {
      return toast.error("Semua field wajib diisi dan total harus lebih dari nol.");
    }
    setIsSubmitting(true);
    try {
      const pendingInvoicesRef = collection(firestoreDb, `depots/${userProfile.depotId}/pendingInvoices`);
      await addDoc(pendingInvoicesRef, {
        invoiceNumber,
        invoiceDate,
        dueDate,
        totalAmount: Number(totalAmount),
        storeId: selectedStore.id,
        storeName: selectedStore.namaToko,
        status: 'pending',
        createdBy: userProfile.fullName,
        createdAt: serverTimestamp(),
        depotId: userProfile.depotId,
      });
      toast.success("Faktur tertunda berhasil disimpan.");
      // Reset form
      setInvoiceNumber('');
      setInvoiceDate('');
      setDueDate('');
      setTotalAmount(0);
      setSelectedStore(null);
      setStoreSearchTerm('');
    } catch (error) {
      toast.error("Gagal menyimpan faktur: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center"><span className="loading loading-spinner loading-lg"></span></div>;
  }

  return (
    <div className="p-4 md:p-8 flex justify-center">
      <div className="card w-full max-w-2xl bg-white shadow-lg">
        <form onSubmit={handleSubmit} className="card-body">
          <h2 className="card-title text-2xl">Buat Faktur Tertunda Baru</h2>
          <p className="text-sm text-gray-500">Gunakan form ini untuk mencatat faktur yang pembayarannya tertunda (kredit).</p>
          
          <div className="form-control dropdown mt-4">
            <label className="label"><span className="label-text font-bold">Cari & Pilih Toko</span></label>
            <input 
              type="text"
              value={storeSearchTerm}
              onChange={(e) => {
                  setStoreSearchTerm(e.target.value);
                  setSelectedStore(null);
              }}
              placeholder="Ketik min. 2 huruf nama toko..."
              className="input input-bordered"
            />
            {filteredStores.length > 0 && !selectedStore && (
              <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                  {filteredStores.map(store => (
                      <li key={store.id}>
                          <a onClick={() => {
                              setSelectedStore(store);
                              setStoreSearchTerm(store.namaToko);
                          }}>{store.namaToko}</a>
                      </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text font-bold">Nomor Faktur</span></label>
            <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="input input-bordered" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label"><span className="label-text font-bold">Tanggal Faktur</span></label>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="input input-bordered" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-bold">Tanggal Jatuh Tempo</span></label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input input-bordered" />
            </div>
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text font-bold">Total Tagihan (Rp)</span></label>
            <input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.valueAsNumber || 0)} className="input input-bordered" />
          </div>

          <div className="card-actions justify-end mt-6">
            <button type="button" onClick={() => setPage('dashboard')} className="btn btn-ghost">Batal</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? <span className="loading loading-spinner"></span> : "Simpan Faktur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FakturTertunda;
