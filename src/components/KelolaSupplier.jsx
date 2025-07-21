import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, update, remove } from 'firebase/database';
import { db } from '../firebaseConfig';

function KelolaSupplier() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  // State untuk form Supplier Utama
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');

  // State untuk modal Sub-supplier
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [subSupplierName, setSubSupplierName] = useState('');

  // State untuk modal Edit Supplier
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [editedSupplierData, setEditedSupplierData] = useState({ name: '', contact: '' });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const suppliersRef = ref(db, 'suppliers/');
    const unsubscribe = onValue(suppliersRef, (snapshot) => {
      const data = snapshot.val();
      const supplierList = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
      setSuppliers(supplierList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (!supplierId || !supplierName) {
        setError('ID dan Nama Supplier wajib diisi.');
        return;
    }
    setError(''); setSuccess('');
    const newSupplierRef = ref(db, 'suppliers/' + supplierId.toUpperCase());
    await set(newSupplierRef, { name: supplierName, contact: supplierContact });
    setSupplierId(''); setSupplierName(''); setSupplierContact('');
    setSuccess('Supplier utama berhasil ditambahkan.');
  };

  const handleAddSubSupplier = async (e) => {
    e.preventDefault();
    if (!subSupplierName || !selectedSupplier) return;
    const subSupplierRef = push(ref(db, `suppliers/${selectedSupplier.id}/subSuppliers`));
    await set(subSupplierRef, { name: subSupplierName });
    setSubSupplierName('');
    document.getElementById('subsupplier_modal').close();
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

  const handleUpdateSupplier = async () => {
    if (!editedSupplierData.name) {
      alert("Nama supplier tidak boleh kosong.");
      return;
    }
    const supplierRef = ref(db, `suppliers/${editingSupplier.id}`);
    try {
      await update(supplierRef, {
        name: editedSupplierData.name,
        contact: editedSupplierData.contact
      });
      alert("Data supplier berhasil diperbarui.");
      setIsEditModalOpen(false);
    } catch (error) {
      alert("Gagal memperbarui data.");
      console.error(error);
    }
  };

  const handleDeleteSupplier = async (supplierId, supplierName) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus supplier "${supplierName}"? Semua sub-supplier juga akan terhapus.`)) {
        try {
            await remove(ref(db, `suppliers/${supplierId}`));
            alert("Supplier berhasil dihapus.");
        } catch (err) {
            alert("Gagal menghapus supplier.");
        }
    }
  };

  return (
    <>
      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* --- BAGIAN YANG HILANG: FORM TAMBAH SUPPLIER --- */}
        <div className="lg:col-span-1">
          <form onSubmit={handleAddSupplier} className="card bg-white shadow-lg p-6 space-y-2">
              <h2 className="card-title">Tambah Supplier</h2>
              {success && <div role="alert" className="alert alert-success text-sm p-2"><span>{success}</span></div>}
              {error && <div role="alert" className="alert alert-error text-sm p-2"><span>{error}</span></div>}
              <div className="form-control">
                  <label className="label"><span className="label-text font-bold">ID Supplier</span></label>
                  <input type="text" placeholder="Contoh: SUP-INDFOOD" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input input-bordered" />
              </div>
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
        {/* --- AKHIR BAGIAN YANG HILANG --- */}

        {/* Kolom Daftar Supplier */}
        <div className="lg:col-span-2">
          <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
            <table className="table w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th>ID Supplier</th>
                  <th>Nama Supplier</th>
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
                      <td className="font-bold">{sup.id}</td>
                      <td>{sup.name}</td>
                      <td>{sup.subSuppliers ? Object.values(sup.subSuppliers).length : 0}</td>
                      <td className="flex gap-2">
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

      {/* Modal Edit Supplier */}
      {isEditModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Edit Supplier: {editingSupplier.id}</h3>
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

      {/* --- BAGIAN YANG HILANG: MODAL SUB-SUPPLIER --- */}
      <dialog id="subsupplier_modal" className="modal">
        <div className="modal-box">
            <h3 className="font-bold text-lg">Kelola Sub-supplier untuk <br/>{selectedSupplier?.name}</h3>
            <form onSubmit={handleAddSubSupplier} className="mt-4">
                <div className="form-control">
                    <label className="label"><span className="label-text">Nama Sub-supplier Baru</span></label>
                    <input type="text" placeholder="Nama cabang/distributor" value={subSupplierName} onChange={(e) => setSubSupplierName(e.target.value)} className="input input-bordered" />
                </div>
                <div className="form-control mt-4">
                    <button type="submit" className="btn btn-primary">Tambah</button>
                </div>
            </form>
            <div className="divider">Daftar Sub-supplier</div>
            <div className="overflow-y-auto max-h-40">
                <ul>
                    {selectedSupplier?.subSuppliers ? Object.values(selectedSupplier.subSuppliers).map(sub => (
                        <li key={sub.name} className="p-2 border-b">{sub.name}</li>
                    )) : <li>Belum ada sub-supplier.</li>}
                </ul>
            </div>
            <div className="modal-action">
                <form method="dialog"><button className="btn">Tutup</button></form>
            </div>
        </div>
      </dialog>
      {/* --- AKHIR BAGIAN YANG HILANG --- */}
    </>
  );
}

export default KelolaSupplier;