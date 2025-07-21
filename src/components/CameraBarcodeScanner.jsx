import React, 'useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

// Komponen baru untuk Viewfinder (Jendela Bidik)
const Viewfinder = () => (
  <div style={{
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '280px',
    height: '180px',
  }}>
    <div style={{
      position: 'absolute',
      width: '100%',
      height: '100%',
      boxShadow: '0 0 0 4000px rgba(0,0,0,0.5)', // Area gelap di luar
      border: '2px solid white',
      borderRadius: '10px',
    }}/>
    <div style={{
      position: 'absolute',
      top: '50%',
      left: 0,
      right: 0,
      height: '2px',
      background: 'red',
      boxShadow: '0 0 5px red',
      animation: 'scan-laser 2s linear infinite'
    }}/>
  </div>
);

function CameraBarcodeScanner({ onScan, onClose }) {
  const [error, setError] = useState('');

  useEffect(() => {
    const scannerId = 'qr-reader-container';
    const html5QrCode = new Html5Qrcode(scannerId, {
      // Tambahkan experimental features untuk performa lebih baik
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true,
      },
    });

    const config = { 
      fps: 10, 
      qrbox: { width: 280, height: 180 }, // Sesuaikan dengan ukuran viewfinder
    };

    const onScanSuccess = (decodedText) => {
        onScan(decodedText);
        onClose();
    };

    const onScanFailure = (errorMsg) => {};
    
    html5QrCode.start(
      { facingMode: "environment" },
      config,
      onScanSuccess,
      onScanFailure
    ).catch(err => {
        setError("Kamera gagal dimulai.");
    });

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => {});
      }
    };
  }, [onScan, onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      {/* CSS untuk animasi garis laser */}
      <style>
        {`@keyframes scan-laser { 0% { transform: translateY(-90px); } 50% { transform: translateY(90px); } 100% { transform: translateY(-90px); } }`}
      </style>
      <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md">
        <h3 className="text-center text-lg font-semibold mb-2">
          Arahkan Barcode ke Dalam Kotak
        </h3>
        
        {/* Kontainer untuk scanner sekarang punya posisi relative */}
        <div id="qr-reader-container" className="relative mb-2 border rounded-lg overflow-hidden" style={{ width: '100%', paddingTop: '75%' /* Rasio 4:3 */ }}>
          {/* Tambahkan Viewfinder di sini */}
          <Viewfinder />
        </div>
        
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