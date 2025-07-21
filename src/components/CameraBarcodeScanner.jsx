import React, { useState } from 'react';
import { useZxing } from 'react-zxing';

function CameraBarcodeScanner({ onScan, onClose }) {
  const { ref } = useZxing({
    // Fungsi yang akan dipanggil saat scan berhasil
    onResult(result) {
      onScan(result.getText());
      onClose(); 
    },
    // Fungsi yang akan dipanggil jika ada error
    onError(err) {
      // Kita tidak menampilkan error 'NotFound' ke UI agar tidak mengganggu
      // dan hanya menampilkannya di console untuk debugging.
      if (err && !(err.name === 'NotFoundException')) {
        console.error("Scanner Error:", err);
      }
    },
    // Konfigurasi kamera yang sudah kita perbaiki
    constraints: {
        video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    },
    // Opsi bagus yang Anda temukan
    timeBetweenDecodingAttempts: 300,
    tryHarder: true,
    checkInverted: true,
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md">
        <h3 className="text-center text-xl font-semibold mb-2">Pindai Barcode</h3>
        
        <div className="relative h-64 bg-black rounded overflow-hidden mb-2">
          <video ref={ref} className="w-full h-full object-cover" />
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500 shadow-[0_0_10px_red]" />
        </div>

        <div className="text-center text-sm text-gray-500 mb-2">Arahkan kamera ke barcode.</div>
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

export default CameraBarcodeScanner;