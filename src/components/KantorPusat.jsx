import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, getDocs, doc, getDoc, query, where, collectionGroup } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import toast from 'react-hot-toast';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const StatCard = ({ title, value, icon, color, loading }) => (
  <div className={`card bg-white shadow-md p-4 flex flex-row items-center`}>
    <div className={`text-3xl p-3 rounded-lg ${color}`}>{icon}</div>
    <div className="ml-4">
      <div className="text-gray-500 text-sm font-semibold">{title}</div>
      {loading ? <span className="loading loading-spinner loading-sm"></span> : <div className="text-2xl font-bold">{value}</div>}
    </div>
  </div>
);

function KantorPusat() {
  const [allDepots, setAllDepots] = useState([]);
  const [masterItems, setMasterItems] = useState({});
  const [loading, setLoading] = useState(true);
  
  // State untuk data real-time
  const [liveStock, setLiveStock] = useState([]);
  const [liveTransactions, setLiveTransactions] = useState([]);

  // State untuk data historis dari "Tutup Hari"
  const [historicalStock, setHistoricalStock] = useState([]);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  
  // State untuk filter
  const [activeTab, setActiveTab] = useState('stok');
  const [selectedDepot, setSelectedDepot] = useState('semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]); // Default ke hari ini

  const [stats, setStats] = useState({ totalDepots: 0, totalItems: 0 });

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      
      const depotsSnap = await getDocs(collection(firestoreDb, 'depots'));
      const depotList = depotsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setAllDepots(depotList);
      setStats(prev => ({ ...prev, totalDepots: depotList.length }));

      const masterItemsSnap = await getDocs(collection(firestoreDb, 'master_items'));
      const masterData = {};
      masterItemsSnap.forEach(doc => { masterData[doc.id] = doc.data(); });
      setMasterItems(masterData);
      setStats(prev => ({ ...prev, totalItems: masterItemsSnap.size }));

      // Listener untuk data STOK LIVE
      const stockQuery = query(collectionGroup(firestoreDb, 'stock'));
      const unsubStock = onSnapshot(stockQuery, (snapshot) => {
        setLiveStock(snapshot.docs.map(doc => ({ itemId: doc.id, depotId: doc.ref.parent.parent.id, ...doc.data() })));
      });

      // Listener untuk data TRANSAKSI LIVE
      const transQuery = query(collectionGroup(firestoreDb, 'transactions'));
      const unsubTrans = onSnapshot(transQuery, (snapshot) => {
        setLiveTransactions(snapshot.docs.map(doc => ({ transId: doc.id, depotId: doc.ref.parent.parent.id, ...doc.data() })));
      });

      setLoading(false);
      return () => { unsubStock(); unsubTrans(); };
    };
    fetchInitialData();
  }, []);

  // useEffect baru untuk mengambil snapshot stok berdasarkan tanggal
  useEffect(() => {
    const fetchHistoricalData = async () => {
      if (!filterDate) {
        setHistoricalStock([]);
        return;
      };
      
      setLoadingHistorical(true);
      const snapshotPromises = allDepots.map(depot => {
        const snapshotId = `${depot.id}_${filterDate}`;
        const snapshotDocRef = doc(firestoreDb, 'daily_stock_snapshots', snapshotId);
        return getDoc(snapshotDocRef);
      });

      try {
        const snapshots = await Promise.all(snapshotPromises);
        const allStockData = [];
        snapshots.forEach(snapshot => {
          if (snapshot.exists()) {
            // Menambahkan depotId ke setiap item stok agar bisa difilter
            const depotId = snapshot.data().depotId;
            const stockWithDepot = snapshot.data().stockData.map(item => ({ ...item, depotId }));
            allStockData.push(...stockWithDepot);
          }
        });
        setHistoricalStock(allStockData);
      } catch (error) {
        toast.error("Gagal memuat data historis.");
        console.error(error);
      } finally {
        setLoadingHistorical(false);
      }
    };

    if (allDepots.length > 0) {
      fetchHistoricalData();
    }
  }, [filterDate, allDepots]);

  const isToday = useMemo(() => {
    return new Date().toISOString().split('T')[0] === filterDate;
  }, [filterDate]);

  const filteredData = useMemo(() => {
    // Jika tanggal hari ini, gunakan data live. Jika tanggal lampau, gunakan data historis.
    let stockSource = isToday ? liveStock : historicalStock;
    
    let stock = [...stockSource];
    let transactions = [...liveTransactions]; // Transaksi selalu live untuk tab transaksi

    if (selectedDepot !== 'semua') {
      stock = stock.filter(s => s.depotId === selectedDepot);
      transactions = transactions.filter(t => t.depotId === selectedDepot);
    }
    
    if (searchTerm) stock = stock.filter(s => masterItems[s.itemId]?.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterCategory) stock = stock.filter(s => masterItems[s.itemId]?.category === filterCategory);

    return { stock, transactions };
  }, [selectedDepot, searchTerm, filterCategory, isToday, liveStock, historicalStock, liveTransactions, masterItems]);

  const aggregatedStock = useMemo(() => {
     const stockMap = filteredData.stock.reduce((acc, s) => {
        const itemName = masterItems[s.itemId]?.name || 'Nama Tidak Ditemukan';
        if (!acc[itemName]) acc[itemName] = { good: 0, damaged: 0 };
        acc[itemName].good += s.totalStockInPcs || 0;
        acc[itemName].damaged += s.damagedStockInPcs || 0;
        return acc;
      }, {});
      return Object.entries(stockMap).sort((a,b) => a[0].localeCompare(b[0]));
  }, [filteredData.stock, masterItems]);
  
  const categories = useMemo(() => [...new Set(Object.values(masterItems).map(i => i.category).filter(Boolean))].sort(), [masterItems]);

  return (
    <div className="p-4 sm:p-8 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Analisis Data Kantor Pusat</h1>
      
      <div role="tablist" className="tabs tabs-lifted">
        <a role="tab" className={`tab ${activeTab === 'stok' ? 'tab-active' : ''}`} onClick={() => setActiveTab('stok')}>Laporan Stok</a>
        <a role="tab" className={`tab ${activeTab === 'transaksi' ? 'tab-active' : ''}`} onClick={() => setActiveTab('transaksi')}>Laporan Transaksi</a>
      </div>

      <div className="bg-white p-6 rounded-b-lg rounded-tr-lg shadow-lg">
        <div className="p-4 bg-base-200 rounded-lg mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="form-control">
                    <label className="label-text">Pilih Depo</label>
                    <select className="select select-bordered select-sm" value={selectedDepot} onChange={(e) => setSelectedDepot(e.target.value)}>
                        <option value="semua">Semua Depo</option>
                        {allDepots.map(depot => (<option key={depot.id} value={depot.id}>{depot.name}</option>))}
                    </select>
                </div>
                {activeTab === 'stok' ? (
                    <>
                        <div className="form-control">
                            <label className="label-text font-bold">Pilih Tanggal Laporan</label>
                            <input type="date" className="input input-bordered input-sm" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}/>
                        </div>
                        <div className="form-control">
                            <label className="label-text">Cari Nama Barang</label>
                            <input type="text" placeholder="Ketik untuk mencari..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input input-bordered input-sm" />
                        </div>
                        <div className="form-control">
                            <label className="label-text">Filter Kategori</label>
                            <select className="select select-bordered select-sm" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                                <option value="">Semua Kategori</option>
                                {categories.map(c => (<option key={c} value={c}>{c}</option>))}
                            </select>
                        </div>
                    </>
                ) : ( <p className="md:col-span-3 text-sm text-gray-500">Tab Laporan Transaksi selalu menampilkan data real-time dari depo yang dipilih.</p> )}
            </div>
        </div>

        {activeTab === 'stok' ? (
            <div className="overflow-x-auto max-h-96">
                <table className="table table-zebra table-sm w-full">
                    <thead className="bg-gray-200 sticky top-0">
                        <tr>
                            <th>Nama Barang</th>
                            <th>Total Stok Baik (Pcs)</th>
                            <th>Total Stok Rusak (Pcs)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loadingHistorical || loading ? (<tr><td colSpan="3" className="text-center"><span className="loading loading-dots"></span></td></tr>) 
                        : (aggregatedStock.map(([name, stock]) => (
                            <tr key={name}>
                                <td className="font-semibold">{name}</td>
                                <td>{stock.good.toLocaleString('id-ID')}</td>
                                <td className="text-red-600">{stock.damaged.toLocaleString('id-ID')}</td>
                            </tr>
                        )))}
                        {(!loadingHistorical && !loading && aggregatedStock.length === 0) && (
                            <tr><td colSpan="3" className="text-center p-4">Tidak ada data "Tutup Hari" untuk tanggal yang dipilih.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        ) : (
            <div className="overflow-x-auto max-h-96">
                 <table className="table table-zebra table-sm w-full">
                    <thead className="bg-gray-200 sticky top-0">
                        <tr>
                            <th>Waktu</th>
                            <th>Depo</th>
                            <th>Tipe Transaksi</th>
                            <th>Detail</th>
                            <th>Oleh</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (<tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>)
                        : (filteredData.transactions.map(t => (
                            <tr key={t.transId}>
                                <td className="text-xs">{t.timestamp?.toDate().toLocaleString('id-ID')}</td>
                                <td className="font-semibold">{allDepots.find(d => d.id === t.depotId)?.name || 'N/A'}</td>
                                <td><span className="badge badge-info">{t.type}</span></td>
                                <td className="text-xs">{t.items?.map(i => i.name).join(', ')}</td>
                                <td>{t.user}</td>
                            </tr>
                        )))}
                    </tbody>
                 </table>
            </div>
        )}
      </div>
    </div>
  );
}

export default KantorPusat;
