import React, { useState } from 'react';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';

function BackupRestore() {
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleBackup = async () => {
    setSuccess('');
    setError('');
    toast.loading('Memulai proses backup...', { id: 'backup' });
    
    try {
      const backupData = {};
      const collectionsToBackup = ['users', 'depots', 'suppliers', 'master_items', 'categories', 'stock_transfers', 'master_toko'];

      for (const collectionName of collectionsToBackup) {
        toast.loading(`Mencadangkan koleksi: ${collectionName}...`, { id: 'backup' });
        const collectionRef = collection(firestoreDb, collectionName);
        const snapshot = await getDocs(collectionRef);
        const docs = {};
        snapshot.forEach(doc => {
          docs[doc.id] = doc.data();
        });
        backupData[collectionName] = docs;
        
        if (collectionName === 'depots') {
            for (const depotId in docs) {
                const subCollections = ['locations', 'stock', 'transactions', 'penerimaanBarang', 'salesOrders', 'pendingInvoices'];
                for (const sub of subCollections) {
                    const subRef = collection(firestoreDb, `depots/${depotId}/${sub}`);
                    const subSnapshot = await getDocs(subRef);
                    if (!subSnapshot.empty) {
                        const subCollectionKey = `depots/${depotId}/${sub}`;
                        backupData[subCollectionKey] = {};
                        subSnapshot.forEach(subDoc => {
                            backupData[subCollectionKey][subDoc.id] = subDoc.data();
                        });
                    }
                }
            }
        }
      }

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
      const link = document.createElement('a');
      const today = new Date().toISOString().split('T')[0];
      link.href = jsonString;
      link.download = `firestore_backup_stokgudang_${today}.json`;
      link.click();
      toast.dismiss('backup');
      setSuccess('Backup berhasil diunduh!');

    } catch (err) {
      toast.dismiss('backup');
      setError('Gagal melakukan backup: ' + err.message);
      console.error(err);
    }
  };
  
  const handleRestore = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!window.confirm("PERINGATAN: Aksi ini akan MENIMPA seluruh data yang ada saat ini dengan data dari file backup. Apakah Anda yakin ingin melanjutkan?")) {
      event.target.value = null; 
      return;
    }
    
    setIsRestoring(true);
    setError('');
    setSuccess('');
    toast.loading('Memulihkan data... Proses ini tidak dapat dibatalkan.', { id: 'restore' });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const batch = writeBatch(firestoreDb);
        
        for (const key in data) {
            const collectionData = data[key];
            for (const docId in collectionData) {
                const docRef = doc(firestoreDb, key, docId);
                batch.set(docRef, collectionData[docId]);
            }
        }

        await batch.commit();
        toast.dismiss('restore');
        setSuccess('Restore berhasil! Silakan refresh halaman untuk melihat perubahan.');

      } catch (err) {
        toast.dismiss('restore');
        setError('Gagal restore: Pastikan format file JSON benar. ' + err.message);
        console.error(err);
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
    event.target.value = null;
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Backup & Restore Data</h1>
      <div className="card bg-white shadow-lg">
        <div className="card-body space-y-4">
          {success && <div role="alert" className="alert alert-success"><span>{success}</span></div>}
          {error && <div role="alert" className="alert alert-error"><span>{error}</span></div>}
          
          <div>
            <h2 className="card-title">Backup Data</h2>
            <p className="text-sm text-gray-600 mb-2">Unduh salinan seluruh data aplikasi dari Firestore ke dalam satu file JSON. Proses ini mungkin memakan waktu untuk database yang besar.</p>
            <button onClick={handleBackup} className="btn btn-primary">Unduh Backup Sekarang</button>
          </div>

          <div className="divider"></div>

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
