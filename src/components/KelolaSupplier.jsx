import React, { useState, useEffect } from 'react';
// --- 1. IMPORT BARU DARI FIRESTORE ---
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';

function KelolaSupplier() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk form Supplier Utama
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');

  // State untuk modal Sub-supplier
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [subSupplierName, setSubSupplierName] = useState('');

  // State untuk modal Edit Supplier
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [editedSupplierData, setEditedSupplierData] = useState({ name: '', contact: '' });

  // --- 2. LOGIKA BARU MENGAMBIL DATA DARI FIRESTORE ---
  useEffect(() => {
    const suppliersCollectionRef = collection(firestoreDb, 'suppliers');
    const unsubscribe = onSnapshot(suppliersCollectionRef, (snapshot) => {
      const supplierList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSuppliers(supplierList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 3. LOGIKA BARU MENAMBAH SUPPLIER KE FIRESTORE ---
  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (!supplierName) {
        return toast.error('Nama Supplier wajib diisi.');
    }
    try {
        await addDoc(collection(firestoreDb, 'suppliers'), { 
            name: supplierName, 
            contact: supplierContact,
            subSuppliers: {} // Inisialisasi sub-supplier sebagai objek kosong
        });
        toast.success('Supplier baru berhasil ditambahkan.');
        setSupplierName(''); setSupplierContact('');
    } catch (err) {
        toast.error("Gagal menambahkan supplier.");
        console.error(err);
    }
  };

  const handleAddSubSupplier = async (e) => {
    e.preventDefault();
    if (!subSupplierName || !selectedSupplier) return;
    
    // Untuk sub-supplier, kita menggunakan ID unik sederhana berbasis waktu
    const subSupplierId = `sub_${Date.now()}`;
    const supplierDocRef = doc(firestoreDb, 'suppliers', selectedSupplier.id);
    
    try {
        // Kita menggunakan dot notation untuk update field di dalam dokumen
        await updateDoc(supplierDocRef, {
            [`subSuppliers.${subSupplierId}`]: { name: subSupplierName }
        });
        setSubSupplierName('');
        // Tidak perlu menutup modal agar bisa tambah lagi
    } catch(err) {
        toast.error("Gagal menambah sub-supplier.");
        console.error(err);
    }
  };

  const openSubSupplierModal = (supplier) => {
    setSelectedSupplier(supplier);
    document.getElementById('subsupplier_modal').showModal();
  };

  const handleOpenEditModal = (supplier) => {
    setEditingSupplier(supplier);
    setEditedSupplierData({ name: supplier.name, contact: supplier.contact || '' });
    setIsEditModalOpen(true);
  };

  // --- 4. LOGIKA BARU UPDATE SUPPLIER KE FIRESTORE ---
  const handleUpdateSupplier = async () => {
    if (!editedSupplierData.name) {
      return toast.error("Nama supplier tidak boleh kosong.");
    }
    const supplierDocRef = doc(firestoreDb, 'suppliers', editingSupplier.id);
    try {
      await updateDoc(supplierDocRef, {
        name: editedSupplierData.name,
        contact: editedSupplierData.contact
      });
      toast.success("Data supplier berhasil diperbarui.");
      setIsEditModalOpen(false);
    } catch (error) {
      toast.error("Gagal memperbarui data.");
      console.error(error);
    }
  };

  // --- 5. LOGIKA BARU HAPUS SUPPLIER DARI FIRESTORE ---
  const handleDeleteSupplier = async (supplierId, supplierName) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus supplier "${supplierName}"?`)) {
        try {
            await deleteDoc(doc(firestoreDb, 'suppliers', supplierId));
            toast.success("Supplier berhasil dihapus.");
        } catch (err) {
            toast.error("Gagal menghapus supplier.");
            console.error(err);
        }
    }
  };

  return (
    <>
      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <form onSubmit={handleAddSupplier} className="card bg-white shadow-lg p-6 space-y-2">
              <h2 className="card-title">Tambah Supplier</h2>
              <div className="form-control">
                  <label className="label"><span className="label-text font-bold">Nama Supplier</span></label>
                  <input type="text" placeholder="Contoh: PT Indofood" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="input input-bordered" />
              </div>
              <div className="form-control">
                  <label className="label"><span className="label-text">Kontak (Opsional)</span></label>
                  <input type="text" placeholder="No. Telepon / Email" value={supplierContact} onChange={(e) => setSupplierContact(e.target.value)} className="input input-bordered" />
              </div>
              <div className="form-control mt-4">
                  <button type="submit" className="btn btn-primary">Simpan Supplier</button>
              </div>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
            <table className="table w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th>Nama Supplier</th>
                  <th>Kontak</th>
                  <th>Sub-supplier</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="text-center"><span className="loading loading-dots loading-md"></span></td></tr>
                ) : (
                  suppliers.map(sup => (
                    <tr key={sup.id}>
                      <td className="font-bold">{sup.name}</td>
                      <td>{sup.contact || '-'}</td>
                      <td>{sup.subSuppliers ? Object.keys(sup.subSuppliers).length : 0}</td>
                      <td className="flex gap-2 flex-wrap">
                        <button onClick={() => handleOpenEditModal(sup)} className="btn btn-sm btn-info">Edit</button>
                        <button onClick={() => openSubSupplierModal(sup)} className="btn btn-sm btn-secondary">Kelola Sub</button>
                        <button onClick={() => handleDeleteSupplier(sup.id, sup.name)} className="btn btn-sm btn-error">Hapus</button>
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
            <h3 className="font-bold text-lg">Edit Supplier: {editingSupplier?.name}</h3>
            <div className="py-4 space-y-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Nama Supplier</span></label>
                <input type="text" value={editedSupplierData.name} onChange={(e) => setEditedSupplierData({...editedSupplierData, name: e.target.value})} className="input input-bordered w-full" />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Kontak (Opsional)</span></label>
                <input type="text" value={editedSupplierData.contact} onChange={(e) => setEditedSupplierData({...editedSupplierData, contact: e.target.value})} className="input input-bordered w-full" />
              </div>
            </div>
            <div className="modal-action">
              <button onClick={handleUpdateSupplier} className="btn btn-primary">Simpan Perubahan</button>
              <button onClick={() => setIsEditModalOpen(false)} className="btn">Batal</button>
            </div>
          </div>
        </div>
      )}

      <dialog id="subsupplier_modal" className="modal">
        <div className="modal-box">
            <h3 className="font-bold text-lg">Kelola Sub-supplier untuk <br/>{selectedSupplier?.name}</h3>
            <form onSubmit={handleAddSubSupplier} className="mt-4">
                <div className="form-control">
                    <label className="label"><span className="label-text">Nama Sub-supplier Baru</span></label>
                    <div className="join w-full">
                        <input type="text" placeholder="Nama cabang/distributor" value={subSupplierName} onChange={(e) => setSubSupplierName(e.target.value)} className="input input-bordered join-item w-full" />
                        <button type="submit" className="btn btn-primary join-item">Tambah</button>
                    </div>
                </div>
            </form>
            <div className="divider">Daftar Sub-supplier</div>
            <div className="overflow-y-auto max-h-40">
                <ul>
                    {selectedSupplier?.subSuppliers && Object.keys(selectedSupplier.subSuppliers).length > 0 ?
                     Object.values(selectedSupplier.subSuppliers).map(sub => (
                        <li key={sub.name} className="p-2 border-b">{sub.name}</li>
                    )) : <li>Belum ada sub-supplier.</li>}
                </ul>
            </div>
            <div className="modal-action">
              <form method="dialog"><button className="btn">Tutup</button></form>
            </div>
        </div>
      </dialog>
    </>
  );
}

export default KelolaSupplier;
