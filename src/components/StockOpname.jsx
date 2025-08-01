import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, onSnapshot, doc, runTransaction, addDoc, serverTimestamp } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import ReactToPrint from 'react-to-print';

const BlangkoOpnameManual = React.forwardRef((props, ref) => {
  const tableRows = Array.from({ length: 20 }, (_, i) => i);

  return (
    <div ref={ref} className="p-8">
      <style type="text/css" media="print">
        {`
          @page { size: A4; margin: 20mm; }
          body { -webkit-print-color-adjust: exact; }
          h3, h4 { page-break-after: avoid; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        `}
      </style>
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold uppercase">Formulir Perhitungan Stok Fisik (Stock Opname)</h3>
      </div>
      <table className="w-full text-sm border-collapse border border-black mb-6">
        <tbody>
          <tr>
            <td className="border border-black p-2 font-bold w-1/4">Nama Depo/Gudang:</td>
            <td className="border border-black p-2"></td>
            <td className="border border-black p-2 font-bold w-1/4">Tanggal Opname:</td>
            <td className="border border-black p-2"></td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-bold">Lokasi Spesifik:</td>
            <td className="border border-black p-2"></td>
            <td className="border border-black p-2 font-bold">Halaman:</td>
            <td className="border border-black p-2">___ dari ___</td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-bold">Petugas Penghitung:</td>
            <td className="border border-black p-2"></td>
            <td className="border border-black p-2 font-bold">Auditor/Pemeriksa:</td>
            <td className="border border-black p-2"></td>
          </tr>
        </tbody>
      </table>
      <h4 className="font-bold mb-2 text-center">II. DETAIL PERHITUNGAN STOK BARANG</h4>
      <table className="w-full text-xs border-collapse border border-black">
        <thead className="bg-gray-200">
          <tr>
            <th className="border border-black p-1 w-[3%]">No.</th>
            <th className="border border-black p-1 w-[15%]">Kode Barang</th>
            <th className="border border-black p-1 w-[30%]">Nama Barang</th>
            <th className="border border-black p-1 w-[10%]">Stok Sistem</th>
            <th className="border border-black p-1 w-[10%]">Jumlah Fisik</th>
            <th className="border border-black p-1 w-[7%]">Selisih</th>
            <th className="border border-black p-1">Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map(i => (
            <tr key={i}>
              <td className="border border-black p-1 h-8 text-center">{i + 1}</td>
              <td className="border border-black p-1"></td>
              <td className="border border-black p-1"></td>
              <td className="border border-black p-1"></td>
              <td className="border border-black p-1"></td>
              <td className="border border-black p-1"></td>
              <td className="border border-black p-1"></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ pageBreakInside: 'avoid', marginTop: '40px' }}>
          <h4 className="font-bold mb-12 text-center">III. VALIDASI DAN PERSETUJUAN</h4>
          <table className="w-full text-center">
              <tbody>
                  <tr>
                      <td className="w-1/3"><strong>Dihitung Oleh,</strong></td>
                      <td className="w-1/3"><strong>Diperiksa Oleh,</strong></td>
                      <td className="w-1/3"><strong>Disetujui Oleh,</strong></td>
                  </tr>
                  <tr>
                      <td className="pt-20">(______________________)</td>
                      <td className="pt-20">(______________________)</td>
                      <td className="pt-20">(______________________)</td>
                  </tr>
                   <tr>
                      <td><em>Petugas Gudang</em></td>
                      <td><em>Supervisor/Auditor</em></td>
                      <td><em>Kepala Depo</em></td>
                  </tr>
              </tbody>
          </table>
      </div>
    </div>
  );
});

const ManualOpname = ({ setView }) => {
  const componentRef = useRef();

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Stok Opname Manual</h2>
        <button onClick={() => setView('pilihan')} className="btn btn-ghost">Kembali</button>
      </div>
      <div className="card bg-white shadow-lg p-6">
        <p className="mb-4">Untuk memulai perhitungan manual, cetak blangko kosong terlebih dahulu untuk pencatatan di lapangan.</p>
        <ReactToPrint
          trigger={() => <button className="btn btn-primary">Cetak Blangko Kosong</button>}
          content={() => componentRef.current}
          documentTitle="Blangko_Stok_Opname"
        />
        <div style={{ display: "none" }}>
          <BlangkoOpnameManual ref={componentRef} />
        </div>
        <div className="divider my-6">Setelah Perhitungan Selesai</div>
        <p>Gunakan fitur "Impor dari CSV" untuk mengunggah dan menyesuaikan hasil perhitungan Anda secara massal.</p>
      </div>
    </div>
  );
};

const PilihanOpname = ({ setView }) => (
    <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
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

const ImporOpname = ({ setView, userProfile, masterItems, stockData }) => {
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false);

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
        setShowPreview(true);
        setLoading(false);
      }
    });
    event.target.value = null;
  };

  const handleConfirmAdjustment = async () => {
    const itemsToAdjust = previewData.filter(item => item.status === 'Akan Disesuaikan');
    if (itemsToAdjust.length === 0) return toast.error("Tidak ada data stok yang perlu disesuaikan.");
    if (!window.confirm(`Anda akan menyesuaikan stok untuk ${itemsToAdjust.length} barang. Lanjutkan?`)) return;

    setIsProcessing(true);
    toast.loading('Memproses penyesuaian stok...', { id: 'opname-toast' });
    const transactionItems = [];
    let successCount = 0;

    try {
      for (const item of itemsToAdjust) {
        const stockDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/stock/${item.itemId}`);
        await runTransaction(firestoreDb, async (transaction) => {
          transaction.set(stockDocRef, { totalStockInPcs: item.stokFisik }, { merge: true });
        });
        transactionItems.push({
            id: item.itemId, name: item.namaBarang, selisih: item.selisih,
            stokAwal: item.stokSistem, stokAkhir: item.stokFisik
        });
        successCount++;
      }
      
      const transactionsRef = collection(firestoreDb, `depots/${userProfile.depotId}/transactions`);
      await addDoc(transactionsRef, {
        type: 'Stok Opname (Impor CSV)', fileName: fileName, items: transactionItems,
        user: userProfile.fullName, timestamp: serverTimestamp()
      });

      toast.dismiss('opname-toast');
      toast.success(`${successCount} item berhasil disesuaikan!`);
      setView('pilihan');

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
    
    if (loading) { return <div className="text-center p-8"><span className="loading loading-spinner loading-lg"></span></div>; }
    
    if (showPreview) {
        const summary = {
          sesuai: previewData.filter(p => p.status === 'Sesuai').length,
          disesuaikan: previewData.filter(p => p.status === 'Akan Disesuaikan').length,
          tidakDitemukan: previewData.filter(p => p.status === 'Tidak Ditemukan di Master').length,
        };
        return (
          <div className="p-4 md:p-8">
            <h2 className="text-2xl font-bold mb-4">Preview Impor Stok Opname</h2>
            <div className="stats shadow w-full mb-6">
              <div className="stat"><div className="stat-title">Total Baris</div><div className="stat-value">{previewData.length}</div></div>
              <div className="stat"><div className="stat-title">Sesuai</div><div className="stat-value text-success">{summary.sesuai}</div></div>
              <div className="stat"><div className="stat-title">Akan Disesuaikan</div><div className="stat-value text-warning">{summary.disesuaikan}</div></div>
              <div className="stat"><div className="stat-title">Tidak Ditemukan</div><div className="stat-value text-error">{summary.tidakDitemukan}</div></div>
            </div>
            <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
              <table className="table table-sm w-full">
                <thead className="bg-gray-200"><tr><th>Kode</th><th>Nama Barang</th><th>Stok Sistem</th><th>Stok Fisik</th><th>Selisih</th><th>Status</th></tr></thead>
                <tbody>
                  {previewData.map((row, index) => (
                    <tr key={index} className={getStatusColor(row.status)}>
                      <td className="font-mono text-xs">{row.kodeInternal}</td>
                      <td>{row.namaBarang}</td>
                      <td>{row.stokSistem}</td>
                      <td>{row.stokFisik}</td>
                      <td>{row.selisih}</td>
                      <td>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex justify-end gap-4">
                <button onClick={() => setShowPreview(false)} disabled={isProcessing} className="btn btn-ghost">Batal / Unggah Ulang</button>
                <button onClick={handleConfirmAdjustment} disabled={isProcessing || summary.disesuaikan === 0} className="btn btn-primary">
                    {isProcessing ? <span className="loading loading-spinner"></span> : `Konfirmasi & Sesuaikan ${summary.disesuaikan} Barang`}
                </button>
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
                    <p className="my-4">Unggah file .csv untuk melakukan penyesuaian stok.</p>
                    <div className="card-actions justify-center">
                        <button onClick={() => fileInputRef.current.click()} className="btn btn-primary btn-lg">Pilih File CSV</button>
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".csv" />
                    </div>
                </div>
            </div>
        </div>
    );
};

function StockOpname({ userProfile }) {
  const [view, setView] = useState('pilihan'); // pilihan, manual, impor
  const [masterItems, setMasterItems] = useState({});
  const [stockData, setStockData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile || !userProfile.depotId) {
      setLoading(false);
      return;
    }
    
    const fetchFirestoreData = async () => {
        const masterItemsRef = collection(firestoreDb, 'master_items');
        const masterSnapshot = await getDocs(masterItemsRef);
        const itemsByInternalCode = {};
        masterSnapshot.forEach(doc => {
            const item = doc.data();
            if (item.kodeInternal) {
                itemsByInternalCode[item.kodeInternal.toUpperCase()] = { id: doc.id, ...item };
            }
        });
        setMasterItems(itemsByInternalCode);

        const stockRef = collection(firestoreDb, `depots/${userProfile.depotId}/stock`);
        const unsubscribeStock = onSnapshot(stockRef, (stockSnapshot) => {
            const stocks = {};
            stockSnapshot.forEach(doc => {
                stocks[doc.id] = doc.data();
            });
            setStockData(stocks);
            setLoading(false);
        });

        return () => unsubscribeStock();
    };
    
    fetchFirestoreData();

  }, [userProfile]);

  const renderView = () => {
    switch (view) {
      case 'manual':
        return <ManualOpname setView={setView} />;
      case 'impor':
        return <ImporOpname setView={setView} userProfile={userProfile} masterItems={masterItems} stockData={stockData} />;
      default:
        return <PilihanOpname setView={setView} />;
    }
  };

  if (loading) {
    return <div className="p-8 text-center"><span className="loading loading-spinner loading-lg"></span></div>;
  }

  return (
    <div className="p-4 md:p-8">
      {renderView()}
    </div>
  );
}

export default StockOpname;
