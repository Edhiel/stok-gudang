import React, { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

function CameraBarcodeScanner({ onScan, onClose }) {
  const [error, setError] = useState('');

  useEffect(() => {
    // ID elemen tempat scanner akan dirender
    const scannerId = 'qr-reader-container';
    
    // Inisialisasi library
    const html5QrCode = new Html5Qrcode(scannerId);

    const config = { 
      fps: 10, 
      qrbox: { width: 250, height: 150 }, // Kotak scan persegi panjang, lebih cocok untuk barcode
    };

    const onScanSuccess = (decodedText, decodedResult) => {
        onScan(decodedText);
        onClose(); // Otomatis tutup setelah berhasil
    };

    const onScanFailure = (errorMsg) => {
      // Abaikan error "tidak ditemukan"
    };
    
    // Fungsi untuk memulai scanner
    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" }, // Prioritaskan kamera belakang
          config,
          onScanSuccess,
          onScanFailure
        );
      } catch (err) {
        console.error("Gagal memulai scanner:", err);
        setError("Kamera tidak ditemukan atau gagal dimulai. Pastikan izin sudah diberikan.");
      }
    };

    startScanner();

    // Cleanup function saat komponen ditutup
    return () => {
      // Pastikan scanner sudah berjalan sebelum mencoba menghentikannya
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          console.log("Scanner dihentikan.");
        }).catch(err => {
          console.error("Gagal menghentikan scanner.", err);
        });
      }
    };
  }, [onScan, onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md">
        <h3 className="text-center text-lg font-semibold mb-2">
          Arahkan Kamera ke Barcode
        </h3>
        {/* Beri style agar ukuran kontainer jelas */}
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