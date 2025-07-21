import React, { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

function CameraBarcodeScanner({ onScan, onClose }) {
  const [error, setError] = useState('');

  useEffect(() => {
    const scannerId = 'qr-reader-container';
    
    // Inisialisasi scanner ditempatkan di dalam useEffect
    // Ini memastikan elemen div #qr-reader-container sudah ada
    const html5QrCode = new Html5Qrcode(scannerId);

    const config = { 
      fps: 10, 
      qrbox: { width: 250, height: 150 },
    };

    const onScanSuccess = (decodedText, decodedResult) => {
        onScan(decodedText);
        onClose();
    };

    const onScanFailure = (errorMsg) => {
      // Abaikan
    };
    
    // Mulai scanner setelah komponen di-mount
    html5QrCode.start(
      { facingMode: "environment" },
      config,
      onScanSuccess,
      onScanFailure
    ).catch(err => {
        console.error("Gagal memulai scanner:", err);
        setError("Kamera gagal dimulai. Pastikan izin sudah diberikan dan tidak ada aplikasi lain yang menggunakan kamera.");
    });

    // Cleanup function saat komponen ditutup
    return () => {
      // Cek apakah scanner sedang berjalan sebelum mencoba menghentikannya
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => {
          console.error("Gagal menghentikan scanner dengan benar.", err);
        });
      }
    };
  }, [onScan, onClose]); // dependensi ditambahkan agar onScan & onClose selalu up-to-date

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md">
        <h3 className="text-center text-lg font-semibold mb-2">
          Arahkan Kamera ke Barcode
        </h3>
        
        {/* Kontainer untuk scanner */}
        <div id="qr-reader-container" className="mb-2 border rounded-lg overflow-hidden" style={{ width: '100%' }}></div>
        
        {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
        
        <button
          onClick={onClose}
          className="w-full bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mt-4"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}

export default CameraBarcodeScanner;