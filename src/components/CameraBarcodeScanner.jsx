import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

// Nama fungsi diubah agar sesuai dengan nama file
function CameraBarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const onScanRef = useRef(onScan); // Menggunakan ref untuk onScan
  onScanRef.current = onScan;

  useEffect(() => {
    // ID elemen tempat scanner akan dirender
    const scannerId = 'qr-reader';
    
    // Konfigurasi untuk scanner
    const config = { 
      fps: 10, 
      qrbox: { width: 250, height: 250 },
      supportedScanTypes: [ /* Biarkan default untuk mendukung semua */ ]
    };

    // Fungsi callback saat scan berhasil
    const onScanSuccess = (decodedText, decodedResult) => {
        onScanRef.current(decodedText);
        // Kita tidak akan otomatis menutup scanner, biarkan user yang menutup
        // atau bisa ditambahkan logika untuk menutup setelah scan pertama jika diinginkan
    };

    // Inisialisasi scanner
    scannerRef.current = new Html5QrcodeScanner(
      scannerId,
      config,
      /* verbose= */ false
    );

    // Mulai rendering scanner
    scannerRef.current.render(onScanSuccess, (errorMsg) => {
      // Abaikan error "QR code not found" yang sering muncul
    });

    // Cleanup function saat komponen ditutup
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Gagal membersihkan html5-qrcode.", error);
        });
      }
    };
  }, []); // Dependency array kosong agar hanya berjalan sekali

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded p-4 w-full max-w-md">
        <h3 className="text-center text-lg font-semibold mb-2">
          Scan Barcode / QR
        </h3>
        <div id="qr-reader" className="mb-2"></div>
        <button
          onClick={onClose}
          className="w-full bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}

// Nama export diubah agar sesuai
export default CameraBarcodeScanner;