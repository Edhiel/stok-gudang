import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, getDocs, collectionGroup, query } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Komponen Kartu Statistik
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
  const [allStock, setAllStock] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepot, setSelectedDepot] = useState('semua');
  
  const [stats, setStats] = useState({ totalDepots: 0, totalItems: 0, totalStockValue: 0 });
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);

      // Ambil daftar depo
      const depotsSnap = await getDocs(collection(firestoreDb, 'depots'));
      const depotList = depotsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setAllDepots(depotList);
      setStats(prev => ({ ...prev, totalDepots: depotList.length }));

      // Ambil master barang
      const masterItemsSnap = await getDocs(collection(firestoreDb, 'master_items'));
      const masterData = {};
      masterItemsSnap.forEach(doc => { masterData[doc.id] = doc.data(); });
      setMasterItems(masterData);
      setStats(prev => ({ ...prev, totalItems: masterItemsSnap.size }));

      // Ambil SEMUA stok dari SEMUA depo menggunakan collectionGroup
      const stockQuery = query(collectionGroup(firestoreDb, 'stock'));
      const unsubStock = onSnapshot(stockQuery, (snapshot) => {
        const stockData = snapshot.docs.map(doc => {
            const path = doc.ref.path.split('/');
            const depotId = path[1];
            return { itemId: doc.id, depotId, ...doc.data() };
        });
        setAllStock(stockData);
      });

      // Ambil SEMUA transaksi dari SEMUA depo
      const transQuery = query(collectionGroup(firestoreDb, 'transactions'));
      const unsubTrans = onSnapshot(transQuery, (snapshot) => {
        const transData = snapshot.docs.map(doc => {
            const path = doc.ref.path.split('/');
            const depotId = path[1];
            return { transId: doc.id, depotId, ...doc.data() };
        });
        setAllTransactions(transData);
        setLoading(false);
      });

      return () => {
        unsubStock();
        unsubTrans();
      };
    };

    fetchInitialData();
  }, []);

  // Memoize data yang difilter agar tidak dihitung ulang setiap render
  const filteredData = useMemo(() => {
    if (selectedDepot === 'semua') {
      return { stock: allStock, transactions: allTransactions };
    }
    return {
      stock: allStock.filter(s => s.depotId === selectedDepot),
      transactions: allTransactions.filter(t => t.depotId === selectedDepot),
    };
  }, [selectedDepot, allStock, allTransactions]);

  // Update chart data saat data yang difilter berubah
  useEffect(() => {
    const now = new Date();
    const dailyData = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      dailyData[dateStr] = { masuk: 0, keluar: 0 };
    }

    filteredData.transactions.forEach((tx) => {
      if (tx.timestamp?.toDate) {
        const txDate = tx.timestamp.toDate();
        const dateStr = txDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
        if (dailyData[dateStr]) {
            if (tx.type === 'Stok Masuk') {
                dailyData[dateStr].masuk += tx.items.reduce((sum, item) => sum + (item.qtyInPcs || item.quantityInPcs || 0), 0);
            } else if (tx.type.includes('Stok Keluar')) {
                dailyData[dateStr].keluar += tx.items.reduce((sum, item) => sum + (item.quantityInPcs || 0), 0);
            }
        }
      }
    });

    setChartData({
      labels: Object.keys(dailyData),
      datasets: [
        { label: 'Stok Masuk (Pcs)', data: Object.values(dailyData).map(d => d.masuk), backgroundColor: 'rgba(75, 192, 192, 0.6)' },
        { label: 'Stok Keluar (Pcs)', data: Object.values(dailyData).map(d => d.keluar), backgroundColor: 'rgba(255, 99, 132, 0.6)' },
      ],
    });
  }, [filteredData.transactions]);

  const totalStockPcs = useMemo(() => {
    return filteredData.stock.reduce((sum, s) => sum + (s.totalStockInPcs || 0), 0);
  }, [filteredData.stock]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: `Aktivitas Gudang 7 Hari Terakhir (${allDepots.find(d => d.id === selectedDepot)?.name || 'Semua Depo'})` },
    },
  };

  return (
    <div className="p-4 sm:p-8 bg-gray-100 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Dasbor Kantor Pusat</h1>
        <div className="form-control w-full md:w-auto mt-4 md:mt-0">
          <select 
            className="select select-bordered" 
            value={selectedDepot} 
            onChange={(e) => setSelectedDepot(e.target.value)}
          >
            <option value="semua">Tampilkan Semua Depo</option>
            {allDepots.map(depot => (
              <option key={depot.id} value={depot.id}>{depot.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Depo Aktif" value={stats.totalDepots} icon="🏢" color="bg-purple-100 text-purple-600" loading={loading} />
        <StatCard title="Total Master Barang" value={stats.totalItems} icon="📦" color="bg-blue-100 text-blue-600" loading={loading} />
        <StatCard title="Total Stok (Pcs)" value={totalStockPcs.toLocaleString('id-ID')} icon="📊" color="bg-green-100 text-green-600" loading={loading} />
      </div>

      <div className="card bg-white shadow-md p-4 mb-8">
        <Bar options={chartOptions} data={chartData} />
      </div>

      <div className="card bg-white shadow-md p-4">
        <h2 className="text-xl font-bold mb-4">Rincian Stok per Barang</h2>
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
              {loading ? (
                <tr><td colSpan="3" className="text-center"><span className="loading loading-dots"></span></td></tr>
              ) : Object.entries(
                  // Mengelompokkan stok berdasarkan nama barang
                  filteredData.stock.reduce((acc, s) => {
                    const itemName = masterItems[s.itemId]?.name || 'Nama Tidak Ditemukan';
                    if (!acc[itemName]) {
                      acc[itemName] = { good: 0, damaged: 0 };
                    }
                    acc[itemName].good += s.totalStockInPcs || 0;
                    acc[itemName].damaged += s.damagedStockInPcs || 0;
                    return acc;
                  }, {})
                ).sort((a,b) => a[0].localeCompare(b[0])) // Urutkan berdasarkan nama barang
                 .map(([name, stock]) => (
                  <tr key={name}>
                    <td className="font-semibold">{name}</td>
                    <td>{stock.good.toLocaleString('id-ID')}</td>
                    <td className="text-red-600">{stock.damaged.toLocaleString('id-ID')}</td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default KantorPusat;
