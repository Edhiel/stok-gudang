import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, update, push, serverTimestamp } from 'firebase/database';
import { db } from '../firebaseConfig';
import CameraBarcodeScanner from './CameraBarcodeScanner'; // Impor scanner
import toast from 'react-hot-toast';

// Fungsi bantuan (tidak berubah)
const formatToDPP = (totalPcs, conversions) => {
  if (totalPcs === undefined || totalPcs === null || !conversions) return '0.0.0';
  const dosInPcs = conversions.Dos?.inPcs || (conversions.Pack?.inPcs || 1);
  const packInPcs = conversions.Pack?.inPcs || 1;
  if (dosInPcs === 0 || packInPcs === 0) return 'N/A';
  const dos = Math.floor(totalPcs / dosInPcs);
  const pack = Math.floor((totalPcs % dosInPcs) / packInPcs);
  const pcs = totalPcs % packInPcs;
  return `${dos}.${pack}.${pcs}`;
};

function StockOpname({ userProfile }) {
  const [loading, setLoading] = useState(true);
  const [mergedStockData, setMergedStockData] = useState([]);
  const [physicalCounts, setPhysicalCounts] = useState({});
  const [viewMode, setViewMode] = useState('input');
  const [reportData, setReportData] = useState([]);

  // --- 1. STATE & REF BARU UNTUK SCAN ---
  const [showScanner, setShowScanner] = useState(false);
  // Ref untuk menyimpan referensi ke setiap baris input di tabel
  const itemInputRefs = useRef({});

  useEffect(() => {
    if (!userProfile || !userProfile.depotId) {
      setLoading(false);
      return;
    }
    
    const masterItemsRef = ref(db, 'master_items');
    const stockRef = ref(db, `depots/${userProfile.depotId}/stock`);

    onValue(masterItemsRef, (masterSnapshot) => {
      const masterItems = masterSnapshot.val() || {};
      onValue(stockRef, (stockSnapshot) => {
        const stockItems = stockSnapshot.val() || {};
        const combinedData = Object.keys(masterItems).map(itemId => {
          const stockInfo = stockItems[itemId] || { totalStock: 0 };
          return { id: itemId, ...masterItems[itemId], ...stockInfo };
        });
        setMergedStockData(combinedData);
        setLoading(false);
      });
    });
  }, [userProfile]);

  const handleCountChange = (itemId, unit, value) => {
    const item = mergedStockData.find(i => i.id === itemId);
    if (!item) return;
    const currentCounts = physicalCounts[itemId] || { dos: 0, pack: 0, pcs: 0 };
    const newCounts = { ...currentCounts, [unit]: Number(value) || 0 };
    setPhysicalCounts(prevCounts => ({ ...prevCounts, [itemId]: newCounts }));
  };

  const calculateTotalPcs = (itemId, counts) => {
    const item = mergedStockData.find(i => i.id === itemId);
    if (!item || !counts) return 0;
    const dosInPcs = item.conversions?.Dos?.inPcs || 0;
    const packInPcs = item.conversions?.Pack?.inPcs || 0;
    return (counts.dos * dosInPcs) + (counts.pack * packInPcs) + counts.pcs;
  };

  const generateReport = () => {
    const newReportData = mergedStockData.map(item => {
      const systemStockPcs = item.totalStock || 0;
      const physicalStockPcs = calculateTotalPcs(item.id, physicalCounts[item.id]);
      const variance = physicalStockPcs - systemStockPcs;
      return { ...item, systemStockPcs, physicalStockPcs, variance };
    }).filter(item => item.variance !== 0);
    setReportData(newReportData);
    setViewMode('report');
  };

  const handleSaveChanges = async () => {
    if (reportData.length === 0) {
      toast.error("Tidak ada selisih stok untuk disimpan.");
      return;
    }
    if (!window.confirm(`Anda akan menyesuaikan stok untuk ${reportData.length} item. Lanjutkan?`)) {
      return;
    }
    const updates = {};
    const depotId = userProfile.depotId;
    reportData.forEach(item => {
      const newTransactionKey = push(child(ref(db), `depots/${depotId}/transactions`)).key;
      updates[`/depots/${depotId}/stock/${item.id}/totalStock`] = item.physicalStockPcs;
      const transactionDetails = {
        timestamp: serverTimestamp(), type: 'Penyesuaian Opname', user: userProfile.fullName,
        details: `Stok diubah dari ${item.systemStockPcs} menjadi ${item.physicalStockPcs} (Selisih: ${item.variance})`,
        items: [{ id: item.id, name: item.name, qtyInPcs: item.variance, displayQty: `${item.variance} Pcs` }]
      };
      updates[`/depots/${depotId}/transactions/${newTransactionKey}`] = transactionDetails;
    });
    try {
      await update(ref(db), updates);
      toast.success("Penyesuaian stok berhasil disimpan!");
      setPhysicalCounts({}); setReportData([]); setViewMode('input');
    } catch (error) {
      console.error("Gagal menyimpan penyesuaian:", error);
      toast.error("Terjadi kesalahan saat menyimpan data.");
    }
  };
  
  // --- 2. FUNGSI BARU UNTUK MENANGANI HASIL SCAN ---
  const handleBarcodeDetected = (scannedBarcode) => {
    const foundItem = mergedStockData.find(item => item.barcodePcs === scannedBarcode || item.barcodeDos === scannedBarcode);
    if (foundItem) {
      toast.success(`Barang ditemukan: ${foundItem.name}`);
      // Scroll ke elemen input dan fokus
      const inputElement = itemInputRefs.current[foundItem.id];
      if (inputElement) {
        inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inputElement.focus();
      }
    } else {
      toast.error("Barang dengan barcode ini tidak ditemukan.");
    }
  };
  return (
    <>
      {/* Panggil komponen scanner */}
      {showScanner && <CameraBarcodeScanner onScan={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}

      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Stock Opname / Audit Stok</h1>
          <div className="flex gap-2">
            {/* --- 3. TOMBOL SCAN BARU --- */}
            <button onClick={() => setShowScanner(true)} className="btn btn-primary">Scan Barang</button>
            {viewMode === 'input' ? (
              <button className="btn btn-info" onClick={generateReport}>Lihat Hasil & Selisih</button>
            ) : (
              <button className="btn btn-secondary" onClick={() => setViewMode('input')}>Kembali ke Input</button>
            )}
            <button className="btn btn-success" onClick={handleSaveChanges} disabled={viewMode === 'input' || reportData.length === 0}>
              Simpan Penyesuaian
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
          {viewMode === 'input' ? (
            <table className="table w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th>Nama Barang</th>
                  <th>Stok Sistem (D.P.P)</th>
                  <th className="w-64">Input Stok Fisik (Dos / Pack / Pcs)</th>
                  <th>Total Fisik (Pcs)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="text-center"><span className="loading loading-dots"></span></td></tr>
                ) : (
                  mergedStockData.map(item => (
                    <tr key={item.id}>
                      <td className="font-bold align-middle">{item.name}</td>
                      <td className="align-middle">{formatToDPP(item.totalStock, item.conversions)}</td>
                      <td>
                        <div className="flex gap-2">
                          {/* --- 4. PASANG REF PADA INPUT DOS --- */}
                          <input 
                            ref={el => itemInputRefs.current[item.id] = el}
                            type="number" placeholder="Dos" className="input input-bordered input-sm w-1/3" 
                            onChange={(e) => handleCountChange(item.id, 'dos', e.target.value)} 
                            defaultValue={physicalCounts[item.id]?.dos || ''} 
                          />
                          <input type="number" placeholder="Pack" className="input input-bordered input-sm w-1/3" onChange={(e) => handleCountChange(item.id, 'pack', e.target.value)} defaultValue={physicalCounts[item.id]?.pack || ''} />
                          <input type="number" placeholder="Pcs" className="input input-bordered input-sm w-1/3" onChange={(e) => handleCountChange(item.id, 'pcs', e.target.value)} defaultValue={physicalCounts[item.id]?.pcs || ''} />
                        </div>
                      </td>
                      <td className="font-semibold align-middle text-center">
                        {calculateTotalPcs(item.id, physicalCounts[item.id])}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            // Tampilan Laporan (tidak berubah)
            <table className="table w-full">
              <thead className="bg-gray-200">
                <tr><th>Nama Barang</th><th>Stok Sistem (D.P.P)</th><th>Stok Fisik (D.P.P)</th><th>Selisih (Pcs)</th></tr>
              </thead>
              <tbody>
                {reportData.length === 0 ? (
                  <tr><td colSpan="4" className="text-center font-semibold p-4">Tidak ada selisih ditemukan. Stok sudah akurat!</td></tr>
                ) : (
                  reportData.map(item => (
                    <tr key={item.id}>
                      <td className="font-bold">{item.name}</td>
                      <td>{formatToDPP(item.systemStockPcs, item.conversions)}</td>
                      <td>{formatToDPP(item.physicalStockPcs, item.conversions)}</td>
                      <td className={`font-bold ${item.variance > 0 ? 'text-success' : 'text-error'}`}>
                        {item.variance > 0 ? `+${item.variance}` : item.variance}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

export default StockOpname;