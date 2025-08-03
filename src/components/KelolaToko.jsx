import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';
import Papa from 'papaparse'; // Library untuk membaca file CSV

function KelolaToko() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredStores, setFilteredStores] = useState([]);

  // State untuk form
  const [namaToko, setNamaToko] = useState('');
  const [kodeToko, setKodeToko] = useState('');
  const [alamat, setAlamat] = useState('');
  const [noTelepon, setNoTelepon] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State untuk modal edit
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(null);

  const fileInputRef = useRef(null); // Ref untuk tombol upload file

  useEffect(() => {
    const unsub = onSnapshot(collection(firestoreDb, 'master_toko'), (snapshot) => {
      const storeList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStores(storeList);
      setFilteredStores(storeList);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setFilteredStores(
      stores.filter(store =>
        store.namaToko.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (store.kodeToko && store.kodeToko.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    );
  }, [searchTerm, stores]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!namaToko) return toast.error("Nama toko wajib diisi.");
    setIsSubmitting(true);
    try {
      await addDoc(collection(firestoreDb, 'master_toko'), {
        namaToko,
        kodeToko: kodeToko || null,
        alamat,
        noTelepon,
        contactPerson,
      });
      toast.success("Toko baru berhasil ditambahkan.");
      // Reset form
      setNamaToko('');
      setKodeToko('');
      setAlamat('');
      setNoTelepon('');
      setContactPerson('');
    } catch (error) {
      toast.error("Gagal menambahkan toko: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingStore.namaToko) return toast.error("Nama toko tidak boleh kosong.");
    setIsSubmitting(true);
    const storeDocRef = doc(firestoreDb, 'master_toko', editingStore.id);
    try {
      await updateDoc(storeDocRef, {
        namaToko: editingStore.namaToko,
        kodeToko: editingStore.kodeToko || null,
        alamat: editingStore.alamat,
        noTelepon: editingStore.noTelepon,
        contactPerson: editingStore.contactPerson,
      });
      toast.success("Data toko berhasil diperbarui.");
      setIsEditModalOpen(false);
    } catch (error) {
      toast.error("Gagal memperbarui data: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // --- FUNGSI BARU UNTUK IMPOR CSV ---
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    toast.loading("Memproses file CSV...", { id: "csv-toast" });

    Papa.parse(file, {
      header: true,
      delimiter: ";", // Memberitahu parser untuk menggunakan semicolon
      skipEmptyLines: true,
      complete: async (results) => {
        const storesFromCsv = results.data;
        if (storesFromCsv.length === 0) {
            toast.dismiss("csv-toast");
            return toast.error("File CSV kosong atau formatnya salah.");
        }

        if (!window.confirm(`Anda akan mengimpor ${storesFromCsv.length} data toko. Ini akan menambahkan data baru, bukan memperbarui yang sudah ada. Lanjutkan?`)) {
            toast.dismiss("csv-toast");
            return;
        }

        try {
            const batch = writeBatch(firestoreDb);
            let importedCount = 0;

            storesFromCsv.forEach(row => {
                // Memetakan nama kolom dari CSV ke field di database
                const newStoreData = {
                    namaToko: row.CUSTOMERNAME,
                    kodeToko: row.CUSTOMERID,
                    alamat: `${row.ADDRESSLINE1 || ''} ${row.ADDRESSLINE2 || ''} ${row.CITY || ''}`.trim(),
                    noTelepon: row.PHONE,
                    contactPerson: row.CONTACTPERSONNAME || row.CUSTOMERNAME,
                    status: row.CUSTOMERSTATUS // Menyimpan data status juga
                };
                
                // Hanya proses jika ada nama toko
                if (newStoreData.namaToko) {
                    const newDocRef = doc(collection(firestoreDb, 'master_toko'));
                    batch.set(newDocRef, newStoreData);
                    importedCount++;
                }
            });

            await batch.commit();
            toast.dismiss("csv-toast");
            toast.success(`${importedCount} data toko berhasil diimpor!`);

        } catch (error) {
            toast.dismiss("csv-toast");
            toast.error("Terjadi kesalahan saat impor: " + error.message);
        } finally {
            // Reset input file agar bisa upload file yang sama lagi
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
      }
    });
  };

  const openEditModal = (store) => {
    setEditingStore(store);
    setIsEditModalOpen(true);
  };

  return (
    <>
      <div className="p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="card bg-white shadow-lg p-6 space-y-4">
            <h2 className="card-title">Tambah Toko / Pelanggan Baru</h2>
            <div className="form-control">
              <label className="label"><span className="label-text font-bold">Nama Toko</span></label>
              <input type="text" value={namaToko} onChange={e => setNamaToko(e.target.value)} placeholder="Contoh: Toko Berkah Jaya" className="input input-bordered" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Kode Toko (dari ND6)</span></label>
              <input type="text" value={kodeToko} onChange={e => setKodeToko(e.target.value)} placeholder="Opsional" className="input input-bordered" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Alamat</span></label>
              <textarea value={alamat} onChange={e => setAlamat(e.target.value)} className="textarea textarea-bordered" placeholder="Alamat lengkap toko"></textarea>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">No. Telepon</span></label>
              <input type="text" value={noTelepon} onChange={e => setNoTelepon(e.target.value)} placeholder="08xxxxxxxxxx" className="input input-bordered" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Contact Person</span></label>
              <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Nama pemilik atau PIC" className="input input-bordered" />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
              {isSubmitting ? <span className="loading loading-spinner"></span> : "Simpan Toko"}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="card bg-white shadow-lg p-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <input
                type="text"
                placeholder="Cari nama atau kode toko..."
                className="input input-bordered w-full max-w-xs"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {/* --- TOMBOL IMPOR BARU --- */}
              <button onClick={() => fileInputRef.current.click()} className="btn btn-success">
                Impor dari CSV
              </button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".csv"/>
            </div>
          </div>
          <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
            <table className="table w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th>Kode Toko</th>
                  <th>Nama Toko</th>
                  <th>Alamat</th>
                  <th>No. Telepon</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>
                ) : (
                  filteredStores.map(store => (
                    <tr key={store.id}>
                      <td className="font-mono text-xs">{store.kodeToko}</td>
                      <td className="font-bold">{store.namaToko}</td>
                      <td>{store.alamat}</td>
                      <td>{store.noTelepon}</td>
                      <td><button onClick={() => openEditModal(store)} className="btn btn-xs btn-info">Edit</button></td>
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
            <h3 className="font-bold text-lg">Edit Toko: {editingStore.namaToko}</h3>
            <form onSubmit={handleUpdate}>
              <div className="form-control mt-4">
                <label className="label-text">Nama Toko</label>
                <input type="text" value={editingStore.namaToko} onChange={e => setEditingStore({...editingStore, namaToko: e.target.value})} className="input input-bordered" />
              </div>
              <div className="form-control mt-2">
                <label className="label-text">Kode Toko</label>
                <input type="text" value={editingStore.kodeToko} onChange={e => setEditingStore({...editingStore, kodeToko: e.target.value})} className="input input-bordered" />
              </div>
              <div className="form-control mt-2">
                <label className="label-text">Alamat</label>
                <textarea value={editingStore.alamat} onChange={e => setEditingStore({...editingStore, alamat: e.target.value})} className="textarea textarea-bordered"></textarea>
              </div>
              <div className="form-control mt-2">
                <label className="label-text">No. Telepon</label>
                <input type="text" value={editingStore.noTelepon} onChange={e => setEditingStore({...editingStore, noTelepon: e.target.value})} className="input input-bordered" />
              </div>
              <div className="form-control mt-2">
                <label className="label-text">Contact Person</label>
                <input type="text" value={editingStore.contactPerson} onChange={e => setEditingStore({...editingStore, contactPerson: e.target.value})} className="input input-bordered" />
              </div>
              <div className="modal-action">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn" disabled={isSubmitting}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? <span className="loading loading-spinner"></span> : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default KelolaToko;
