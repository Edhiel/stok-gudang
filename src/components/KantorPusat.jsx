import React, { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebaseConfig';

// --- FUNGSI BANTUAN ---
const formatToDPP = (totalPcs, conversions) => {
  if (!totalPcs || !conversions) return '0.0.0';
  const dosInPcs = conversions.Dos?.inPcs || (conversions.Pack?.inPcs || 1);
  const packInPcs = conversions.Pack?.inPcs || 1;
  return `${Math.floor(totalPcs / dosInPcs)}.${Math.floor((totalPcs % dosInPcs) / packInPcs)}.${totalPcs % packInPcs}`;
};

// --- KOMPONEN KECIL UNTUK TABEL STOK ---
const LaporanStok = ({ stockData, loading }) => (
  <div className="overflow-x-auto">
    <table className="table table-zebra w-full">
      <thead className="bg-gray-200">
        <tr><th>Nama Barang</th><th>Kategori</th><th>Supplier</th><th>Total Stok Baik (D.P.P)</th><th>Total Stok Rusak (D.P.P)</th></tr>
      </thead>
      <tbody>
        {loading ? (<tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>) 
        : stockData.length === 0 ? (<tr><td colSpan="5" className="text-center">Tidak ada data yang cocok.</td></tr>) 
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

// --- KOMPONEN KECIL BARU UNTUK TABEL TRANSAKSI ---
const LaporanTransaksi = ({ transactions, loading, depots }) => (
    <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
        <thead className="bg-gray-200">
            <tr><th>Tanggal</th><th>Depo</th><th>Tipe Transaksi</th><th>Detail</th><th>Oleh</th></tr>
        </thead>
        <tbody>
            {loading ? (<tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>)
            : transactions.length === 0 ? (<tr><td colSpan="5" className="text-center">Tidak ada data yang cocok.</td></tr>)
            : (transactions.map(trans => (
                <tr key={trans.id}>
                    <td>{new Date(trans.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short'})}</td>
                    <td>{depots.find(d => d.id === trans.depotId)?.name || trans.depotId}</td>
                    <td><span className={`badge ${trans.type.includes('Masuk') || trans.type.includes('Baik') ? 'badge-success' : 'badge-error'}`}>{trans.type}</span></td>
                    <td>
                        {trans.items.map((item, idx) => (<div key={idx} className="text-xs">{item.name} ({item.displayQty})</div>))}
                    </td>
                    <td>{trans.user}</td>
                </tr>
            )))}
        </tbody>
        </table>
    </div>
);

// --- KOMPONEN KECIL UNTUK KONTROL HALAMAN (PAGINATION) ---
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
function KantorPusat({ userProfile }) {
  const [activeTab, setActiveTab] = useState('stok');
  const [loading, setLoading] = useState(true);

  // Data mentah dari Firebase
  const [allDepots, setAllDepots] = useState([]);
  const [masterItems, setMasterItems] = useState({});
  const [originalStockData, setOriginalStockData] = useState([]);
  const [originalTransactions, setOriginalTransactions] = useState([]);
  
  // State untuk filter & pencarian
  const [selectedDepot, setSelectedDepot] = useState('semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  // State untuk data yang sudah diproses
  const [processedStock, setProcessedStock] = useState([]);
  const [processedTransactions, setProcessedTransactions] = useState([]);
  
  // State untuk pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Mengambil data awal (daftar depo & master barang)
  useEffect(() => {
    const depotsRef = ref(db, 'depots');
    onValue(depotsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const depotList = Object.keys(data).map(key => ({ id: key, name: data[key].info.name }));
      setAllDepots(depotList);
    });

    const masterItemsRef = ref(db, 'master_items');
    onValue(masterItemsRef, (snapshot) => {
      setMasterItems(snapshot.val() || {});
    });
  }, []);

  // Mengambil data stok & transaksi dari SEMUA depo
  useEffect(() => {
    setLoading(true);
    const depotsRef = ref(db, 'depots');
    onValue(depotsRef, (snapshot) => {
      const allDepotData = snapshot.val() || {};
      const stockSummary = {};
      const allTransactions = [];

      Object.keys(allDepotData).forEach(depotId => {
        const stockItems = allDepotData[depotId].stock || {};
        const transItems = allDepotData[depotId].transactions || {};

        Object.keys(stockItems).forEach(itemId => {
          if (!stockSummary[itemId]) {
            stockSummary[itemId] = { total: 0, damaged: 0 };
          }
          stockSummary[itemId].total += stockItems[itemId].totalStockInPcs || 0;
          stockSummary[itemId].damaged += stockItems[itemId].damagedStockInPcs || 0;
        });

        Object.keys(transItems).forEach(transId => {
            allTransactions.push({ id: transId, ...transItems[transId], depotId });
        });
      });

      const finalStockData = Object.keys(stockSummary).map(itemId => ({
        id: itemId, ...masterItems[itemId],
        totalStock: stockSummary[itemId].total,
        damagedStock: stockSummary[itemId].damaged,
      })).filter(item => item.name);
      
      setOriginalStockData(finalStockData);
      setOriginalTransactions(allTransactions.sort((a,b) => b.timestamp - a.timestamp));
      setLoading(false);
    }, { onlyOnce: true });
  }, [masterItems]);


  // useEffect untuk memfilter dan mencari data
  useEffect(() => {
    // Proses untuk STOK
    let newProcessedStock = [...originalStockData];
    if (selectedDepot !== 'semua') {
      // (Logika filter stok per depo perlu data stok mentah per depo)
      // Untuk saat ini, filter depo hanya berlaku untuk transaksi
    }
    if (filterCategory) newProcessedStock = newProcessedStock.filter(item => item.category === filterCategory);
    if (searchTerm) newProcessedStock = newProcessedStock.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    setProcessedStock(newProcessedStock);

    // Proses untuk TRANSAKSI
    let newProcessedTrans = [...originalTransactions];
    if (selectedDepot !== 'semua') newProcessedTrans = newProcessedTrans.filter(t => t.depotId === selectedDepot);
    if (filterStartDate) { const start = new Date(filterStartDate).setHours(0,0,0,0); newProcessedTrans = newProcessedTrans.filter(t => t.timestamp >= start); }
    if (filterEndDate) { const end = new Date(filterEndDate).setHours(23,59,59,999); newProcessedTrans = newProcessedTrans.filter(t => t.timestamp <= end); }
    setProcessedTransactions(newProcessedTrans);

    setCurrentPage(1); // Kembali ke halaman 1 setiap filter berubah
  }, [selectedDepot, filterCategory, searchTerm, filterStartDate, filterEndDate, originalStockData, originalTransactions]);

  // Logika untuk pagination
  const totalStockPages = Math.ceil(processedStock.length / itemsPerPage);
  const totalTransactionPages = Math.ceil(processedTransactions.length / itemsPerPage);
  
  const paginatedStock = useMemo(() => {
    const first = (currentPage - 1) * itemsPerPage;
    const last = first + itemsPerPage;
    return processedStock.slice(first, last);
  }, [currentPage, processedStock]);

  const paginatedTransactions = useMemo(() => {
    const first = (currentPage - 1) * itemsPerPage;
    const last = first + itemsPerPage;
    return processedTransactions.slice(first, last);
  }, [currentPage, processedTransactions]);
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Dasbor Kantor Pusat</h1>
      
      <div role="tablist" className="tabs tabs-lifted">
        <a role="tab" className={`tab ${activeTab === 'stok' ? 'tab-active' : ''}`} onClick={() => setActiveTab('stok')}>Laporan Stok Gabungan</a>
        <a role="tab" className={`tab ${activeTab === 'transaksi' ? 'tab-active' : ''}`} onClick={() => setActiveTab('transaksi')}>Laporan Transaksi Gabungan</a>
      </div>

      <div className="card bg-white shadow-lg w-full rounded-b-lg rounded-tr-lg">
        <div className="card-body">
          {/* Panel Filter */}
          <div className="p-4 bg-base-200 rounded-lg mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="form-control">
                <label className="label-text">Filter per Depo</label>
                <select className="select select-bordered" value={selectedDepot} onChange={(e) => setSelectedDepot(e.target.value)}>
                  <option value="semua">Semua Depo</option>
                  {allDepots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {activeTab === 'stok' ? (
                <>
                  <div className="form-control">
                    <label className="label-text">Cari Nama Barang</label>
                    <input type="text" placeholder="Ketik untuk mencari..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input input-bordered" />
                  </div>
                  <div className="form-control">
                    <label className="label-text">Filter Kategori</label>
                    <select className="select select-bordered" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                      <option value="">Semua Kategori</option>
                      {[...new Set(masterItems ? Object.values(masterItems).map(i => i.category) : [])].sort().map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-control">
                    <label className="label-text">Dari Tanggal</label>
                    <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="input input-bordered" />
                  </div>
                  <div className="form-control">
                    <label className="label-text">Sampai Tanggal</label>
                    <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="input input-bordered" />
                  </div>
                </>
              )}
            </div>
          </div>

          {activeTab === 'stok' && (
            <>
              <LaporanStok stockData={paginatedStock} loading={loading} />
              <PaginationControls currentPage={currentPage} totalPages={totalStockPages} onPageChange={setCurrentPage} />
            </>
          )}

          {activeTab === 'transaksi' && (
            <>
              <LaporanTransaksi transactions={paginatedTransactions} loading={loading} depots={allDepots} />
              <PaginationControls currentPage={currentPage} totalPages={totalTransactionPages} onPageChange={setCurrentPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
export default KantorPusat;