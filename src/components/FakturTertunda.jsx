import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';
import CameraBarcodeScanner from './CameraBarcodeScanner';

function FakturTertunda({ userProfile, setPage }) {
  const [items, setItems] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State untuk form
  const [tandaTerimaNumber, setTandaTerimaNumber] = useState(`TT-${Date.now()}`);
  const [keterangan, setKeterangan] = useState('');

  // State untuk pencarian toko
  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const [filteredStores, setFilteredStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);

  // State untuk item
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [transactionItems, setTransactionItems] = useState([]);
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!userProfile?.depotId) {
      setLoading(false);
      return;
    }
    const itemsRef = collection(firestoreDb, 'master_items');
    const storesRef = collection(firestoreDb, 'master_toko');

    const unsubItems = onSnapshot(itemsRef, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubStores = onSnapshot(storesRef, (snapshot) => {
      setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    setLoading(false);
    return () => {
      unsubItems();
      unsubStores();
    };
  }, [userProfile]);

  useEffect(() => {
    if (storeSearchTerm.length > 1) {
      setFilteredStores(stores.filter(s => s.namaToko.toLowerCase().includes(storeSearchTerm.toLowerCase())));
    } else {
      setFilteredStores([]);
    }
  }, [storeSearchTerm, stores]);

  const handleAddItem = () => {
    if (!selectedItem) return toast.error("Pilih barang terlebih dahulu.");
    const totalPcs = (Number(dosQty) * (selectedItem.conversions?.Dos?.inPcs || 1)) + 
                     (Number(packQty) * (selectedItem.conversions?.Pack?.inPcs || 1)) + 
                     Number(pcsQty);
    if (totalPcs <= 0) return toast.error("Masukkan jumlah yang valid.");

    setTransactionItems([...transactionItems, {
        id: selectedItem.id, name: selectedItem.name, quantityInPcs: totalPcs,
        displayQty: `${dosQty}.${packQty}.${pcsQty}`, conversions: selectedItem.conversions
    }]);

    setItemSearchTerm(''); setSelectedItem(null);
    setDosQty(0); setPackQty(0); setPcsQty(0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStore || transactionItems.length === 0) {
      return toast.error("Pilih toko dan tambahkan minimal satu barang.");
    }
    setIsSubmitting(true);
    try {
      // Menyimpan ke koleksi baru 'tandaTerima', BUKAN memotong stok
      const tandaTerimaRef = collection(firestoreDb, `depots/${userProfile.depotId}/tandaTerima`);
      await addDoc(tandaTerimaRef, {
        tandaTerimaNumber,
        storeId: selectedStore.id,
        storeName: selectedStore.namaToko,
        items: transactionItems,
        keterangan,
        status: 'pending', // Status awal adalah 'pending'
        createdBy: userProfile.fullName,
        createdAt: serverTimestamp(),
      });
      toast.success("Tanda Terima berhasil disimpan dan menunggu diproses.");
      // Reset form
      setTandaTerimaNumber(`TT-${Date.now()}`);
      setKeterangan('');
      setTransactionItems([]);
      setSelectedStore(null);
      setStoreSearchTerm('');
    } catch (error) {
      toast.error("Gagal menyimpan Tanda Terima: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = itemSearchTerm.length > 1 ? items.filter(i => i.name.toLowerCase().includes(itemSearchTerm.toLowerCase())) : [];

  if (loading) return <div className="p-8 text-center"><span className="loading loading-spinner loading-lg"></span></div>;

  return (
    <>
      {showScanner && ( /* ... JSX Scanner ... */ )}
      <div className="p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-6">Buat Tanda Terima (Faktur Tertunda)</h1>
        
        <div className="card bg-white shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label"><span className="label-text font-bold">No. Tanda Terima</span></label>
              <input type="text" value={tandaTerimaNumber} onChange={(e) => setTandaTerimaNumber(e.target.value)} className="input input-bordered" />
            </div>
            <div className="form-control dropdown">
              <label className="label"><span className="label-text font-bold">Cari Toko Tujuan</span></label>
              <input type="text" value={storeSearchTerm} onChange={e => {setStoreSearchTerm(e.target.value); setSelectedStore(null);}} placeholder="Ketik min. 2 huruf..." className="input input-bordered" />
              {filteredStores.length > 0 && !selectedStore && (
                <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                    {filteredStores.map(store => (
                        <li key={store.id}><a onClick={() => { setSelectedStore(store); setStoreSearchTerm(store.namaToko); }}>{store.namaToko}</a></li>
                    ))}
                </ul>
              )}
            </div>
            <div className="form-control md:col-span-2">
              <label className="label"><span className="label-text">Keterangan (Opsional)</span></label>
              <input type="text" value={keterangan} onChange={e => setKeterangan(e.target.value)} className="input input-bordered" placeholder="Contoh: Barang titipan, dll."/>
            </div>
          </div>
        </div>

        <div className="card bg-white shadow-lg p-6">
          {/* ... Form tambah barang (sama seperti Stok Keluar) ... */}
        </div>

        <div className="mt-6 flex justify-end">
            <button onClick={handleSubmit} className="btn btn-primary btn-lg" disabled={isSubmitting || !selectedStore || transactionItems.length === 0}>
                {isSubmitting ? <span className="loading loading-spinner"></span> : "Simpan Tanda Terima"}
            </button>
        </div>
      </div>
    </>
  );
}

export default FakturTertunda;
