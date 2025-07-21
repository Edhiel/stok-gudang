import React, { useState, useEffect } from 'react';
import { ref, onValue, push, remove, update } from 'firebase/database';
import { db } from '../firebaseConfig';

function KelolaKategori() {
  const [categories, setCategories] = useState([]);
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editedCategoryName, setEditedCategoryName] = useState('');

  useEffect(() => {
    const categoriesRef = ref(db, 'categories/');
    onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      const loadedCategories = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
      setCategories(loadedCategories);
      setLoading(false);
    });
  }, []);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!categoryName) { setError("Nama kategori tidak boleh kosong."); return; }
    setError(''); setSuccess('');
    
    try {
      await push(ref(db, 'categories'), { name: categoryName });
      setSuccess(`Kategori "${categoryName}" berhasil ditambahkan.`);
      setCategoryName('');
    } catch (err) {
      setError("Gagal menambahkan kategori.");
      console.error(err);
    }
  };
  
  const handleDeleteCategory = async (categoryId, categoryName) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus kategori "${categoryName}"?`)) {
        try {
            await remove(ref(db, `categories/${categoryId}`));
            alert("Kategori berhasil dihapus.");
        } catch (err) {
            alert("Gagal menghapus kategori.");
        }
    }
  };

  const handleOpenEditModal = (category) => {
    setEditingCategory(category);
    setEditedCategoryName(category.name);
    setIsEditModalOpen(true);
  };

  const handleUpdateCategory = async () => {
    if (!editedCategoryName) {
      alert("Nama kategori tidak boleh kosong.");
      return;
    }
    const categoryRef = ref(db, `categories/${editingCategory.id}`);
    try {
      await update(categoryRef, { name: editedCategoryName });
      alert("Kategori berhasil diperbarui.");
      setIsEditModalOpen(false);
      setEditingCategory(null);
    } catch (error) {
      alert("Gagal memperbarui kategori.");
      console.error(error);
    }
  };

  return (
    <>
      <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <form onSubmit={handleAddCategory} className="card bg-white shadow-lg p-6">
            <h2 className="card-title">Tambah Kategori Baru</h2>
            {success && <div role="alert" className="alert alert-success text-sm p-2 mt-2"><span>{success}</span></div>}
            {error && <div role="alert" className="alert alert-error text-sm p-2 mt-2"><span>{error}</span></div>}
            <div className="form-control mt-2">
              <label className="label"><span className="label-text">Nama Kategori</span></label>
              <input type="text" placeholder="Contoh: Kebutuhan Dapur" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className="input input-bordered" />
            </div>
            <div className="form-control mt-4">
              <button type="submit" className="btn btn-primary">Simpan Kategori</button>
            </div>
          </form>
        </div>
        <div className="md:col-span-2">
          <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
            <table className="table w-full">
              <thead className="bg-gray-200"><tr><th>Nama Kategori</th><th>Aksi</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="2" className="text-center"><span className="loading loading-dots"></span></td></tr> :
                categories.map(cat => (
                  <tr key={cat.id}>
                    <td>{cat.name}</td>
                    <td className="flex gap-2">
                      <button onClick={() => handleOpenEditModal(cat)} className="btn btn-xs btn-info">Edit</button>
                      <button onClick={() => handleDeleteCategory(cat.id, cat.name)} className="btn btn-xs btn-error">Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isEditModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Edit Nama Kategori</h3>
            <div className="py-4">
              <label className="label"><span className="label-text">Nama Kategori</span></label>
              <input type="text" value={editedCategoryName} onChange={(e) => setEditedCategoryName(e.target.value)} className="input input-bordered w-full"/>
            </div>
            <div className="modal-action">
              <button onClick={handleUpdateCategory} className="btn btn-primary">Simpan Perubahan</button>
              <button onClick={() => setIsEditModalOpen(false)} className="btn">Batal</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export default KelolaKategori;