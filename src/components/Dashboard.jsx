import React, { useState, useEffect } from 'react';
import { ref, onValue, query, orderByChild, startAt } from 'firebase/database';
import { db } from '../firebaseConfig';

// Impor untuk Grafik
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

// Registrasi komponen-komponen Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// --- KOMPONEN KECIL BARU UNTUK KARTU STATISTIK ---
const StatCard = ({ title, value, icon, color }) => (
  <div className={`card bg-white shadow-md p-4 flex flex-row items-center`}>
    <div className={`text-3xl p-3 rounded-lg ${color}`}>
      {icon}
    </div>
    <div className="ml-4">
      <div className="text-gray-500 text-sm font-semibold">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  </div>
);

// --- KOMPONEN KECIL BARU UNTUK ITEM STOK KRITIS ---
const LowStockAlertItem = ({ item, onClick }) => (
    <div onClick={onClick} className="flex justify-between items-center p-2 hover:bg-red-50 rounded-lg cursor-pointer">
        <div>
            <div className="font-bold text-sm text-gray-800">{item.name}</div>
            <div className="text-xs text-gray-500">Sisa: {item.totalStock} Pcs</div>
        </div>
        <div className="font-bold text-red-500 text-sm">
            Stok Kritis
        </div>
    </div>
);

// --- KOMPONEN KECIL UNTUK TOMBOL IKON MENU NAVIGASI ---
const MenuCard = ({ name, icon, onClick, category, colorSchemes }) => {
  const colorClass = colorSchemes[category] || 'text-gray-600';
  // Clone ikon untuk menambahkan kelas warna secara dinamis
  const coloredIcon = React.cloneElement(icon, {
    className: `${icon.props.className} ${colorClass}`
  });

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 aspect-square"
    >
      {coloredIcon}
      <span className="mt-2 text-sm text-center font-medium text-gray-700">{name}</span>
    </button>
  );
};


// --- KOMPONEN KECIL UNTUK GRUP MENU NAVIGASI ---
const MenuGroup = ({ title, items, setPage, Ikon, colorSchemes }) => (
  <div className="mb-8">
    <h2 className="text-xl font-bold text-gray-700 px-4 mb-3">{title}</h2>
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 px-4">
      {items.map(item => (
        <MenuCard
          key={item.page}
          name={item.name}
          icon={item.icon}
          onClick={() => setPage(item.page)}
          category={item.category}
          colorSchemes={colorSchemes}
        />
      ))}
    </div>
  </div>
);
// --- OBJEK LENGKAP UNTUK SEMUA IKON NAVIGASI ---
const Ikon = {
  BuatOrder: () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>),
  ProsesOrder: () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>),
  PengeluaranBarang: () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>),
  BackupRestore: () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M5.293 7.293a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 11.414V15a1 1 0 11-2 0v-3.586L6.293 9.707a1 1 0 010-1.414zM15 19v-5h-5M18.707 16.707a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L14 12.586V9a1 1 0 112 0v3.586l1.707 1.707a1 1 0 010 1.414z" /></svg>),
  ProsesFaktur: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> ),
  StokMasuk: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14 m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3 V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg> ),
  StokKeluar: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16l4-4m0 0l-4-4m4 4H3 m5 4v1a3 3 0 003 3h7a3 3 0 003-3 V7a3 3 0 00-3-3H11a3 3 0 00-3 3v1" /></svg> ),
  Retur: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8 m0 0l3 3m-3-3l3-3" /></svg> ),
  FakturTertunda: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2 h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 5a2 2 0 002 2h2a2 2 0 002-2 m-6 9l2 2 4-4" /></svg> ),
  MasterBarang: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4 s8-1.79 8-4V7 M4 7c0 2.21 3.582 4 8 4 s8-1.79 8-4 M4 7c0-2.21 3.582-4 8-4 s8 1.79 8 4 m0 5c0 2.21-3.582 4-8 4 s-8-1.79-8-4" /></svg> ),
  Supplier: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0z M19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4 a1 1 0 00-1 1v10a1 1 0 001 1h1 m8-1a1 1 0 01-1 1H9m4-1V8 a1 1 0 011-1h2.586a1 1 0 01.707.293 l3.414 3.414a1 1 0 01.293.707V16 a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1 M5 17a2 2 0 104 0m6 0a2 2 0 104 0" /></svg> ),
  Kategori: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586 l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7 A2 2 0 013 8v-3c0-1.1.9-2 2-2z" /></svg> ),
  User: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0z M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> ),
  Depo: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16 m14 0h2m-2 0h-5m-9 0H3m2 0h2M9 7h1m-1 4h1 m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2 a1 1 0 011 1v5m-4 0h4" /></svg> ),
  Alokasi: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.862 12.52 9 11.778 9 11 c0-.778-.138-1.52-.316-2.342m0 4.684 a3 3 0 110-4.684m0 4.684l-3.32-1.405 a2.25 2.25 0 00-2.36 3.664l.515.296 a2.25 2.25 0 002.36 3.664l3.32-1.405z" /></svg> ),
  Laporan: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6 m2 10H7a2 2 0 01-2-2V5 a2 2 0 012-2h5.586a1 1 0 01.707.293 l5.414 5.414a1 1 0 01.293.707V19 a2 2 0 01-2 2z" /></svg> ),
  StockOpname: () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>),
};

// --- SKEMA WARNA UNTUK IKON NAVIGASI ---
const colorSchemes = {
  orderan: 'text-cyan-600',
  operasional: 'text-blue-600',
  master: 'text-green-600',
  admin: 'text-purple-600',
  laporan: 'text-amber-600',
};

// --- DAFTAR LENGKAP MENU NAVIGASI ---
const menuOrderan = [
    { name: 'Buat Order',   icon: <Ikon.BuatOrder />,   page: 'buat-order',               category: 'orderan' },
    { name: 'Proses Order',      icon: <Ikon.ProsesOrder />,page: 'proses-order',             category: 'orderan' },
    { name: 'Faktur Tertunda',   icon: <Ikon.FakturTertunda />,  page: 'faktur-tertunda',          category: 'orderan' },
    { name: 'Proses Faktur',     icon: <Ikon.ProsesFaktur />,    page: 'proses-faktur-tertunda',   category: 'orderan' },
];
  
const menuGudang = [
    { name: 'Stok Masuk',         icon: <Ikon.StokMasuk />,         page: 'stok-masuk',             category: 'operasional' },
    { name: 'Stok Keluar',        icon: <Ikon.StokKeluar />,        page: 'stok-keluar',            category: 'operasional' },
    { name: 'Pengeluaran (Order)',icon: <Ikon.PengeluaranBarang />, page: 'pengeluaran-barang',     category: 'operasional' },
    { name: 'Manajemen Retur',    icon: <Ikon.Retur />,             page: 'manajemen-retur',        category: 'operasional' },
    { name: 'Stock Opname',       icon: <Ikon.StockOpname />,       page: 'stock-opname',           category: 'operasional' },
];

const menuMaster = [
    { name: 'Master Barang', icon: <Ikon.MasterBarang />, page: 'kelola-master-barang', category: 'master' },
    { name: 'Supplier',      icon: <Ikon.Supplier />,      page: 'kelola-supplier',      category: 'master' },
    { name: 'Kategori',      icon: <Ikon.Kategori />,      page: 'kelola-kategori',      category: 'master' }
];

const menuAdmin = [
    { name: 'Pengguna',          icon: <Ikon.User />,            page: 'kelola-pengguna',    category: 'admin' },
    { name: 'Depo',              icon: <Ikon.Depo />,            page: 'kelola-depo',        category: 'admin' },
    { name: 'Alokasi Supplier',  icon: <Ikon.Alokasi />,         page: 'alokasi-supplier',   category: 'admin' },
    { name: 'Backup & Restore',  icon: <Ikon.BackupRestore />,   page: 'backup-restore',     category: 'admin' },
];

const menuReport = [
    { name: 'Laporan', icon: <Ikon.Laporan />, page: 'laporan', category: 'laporan' }
];
function Dashboard({ user, setPage }) {
  // State untuk widget analitik
  const [stats, setStats] = useState({ itemCount: 0, supplierCount: 0, pendingInvoices: 0 });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !user.depotId) return;

    // --- 1. Ambil Data untuk Kartu Statistik & Stok Kritis ---
    const masterItemsRef = ref(db, 'master_items');
    const suppliersRef = ref(db, 'suppliers');
    const stockRef = ref(db, `depots/${user.depotId}/stock`);

    onValue(masterItemsRef, (masterSnapshot) => {
      const masterItems = masterSnapshot.val() || {};
      setStats(prev => ({ ...prev, itemCount: Object.keys(masterItems).length }));
      
      onValue(stockRef, (stockSnapshot) => {
        const stockItems = stockSnapshot.val() || {};
        const criticalItems = [];

        Object.keys(masterItems).forEach(itemId => {
          const item = masterItems[itemId];
          const stock = stockItems[itemId];
          const stockInPcs = stock?.totalStock || 0;
          
          const criticalThreshold = item.conversions?.Dos?.inPcs || 20;
          if (stockInPcs > 0 && stockInPcs < criticalThreshold) {
            criticalItems.push({ id: itemId, name: item.name, totalStock: stockInPcs });
          }
        });
        setLowStockItems(criticalItems);
      });
    });

    onValue(suppliersRef, (snapshot) => {
      setStats(prev => ({ ...prev, supplierCount: Object.keys(snapshot.val() || {}).length }));
    });
    
    // --- 2. Ambil & Proses Data untuk Grafik ---
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).getTime();
    const transQuery = query(ref(db, `depots/${user.depotId}/transactions`), orderByChild('timestamp'), startAt(sevenDaysAgo));
    
    onValue(transQuery, (snapshot) => {
        const transactions = snapshot.val() || {};
        const dailyData = {};

        for (let i = 0; i < 7; i++) {
            const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            const dateString = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
            dailyData[dateString] = { masuk: 0, keluar: 0 };
        }
        
        Object.values(transactions).forEach(trans => {
            const dateString = new Date(trans.timestamp).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
            if (dailyData[dateString]) {
                const totalQty = trans.items.reduce((sum, item) => sum + (item.qtyInPcs || 0), 0);
                if (trans.type === 'Stok Masuk' || trans.type === 'Retur Baik') {
                    dailyData[dateString].masuk += totalQty;
                } else if (trans.type === 'Stok Keluar') {
                    dailyData[dateString].keluar += totalQty;
                }
            }
        });
        
        const labels = Object.keys(dailyData).reverse();
        const dataMasuk = Object.values(dailyData).map(d => d.masuk).reverse();
        const dataKeluar = Object.values(dailyData).map(d => d.keluar).reverse();

        setChartData({
            labels,
            datasets: [
                { label: 'Stok Masuk (Pcs)', data: dataMasuk, backgroundColor: 'rgba(54, 162, 235, 0.7)' },
                { label: 'Stok Keluar (Pcs)', data: dataKeluar, backgroundColor: 'rgba(255, 99, 132, 0.7)' },
            ],
        });
        setLoading(false);
    });

  }, [user]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Aktivitas Gudang 7 Hari Terakhir' },
    },
  };
  
  const isSales = user.role === 'Sales Depo';
  const canAccessMasterData = ['Super Admin', 'Kepala Depo', 'Admin Depo'].includes(user.role);
  const isSuperAdmin = user.role === 'Super Admin';
  
  const accessibleOrderan = menuOrderan.filter(item => {
    if(item.page === 'buat-order') return isSales || isSuperAdmin;
    if(item.page === 'proses-order') return canAccessMasterData;
    return true;
  });

  return (
    <div className="p-4 sm:p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Selamat Datang, {user.fullName}!</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-700 mb-3">Ringkasan Sistem</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Total Master Barang" value={loading ? '...' : stats.itemCount} icon="📦" color="bg-blue-100 text-blue-600" />
            <StatCard title="Total Supplier" value={loading ? '...' : stats.supplierCount} icon="🚚" color="bg-green-100 text-green-600" />
            <StatCard title="Faktur Tertunda" value={loading ? '...' : stats.pendingInvoices} icon="⏳" color="bg-yellow-100 text-yellow-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 card bg-white shadow-md p-4">
            {loading || !chartData ? <div className="text-center p-10">Memuat data grafik...</div> : <Bar options={chartOptions} data={chartData} />}
          </div>
          <div className="card bg-white shadow-md p-4">
            <h3 className="font-bold mb-2 text-gray-700">⚠️ Notifikasi Stok Kritis</h3>
            <div className="space-y-2">
                {loading ? <div className="text-center text-sm">Memuat...</div> 
                : lowStockItems.length === 0 ? <div className="text-center text-sm text-gray-500 p-4">👍 Stok aman.</div>
                : lowStockItems.slice(0, 5).map(item => <LowStockAlertItem key={item.id} item={item} onClick={() => setPage('kelola-master-barang')}/>)}
            </div>
          </div>
      </div>
      
      <div className="mt-10">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Menu Navigasi</h2>
        {accessibleOrderan.length > 0 && <MenuGroup title="Orderan & Faktur" items={accessibleOrderan} setPage={setPage} Ikon={Ikon} colorSchemes={colorSchemes} />}
        <MenuGroup title="Aktivitas Gudang" items={menuGudang} setPage={setPage} Ikon={Ikon} colorSchemes={colorSchemes} />
        {canAccessMasterData && <MenuGroup title="Master Data" items={menuMaster} setPage={setPage} Ikon={Ikon} colorSchemes={colorSchemes} />}
        <MenuGroup title="Laporan" items={menuReport} setPage={setPage} Ikon={Ikon} colorSchemes={colorSchemes} />
        {isSuperAdmin && <MenuGroup title="Konfigurasi & Admin" items={menuAdmin} setPage={setPage} Ikon={Ikon} colorSchemes={colorSchemes} />}
      </div>
    </div>
  );
}

export default Dashboard;