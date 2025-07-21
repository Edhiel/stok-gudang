import React, { useState } from 'react';
import { ref, get, set } from 'firebase/database';
import { db } from '../firebaseConfig';

function BackupRestore() {
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fungsi untuk mengunduh seluruh database
  const handleBackup = async () => {
    setSuccess('');
    setError('');
    try {
      const dbRef = ref(db, '/');
      const snapshot = await get(dbRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
        const link = document.createElement('a');
        const today = new Date().toISOString().split('T')[0];
        link.href = jsonString;
        link.download = `backup_stokgudang_${today}.json`;
        link.click();
        setSuccess('Backup berhasil diunduh!');
      } else {
        setError('Tidak ada data untuk di-backup.');
      }
    } catch (err) {
      setError('Gagal melakukan backup.');
      console.error(err);
    }
  };

  // Fungsi untuk mengunggah dan me-restore data
  const handleRestore = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!window.confirm("PERINGATAN: Aksi ini akan MENIMPA seluruh data yang ada saat ini dengan data dari file backup. Apakah Anda yakin ingin melanjutkan?")) {
      event.target.value = null; // Reset input file
      return;
    }

    setIsRestoring(true);
    setError('');
    setSuccess('');
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        // Hapus semua data lama dan ganti dengan data baru
        await set(ref(db, '/'), data);
        setSuccess('Restore berhasil! Silakan refresh halaman untuk melihat perubahan.');
      } catch (err) {
        setError('Gagal me-restore data. Pastikan file JSON valid.');
        console.error(err);
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
    event.target.value = null; // Reset input file
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Backup & Restore Data</h1>
      <div className="card bg-white shadow-lg">
        <div className="card-body space-y-4">
          {success && <div role="alert" className="alert alert-success"><span>{success}</span></div>}
          {error && <div role="alert" className="alert alert-error"><span>{error}</span></div>}
          
          {/* Bagian Backup */}
          <div>
            <h2 className="card-title">Backup Data</h2>
            <p className="text-sm text-gray-600 mb-2">Unduh salinan seluruh data aplikasi (users, depots, items, dll) ke dalam satu file JSON sebagai cadangan.</p>
            <button onClick={handleBackup} className="btn btn-primary">Unduh Backup Sekarang</button>
          </div>

          <div className="divider"></div>

          {/* Bagian Restore */}
          <div>
            <h2 className="card-title text-error">Restore Data</h2>
            <p className="text-sm text-gray-600 mb-2">
              <span className="font-bold">PERINGATAN:</span> Fitur ini akan menghapus semua data saat ini dan menggantinya dengan data dari file backup. Gunakan dengan sangat hati-hati.
            </p>
            <label htmlFor="restore-file" className={`btn btn-error ${isRestoring ? 'disabled' : ''}`}>
              {isRestoring ? 'Sedang Me-restore...' : 'Pilih File Backup & Restore'}
            </label>
            <input 
              type="file" 
              id="restore-file" 
              className="hidden" 
              accept=".json"
              onChange={handleRestore}
              disabled={isRestoring}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default BackupRestore;