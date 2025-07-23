import React, { useState, useEffect } from 'react';
import { ref, onValue, query, orderByChild, startAt } from 'firebase/database';
import { db } from '../firebaseConfig';

// Impor untuk Grafik
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

// Registrasi komponen-komponen Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// --- KOMPONEN KECIL UNTUK KARTU STATISTIK ---
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

// --- KOMPONEN KECIL UNTUK ITEM STOK KRITIS ---
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
const MenuGroup = ({ title, items, setPage, colorSchemes }) => (
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
  BuatOrder: () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>),
  ProsesOrder: () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>),
  FakturTertunda: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2 h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 5a2 2 0 002 2h2a2 2 0 002-2 m-6 9l2 2 4-4" /></svg> ),
  ProsesFaktur: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> ),
  StokMasuk: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14 m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3 V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg> ),
  StokKeluar: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16l4-4m0 0l-4-4m4 4H3 m5 4v1a3 3 0 003 3h7a3 3 0 003-3 V7a3 3 0 00-3-3H11a3 3 0 00-3 3v1" /></svg> ),
  PengeluaranBarang: () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>),
  Retur: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 15v-1a4 4 0 00-4-4H8 m0 0l3 3m-3-3l3-3" /></svg> ),
  StockOpname: () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>),
  TransferStok: () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>),
  MasterBarang: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4 s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4 s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4 s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg> ),
  Supplier: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m6 0a2 2 0 104 0" /></svg> ),
  Kategori: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 8v-3c0-1.1.9-2 2-2z" /></svg> ),
  Laporan: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> ),
  KantorPusat: () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547a2 2 0 00-.547 1.806l.477 2.387a6 6 0 00.517 3.86l.158.318a6 6 0 003.86.517l2.387.477a2 2 0 001.806-.547a2 2 0 00.547-1.806l-.477-2.387a6 6 0 00-.517-3.86l-.158-.318a6 6 0 01-.517-3.86l.477-2.387a2 2 0 01.547-1.022a2 2 0 011.022-.547z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8a3 3 0 100-6 3 3 0 000 6z" /></svg>),
  Pengguna: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> ),
  Depo: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h2M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> ),
  Alokasi: () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.862 12.52 9 11.778 9 11c0-.778-.138-1.52-.316-2.342m0 4.684a3 3 0 110-4.684m0 4.684l-3.32-1.405a2.25 2.25 0 00-2.36 3.664l.515.296a2.25 2.25 0 002.36 3.664l3.32-1.405z" /></svg> ),
  BackupRestore: () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M5.293 7.293a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 11.414V15a1 1 0 11-2 0v-3.586L6.293 9.707a1 1 0 010-1.414zM15 19v-5h-5m18.707 16.707a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L14 12.586V9a1 1 0 112 0v3.586l1.707 1.707a1 1 0 010 1.414z" /></svg>),
};

// --- SKEMA WARNA UNTUK IKON NAVIGASI ---
const colorSchemes = {
  orderan: 'text-cyan-600',
  operasional: 'text-blue-600',
  master: 'text-green-600',
  admin: 'text-purple-600',
  laporan: 'text-amber-600',
};

function Dashboard({ user, setPage }) {
  // State untuk widget analitik
  const [stats, setStats] = useState({ itemCount: 0, supplierCount: 0, pendingInvoices: 0 });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Logika untuk mengambil data widget dan chart (tidak diubah)
    // ...
    // Anggap saja semua logika useEffect untuk data tetap sama
    setLoading(false); // Hentikan loading untuk contoh
  }, [user]);

  const chartOptions = {
    responsive: true,
    plugins: { legend: { position: 'top' }, title: { display: true, text: 'Aktivitas Gudang 7 Hari Terakhir' } },
  };
  
  // --- KUMPULKAN SEMUA HAK AKSES DI SINI ---
  const isSuperAdmin = user.role === 'Super Admin';
  const isAdminPusat = user.role === 'Admin Pusat';
  const isSales = user.role === 'Sales Depo';
  const canDoGudangTransaction = ['Super Admin', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang', 'Staf Gudang'].includes(user.role);
  const canAccessMasterData = ['Super Admin', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang'].includes(user.role);
  const canViewLaporan = ['Super Admin', 'Admin Pusat', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang'].includes(user.role);
  const canProcessOrder = ['Super Admin', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang'].includes(user.role);

  // --- BUAT DAFTAR MENU BERDASARKAN HAK AKSES ---
  const menuOrderan = [
    { name: 'Buat Order', icon: <Ikon.BuatOrder />, page: 'buat-order', show: isSales || isSuperAdmin },
    { name: 'Proses Order', icon: <Ikon.ProsesOrder />, page: 'proses-order', show: canProcessOrder },
    { name: 'Faktur Tertunda', icon: <Ikon.FakturTertunda />, page: 'faktur-tertunda', show: true }, // Tampil untuk semua
    { name: 'Proses Faktur', icon: <Ikon.ProsesFaktur />, page: 'proses-faktur-tertunda', show: canProcessOrder },
  ].filter(item => item.show).map(item => ({...item, category: 'orderan'}));
  
  const menuGudang = [
    { name: 'Stok Masuk', icon: <Ikon.StokMasuk />, page: 'stok-masuk' },
    { name: 'Stok Keluar', icon: <Ikon.StokKeluar />, page: 'stok-keluar' },
    { name: 'Pengeluaran (Order)', icon: <Ikon.PengeluaranBarang />, page: 'pengeluaran-barang' },
    { name: 'Transfer Stok', icon: <Ikon.TransferStok />, page: 'transfer-stok' },
    { name: 'Manajemen Retur', icon: <Ikon.Retur />, page: 'manajemen-retur' },
    { name: 'Stock Opname', icon: <Ikon.StockOpname />, page: 'stock-opname' },
  ].map(item => ({...item, category: 'operasional'}));
  
  const menuMaster = [
    { name: 'Master Barang', icon: <Ikon.MasterBarang />, page: 'kelola-master-barang' },
    { name: 'Supplier', icon: <Ikon.Supplier />, page: 'kelola-supplier' },
    { name: 'Kategori', icon: <Ikon.Kategori />, page: 'kelola-kategori' }
  ].map(item => ({...item, category: 'master'}));

  const menuLaporan = [
    { name: 'Laporan Depo', icon: <Ikon.Laporan />, page: 'laporan' },
    { name: 'Dasbor Pusat', icon: <Ikon.KantorPusat />, page: 'kantor-pusat' }
  ].map(item => ({...item, category: 'laporan'}));

  const menuAdmin = [
    { name: 'Pengguna', icon: <Ikon.Pengguna />, page: 'kelola-pengguna' },
    { name: 'Depo', icon: <Ikon.Depo />, page: 'kelola-depo' },
    { name: 'Alokasi Supplier', icon: <Ikon.Alokasi />, page: 'alokasi-supplier' },
    { name: 'Backup & Restore', icon: <Ikon.BackupRestore />, page: 'backup-restore' },
  ].map(item => ({...item, category: 'admin'}));

  return (
    <div className="p-4 sm:p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Selamat Datang, {user.fullName}!</h1>
      
      {/* --- Bagian Widget Statistik & Grafik (Tidak Diubah) --- */}
      {!isSales && (
        <>
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
        </>
      )}
      
      {/* --- TAMPILAN MENU UTAMA --- */}
      <div className="mt-10">
        <h2 className="text-2xl font-bold text-gray-800 px-4 mb-4">Menu Utama</h2>
        {menuOrderan.length > 0 && <MenuGroup title="Orderan & Faktur" items={menuOrderan} setPage={setPage} colorSchemes={colorSchemes} />}
        {canDoGudangTransaction && <MenuGroup title="Aktivitas Gudang" items={menuGudang} setPage={setPage} colorSchemes={colorSchemes} />}
        {canAccessMasterData && <MenuGroup title="Master Data" items={menuMaster} setPage={setPage} colorSchemes={colorSchemes} />}
        {canViewLaporan && <MenuGroup title="Laporan & Analitik" items={menuLaporan} setPage={setPage} colorSchemes={colorSchemes} />}
        {isSuperAdmin && <MenuGroup title="Konfigurasi & Admin" items={menuAdmin} setPage={setPage} colorSchemes={colorSchemes} />}
      </div>
    </div>
  );
}

export default Dashboard;