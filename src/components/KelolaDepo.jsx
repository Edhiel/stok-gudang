import React, { useState, useEffect } from 'react';
// Tambahkan 'update' dan 'remove' dari firebase
import { ref, set, onValue, update, remove } from 'firebase/database';
import { db } from '../firebaseConfig';

function KelolaDepo() {
  const [depots, setDepots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [depotId, setDepotId] = useState('');
  const [depotName, setDepotName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // --- 1. STATE BARU UNTUK MODAL EDIT ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDepo, setEditingDepo] = useState(null); // Menyimpan data {id, name}
  const [editedDepoName, setEditedDepoName] = useState('');

  useEffect(() => {
    const depotsRef = ref(db, 'depots/');
    const unsubscribe = onValue(depotsRef, (snapshot) => {
      const data = snapshot.val();
      const depotList = data ? Object.keys(data).map(key => ({
        id: key,
        ...data[key].info
      })) : [];
      setDepots(depotList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddDepo = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!depotId || !depotName) {
      setError("ID dan Nama Depo tidak boleh kosong.");
      return;
    }
    if (depots.some(depot => depot.id.toUpperCase() === depotId.toUpperCase())) {
        setError("ID Depo sudah ada. Gunakan ID lain.");
        return;
    }
    try {
      const newDepotRef = ref(db, 'depots/' + depotId.toUpperCase());
      await set(newDepotRef, {
        info: { name: depotName, address: '' }
      });
      setSuccess(`Depo ${depotName} berhasil ditambahkan!`);
      setDepotId(''); setDepotName('');
    } catch (err) {
      setError("Gagal menambahkan depo. Coba lagi.");
      console.error(err);
    }
  };

  // --- 2. FUNGSI-FUNGSI BARU UNTUK EDIT DAN HAPUS ---
  const handleOpenEditModal = (depot) => {
    setEditingDepo(depot);
    setEditedDepoName(depot.name);
    setIsEditModalOpen(true);
  };

  const handleUpdateDepo = async () => {
    if (!editedDepoName) {
      alert("Nama depo tidak boleh kosong.");
      return;
    }
    // Update hanya node 'info' di dalam depo, agar tidak mengganggu data 'stock' atau 'transactions'
    const depoInfoRef = ref(db, `depots/${editingDepo.id}/info`);
    try {
      await update(depoInfoRef, { name: editedDepoName });
      alert("Nama depo berhasil diperbarui.");
      setIsEditModalOpen(false);
    } catch (error) {
      alert("Gagal memperbarui depo.");
      console.error(error);
    }
  };

  const handleDeleteDepo = async (depot) => {
    if (window.confirm(`PERINGATAN: Anda akan menghapus depo "${depot.name}" beserta SEMUA data stok dan transaksinya. Aksi ini tidak bisa dibatalkan. Lanjutkan?`)) {
      try {
        await remove(ref(db, `depots/${depot.id}`));
        alert("Depo berhasil dihapus.");
      } catch (err) {
        alert("Gagal menghapus depo.");
        console.error(err);
      }
    }
  };
  return (
    <>
      <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Kolom Kiri: Form Tambah Depo */}
        <div className="md:col-span-1">
          <div className="card bg-white shadow-lg">
            <form className="card-body" onSubmit={handleAddDepo}>
              <h2 className="card-title">Tambah Depo Baru</h2>
              {error && <div role="alert" className="alert alert-error text-sm"><span>{error}</span></div>}
              {success && <div role="alert" className="alert alert-success text-sm"><span>{success}</span></div>}
              
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

        {/* Kolom Kanan: Daftar Depo */}
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
                      {/* --- 3. TOMBOL EDIT & HAPUS YANG SUDAH BERFUNGSI --- */}
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

      {/* --- 4. MODAL BARU UNTUK EDIT DEPO --- */}
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