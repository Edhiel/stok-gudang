import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';

function AlokasiSupplier({ userProfile, setPage }) {
  const [depots, setDepots] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedDepotId, setSelectedDepotId] = useState('');
  const [allocations, setAllocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Cek akses Super Admin atau Admin Pusat
    if (!userProfile || !['Super Admin', 'Admin Pusat'].includes(userProfile.role)) {
      toast.error('Akses ditolak. Hanya Super Admin atau Admin Pusat yang dapat mengelola alokasi supplier.');
      setPage('dashboard');
      return;
    }

    setLoading(true);

    // Ambil data depots dari Firestore
    const unsubscribeDepots = onSnapshot(
      collection(firestoreDb, 'depots'),
      (snapshot) => {
        const depotList = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().info?.name || doc.id,
          assignedSuppliers: doc.data().info?.assignedSuppliers || {},
        }));
        setDepots(depotList);
      },
      (error) => {
        console.error('Gagal memuat data depo:', error);
        toast.error('Gagal memuat data depo: ' + error.message);
      }
    );

    // Ambil data suppliers dari Firestore
    const unsubscribeSuppliers = onSnapshot(
      collection(firestoreDb, 'suppliers'),
      (snapshot) => {
        const supplierList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSuppliers(supplierList);
        setLoading(false);
      },
      (error) => {
        console.error('Gagal memuat data supplier:', error);
        toast.error('Gagal memuat data supplier: ' + error.message);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeDepots();
      unsubscribeSuppliers();
    };
  }, [userProfile, setPage]);

  useEffect(() => {
    if (!selectedDepotId) {
      setAllocations({});
      return;
    }
    // Ambil data alokasi supplier untuk depo yang dipilih
    const selectedDepot = depots.find((depot) => depot.id === selectedDepotId);
    setAllocations(selectedDepot?.assignedSuppliers || {});
  }, [selectedDepotId, depots]);

  const handleCheckboxChange = (supplierId) => {
    setAllocations((prev) => ({
      ...prev,
      [supplierId]: !prev[supplierId],
    }));
  };

  const handleSaveAllocations = async () => {
    if (!selectedDepotId) {
      toast.error('Pilih depo terlebih dahulu.');
      return;
    }

    const depotDocRef = doc(firestoreDb, 'depots', selectedDepotId);
    // Filter hanya alokasi yang bernilai true
    const finalAllocations = {};
    for (const key in allocations) {
      if (allocations[key]) {
        finalAllocations[key] = true;
      }
    }

    try {
      await updateDoc(depotDocRef, {
        'info.assignedSuppliers': finalAllocations,
      });
      setSuccess(`Alokasi supplier untuk depo ${selectedDepotId} berhasil disimpan.`);
      toast.success(`Alokasi supplier untuk depo ${selectedDepotId} berhasil disimpan.`);
    } catch (error) {
      console.error('Gagal menyimpan alokasi:', error);
      toast.error('Gagal menyimpan alokasi: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <span className="loading loading-spinner loading-lg"></span>
        <p>Memuat data alokasi supplier...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Alokasi Supplier ke Depo</h1>

      <div className="card bg-white shadow-lg p-6">
        {success && (
          <div role="alert" className="alert alert-success mb-4">
            <span>{success}</span>
          </div>
        )}

        <div className="form-control w-full max-w-xs">
          <label className="label">
            <span className="label-text font-bold">Pilih Depo yang Akan Diatur</span>
          </label>
          <select
            value={selectedDepotId}
            onChange={(e) => setSelectedDepotId(e.target.value)}
            className="select select-bordered"
          >
            <option value="">Pilih Depo</option>
            {depots.map((depot) => (
              <option key={depot.id} value={depot.id}>
                {depot.name}
              </option>
            ))}
          </select>
        </div>

        {selectedDepotId && (
          <>
            <div className="divider">Pilih Supplier yang Dipegang oleh Depo Ini</div>
            {loading ? (
              <span className="loading loading-spinner loading-lg"></span>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                {suppliers.map((supplier) => (
                  <div className="form-control" key={supplier.id}>
                    <label className="label cursor-pointer border rounded-lg p-4 justify-start">
                      <input
                        type="checkbox"
                        checked={!!allocations[supplier.id]}
                        onChange={() => handleCheckboxChange(supplier.id)}
                        className="checkbox checkbox-primary mr-4"
                      />
                      <span className="label-text">{supplier.name}</span>
                    </label>
                  </div>
                ))}
              </div>
            )}
            <div className="card-actions justify-end mt-6">
              <button onClick={handleSaveAllocations} className="btn btn-primary btn-lg">
                Simpan Alokasi
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AlokasiSupplier;
