import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';
import CameraBarcodeScanner from './CameraBarcodeScanner'; // Pastikan ini diimpor

function FakturTertunda({ userProfile, setPage }) {
  const [items, setItems] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [tandaTerimaNumber, setTandaTerimaNumber] = useState(`TT-${Date.now()}`);
  const [keterangan, setKeterangan] = useState('');

  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const [filteredStores, setFilteredStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);

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

  const handleRemoveItem = (index) => {
    setTransactionItems(transactionItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStore || transactionItems.length === 0) {
      return toast.error("Pilih toko dan tambahkan minimal satu barang.");
    }
    setIsSubmitting(true);
    try {
      const tandaTerimaRef = collection(firestoreDb, `depots/${userProfile.depotId}/tandaTerima`);
      await addDoc(tandaTerimaRef, {
        tandaTerimaNumber,
        storeId: selectedStore.id,
        storeName: selectedStore.namaToko,
        items: transactionItems,
        keterangan,
        status: 'pending',
        createdBy: userProfile.fullName,
        createdAt: serverTimestamp(),
      });
      toast.success("Tanda Terima berhasil disimpan dan menunggu diproses.");
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

  const handleScanResult = (scannedCode) => {
    const foundItem = items.find(item => item.barcodePcs === scannedCode || item.barcodeDos === scannedCode);
    if (foundItem) {
        setSelectedItem(foundItem);
        setItemSearchTerm(foundItem.name);
    } else {
        toast.error("Barang tidak ditemukan di master.");
    }
    setShowScanner(false);
  };

  const filteredItems = itemSearchTerm.length > 1 ? items.filter(i => i.name.toLowerCase().includes(itemSearchTerm.toLowerCase())) : [];

  if (loading) return <div className="p-8 text-center"><span className="loading loading-spinner loading-lg"></span></div>;

  return (
    <>
      {showScanner && (
        <CameraBarcodeScanner
            onScan={handleScanResult}
            onClose={() => setShowScanner(false)}
        />
      )}
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
            <div className="form-control dropdown">
                <label className="label"><span className="label-text">Cari Barang</span></label>
                <div className="join w-full">
                    <input type="text" placeholder="Ketik nama barang..." className="input input-bordered join-item w-full" value={itemSearchTerm} onChange={e => {setItemSearchTerm(e.target.value); setSelectedItem(null);}}/>
                    <button onClick={() => setShowScanner(true)} className="btn btn-primary join-item">Scan</button>
                </div>
                {filteredItems.length > 0 && !selectedItem && (
                    <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                        {filteredItems.slice(0,10).map(item => <li key={item.id}><a onClick={() => {setSelectedItem(item); setItemSearchTerm(item.name)}}>{item.name}</a></li>)}
                    </ul>
                )}
            </div>
            {selectedItem && (
                <div className="mt-4 p-4 border rounded-md bg-base-200">
                    <p className="font-bold">Barang Terpilih: <span className="text-secondary">{selectedItem.name}</span></p>
                    <div className="flex items-end gap-4 flex-wrap mt-2">
                        <div className="form-control"><label className="label-text">DOS</label><input type="number" value={dosQty} onChange={(e) => setDosQty(e.target.valueAsNumber || 0)} className="input input-bordered input-sm" /></div>
                        <div className="form-control"><label className="label-text">PACK</label><input type="number" value={packQty} onChange={(e) => setPackQty(e.target.valueAsNumber || 0)} className="input input-bordered input-sm" /></div>
                        <div className="form-control"><label className="label-text">PCS</label><input type="number" value={pcsQty} onChange={(e) => setPcsQty(e.target.valueAsNumber || 0)} className="input input-bordered input-sm" /></div>
                        <button type="button" onClick={handleAddItem} className="btn btn-secondary btn-sm">Tambah</button>
                    </div>
                </div>
            )}
        </div>

        <div className="mt-6">
            <h3 className="text-xl font-bold mb-2">Daftar Barang</h3>
            <div className="overflow-x-auto bg-white rounded-lg shadow">
              <table className="table w-full">
                <thead><tr><th>Nama Barang</th><th>Jumlah</th><th>Aksi</th></tr></thead>
                <tbody>
                  {transactionItems.map((item, index) => (
                    <tr key={index}>
                        <td>{item.name}</td>
                        <td>{item.displayQty}</td>
                        <td><button onClick={() => handleRemoveItem(index)} className="btn btn-xs btn-error">Hapus</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
