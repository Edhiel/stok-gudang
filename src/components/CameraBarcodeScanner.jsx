import React, { useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';

function CameraBarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const codeReader = useRef(new BrowserMultiFormatReader());

  useEffect(() => {
    const startScanner = async () => {
      try {
        const devices = await codeReader.current.listVideoInputDevices();
        const deviceId = devices[0]?.deviceId;
        if (!deviceId) {
          alert('Kamera tidak ditemukan!');
          onClose();
          return;
        }
        codeReader.current.decodeFromVideoDevice(deviceId, videoRef.current, (result, err) => {
          if (result) {
            onDetected(result.getText());
            codeReader.current.reset();
          }
          if (err && !(err instanceof window.NotFoundException)) {
            console.error('Scanner error:', err);
          }
        });
      } catch (e) {
        console.error('Error starting scanner:', e);
        alert('Gagal memulai pemindai barcode!');
        onClose();
      }
    };
    startScanner();
    return () => {
      codeReader.current.reset();
    };
  }, [onDetected, onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg max-w-md w-full">
        <h3 className="text-lg font-bold mb-4">Pindai Barcode</h3>
        <div className="scanner-container">
          <video ref={videoRef} className="w-full h-auto"></video>
          <div className="scanner-overlay">
            <div className="scanner-frame">
              <div className="scanner-line"></div>
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            codeReader.current.reset();
            onClose();
          }}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 w-full"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}

export default CameraBarcodeScanner;