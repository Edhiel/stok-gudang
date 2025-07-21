import React, { useEffect, useRef, useState } from 'react';
// Hapus Html5QrcodeScanType yang tidak perlu
import { Html5Qrcode } from 'html5-qrcode';

function CameraBarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  
  const [error, setError] = useState('');

  useEffect(() => {
    const scannerId = 'qr-reader';
    
    // --- PERBAIKAN UTAMA ADA DI SINI ---
    const config = { 
      fps: 10, 
      qrbox: { width: 250, height: 250 },
      // Gunakan daftar format barcode yang valid sebagai string
      formatsToSupport: [
        "EAN_13",
        "EAN_8",
        "UPC_A",
        "UPC_E",
        "CODE_128",
        "CODE_39",
        "ITF"
      ],
    };

    const onScanSuccess = (decodedText, decodedResult) => {
        onScanRef.current(decodedText);
    };

    const onScanFailure = (errorMsg) => {
      // Abaikan error
    };
    
    // Ganti Html5QrcodeScanner menjadi Html5Qrcode
    const html5QrcodeScanner = new Html5Qrcode(scannerId, false);
    
    const startScanner = async () => {
      try {
        await html5QrcodeScanner.start(
          { facingMode: "environment" }, // Kamera belakang
          config,
          onScanSuccess,
          onScanFailure
        );
        scannerRef.current = html5QrcodeScanner;
      } catch (err) {
        console.error("Gagal memulai scanner:", err);
        setError("Kamera tidak ditemukan atau gagal dimulai.");
      }
    };

    startScanner();

    // Cleanup function
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(error => {
          console.error("Gagal menghentikan scanner.", error);
        });
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-md">
        <h3 className="text-center text-lg font-semibold mb-2">
          Scan Barcode
        </h3>
        {/* Tambahkan style untuk memastikan elemen tidak tersembunyi */}
        <div id="qr-reader" className="mb-2 border" style={{ width: '100%', minHeight: '300px' }}></div>
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <button
          onClick={onClose}
          className="w-full bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mt-2"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}

export default CameraBarcodeScanner;