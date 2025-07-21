import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

function CameraBarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const [error, setError] = useState('');
  const [debugMessage, setDebugMessage] = useState('Menginisialisasi scanner...');

  useEffect(() => {
    codeReaderRef.current = new BrowserMultiFormatReader();
    console.log('Component Mounted, Code Reader siap.');
    setDebugMessage('Code Reader siap.');

    const startCamera = async () => {
      try {
        setDebugMessage('Meminta izin kamera...');
        console.log('Meminta izin kamera...');
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setDebugMessage('Stream kamera didapatkan, menunggu video siap...');
          console.log('Stream kamera didapatkan, menunggu video siap...');

          videoRef.current.oncanplay = () => {
            console.log('Video siap diputar (oncanplay event). Memulai pemindaian...');
            setDebugMessage('Video siap, memulai pemindaian...');
            
            videoRef.current.play();

            codeReaderRef.current.decodeFromVideoElement(
              videoRef.current,
              (result, err) => {
                if (result) {
                  console.log("--- SCAN BERHASIL ---", result.getText());
                  setDebugMessage(`Berhasil: ${result.getText()}`);
                  onScan(result.getText());
                }
                if (err && !(err instanceof NotFoundException)) {
                  console.error("!!! SCANNER ERROR !!!", err);
                  setDebugMessage(`Error: ${err.message}`);
                }
              }
            );
          };
        }
      } catch (e) {
        console.error("!!! GAGAL INIT !!!", e);
        setError('Gagal memulai kamera: ' + e.message);
        setDebugMessage(`Gagal total: ${e.name}`);
      }
    };

    startCamera();

    // Cleanup function
    return () => {
      console.log('Component Unmounted, membersihkan...');
      codeReaderRef.current?.reset();
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md">
        <h3 className="text-center text-xl font-semibold mb-2">Pindai Barcode (Mode Debug)</h3>
        <div className="relative h-64 bg-black rounded overflow-hidden mb-2 flex justify-center items-center">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <div className="absolute w-full h-0.5 bg-red-500 shadow-[0_0_10px_red]" />
        </div>
        
        <div className="bg-gray-800 text-white text-xs font-mono p-2 rounded mb-2">
            <p>Status: {debugMessage}</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded" role="alert">
            <span className="block sm-inline">{error}</span>
          </div>
        )}
        <button onClick={onClose} className="w-full bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">Tutup</button>
      </div>
    </div>
  );
}

export default CameraBarcodeScanner;