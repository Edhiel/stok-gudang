import React, { useState } from 'react';
import { useZxing } from 'react-zxing';

function CameraBarcodeScanner({ onScan, onClose }) {
  const [error, setError] = useState('');

  const { ref } = useZxing({
    // Fungsi yang akan dipanggil saat scan berhasil
    onResult(result) {
      onScan(result.getText());
      // Anda bisa tambahkan onClose() di sini jika ingin scanner langsung tertutup setelah berhasil
      // onClose(); 
    },
    // Fungsi yang akan dipanggil jika ada error saat memulai kamera
    onError(err) {
      console.error("Scanner Error:", err);
      setError("Gagal memulai scanner. Pastikan izin kamera sudah diberikan.");
    },
    // Opsi untuk scanner
    constraints: {
        video: {
            facingMode: 'environment' // Prioritaskan kamera belakang
        }
    },
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md">
        <h3 className="text-center text-xl font-semibold mb-2">Pindai Barcode</h3>
        
        <div className="relative h-64 bg-black rounded overflow-hidden mb-2">
          {/* Komponen video sekarang dikontrol oleh hook 'useZxing' */}
          <video ref={ref} className="w-full h-full object-cover" />
          
          {/* Garis animasi (opsional, bisa ditambahkan kembali jika suka) */}
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500 shadow-[0_0_10px_red]" />
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

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