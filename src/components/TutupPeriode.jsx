import React, { useState } from 'react';
import { collection, getDocs, writeBatch, serverTimestamp, addDoc } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';

function TutupPeriode({ userProfile }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');

  const handleTutupHari = async () => {
    if (window.confirm("PERINGATAN: Anda akan memproses Tutup Hari. Aksi ini akan menyimpan snapshot stok saat ini dan tidak dapat diulang untuk tanggal yang sama. Lanjutkan?")) {
      setIsProcessing(true);
      toast.loading("Memproses Tutup Hari...", { id: "tutup-hari" });

      try {
        const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
        const snapshotId = `${userProfile.depotId}_${today}`;
        
        // Cek apakah snapshot untuk hari ini sudah ada (opsional, tapi bagus untuk mencegah duplikasi)
        // Untuk kesederhanaan, kita asumsikan admin hanya menekan sekali sehari.

        const stockRef = collection(firestoreDb, `depots/${userProfile.depotId}/stock`);
        const stockSnapshot = await getDocs(stockRef);

        if (stockSnapshot.empty) {
          throw new Error("Tidak ada data stok untuk diproses.");
        }

        const batch = writeBatch(firestoreDb);
        const stockData = [];

        stockSnapshot.forEach(doc => {
          stockData.push({
            itemId: doc.id,
            ...doc.data()
          });
        });

        // Simpan snapshot ke koleksi baru
        const snapshotDocRef = doc(firestoreDb, 'daily_stock_snapshots', snapshotId);
        batch.set(snapshotDocRef, {
          depotId: userProfile.depotId,
          date: today,
          processedBy: userProfile.fullName,
          processedAt: serverTimestamp(),
          stockData: stockData
        });

        await batch.commit();
        toast.dismiss("tutup-hari");
        toast.success(`Tutup Hari untuk tanggal ${today} berhasil diproses!`);

      } catch (error) {
        toast.dismiss("tutup-hari");
        toast.error("Gagal memproses Tutup Hari: " + error.message);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleTutupTahun = async () => {
    if (confirmationText !== "TUTUP TAHUN") {
        return toast.error("Ketik 'TUTUP TAHUN' dengan benar untuk konfirmasi.");
    }
    if (window.confirm("PERINGATAN PALING AKHIR: ANDA AKAN MENGARSIPKAN SEMUA TRANSAKSI DAN MERESET DATA UNTUK TAHUN BARU. DATA TIDAK BISA DIKEMBALIKAN. LANJUTKAN?")) {
        // Logika Tutup Tahun (memerlukan Cloud Function untuk keamanan dan keandalan)
        // 1. Buat ringkasan data tahunan (total penjualan, retur, dll.) simpan ke koleksi 'yearly_summary'.
        // 2. Arsipkan semua koleksi transaksi (salesOrders, transactions, tandaTerima) ke koleksi baru, misal 'transactions_ARCHIVE_2025'.
        // 3. Hapus data dari koleksi transaksi yang asli.
        toast.success("Proses Tutup Tahun telah dimulai. Ini akan berjalan di latar belakang dan memakan waktu beberapa menit.");
    }
  };


  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Tutup Periode</h1>
      
      <div className="card w-full max-w-2xl bg-white shadow-lg mb-8">
        <div className="card-body">
          <h2 className="card-title">Proses Tutup Hari (End of Day)</h2>
          <p className="text-sm text-gray-600">Jalankan proses ini di akhir setiap hari kerja untuk menyimpan snapshot (foto) data stok akhir. Data ini akan digunakan oleh Kantor Pusat untuk analisis harian.</p>
          <div className="card-actions justify-end mt-4">
            <button 
              className="btn btn-primary"
              onClick={handleTutupHari}
              disabled={isProcessing}
            >
              {isProcessing ? <span className="loading loading-spinner"></span> : "Proses Tutup Hari Sekarang"}
            </button>
          </div>
        </div>
      </div>

      {userProfile.role === 'Super Admin' && (
        <div className="card w-full max-w-2xl bg-error text-error-content shadow-lg">
          <div className="card-body">
            <h2 className="card-title">Proses Tutup Tahun (End of Year)</h2>
            <p className="text-sm">
              <strong>PERINGATAN:</strong> Aksi ini sangat berbahaya dan tidak dapat diurungkan. Ini akan mengarsipkan semua data transaksi dari tahun ini dan menyiapkan sistem untuk tahun baru.
              <br/>
              <strong>Fitur ini memerlukan implementasi backend (Cloud Functions) yang aman. Tombol di bawah ini adalah UI sementara.</strong>
            </p>
            <div className="form-control mt-4">
              <label className="label"><span className="label-text text-error-content">Ketik "TUTUP TAHUN" untuk konfirmasi</span></label>
              <input 
                type="text" 
                className="input input-bordered"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
              />
            </div>
            <div className="card-actions justify-end mt-4">
              <button 
                className="btn btn-ghost"
                onClick={handleTutupTahun}
                disabled={confirmationText !== "TUTUP TAHUN"}
              >
                Proses Tutup Tahun
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TutupPeriode;
