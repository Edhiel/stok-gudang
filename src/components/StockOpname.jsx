import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, get, runTransaction, push, serverTimestamp } from 'firebase/database';
import { db } from '../firebaseConfig';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

function StockOpname({ userProfile }) {
  const [masterItems, setMasterItems] = useState({});
  const [stockData, setStockData] = useState({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('upload'); // 'upload' atau 'preview'
  const [previewData, setPreviewData] = useState([]);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!userProfile.depotId) {
      setLoading(false);
      return;
    }
    // 1. Ambil semua master barang untuk referensi
    const masterItemsRef = ref(db, 'master_items');
    get(masterItemsRef).then((snapshot) => {
      const items = snapshot.val() || {};
      // Ubah menjadi map untuk pencarian cepat berdasarkan kodeInternal
      const itemsByInternalCode = {};
      Object.keys(items).forEach(key => {
        const item = items[key];
        if (item.kodeInternal) {
          itemsByInternalCode[item.kodeInternal.toUpperCase()] = { id: key, ...item };
        }
      });
      setMasterItems(itemsByInternalCode);
    });

    // 2. Ambil semua data stok saat ini
    const stockRef = ref(db, `depots/${userProfile.depotId}/stock`);
    onValue(stockRef, (snapshot) => {
      setStockData(snapshot.val() || {});
      setLoading(false);
    });
  }, [userProfile.depotId]);

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
              stokSistem: 0,
              stokFisik: 0,
              selisih: 0,
              status: 'Tidak Ditemukan di Master'
            };
          }

          const dosInPcs = masterItem.conversions?.Dos?.inPcs || 1;
          const packInPcs = masterItem.conversions?.Pack?.inPcs || 1;
          
          const stokFisik = (Number(row['AKHIR DUS']) || 0) * dosInPcs +
                            (Number(row['AKHIR BKS']) || 0) * packInPcs +
                            (Number(row['AKHIR PCS']) || 0);

          const stokSistem = stockData[masterItem.id]?.totalStockInPcs || 0;
          const selisih = stokFisik - stokSistem;

          return {
            itemId: masterItem.id,
            kodeInternal,
            namaBarang: masterItem.name,
            stokSistem,
            stokFisik,
            selisih,
            status: selisih === 0 ? 'Sesuai' : 'Akan Disesuaikan'
          };
        });
        
        setPreviewData(preview);
        setView('preview');
        setLoading(false);
      }
    });
    event.target.value = null; // Reset input file
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
            // Seharusnya tidak terjadi jika barang ada di master, tapi sebagai pengaman
            return { totalStockInPcs: item.stokFisik, locations: {} };
          }
          // Di sini kita hanya update total stok. Penyesuaian per lokasi butuh proses opname fisik yang lebih detail.
          currentStock.totalStockInPcs = item.stokFisik;
          return currentStock;
        });
        transactionItems.push({
            id: item.itemId,
            name: item.namaBarang,
            selisih: item.selisih,
            stokAwal: item.stokSistem,
            stokAkhir: item.stokFisik
        });
        successCount++;
      }
      
      // Simpan satu log transaksi besar untuk opname ini
      const transactionsRef = ref(db, `depots/${userProfile.depotId}/transactions`);
      await push(transactionsRef, {
        type: 'Stok Opname (Impor CSV)',
        fileName: fileName,
        items: transactionItems,
        user: userProfile.fullName,
        timestamp: serverTimestamp()
      });

      toast.dismiss('opname-toast');
      toast.success(`${successCount} item berhasil disesuaikan!`);
      setView('upload');
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

  if (loading) {
    return <div className="p-8 text-center"><span className="loading loading-spinner loading-lg"></span></div>;
  }

  if (view === 'preview') {
    const summary = {
      sesuai: previewData.filter(p => p.status === 'Sesuai').length,
      disesuaikan: previewData.filter(p => p.status === 'Akan Disesuaikan').length,
      tidakDitemukan: previewData.filter(p => p.status === 'Tidak Ditemukan di Master').length,
      total: previewData.length
    };
    return (
      <div className="p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-4">Preview Stok Opname</h1>
        <p className="mb-6">File: <strong>{fileName}</strong></p>

        <div className="stats shadow mb-6 w-full">
          <div className="stat"><div className="stat-title">Total Baris</div><div className="stat-value">{summary.total}</div></div>
          <div className="stat"><div className="stat-title">Sesuai</div><div className="stat-value text-success">{summary.sesuai}</div></div>
          <div className="stat"><div className="stat-title">Akan Disesuaikan</div><div className="stat-value text-warning">{summary.disesuaikan}</div></div>
          <div className="stat"><div className="stat-title">Tidak Ditemukan</div><div className="stat-value text-error">{summary.tidakDitemukan}</div></div>
        </div>

        <div className="overflow-x-auto bg-white rounded-lg shadow max-h-[50vh]">
          <table className="table table-compact w-full">
            <thead className="sticky top-0 bg-gray-200">
              <tr><th>Kode Internal</th><th>Nama Barang</th><th>Stok Sistem (Pcs)</th><th>Stok Fisik (Pcs)</th><th>Selisih</th><th>Status</th></tr>
            </thead>
            <tbody>
              {previewData.map((item, index) => (
                <tr key={index}>
                  <td className="font-mono">{item.kodeInternal}</td>
                  <td>{item.namaBarang}</td>
                  <td>{item.stokSistem}</td>
                  <td className="font-bold">{item.stokFisik}</td>
                  <td className={`font-bold ${item.selisih > 0 ? 'text-success' : item.selisih < 0 ? 'text-error' : ''}`}>{item.selisih}</td>
                  <td><span className={`badge badge-sm ${getStatusColor(item.status)}`}>{item.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex justify-end gap-4">
            <button onClick={() => setView('upload')} disabled={isProcessing} className="btn btn-ghost">Batal / Unggah Ulang</button>
            <button onClick={handleConfirmAdjustment} disabled={isProcessing || summary.disesuaikan === 0} className="btn btn-primary">
                {isProcessing ? <span className="loading loading-spinner"></span> : `Konfirmasi & Sesuaikan ${summary.disesuaikan} Barang`}
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 flex items-center justify-center" style={{minHeight: '60vh'}}>
        <div className="card w-full max-w-lg bg-white shadow-xl text-center">
            <div className="card-body">
                <h2 className="card-title block text-2xl">Impor Stok Opname</h2>
                <p className="my-4">Unggah file .csv hasil ekspor dari ND6 untuk melakukan penyesuaian stok secara massal.</p>
                <div className="card-actions justify-center">
                    <button onClick={() => fileInputRef.current.click()} className="btn btn-primary btn-lg">
                        Pilih File CSV
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileUpload}
                        accept=".csv"
                    />
                </div>
            </div>
        </div>
    </div>
  );
}

export default StockOpname;
