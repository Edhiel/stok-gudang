import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

function CameraBarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  
  const [error, setError] = useState('');

  useEffect(() => {
    const scannerId = 'qr-reader';
    
    // --- PERUBAHAN UTAMA: KONFIGURASI KAMERA LEBIH DETAIL ---
    const config = { 
      fps: 10, 
      qrbox: { width: 250, height: 250 },
      // Minta kamera belakang secara spesifik
      camera: { facingMode: "environment" },
      // Minta stream video dengan kualitas lebih tinggi & coba aktifkan autofocus
      videoConstraints: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        advanced: [
          { focusMode: "continuous" }
        ]
      },
      // Hanya scan tipe barcode 1D (produk)
      formatsToSupport: [
          Html5QrcodeScanType.SCAN_TYPE_BARCODE,
      ],
    };

    const onScanSuccess = (decodedText, decodedResult) => {
        onScanRef.current(decodedText);
    };

    const onScanFailure = (errorMsg) => {
      // Fungsi ini sengaja dikosongkan untuk menghindari spam console
      // console.warn(`Scan Gagal: ${errorMsg}`);
    };

    scannerRef.current = new Html5QrcodeScanner(scannerId, config, false);
    scannerRef.current.render(onScanSuccess, onScanFailure);

    // Cleanup function
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Gagal membersihkan scanner.", error);
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
        <div id="qr-reader" className="mb-2 border"></div>
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