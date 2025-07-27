import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, get, runTransaction, push, serverTimestamp } from 'firebase/database';
import { db } from '../firebaseConfig';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

// Komponen untuk Halaman Pilihan Awal
const PilihanOpname = ({ setView }) => (
    <div className="flex items-center justify-center" style={{minHeight: '60vh'}}>
        <div className="text-center">
            <h2 className="text-2xl font-bold mb-6">Pilih Metode Stok Opname</h2>
            <div className="flex flex-col md:flex-row gap-4">
                <button onClick={() => setView('manual')} className="btn btn-primary btn-lg">
                    Opname Manual
                </button>
                <button onClick={() => setView('impor')} className="btn btn-secondary btn-lg">
                    Impor dari CSV
                </button>
            </div>
        </div>
    </div>
);

// Komponen untuk Impor CSV (yang sudah kita buat)
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
            // Logika ini mengasumsikan opname massal akan menimpa total, dan butuh opname manual per lokasi untuk detail
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
const ManualOpname = ({ setView, userProfile, masterItems, stockData }) => {
    // Logika dan JSX untuk Opname Manual akan kita tambahkan di sini
    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Stok Opname Manual</h2>
                <button onClick={() => setView('pilihan')} className="btn btn-ghost">Kembali</button>
            </div>
            {/* Konten untuk opname manual akan ditambahkan di sini */}
            <p>Fitur untuk stok opname manual per lokasi akan segera dibangun di sini.</p>
        </div>
    );
};
function StockOpname({ userProfile }) {
  const [masterItems, setMasterItems] = useState({});
  const [stockData, setStockData] = useState({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('pilihan'); // pilihan, manual, impor, previewImpor

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
      Object.keys(items).forEach(key => {
        const item = items[key];
        if (item.kodeInternal) {
          itemsByInternalCode[item.kodeInternal.toUpperCase()] = { id: key, ...item };
        }
      });
      setMasterItems(itemsByInternalCode);

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
            return <ManualOpname setView={setView} userProfile={userProfile} masterItems={masterItems} stockData={stockData} />;
        case 'impor':
            return <ImporOpname setView={setView} userProfile={userProfile} masterItems={masterItems} stockData={stockData} />;
        case 'previewImpor':
            // ImporOpname juga menangani tampilan preview-nya sendiri
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
