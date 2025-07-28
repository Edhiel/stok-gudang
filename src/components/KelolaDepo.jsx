import React, { useState, useEffect } from 'react';
// --- 1. IMPORT BARU DARI FIRESTORE ---
import { collection, onSnapshot, doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';

function KelolaDepo() {
  const [depots, setDepots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [depotId, setDepotId] = useState('');
  const [depotName, setDepotName] = useState('');
  
  // State untuk modal Edit
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDepo, setEditingDepo] = useState(null);
  const [editedDepoName, setEditedDepoName] = useState('');

  // --- 2. LOGIKA BARU MENGAMBIL DATA DARI FIRESTORE ---
  useEffect(() => {
    const depotsCollectionRef = collection(firestoreDb, 'depots');
    const unsubscribe = onSnapshot(depotsCollectionRef, (snapshot) => {
      const depotList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() // Di Firestore, data info tidak perlu dipisah dalam sub-objek 'info'
      }));
      setDepots(depotList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 3. LOGIKA BARU MENAMBAH DEPO KE FIRESTORE (DENGAN PENYEMPURNAAN) ---
  const handleAddDepo = async (e) => {
    e.preventDefault();
    if (!depotId || !depotName) {
      return toast.error("ID dan Nama Depo tidak boleh kosong.");
    }

    const formattedDepotId = depotId.toUpperCase().replace(/\s+/g, '-'); // Format ID agar konsisten
    const depotDocRef = doc(firestoreDb, 'depots', formattedDepotId);
    
    const docSnap = await getDoc(depotDocRef);
    if (docSnap.exists()) {
        return toast.error(`ID Depo "${formattedDepotId}" sudah ada.`);
    }

    try {
      await setDoc(depotDocRef, {
        name: depotName,
        address: '' // Struktur lebih sederhana
      });
      toast.success(`Depo ${depotName} berhasil ditambahkan!`);
      setDepotId(''); setDepotName('');
    } catch (err) {
      toast.error("Gagal menambahkan depo.");
      console.error(err);
    }
  };

  const handleOpenEditModal = (depot) => {
    setEditingDepo(depot);
    setEditedDepoName(depot.name);
    setIsEditModalOpen(true);
  };

  const handleUpdateDepo = async () => {
    if (!editedDepoName) {
      return toast.error("Nama depo tidak boleh kosong.");
    }
    const depoDocRef = doc(firestoreDb, 'depots', editingDepo.id);
    try {
      await updateDoc(depoDocRef, { name: editedDepoName });
      toast.success("Nama depo berhasil diperbarui.");
      setIsEditModalOpen(false);
    } catch (error) {
      toast.error("Gagal memperbarui depo.");
      console.error(error);
    }
  };

  const handleDeleteDepo = async (depot) => {
    if (window.confirm(`PERINGATAN: Anda akan menghapus depo "${depot.name}". Aksi ini tidak bisa dibatalkan. Lanjutkan?`)) {
      try {
        await deleteDoc(doc(firestoreDb, `depots/${depot.id}`));
        toast.success("Depo berhasil dihapus.");
      } catch (err) {
        toast.error("Gagal menghapus depo.");
        console.error(err);
      }
    }
  };

  return (
    <>
      <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <div className="card bg-white shadow-lg">
            <form className="card-body" onSubmit={handleAddDepo}>
              <h2 className="card-title">Tambah Depo Baru</h2>
              <div className="form-control">
                <label className="label"><span className="label-text">ID Depo (Singkat & Unik)</span></label>
                <input type="text" placeholder="Contoh: DEPO-MKS" className="input input-bordered" value={depotId} onChange={(e) => setDepotId(e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Nama Lengkap Depo</span></label>
                <input type="text" placeholder="Contoh: Depo Makassar" className="input input-bordered" value={depotName} onChange={(e) => setDepotName(e.target.value)} />
              </div>
              <div className="form-control mt-4">
                <button type="submit" className="btn btn-primary">Simpan Depo</button>
              </div>
            </form>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
            <table className="table w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th>ID Depo</th>
                  <th>Nama Depo</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="3" className="text-center"><span className="loading loading-dots loading-md"></span></td></tr>
                ) : (
                  depots.map(depot => (
                    <tr key={depot.id}>
                      <td className="font-bold">{depot.id}</td>
                      <td>{depot.name}</td>
                      <td className="flex gap-2">
                        <button onClick={() => handleOpenEditModal(depot)} className="btn btn-xs btn-info">Edit</button>
                        <button onClick={() => handleDeleteDepo(depot)} className="btn btn-xs btn-error">Hapus</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isEditModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Edit Depo: {editingDepo.id}</h3>
            <div className="py-4">
              <label className="label"><span className="label-text">Nama Depo</span></label>
              <input
                type="text"
                value={editedDepoName}
                onChange={(e) => setEditedDepoName(e.target.value)}
                className="input input-bordered w-full"
              />
            </div>
            <div className="modal-action">
              <button onClick={handleUpdateDepo} className="btn btn-primary">Simpan Perubahan</button>
              <button onClick={() => setIsEditModalOpen(false)} className="btn">Batal</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default KelolaDepo;
