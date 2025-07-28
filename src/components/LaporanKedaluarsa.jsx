import React, { useState, useEffect } from 'react';
import { ref, onValue, get } from 'firebase/database';
import { db } from '../firebaseConfig';

function LaporanKedaluwarsa({ userProfile }) {
  const [loading, setLoading] = useState(true);
  const [masterItems, setMasterItems] = useState({});
  const [allBatches, setAllBatches] = useState([]);
  const [filteredBatches, setFilteredBatches] = useState([]);
  
  // State untuk filter: 30, 60, 90 hari, atau 'expired'
  const [filterMode, setFilterMode] = useState(30);

  useEffect(() => {
    if (!userProfile.depotId) {
      setLoading(false);
      return;
    }

    // Ambil master barang sekali saja untuk mendapatkan nama
    const masterItemsRef = ref(db, 'master_items');
    get(masterItemsRef).then(snapshot => {
        setMasterItems(snapshot.val() || {});
    });

    // Ambil semua data stok
    const stockRef = ref(db, `depots/${userProfile.depotId}/stock`);
    const unsubscribe = onValue(stockRef, (snapshot) => {
      const stockData = snapshot.val() || {};
      const processedBatches = [];
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Set ke awal hari

      // Loop setiap item di stok
      for (const itemId in stockData) {
        const item = stockData[itemId];
        if (item.batches) {
          // Loop setiap batch di dalam item
          for (const batchId in item.batches) {
            const batch = item.batches[batchId];
            const expireDate = new Date(batch.expireDate);
            
            // Hitung selisih hari
            const diffTime = expireDate - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            processedBatches.push({
              itemId: itemId,
              batchId: batchId,
              itemName: 'Loading...', // Akan diisi nanti
              ...batch,
              daysUntilExpired: diffDays,
            });
          }
        }
      }
      setAllBatches(processedBatches);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile.depotId]);

  useEffect(() => {
    // Filter batches berdasarkan mode yang dipilih
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const filtered = allBatches
        .map(batch => ({...batch, itemName: masterItems[batch.itemId]?.name || 'Nama Tidak Ditemukan'}))
        .filter(batch => {
            if (!batch.expireDate) return false;
            
            if (filterMode === 'expired') {
                return batch.daysUntilExpired < 0;
            } else {
                return batch.daysUntilExpired >= 0 && batch.daysUntilExpired <= filterMode;
            }
        });
    
    // Urutkan berdasarkan yang paling cepat kedaluwarsa
    setFilteredBatches(filtered.sort((a, b) => a.daysUntilExpired - b.daysUntilExpired));

  }, [allBatches, filterMode, masterItems]);

  const getStatusBadge = (days) => {
      if (days < 0) return <span className="badge badge-error">Sudah Kedaluwarsa</span>;
      if (days <= 30) return <span className="badge badge-warning">Kritis</span>;
      if (days <= 60) return <span className="badge badge-info">Waspada</span>;
      return <span className="badge badge-success">Aman</span>;
  };

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-4">Laporan Kontrol Kedaluwarsa</h1>
      <p className="mb-6">Gunakan laporan ini untuk memantau stok yang mendekati tanggal kedaluwarsa.</p>

      <div className="card bg-white shadow-lg p-4 mb-6">
        <label className="label-text font-bold mb-2">Tampilkan barang yang akan kedaluwarsa dalam:</label>
        <div className="join">
          <button onClick={() => setFilterMode(30)} className={`join-item btn ${filterMode === 30 ? 'btn-active' : ''}`}>30 Hari</button>
          <button onClick={() => setFilterMode(60)} className={`join-item btn ${filterMode === 60 ? 'btn-active' : ''}`}>60 Hari</button>
          <button onClick={() => setFilterMode(90)} className={`join-item btn ${filterMode === 90 ? 'btn-active' : ''}`}>90 Hari</button>
          <button onClick={() => setFilterMode('expired')} className={`join-item btn ${filterMode === 'expired' ? 'btn-active' : ''}`}>Sudah Kedaluwarsa</button>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="table w-full">
          <thead className="bg-gray-200">
            <tr>
              <th>Nama Barang</th>
              <th>Lokasi</th>
              <th>Jumlah Batch</th>
              <th>Tanggal Kedaluwarsa</th>
              <th>Sisa Hari</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="text-center"><span className="loading loading-dots"></span></td></tr>
            ) : filteredBatches.length === 0 ? (
              <tr><td colSpan="6" className="text-center p-8">Tidak ada barang yang cocok dengan kriteria filter.</td></tr>
            ) : (
              filteredBatches.map(batch => (
                <tr key={batch.batchId} className="hover">
                  <td className="font-bold">{batch.itemName}</td>
                  <td>{batch.locationId}</td>
                  <td>{batch.quantity} Pcs</td>
                  <td className="font-semibold">{new Date(batch.expireDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                  <td className="font-semibold">{batch.daysUntilExpired} hari</td>
                  <td>{getStatusBadge(batch.daysUntilExpired)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LaporanKedaluwarsa;
