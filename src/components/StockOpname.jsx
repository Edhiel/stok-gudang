import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, get, runTransaction, push, serverTimestamp } from 'firebase/database';
import { db } from '../firebaseConfig';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import CameraBarcodeScanner from './CameraBarcodeScanner';

// Komponen untuk Halaman Pilihan Awal
const PilihanOpname = ({ setView }) => (
    <div className="flex items-center justify-center" style={{minHeight: '60vh'}}>
        <div className="text-center">
            <h2 className="text-2xl font-bold mb-6">Pilih Metode Stok Opname</h2>
            <div className="flex flex-col md:flex-row gap-4">
                <button onClick={() => setView('manual')} className="btn btn-primary btn-lg">
                    Opname Manual Per Item
                </button>
                <button onClick={() => setView('impor')} className="btn btn-secondary btn-lg">
                    Impor Massal dari CSV
                </button>
            </div>
        </div>
    </div>
);

// Komponen untuk Impor CSV
const ImporOpname = ({ setView, userProfile, masterItems, stockData }) => {
    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState([]);
    const [fileName, setFileName] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setFileName(file.name);
        setLoading(true);

        Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            const opnameData = results.data;
            const preview = opnameData.map(row => {
            const kodeInternal = row.KODE?.toUpperCase();
            const masterItem = masterItems[kodeInternal];

            if (!masterItem) {
                return {
                kodeInternal: kodeInternal || 'KODE KOSONG',
                namaBarang: row['NAMA BARANG'] || 'N/A',
                stokSistem: 0, stokFisik: 0, selisih: 0,
                status: 'Tidak Ditemukan di Master'
                };
            }
            const dosInPcs = masterItem.conversions?.Dos?.inPcs || 1;
            const packInPcs = masterItem.conversions?.Pack?.inPcs || 1;
            const stokFisik = (Number(row['AKHIR DUS']) || 0) * dosInPcs + (Number(row['AKHIR BKS']) || 0) * packInPcs + (Number(row['AKHIR PCS']) || 0);
            const stokSistem = stockData[masterItem.id]?.totalStockInPcs || 0;
            const selisih = stokFisik - stokSistem;

            return {
                itemId: masterItem.id, kodeInternal, namaBarang: masterItem.name,
                stokSistem, stokFisik, selisih,
                status: selisih === 0 ? 'Sesuai' : 'Akan Disesuaikan'
            };
            });
            setPreviewData(preview);
            setView('previewImpor');
            setLoading(false);
        }
        });
        event.target.value = null;
    };

    const handleConfirmAdjustment = async () => {
        const itemsToAdjust = previewData.filter(item => item.status === 'Akan Disesuaikan');
        if (itemsToAdjust.length === 0) {
        return toast.error("Tidak ada data stok yang perlu disesuaikan.");
        }
        if (!window.confirm(`Anda akan menyesuaikan stok untuk ${itemsToAdjust.length} barang. Lanjutkan?`)) return;

        setIsProcessing(true);
        toast.loading('Memproses penyesuaian stok...', { id: 'opname-toast' });
        
        const transactionItems = [];
        let successCount = 0;

        try {
        for (const item of itemsToAdjust) {
            const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${item.itemId}`);
            await runTransaction(stockRef, (currentStock) => {
            if (!currentStock) {
                return { totalStockInPcs: item.stokFisik, locations: {} };
            }
            currentStock.totalStockInPcs = item.stokFisik;
            return currentStock;
            });
            transactionItems.push({
                id: item.itemId, name: item.namaBarang, selisih: item.selisih,
                stokAwal: item.stokSistem, stokAkhir: item.stokFisik
            });
            successCount++;
        }
        
        const transactionsRef = ref(db, `depots/${userProfile.depotId}/transactions`);
        await push(transactionsRef, {
            type: 'Stok Opname (Impor CSV)', fileName: fileName, items: transactionItems,
            user: userProfile.fullName, timestamp: serverTimestamp()
        });

        toast.dismiss('opname-toast');
        toast.success(`${successCount} item berhasil disesuaikan!`);
        setView('pilihan');
        setPreviewData([]);

        } catch (error) {
        toast.dismiss('opname-toast');
        toast.error(`Gagal memproses penyesuaian: ${error.message}`);
        } finally {
        setIsProcessing(false);
        }
    };
    
    const getStatusColor = (status) => {
        if (status === 'Sesuai') return 'bg-green-100 text-green-800';
        if (status === 'Akan Disesuaikan') return 'bg-yellow-100 text-yellow-800';
        if (status === 'Tidak Ditemukan di Master') return 'bg-red-100 text-red-800';
        return '';
    };

    if (view === 'previewImpor') {
        const summary = {
            sesuai: previewData.filter(p => p.status === 'Sesuai').length,
            disesuaikan: previewData.filter(p => p.status === 'Akan Disesuaikan').length,
            tidakDitemukan: previewData.filter(p => p.status === 'Tidak Ditemukan di Master').length,
            total: previewData.length
        };
        return (
            <div className="p-4 md:p-8">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-3xl font-bold">Preview Stok Opname</h1>
                    <button onClick={() => setView('pilihan')} className="btn btn-ghost">Kembali</button>
                </div>
                <p className="mb-6">File: <strong>{fileName}</strong></p>
                <div className="stats shadow mb-6 w-full">
                    <div className="stat"><div className="stat-title">Total Baris</div><div className="stat-value">{summary.total}</div></div>
                    <div className="stat"><div className="stat-title">Sesuai</div><div className="stat-value text-success">{summary.sesuai}</div></div>
                    <div className="stat"><div className="stat-title">Akan Disesuaikan</div><div className="stat-value text-warning">{summary.disesuaikan}</div></div>
                    <div className="stat"><div className="stat-title">Tidak Ditemukan</div><div className="stat-value text-error">{summary.tidakDitemukan}</div></div>
                </div>
                <div className="overflow-x-auto bg-white rounded-lg shadow max-h-[50vh]">
                    <table className="table table-compact w-full">
                        <thead className="sticky top-0 bg-gray-200"><tr><th>Kode Internal</th><th>Nama Barang</th><th>Stok Sistem (Pcs)</th><th>Stok Fisik (Pcs)</th><th>Selisih</th><th>Status</th></tr></thead>
                        <tbody>{previewData.map((item, index) => (<tr key={index}>
                            <td className="font-mono">{item.kodeInternal}</td><td>{item.namaBarang}</td>
                            <td>{item.stokSistem}</td><td className="font-bold">{item.stokFisik}</td>
                            <td className={`font-bold ${item.selisih > 0 ? 'text-success' : item.selisih < 0 ? 'text-error' : ''}`}>{item.selisih}</td>
                            <td><span className={`badge badge-sm ${getStatusColor(item.status)}`}>{item.status}</span></td>
                        </tr>))}</tbody>
                    </table>
                </div>
                <div className="mt-6 flex justify-end gap-4">
                    <button onClick={() => setView('impor')} disabled={isProcessing} className="btn btn-ghost">Batal / Unggah Ulang</button>
                    <button onClick={handleConfirmAdjustment} disabled={isProcessing || summary.disesuaikan === 0} className="btn btn-primary">{isProcessing ? <span className="loading loading-spinner"></span> : `Konfirmasi & Sesuaikan ${summary.disesuaikan} Barang`}</button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Impor Stok Opname dari CSV</h2>
                <button onClick={() => setView('pilihan')} className="btn btn-ghost">Kembali</button>
            </div>
            <div className="card w-full max-w-lg mx-auto bg-white shadow-xl text-center">
                <div className="card-body">
                    <p className="my-4">Unggah file .csv hasil ekspor dari ND6 untuk melakukan penyesuaian stok secara massal.</p>
                    <div className="card-actions justify-center">
                        <button onClick={() => fileInputRef.current.click()} className="btn btn-primary btn-lg">Pilih File CSV</button>
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".csv" />
                    </div>
                </div>
            </div>
        </div>
    );
};
// Komponen untuk Opname Manual
const ManualOpname = ({ setView, userProfile, masterItemsList, stockData }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [locationCounts, setLocationCounts] = useState({});
    const [showScanner, setShowScanner] = useState(false);

    const handleBarcodeDetected = (scannedCode) => {
        const foundItem = masterItemsList.find(item => item.barcodePcs === scannedCode || item.barcodeDos === scannedCode);
        if (foundItem) {
            handleSelectItem(foundItem);
        } else {
            toast.error("Barang tidak ditemukan.");
        }
        setShowScanner(false);
    };

    const handleSelectItem = (item) => {
        setSearchTerm(item.name);
        const currentStock = stockData[item.id] || { locations: {} };
        setSelectedItem({ ...item, ...currentStock });
        // Inisialisasi form dengan data stok saat ini
        setLocationCounts(currentStock.locations || {});
    };

    const handleCountChange = (locationId, value) => {
        setLocationCounts(prev => ({
            ...prev,
            [locationId]: Number(value)
        }));
    };

    const handleSaveOpname = async () => {
        const oldTotal = selectedItem.totalStockInPcs || 0;
        const newTotal = Object.values(locationCounts).reduce((sum, qty) => sum + qty, 0);
        const selisih = newTotal - oldTotal;

        if (selisih === 0) {
            return toast.success("Tidak ada perubahan stok.");
        }

        if (!window.confirm(`Stok akan diubah dari ${oldTotal} menjadi ${newTotal} (Selisih: ${selisih}). Lanjutkan?`)) return;

        try {
            const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${selectedItem.id}`);
            await runTransaction(stockRef, (currentStock) => {
                if (!currentStock) {
                    return { totalStockInPcs: newTotal, locations: locationCounts };
                }
                currentStock.totalStockInPcs = newTotal;
                currentStock.locations = locationCounts;
                return currentStock;
            });

            const transactionsRef = ref(db, `depots/${userProfile.depotId}/transactions`);
            await push(transactionsRef, {
                type: 'Stok Opname (Manual)',
                items: [{
                    id: selectedItem.id, name: selectedItem.name,
                    selisih: selisih, stokAwal: oldTotal, stokAkhir: newTotal
                }],
                user: userProfile.fullName,
                timestamp: serverTimestamp()
            });

            toast.success("Penyesuaian stok berhasil disimpan!");
            setSelectedItem(null);
            setSearchTerm('');
            setLocationCounts({});

        } catch (error) {
            toast.error(`Gagal menyimpan: ${error.message}`);
        }
    };

    return (
        <div className="p-4 md:p-8">
            {showScanner && <CameraBarcodeScanner onScan={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Stok Opname Manual</h2>
                <button onClick={() => setView('pilihan')} className="btn btn-ghost">Kembali</button>
            </div>
            <div className="card bg-white shadow-lg p-4 space-y-4">
                <div className="form-control">
                    <label className="label-text">Cari Barang</label>
                    <div className="join w-full">
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Ketik nama atau scan barcode..." className="input input-bordered join-item w-full" />
                        <button onClick={() => setShowScanner(true)} className="btn btn-primary join-item">Scan</button>
                    </div>
                     {searchTerm && !selectedItem &&
                        <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                            {masterItemsList.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 5).map(item => (
                                <li key={item.id}><a onClick={() => handleSelectItem(item)}>{item.name}</a></li>
                            ))}
                        </ul>
                    }
                </div>

                {selectedItem && (
                    <div className="mt-4">
                        <h3 className="font-bold text-lg">{selectedItem.name}</h3>
                        <p className="text-sm">Stok Sistem Total: <strong>{selectedItem.totalStockInPcs || 0} Pcs</strong></p>
                        <div className="divider">Input Hitungan Fisik per Lokasi</div>
                        <div className="space-y-2">
                            {Object.keys(selectedItem.locations).map(locId => (
                                <div key={locId} className="form-control">
                                    <label className="label">
                                        <span className="label-text">{locId}</span>
                                        <span className="label-text-alt">Stok Sistem: {selectedItem.locations[locId]}</span>
                                    </label>
                                    <input 
                                        type="number" 
                                        value={locationCounts[locId] || ''}
                                        onChange={(e) => handleCountChange(locId, e.target.value)}
                                        className="input input-bordered" 
                                    />
                                </div>
                            ))}
                            {Object.keys(selectedItem.locations).length === 0 && <p className="text-sm text-center p-4 bg-base-200 rounded-lg">Barang ini belum memiliki catatan stok di lokasi manapun.</p>}
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button onClick={handleSaveOpname} className="btn btn-primary">Simpan Penyesuaian</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Komponen Utama
function StockOpname({ userProfile }) {
  const [masterItems, setMasterItems] = useState({});
  const [masterItemsList, setMasterItemsList] = useState([]);
  const [stockData, setStockData] = useState({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('pilihan');

  useEffect(() => {
    if (!userProfile.depotId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const masterItemsRef = ref(db, 'master_items');
    get(masterItemsRef).then((snapshot) => {
      const items = snapshot.val() || {};
      const itemsByInternalCode = {};
      const itemListForSearch = [];
      Object.keys(items).forEach(key => {
        const item = { id: key, ...items[key] };
        itemListForSearch.push(item);
        if (item.kodeInternal) {
          itemsByInternalCode[item.kodeInternal.toUpperCase()] = item;
        }
      });
      setMasterItems(itemsByInternalCode);
      setMasterItemsList(itemListForSearch);

      const stockRef = ref(db, `depots/${userProfile.depotId}/stock`);
      onValue(stockRef, (stockSnapshot) => {
        setStockData(stockSnapshot.val() || {});
        setLoading(false);
      });
    });
  }, [userProfile.depotId]);

  if (loading) {
    return <div className="p-8 text-center"><span className="loading loading-spinner loading-lg"></span></div>;
  }

  const renderView = () => {
    switch(view) {
        case 'manual':
            return <ManualOpname setView={setView} userProfile={userProfile} masterItemsList={masterItemsList} stockData={stockData} />;
        case 'impor':
            return <ImporOpname setView={setView} userProfile={userProfile} masterItems={masterItems} stockData={stockData} />;
        case 'previewImpor':
            return <ImporOpname setView={setView} userProfile={userProfile} masterItems={masterItems} stockData={stockData} />;
        case 'pilihan':
        default:
            return <PilihanOpname setView={setView} />;
    }
  };

  return (
    <div className="p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-6">Stok Opname</h1>
        {renderView()}
    </div>
  );
}

export default StockOpname;
