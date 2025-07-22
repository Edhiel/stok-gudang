import React, { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebaseConfig';
import Papa from 'papaparse';

const formatToDPP = (totalPcs, conversions) => {
  if (!totalPcs || !conversions) return '0.0.0';
  const dosInPcs = conversions.Dos?.inPcs || (conversions.Pack?.inPcs || 1);
  const packInPcs = conversions.Pack?.inPcs || 1;
  return `${Math.floor(totalPcs / dosInPcs)}.${Math.floor((totalPcs % dosInPcs) / packInPcs)}.${totalPcs % packInPcs}`;
};

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
  const [allDepots, setAllDepots] = useState([]);
  const [masterItems, setMasterItems] = useState({});
  const [originalStockData, setOriginalStockData] = useState([]);
  const [originalTransactions, setOriginalTransactions] = useState([]);
  const [processedStock, setProcessedStock] = useState([]);
  const [processedTransactions, setProcessedTransactions] = useState([]);
  const [selectedDepot, setSelectedDepot] = useState('semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

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
          if (!stockSummary[itemId]) stockSummary[itemId] = { total: 0, damaged: 0 };
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

  useEffect(() => {
    let newProcessedStock = [...originalStockData];
    if (filterCategory) newProcessedStock = newProcessedStock.filter(item => item.category === filterCategory);
    if (searchTerm) newProcessedStock = newProcessedStock.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    setProcessedStock(newProcessedStock);
    let newProcessedTrans = [...originalTransactions];
    if (selectedDepot !== 'semua') newProcessedTrans = newProcessedTrans.filter(t => t.depotId === selectedDepot);
    if (filterStartDate) { const start = new Date(filterStartDate).setHours(0,0,0,0); newProcessedTrans = newProcessedTrans.filter(t => t.timestamp >= start); }
    if (filterEndDate) { const end = new Date(filterEndDate).setHours(23,59,59,999); newProcessedTrans = newProcessedTrans.filter(t => t.timestamp <= end); }
    setProcessedTransactions(newProcessedTrans);
    setCurrentPage(1);
  }, [selectedDepot, filterCategory, searchTerm, filterStartDate, filterEndDate, originalStockData, originalTransactions]);

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

  const handlePrint = () => { window.print(); };
  const handleExportCsv = () => {
    let dataToExport = [];
    let filename = 'laporan_pusat.csv';
    const today = new Date().toISOString().split('T')[0];
    const depotName = selectedDepot === 'semua' ? 'SemuaDepo' : selectedDepot;
    if (activeTab === 'stok') {
        dataToExport = processedStock.map(item => ({
            'ID Barang': item.id, 'Nama Barang': item.name, 'Kategori': item.category, 
            'Supplier': item.supplierName, 'Total Stok Baik (Pcs)': item.totalStock || 0,
            'Total Stok Rusak (Pcs)': item.damagedStock || 0, 'Stok Baik (D.P.P)': formatToDPP(item.totalStock, item.conversions),
        }));
        filename = `laporan_stok_gabungan_${depotName}_${today}.csv`;
    } else if (activeTab === 'transaksi') {
        dataToExport = processedTransactions.map(trans => ({
            'Tanggal': new Date(trans.timestamp).toLocaleString('id-ID'), 'Depo': allDepots.find(d => d.id === trans.depotId)?.name || trans.depotId,
            'Tipe': trans.type, 'Oleh': trans.user, 'Detail Barang': trans.items.map(i => `${i.name} (${i.displayQty})`).join('; ')
        }));
        filename = `laporan_transaksi_gabungan_${depotName}_${today}.csv`;
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
      <div className="hidden print:block mb-4">
        <div className="flex items-center justify-center mb-4">
          <img src="/logo_bulet_mhm.gif" alt="Logo Perusahaan" className="h-16 w-16 mr-4" />
          <div>
            <h1 className="text-2xl font-bold">PT. Mahameru Mitra Makmur</h1>
            <p>Laporan Gabungan Kantor Pusat</p>
          </div>
        </div>
        <div className="text-center">
            <p>Depo: {allDepots.find(d => d.id === selectedDepot)?.name || 'Semua Depo'}</p>
            <p className="font-semibold text-lg">Laporan {activeTab === 'stok' ? 'Stok Barang' : 'Transaksi'}</p>
            <p className="text-sm">Dicetak pada: {new Date().toLocaleDateString('id-ID')}</p>
        </div>
      </div>
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="text-3xl font-bold">Dasbor Kantor Pusat</h1>
        <div className="flex gap-2">
            <button className="btn btn-sm btn-info" onClick={handlePrint}>Cetak / PDF</button>
            <button className="btn btn-sm btn-success" onClick={handleExportCsv}>Ekspor ke CSV</button>
        </div>
      </div>
      <div role="tablist" className="tabs tabs-lifted print:hidden">
        <a role="tab" className={`tab ${activeTab === 'stok' ? 'tab-active' : ''}`} onClick={() => setActiveTab('stok')}>Laporan Stok Gabungan</a>
        <a role="tab" className={`tab ${activeTab === 'transaksi' ? 'tab-active' : ''}`} onClick={() => setActiveTab('transaksi')}>Laporan Transaksi Gabungan</a>
      </div>
      <div className="card bg-white shadow-lg w-full rounded-b-lg rounded-tr-lg">
        <div className="card-body">
          <div className="p-4 bg-base-200 rounded-lg mb-4 print:hidden">
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
                  <div className="form-control"><label className="label-text">Cari Nama Barang</label><input type="text" placeholder="Ketik untuk mencari..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input input-bordered" /></div>
                  <div className="form-control"><label className="label-text">Filter Kategori</label><select className="select select-bordered" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}><option value="">Semua Kategori</option>{[...new Set(masterItems ? Object.values(masterItems).map(i => i.category) : [])].sort().map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                </>
              ) : (
                <>
                  <div className="form-control"><label className="label-text">Dari Tanggal</label><input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="input input-bordered" /></div>
                  <div className="form-control"><label className="label-text">Sampai Tanggal</label><input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="input input-bordered" /></div>
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