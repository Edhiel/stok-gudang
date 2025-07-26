import React, { useState, useEffect } from 'react';
import { ref, onValue, set, get, update, remove } from 'firebase/database';
import { db } from '../firebaseConfig';
import toast from 'react-hot-toast';

function KelolaToko() {
  const [tokoList, setTokoList] = useState([]);
  const [filteredToko, setFilteredToko] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // State untuk form tambah
  const [idToko, setIdToko] = useState('');
  const [namaToko, setNamaToko] = useState('');
  const [alamat, setAlamat] = useState('');
  const [telepon, setTelepon] = useState('');
  const [pemilik, setPemilik] = useState('');
  
  // State untuk modal edit
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingToko, setEditingToko] = useState(null);
  const [editedData, setEditedData] = useState({});

  useEffect(() => {
    const tokoRef = ref(db, 'master_toko');
    const unsubscribe = onValue(tokoRef, (snapshot) => {
      const data = snapshot.val() || {};
      const loadedToko = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
      setTokoList(loadedToko);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let filtered = [...tokoList];
    if (searchTerm) {
      filtered = filtered.filter(toko =>
        toko.namaToko.toLowerCase().includes(searchTerm.toLowerCase()) ||
        toko.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredToko(filtered.sort((a, b) => a.namaToko.localeCompare(b.namaToko)));
  }, [searchTerm, tokoList]);

  const resetForm = () => {
    setIdToko('');
    setNamaToko('');
    setAlamat('');
    setTelepon('');
    setPemilik('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!idToko || !namaToko || !alamat) {
      return toast.error("ID Toko, Nama Toko, dan Alamat wajib diisi.");
    }
    const newTokoRef = ref(db, `master_toko/${idToko.toUpperCase()}`);
    const snapshot = await get(newTokoRef);
    if (snapshot.exists()) {
      return toast.error(`ID Toko "${idToko.toUpperCase()}" sudah terdaftar.`);
    }
    try {
      await set(newTokoRef, { namaToko, alamat, telepon, pemilik });
      toast.success("Toko baru berhasil ditambahkan.");
      resetForm();
    } catch (error) {
      toast.error("Gagal menambahkan toko.");
      console.error(error);
    }
  };
  
  const handleDelete = (toko) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus "${toko.namaToko}"?`)) {
        const tokoRef = ref(db, `master_toko/${toko.id}`);
        remove(tokoRef)
            .then(() => toast.success("Toko berhasil dihapus."))
            .catch(() => toast.error("Gagal menghapus toko."));
    }
  };
  
  const openEditModal = (toko) => {
    setEditingToko(toko);
    setEditedData({
        namaToko: toko.namaToko,
        alamat: toko.alamat,
        telepon: toko.telepon || '',
        pemilik: toko.pemilik || '',
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editedData.namaToko || !editedData.alamat) {
        return toast.error("Nama Toko dan Alamat wajib diisi.");
    }
    const tokoRef = ref(db, `master_toko/${editingToko.id}`);
    try {
        await update(tokoRef, editedData);
        toast.success("Data toko berhasil diperbarui.");
        setIsEditModalOpen(false);
        setEditingToko(null);
    } catch (error) {
        toast.error("Gagal memperbarui data toko.");
    }
  };

  return (
    <>
      <div className="p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="card bg-white shadow-lg p-6 space-y-2">
            <h2 className="card-title">Tambah Toko Baru</h2>
            <div className="form-control">
              <label className="label"><span className="label-text font-bold">ID Toko</span></label>
              <input type="text" value={idToko} onChange={e => setIdToko(e.target.value)} placeholder="Contoh: T-BKM-001" className="input input-bordered" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-bold">Nama Toko</span></label>
              <input type="text" value={namaToko} onChange={e => setNamaToko(e.target.value)} placeholder="Nama lengkap toko" className="input input-bordered" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-bold">Alamat</span></label>
              <textarea value={alamat} onChange={e => setAlamat(e.target.value)} className="textarea textarea-bordered" placeholder="Alamat lengkap"></textarea>
            </div>
            <div className="divider text-xs">Info Tambahan (Opsional)</div>
            <div className="form-control">
              <label className="label"><span className="label-text">No. Telepon</span></label>
              <input type="text" value={telepon} onChange={e => setTelepon(e.target.value)} placeholder="Nomor telepon/HP" className="input input-bordered" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Nama Pemilik</span></label>
              <input type="text" value={pemilik} onChange={e => setPemilik(e.target.value)} placeholder="Nama pemilik toko" className="input input-bordered" />
            </div>
            <div className="form-control mt-4">
              <button type="submit" className="btn btn-primary">Simpan Toko</button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="card bg-white shadow-lg p-4 mb-6">
            <div className="form-control">
              <label className="label-text">Cari Toko (Nama atau ID)</label>
              <input type="text" placeholder="Ketik untuk mencari..." className="input input-bordered w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
            <table className="table w-full">
              <thead className="bg-gray-200">
                <tr><th>ID Toko</th><th>Nama Toko</th><th>Alamat</th><th>Aksi</th></tr>
              </thead>
              <tbody>
                {loading ? (<tr><td colSpan="4" className="text-center"><span className="loading loading-dots"></span></td></tr>) 
                : (filteredToko.map(toko => (
                    <tr key={toko.id} className="hover">
                      <td className="font-bold">{toko.id}</td>
                      <td>{toko.namaToko}</td>
                      <td>{toko.alamat}</td>
                      <td className="flex gap-2">
                        <button onClick={() => openEditModal(toko)} className="btn btn-xs btn-info">Edit</button>
                        <button onClick={() => handleDelete(toko)} className="btn btn-xs btn-error">Hapus</button>
                      </td>
                    </tr>
                  )))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {isEditModalOpen && editingToko && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Edit Toko: {editingToko.namaToko}</h3>
            <div className="py-4 space-y-4">
                <div className="form-control"><label className="label-text">Nama Toko</label><input type="text" value={editedData.namaToko} onChange={e => setEditedData({...editedData, namaToko: e.target.value})} className="input input-bordered" /></div>
                <div className="form-control"><label className="label-text">Alamat</label><textarea value={editedData.alamat} onChange={e => setEditedData({...editedData, alamat: e.target.value})} className="textarea textarea-bordered"></textarea></div>
                <div className="form-control"><label className="label-text">No. Telepon</label><input type="text" value={editedData.telepon} onChange={e => setEditedData({...editedData, telepon: e.target.value})} className="input input-bordered" /></div>
                <div className="form-control"><label className="label-text">Nama Pemilik</label><input type="text" value={editedData.pemilik} onChange={e => setEditedData({...editedData, pemilik: e.target.value})} className="input input-bordered" /></div>
            </div>
            <div className="modal-action">
              <button onClick={handleUpdate} className="btn btn-primary">Simpan</button>
              <button onClick={() => setIsEditModalOpen(false)} className="btn">Batal</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default KelolaToko;
