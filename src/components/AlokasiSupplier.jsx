import React, { useState, useEffect } from 'react';
import { ref, onValue, get, update } from 'firebase/database';
import { db } from '../firebaseConfig';

function AlokasiSupplier() {
  const [depots, setDepots] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedDepotId, setSelectedDepotId] = useState('');
  const [allocations, setAllocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');

  // Mengambil daftar semua depo dan semua supplier
  useEffect(() => {
    const depotsRef = ref(db, 'depots/');
    onValue(depotsRef, (snapshot) => {
      const data = snapshot.val();
      setDepots(data ? Object.keys(data).map(key => ({ id: key, ...data[key].info })) : []);
    });

    const suppliersRef = ref(db, 'suppliers/');
    onValue(suppliersRef, (snapshot) => {
      const data = snapshot.val();
      setSuppliers(data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : []);
      setLoading(false);
    });
  }, []);

  // Jika depo dipilih, ambil data alokasi yang sudah ada
  useEffect(() => {
    if (!selectedDepotId) {
      setAllocations({});
      return;
    };
    const allocationRef = ref(db, `depots/${selectedDepotId}/info/assignedSuppliers`);
    get(allocationRef).then((snapshot) => {
      if (snapshot.exists()) {
        setAllocations(snapshot.val());
      } else {
        setAllocations({});
      }
    });
  }, [selectedDepotId]);

  const handleCheckboxChange = (supplierId) => {
    setAllocations(prev => ({
      ...prev,
      [supplierId]: !prev[supplierId]
    }));
  };

  const handleSaveAllocations = async () => {
    if (!selectedDepotId) {
      alert("Pilih depo terlebih dahulu.");
      return;
    }
    const depotInfoRef = ref(db, `depots/${selectedDepotId}/info`);
    
    // Filter hanya alokasi yang bernilai true
    const finalAllocations = {};
    for (const key in allocations) {
      if (allocations[key]) {
        finalAllocations[key] = true;
      }
    }

    try {
      await update(depotInfoRef, {
        assignedSuppliers: finalAllocations
      });
      setSuccess(`Alokasi supplier untuk depo ${selectedDepotId} berhasil disimpan.`);
    } catch (error) {
      console.error("Gagal menyimpan alokasi:", error);
      alert("Gagal menyimpan alokasi.");
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Alokasi Supplier ke Depo</h1>
      
      <div className="card bg-white shadow-lg p-6">
        {success && <div role="alert" className="alert alert-success"><span>{success}</span></div>}
        
        <div className="form-control w-full max-w-xs">
          <label className="label"><span className="label-text font-bold">Pilih Depo yang Akan Diatur</span></label>
          <select 
            value={selectedDepotId} 
            onChange={(e) => setSelectedDepotId(e.target.value)}
            className="select select-bordered"
          >
            <option value="">Pilih Depo</option>
            {depots.map(depot => <option key={depot.id} value={depot.id}>{depot.name}</option>)}
          </select>
        </div>

        {selectedDepotId && (
          <>
            <div className="divider">Pilih Supplier yang Dipegang oleh Depo Ini</div>
            {loading ? <span className="loading loading-spinner"></span> :
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
              {suppliers.map(supplier => (
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
            }
            <div className="card-actions justify-end mt-6">
              <button onClick={handleSaveAllocations} className="btn btn-primary btn-lg">Simpan Alokasi</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AlokasiSupplier;