import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';

function KelolaLokasi({ userProfile }) {
  const [locations, setLocations] = useState([]);
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State untuk form tambah
  const [kodeLokasi, setKodeLokasi] = useState('');
  const [namaLokasi, setNamaLokasi] = useState('');
  const [keterangan, setKeterangan] = useState('');

  useEffect(() => {
    if (!userProfile || !userProfile.depotId) {
      setLoading(false);
      return;
    }
    // Lokasi sekarang adalah sub-koleksi di dalam dokumen depo
    const locationsCollectionRef = collection(firestoreDb, 'depots', userProfile.depotId, 'locations');
    const unsubscribe = onSnapshot(locationsCollectionRef, (snapshot) => {
      const loadedLocations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLocations(loadedLocations);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userProfile]);

  useEffect(() => {
    let filtered = [...locations];
    if (searchTerm) {
      filtered = filtered.filter(loc =>
        loc.namaLokasi.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredLocations(filtered.sort((a, b) => a.id.localeCompare(b.id)));
  }, [searchTerm, locations]);

  const resetForm = () => {
    setKodeLokasi('');
    setNamaLokasi('');
    setKeterangan('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!kodeLokasi || !namaLokasi) {
      return toast.error("Kode dan Nama Lokasi wajib diisi.");
    }
    const locationId = kodeLokasi.toUpperCase();
    const newLocationDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/locations/${locationId}`);
    
    const docSnap = await getDoc(newLocationDocRef);
    if (docSnap.exists()) {
      return toast.error(`Kode Lokasi "${locationId}" sudah terdaftar.`);
    }

    try {
      await setDoc(newLocationDocRef, { namaLokasi, keterangan });
      toast.success("Lokasi baru berhasil ditambahkan.");
      resetForm();
    } catch (error) {
      toast.error("Gagal menambahkan lokasi.");
      console.error(error);
    }
  };
  
  const handleDelete = async (location) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus lokasi "${location.namaLokasi}"?`)) {
        try {
            const locationDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/locations/${location.id}`);
            await deleteDoc(locationDocRef);
            toast.success("Lokasi berhasil dihapus.");
        } catch (err) {
            toast.error("Gagal menghapus lokasi.");
        }
    }
  };

  if (!userProfile.depotId) {
    return <div className="p-8 text-center">Hanya user depo yang bisa mengelola lokasi gudang.</div>;
  }

  return (
    <div className="p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg-col-span-1">
        <form onSubmit={handleSubmit} className="card bg-white shadow-lg p-6 space-y-2">
          <h2 className="card-title">Tambah Lokasi Gudang</h2>
          <div className="form-control">
            <label className="label"><span className="label-text font-bold">Kode Lokasi</span></label>
            <input type="text" value={kodeLokasi} onChange={e => setKodeLokasi(e.target.value)} placeholder="Contoh: RAK-A-01, LT2" className="input input-bordered" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text font-bold">Nama Lokasi</span></label>
            <input type="text" value={namaLokasi} onChange={e => setNamaLokasi(e.target.value)} placeholder="Contoh: Rak A Baris 1" className="input input-bordered" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Keterangan (Opsional)</span></label>
            <textarea value={keterangan} onChange={e => setKeterangan(e.target.value)} className="textarea textarea-bordered" placeholder="Info tambahan mengenai lokasi"></textarea>
          </div>
          <div className="form-control mt-4">
            <button type="submit" className="btn btn-primary">Simpan Lokasi</button>
          </div>
        </form>
      </div>

      <div className="lg-col-span-2">
        <div className="card bg-white shadow-lg p-4 mb-6">
          <div className="form-control">
            <label className="label-text">Cari Lokasi</label>
            <input type="text" placeholder="Ketik untuk mencari..." className="input input-bordered w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
          <table className="table w-full">
            <thead className="bg-gray-200">
              <tr><th>Kode Lokasi</th><th>Nama Lokasi</th><th>Keterangan</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {loading ? (<tr><td colSpan="4" className="text-center"><span className="loading loading-dots"></span></td></tr>) 
              : (filteredLocations.map(loc => (
                  <tr key={loc.id} className="hover">
                    <td className="font-bold">{loc.id}</td>
                    <td>{loc.namaLokasi}</td>
                    <td>{loc.keterangan}</td>
                    <td>
                      <button onClick={() => handleDelete(loc)} className="btn btn-xs btn-error">Hapus</button>
                    </td>
                  </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default KelolaLokasi;
