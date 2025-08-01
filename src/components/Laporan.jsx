import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import Papa from 'papaparse';

const LaporanStok = ({ stockData, loading }) => {
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
                    <td>{formatToDPP(item.totalStockInPcs, item.conversions)}</td><td className='text-red-600'>{formatToDPP(item.damagedStockInPcs, item.conversions)}</td>
                </tr>
                )))}
            </tbody>
        </table>
        </div>
    );
};

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
                        <td>{trans.timestamp?.toDate().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short'})}</td>
                        <td><span className={`badge ${trans.type.includes('Masuk') || trans.type.includes('Baik') ? 'badge-success' : 'badge-error'}`}>{trans.type}</span></td>
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

const PaginationControls = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    return (
        <div className="flex justify-center items-center gap-4 mt-4 print:hidden">
            <button className="btn btn-sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>«</button>
            <span className="font-semibold">Halaman {currentPage} dari {totalPages}</span>
            <button className="btn btn-sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>»</button>
        </div>
    );
};

function Laporan({ userProfile }) {
  const [activeTab, setActiveTab] = useState('stok');
  const [loading, setLoading] = useState(true);
  const [originalStockData, setOriginalStockData] = useState([]);
  const [originalTransactions, setOriginalTransactions] = useState([]);
  const [filteredStockData, setFilteredStockData] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [supplierList, setSupplierList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  useEffect(() => {
    if (!userProfile || !userProfile.depotId) { setLoading(false); return; }
    setLoading(true);

    const fetchData = async () => {
        const masterItemsSnap = await getDocs(collection(firestoreDb, 'master_items'));
        const masterItems = {};
        masterItemsSnap.forEach(doc => {
            masterItems[doc.id] = doc.data();
        });

        const stockRef = collection(firestoreDb, `depots/${userProfile.depotId}/stock`);
        const unsubStock = onSnapshot(stockRef, (stockSnapshot) => {
            const combinedData = [];
            stockSnapshot.forEach(doc => {
                const stockInfo = doc.data();
                const masterInfo = masterItems[doc.id] || {};
                combinedData.push({ id: doc.id, ...masterInfo, ...stockInfo });
            });

            setOriginalStockData(combinedData);
            setFilteredStockData(combinedData);

            const suppliers = [...new Set(combinedData.map(item => item.supplierName).filter(Boolean))];
            const categories = [...new Set(combinedData.map(item => item.category).filter(Boolean))];
            setSupplierList(suppliers.sort());
            setCategoryList(categories.sort());
        });
        
        const transRef = collection(firestoreDb, `depots/${userProfile.depotId}/transactions`);
        const unsubTrans = onSnapshot(transRef, (snapshot) => {
            const loadedTrans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const sortedTrans = loadedTrans.sort((a, b) => b.timestamp?.toMillis() - a.timestamp?.toMillis());
            setOriginalTransactions(sortedTrans);
            setFilteredTransactions(sortedTrans);
            setLoading(false);
        });

        return () => {
            unsubStock();
            unsubTrans();
        };
    };
    
    fetchData();
  }, [userProfile]);

  useEffect(() => {
    let newFilteredStock = [...originalStockData];
    if (filterCategory) { newFilteredStock = newFilteredStock.filter(item => item.category === filterCategory); }
    if (filterSupplier) { newFilteredStock = newFilteredStock.filter(item => item.supplierName === filterSupplier); }
    if (searchTerm) { newFilteredStock = newFilteredStock.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())); }
    setFilteredStockData(newFilteredStock);

    let newFilteredTrans = [...originalTransactions];
    if (filterStartDate) { const startDate = new Date(filterStartDate).setHours(0, 0, 0, 0); newFilteredTrans = newFilteredTrans.filter(trans => trans.timestamp?.toDate() >= startDate); }
    if (filterEndDate) { const endDate = new Date(filterEndDate).setHours(23, 59, 59, 999); newFilteredTrans = newFilteredTrans.filter(trans => trans.timestamp?.toDate() <= endDate); }
    setFilteredTransactions(newFilteredTrans);

    setCurrentPage(1);
  }, [filterCategory, filterSupplier, searchTerm, filterStartDate, filterEndDate, originalStockData, originalTransactions]);

  const totalStockPages = Math.ceil(filteredStockData.length / itemsPerPage);
  const totalTransactionPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedStockData = useMemo(() => {
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return filteredStockData.slice(indexOfFirstItem, indexOfLastItem);
  }, [currentPage, filteredStockData]);
  const paginatedTransactions = useMemo(() => {
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return filteredTransactions.slice(indexOfFirstItem, indexOfLastItem);
  }, [currentPage, filteredTransactions]);

  const resetFilters = () => {
    setFilterCategory(''); setFilterSupplier(''); setSearchTerm('');
    setFilterStartDate(''); setFilterEndDate('');
  };
  const handlePrint = () => { window.print(); };
  const handleExportCsv = () => {
    let dataToExport = [];
    let filename = 'laporan.csv';
    const today = new Date().toISOString().split('T')[0];

    if (activeTab === 'stok') {
        dataToExport = filteredStockData.map(item => ({
            'Nama Barang': item.name, 'Kategori': item.category, 'Supplier': item.supplierName,
            'Stok Baik (Pcs)': item.totalStockInPcs || 0, 'Stok Rusak (Pcs)': item.damagedStockInPcs || 0
        }));
        filename = `laporan_stok_${userProfile.depotId}_${today}.csv`;
    } else if (activeTab === 'transaksi') {
        dataToExport = filteredTransactions.map(trans => ({
            'Tanggal': trans.timestamp?.toDate().toLocaleString('id-ID'), 'Tipe': trans.type, 'Oleh': trans.user,
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
      <div className="hidden print:block mb-4">
        <div className="flex items-center justify-center mb-4">
          <img src="/logo_bulet_mhm.gif" alt="Logo Perusahaan" className="h-16 w-16 mr-4" />
          <div>
            <h1 className="text-2xl font-bold">PT. Mahameru Mitra Makmur</h1>
            <p>Depo: {userProfile.depotId}</p>
          </div>
        </div>
        <div className="text-center">
            <p className="font-semibold text-lg">Laporan {activeTab === 'stok' ? 'Stok Barang' : 'Transaksi'}</p>
            <p className="text-sm">Dicetak pada: {new Date().toLocaleDateString('id-ID')}</p>
        </div>
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
                <div><button className="btn btn-sm btn-ghost" onClick={resetFilters}>Reset Filter</button></div>
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
        {activeTab === 'stok' && <LaporanStok stockData={paginatedStockData} loading={loading} />}
        {activeTab === 'transaksi' && <LaporanTransaksi transactions={paginatedTransactions} loading={loading} />}
        <PaginationControls 
            currentPage={currentPage} 
            totalPages={activeTab === 'stok' ? totalStockPages : totalTransactionPages} 
            onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
export default Laporan;
