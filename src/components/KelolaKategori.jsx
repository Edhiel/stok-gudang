import React, { useState, useEffect } from 'react';
// --- 1. IMPORT BARU DARI FIRESTORE ---
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
// --- 2. UBAH IMPORT DARI FIREBASECONFIG ---
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';

function KelolaKategori() {
  const [categories, setCategories] = useState([]);
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editedCategoryName, setEditedCategoryName] = useState('');

  // --- 3. LOGIKA BARU MENGAMBIL DATA DARI FIRESTORE ---
  useEffect(() => {
    const categoriesCollectionRef = collection(firestoreDb, 'categories');
    const unsubscribe = onSnapshot(categoriesCollectionRef, (snapshot) => {
      const loadedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCategories(loadedCategories);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 4. LOGIKA BARU MENAMBAH KATEGORI KE FIRESTORE ---
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!categoryName) { 
        return toast.error("Nama kategori tidak boleh kosong.");
    }
    try {
      await addDoc(collection(firestoreDb, 'categories'), { name: categoryName });
      toast.success(`Kategori "${categoryName}" berhasil ditambahkan.`);
      setCategoryName('');
    } catch (err) {
      toast.error("Gagal menambahkan kategori.");
      console.error(err);
    }
  };
  
  // --- 5. LOGIKA BARU MENGHAPUS KATEGORI DARI FIRESTORE ---
  const handleDeleteCategory = async (categoryId, categoryName) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus kategori "${categoryName}"?`)) {
        try {
            await deleteDoc(doc(firestoreDb, 'categories', categoryId));
            toast.success("Kategori berhasil dihapus.");
        } catch (err) {
            toast.error("Gagal menghapus kategori.");
        }
    }
  };

  const handleOpenEditModal = (category) => {
    setEditingCategory(category);
    setEditedCategoryName(category.name);
    setIsEditModalOpen(true);
  };

  // --- 6. LOGIKA BARU UPDATE KATEGORI KE FIRESTORE ---
  const handleUpdateCategory = async () => {
    if (!editedCategoryName) {
      return toast.error("Nama kategori tidak boleh kosong.");
    }
    const categoryDocRef = doc(firestoreDb, 'categories', editingCategory.id);
    try {
      await updateDoc(categoryDocRef, { name: editedCategoryName });
      toast.success("Kategori berhasil diperbarui.");
      setIsEditModalOpen(false);
      setEditingCategory(null);
    } catch (error) {
      toast.error("Gagal memperbarui kategori.");
      console.error(error);
    }
  };
  
  return (
    <>
      <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <form onSubmit={handleAddCategory} className="card bg-white shadow-lg p-6">
            <h2 className="card-title">Tambah Kategori Baru</h2>
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
                {loading ?
                <tr><td colSpan="2" className="text-center"><span className="loading loading-dots"></span></td></tr> :
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
