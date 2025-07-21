import React, { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

function BarcodeScanner({ onScan, onClose }) {
  // State baru untuk menampilkan hasil scan sesaat
  const [scanResult, setScanResult] = useState(null);

  useEffect(() => {
    const scannerId = 'qr-reader';
    const html5QrCode = new Html5Qrcode(scannerId);

    // Fungsi saat scan berhasil
    const onScanSuccess = (decodedText) => {
      // 1. Tampilkan hasil di UI dan hentikan kamera
      setScanResult(decodedText);
      if (html5QrCode.isScanning) {
        html5QrCode.stop();
      }

      // 2. Beri jeda 1 detik sebelum mengirim hasil dan menutup modal
      setTimeout(() => {
        onScan(decodedText);
        onClose();
      }, 1000);
    };

    // Fungsi saat scan gagal (diabaikan)
    const onScanFailure = (err) => {};

    // Mulai scanner
    if (!scanResult) { // Hanya mulai jika belum ada hasil scan
      html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 150 } },
        onScanSuccess,
        onScanFailure
      ).catch((err) => {
        console.error("Gagal memulai scanner.", err);
      });
    }

    // 3. Logika cleanup yang lebih aman
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => {
          console.error("Gagal menghentikan scanner dengan benar.", err);
        });
      }
    };
  }, [onScan, onClose, scanResult]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50">
      <div id="qr-reader" className="w-full max-w-sm h-80 bg-black rounded-lg overflow-hidden relative">
        {/* Tampilan saat hasil scan didapatkan */}
        {scanResult && (
          <div className="w-full h-full bg-green-500 flex flex-col items-center justify-center text-white p-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            <p className="mt-4 font-bold">Scan Berhasil!</p>
            <p className="text-sm break-all">{scanResult}</p>
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
      >
        Tutup
      </button>
    </div>
  );
}

export default BarcodeScanner;