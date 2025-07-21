import React, { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebaseConfig';
import Papa from 'papaparse';

// --- FUNGSI BANTUAN ---
// Dipindah ke atas agar bisa digunakan di semua bagian
const formatToDPP = (totalPcs, conversions) => {
  if (!totalPcs || !conversions) return '0.0.0';
  const dosInPcs = conversions.Dos?.inPcs || (conversions.Pack?.inPcs || 1);
  const packInPcs = conversions.Pack?.inPcs || 1;
  if (dosInPcs === 0 || packInPcs === 0) return 'N/A';
  const dos = Math.floor(totalPcs / dosInPcs);
  const pack = Math.floor((totalPcs % dosInPcs) / packInPcs);
  const pcs = totalPcs % packInPcs;
  return `${dos}.${pack}.${pcs}`;
};

// --- KOMPONEN KECIL UNTUK TABEL STOK ---
const LaporanStok = ({ stockData, loading }) => {
  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra w-full">
        <thead className="bg-gray-200">
          <tr><th>Nama Barang</th><th>Kategori</th><th>Supplier</th><th>Stok Baik (D.P.P)</th><th>Stok Rusak (D.P.P)</th></tr>
        </thead>
        <tbody>
          {loading ? (<tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>) 
          : stockData.length === 0 ? (<tr><td colSpan="5" className="text-center">Tidak ada data yang cocok dengan filter.</td></tr>) 
          : (stockData.map(item => (
              <tr key={item.id}>
                <td className="font-bold">{item.name}</td><td>{item.category}</td><td>{item.supplierName}</td>
                <td>{formatToDPP(item.totalStock, item.conversions)}</td><td className='text-red-600'>{formatToDPP(item.damagedStock, item.conversions)}</td>
              </tr>
            )))}
        </tbody>
      </table>
    </div>
  );
};

// --- KOMPONEN KECIL UNTUK TABEL TRANSAKSI ---
const LaporanTransaksi = ({ transactions, loading }) => {
    return (
        <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
            <thead className="bg-gray-200">
                <tr><th>Tanggal</th><th>Tipe Transaksi</th><th>Detail</th><th>Oleh</th></tr>
            </thead>
            <tbody>
                {loading ? (<tr><td colSpan="4" className="text-center"><span className="loading loading-dots"></span></td></tr>)
                : transactions.length === 0 ? (<tr><td colSpan="4" className="text-center">Tidak ada data yang cocok dengan filter.</td></tr>)
                : (transactions.map(trans => (
                    <tr key={trans.id}>
                        <td>{new Date(trans.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short'})}</td>
                        <td><span className={`badge ${trans.type === 'Stok Masuk' || trans.type === 'Retur Baik' ? 'badge-success' : 'badge-error'}`}>{trans.type}</span></td>
                        <td>
                            {trans.items.map((item, idx) => (<div key={idx} className="text-xs">{item.name} ({item.displayQty})</div>))}
                            {trans.fromStore && <div className="text-xs italic">Dari: {trans.fromStore}</div>}
                            {trans.storeName && <div className="text-xs italic">Ke: {trans.storeName}</div>}
                        </td>
                        <td>{trans.user}</td>
                    </tr>
                )))}
            </tbody>
            </table>
        </div>
    );
};

// --- KOMPONEN KECIL BARU UNTUK KONTROL HALAMAN (PAGINATION) ---
const PaginationControls = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    return (
        <div className="flex justify-center items-center gap-4 mt-4 print:hidden">
            <button className="btn btn-sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>«</button>
            <span className="font-semibold">Halaman {currentPage} dari {totalPages}</span>
            <button className="btn btn-sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>»</button>
        </div>
    );
}
// --- KOMPONEN UTAMA ---
function Laporan({ userProfile }) {
  const [activeTab, setActiveTab] = useState('stok');
  const [loading, setLoading] = useState(true);

  // State untuk data mentah
  const [originalStockData, setOriginalStockData] = useState([]);
  const [originalTransactions, setOriginalTransactions] = useState([]);
  
  // State untuk data yang sudah difilter & dicari
  const [processedStockData, setProcessedStockData] = useState([]);
  const [processedTransactions, setProcessedTransactions] = useState([]);

  // State untuk filter & pencarian
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // State untuk pilihan di dropdown filter
  const [supplierList, setSupplierList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);

  // State untuk pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25; // Tampilkan 25 item per halaman

  // useEffect untuk mengambil data mentah dari Firebase
  useEffect(() => {
    if (!userProfile || !userProfile.depotId) { setLoading(false); return; }
    setLoading(true);

    const masterItemsRef = ref(db, 'master_items');
    const stockRef = ref(db, `depots/${userProfile.depotId}/stock`);
    onValue(masterItemsRef, (masterSnapshot) => {
        const masterItems = masterSnapshot.val() || {};
        onValue(stockRef, (stockSnapshot) => {
            const stockItems = stockSnapshot.val() || {};
            const combinedData = Object.keys(masterItems).map(itemId => {
                const stockInfo = stockItems[itemId] || { totalStock: 0, damagedStock: 0 };
                return { id: itemId, ...masterItems[itemId], ...stockInfo };
            });
            setOriginalStockData(combinedData);
            const suppliers = [...new Set(combinedData.map(item => item.supplierName).filter(Boolean))];
            const categories = [...new Set(combinedData.map(item => item.category).filter(Boolean))];
            setSupplierList(suppliers.sort());
            setCategoryList(categories.sort());
        });
    });

    const transRef = ref(db, `depots/${userProfile.depotId}/transactions`);
    onValue(transRef, (snapshot) => {
        const data = snapshot.val() || {};
        const loadedTrans = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        const sortedTrans = loadedTrans.sort((a, b) => b.timestamp - a.timestamp);
        setOriginalTransactions(sortedTrans);
        setLoading(false);
    });
  }, [userProfile]);

  // useEffect untuk proses filtering & pencarian
  useEffect(() => {
    let newFilteredStock = originalStockData;
    if (filterCategory) { newFilteredStock = newFilteredStock.filter(item => item.category === filterCategory); }
    if (filterSupplier) { newFilteredStock = newFilteredStock.filter(item => item.supplierName === filterSupplier); }
    if (searchTerm) { newFilteredStock = newFilteredStock.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())); }
    setProcessedStockData(newFilteredStock);

    let newFilteredTrans = originalTransactions;
    if (filterStartDate) { const startDate = new Date(filterStartDate).setHours(0, 0, 0, 0); newFilteredTrans = newFilteredTrans.filter(trans => trans.timestamp >= startDate); }
    if (filterEndDate) { const endDate = new Date(filterEndDate).setHours(23, 59, 59, 999); newFilteredTrans = newFilteredTrans.filter(trans => trans.timestamp <= endDate); }
    setProcessedTransactions(newFilteredTrans);
    
    setCurrentPage(1); // Selalu kembali ke halaman 1 setiap kali filter berubah
  }, [filterCategory, filterSupplier, searchTerm, filterStartDate, filterEndDate, originalStockData, originalTransactions]);

  // Logika untuk "memotong" data sesuai halaman (Pagination)
  const paginatedStockData = useMemo(() => {
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return processedStockData.slice(indexOfFirstItem, indexOfLastItem);
  }, [currentPage, processedStockData]);

  const paginatedTransactions = useMemo(() => {
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return processedTransactions.slice(indexOfFirstItem, indexOfLastItem);
  }, [currentPage, processedTransactions]);
  
  const totalStockPages = Math.ceil(processedStockData.length / itemsPerPage);
  const totalTransactionPages = Math.ceil(processedTransactions.length / itemsPerPage);

  const resetFilters = () => {
    setFilterCategory(''); setFilterSupplier(''); setSearchTerm('');
    setFilterStartDate(''); setFilterEndDate('');
  };
  
  const handlePrint = () => { window.print(); };

  const handleExportCsv = () => {
    let dataToExport = [];
    let filename = 'laporan.csv';
    const today = new Date().toISOString().split('T')[0];
    
    // Gunakan data yang sudah difilter (processed), bukan yang dipaginasi
    if (activeTab === 'stok') {
        dataToExport = processedStockData.map(item => ({
            'Nama Barang': item.name, 'Kategori': item.category, 'Supplier': item.supplierName,
            'Stok Baik (Pcs)': item.totalStock || 0,
            'Stok Rusak (Pcs)': item.damagedStock || 0,
            'Stok Baik (D.P.P)': formatToDPP(item.totalStock, item.conversions), // <-- PERBAIKAN CSV
        }));
        filename = `laporan_stok_${userProfile.depotId}_${today}.csv`;
    } else if (activeTab === 'transaksi') {
        dataToExport = processedTransactions.map(trans => ({
            'Tanggal': new Date(trans.timestamp).toLocaleString('id-ID'), 'Tipe': trans.type, 'Oleh': trans.user,
            'Toko/Asal': trans.fromStore || trans.storeName || '-', 'No Dokumen': trans.invoiceNumber || trans.suratJalan || '-',
            'Detail Barang': trans.items.map(i => `${i.name} (${i.displayQty})`).join('; ')
        }));
        filename = `laporan_transaksi_${userProfile.depotId}_${today}.csv`;
    }

    if (dataToExport.length === 0) { alert("Tidak ada data untuk diekspor."); return; }
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  return (
    <div className="p-8">
      <div className="hidden print:block mb-4 text-center">
        <h1 className="text-2xl font-bold">Laporan PT. ...</h1>
        <p>Depo: {userProfile.depotId}</p>
        <p>Laporan {activeTab === 'stok' ? 'Stok Barang' : 'Transaksi'}</p>
        <p>Dicetak pada: {new Date().toLocaleDateString('id-ID')}</p>
      </div>
      <div className="flex justify-between items-center print:hidden">
        <h1 className="text-3xl font-bold">Laporan</h1>
        <div className="flex gap-2">
            <button className="btn btn-sm btn-info" onClick={handlePrint}>Cetak / PDF</button>
            <button className="btn btn-sm btn-success" onClick={handleExportCsv}>Ekspor ke CSV</button>
        </div>
      </div>
      
      <div className="card bg-base-100 shadow-md my-4 p-4 print:hidden">
        {activeTab === 'stok' ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div><label className="label-text">Cari Nama Barang</label><input type="text" placeholder="Ketik untuk mencari..." className="input input-bordered input-sm w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                <div><label className="label-text">Filter Kategori</label><select className="select select-bordered select-sm w-full" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}><option value="">Semua Kategori</option>{categoryList.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label className="label-text">Filter Supplier</label><select className="select select-bordered select-sm w-full" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}><option value="">Semua Supplier</option>{supplierList.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><button className="btn btn-sm btn-ghost" onClick={resetFilters}>Reset Semua Filter</button></div>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div><label className="label-text">Dari Tanggal</label><input type="date" className="input input-bordered input-sm w-full" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} /></div>
                <div><label className="label-text">Sampai Tanggal</label><input type="date" className="input input-bordered input-sm w-full" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} /></div>
                <div><button className="btn btn-sm btn-ghost" onClick={resetFilters}>Reset Filter</button></div>
            </div>
        )}
      </div>

      <div role="tablist" className="tabs tabs-lifted mt-4 print:hidden">
        <a role="tab" className={`tab ${activeTab === 'stok' ? 'tab-active' : ''}`} onClick={() => setActiveTab('stok')}>Laporan Stok</a>
        <a role="tab" className={`tab ${activeTab === 'transaksi' ? 'tab-active' : ''}`} onClick={() => setActiveTab('transaksi')}>Laporan Transaksi</a>
      </div>

      <div className="bg-white p-6 rounded-b-lg rounded-tr-lg shadow-lg min-h-96">
        {activeTab === 'stok' && (
            <>
                <LaporanStok stockData={paginatedStockData} loading={loading} />
                <PaginationControls currentPage={currentPage} totalPages={totalStockPages} onPageChange={setCurrentPage} />
            </>
        )}
        {activeTab === 'transaksi' && (
            <>
                <LaporanTransaksi transactions={paginatedTransactions} loading={loading} />
                <PaginationControls currentPage={currentPage} totalPages={totalTransactionPages} onPageChange={setCurrentPage} />
            </>
        )}
      </div>
    </div>
  );
}
export default Laporan;