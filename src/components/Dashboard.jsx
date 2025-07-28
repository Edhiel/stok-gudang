import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebaseConfig';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const StatCard = ({ title, value, icon, color }) => ( <div className={`card bg-white shadow-md p-4 flex flex-row items-center`}><div className={`text-3xl p-3 rounded-lg ${color}`}>{icon}</div><div className="ml-4"><div className="text-gray-500 text-sm font-semibold">{title}</div><div className="text-2xl font-bold">{value}</div></div></div> );
const LowStockAlertItem = ({ item, onClick }) => ( <div onClick={onClick} className="flex justify-between items-center p-2 hover:bg-red-50 rounded-lg cursor-pointer"><div><div className="font-bold text-sm text-gray-800">{item.name}</div><div className="text-xs text-gray-500">Sisa: {item.totalStock} Pcs</div></div><div className="font-bold text-red-500 text-sm">Stok Kritis</div></div> );

const MenuModal = ({ title, items, setPage, onClose, colorSchemes }) => {
    const SubMenuCard = ({ name, icon, onClick, category }) => {
        const colorValue = colorSchemes[category] || '#4B5567';
        const coloredIcon = React.cloneElement(icon, { className: 'h-10 w-10', color: colorValue });
        return ( <button onClick={onClick} className="flex flex-col items-center justify-center p-2 text-center bg-gray-50 hover:bg-gray-100 rounded-lg transition-all">{coloredIcon}<span className="mt-2 text-xs font-medium text-gray-700">{name}</span></button> );
    };
    return ( <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"><div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6"><div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">{title}</h3><button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">✕</button></div><div className="grid grid-cols-3 sm:grid-cols-4 gap-4">{items.map(item => ( <SubMenuCard key={item.page} name={item.name} icon={item.icon} onClick={() => { setPage(item.page); onClose(); }} category={item.category} /> ))}</div></div></div> );
};

const MainMenuCard = ({ name, icon, onClick, category, colorSchemes }) => {
    const colorValue = colorSchemes[category] || '#4B5567';
    const coloredIcon = React.cloneElement(icon, { color: colorValue });
    return ( <button onClick={onClick} className="flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 aspect-square">{coloredIcon}<span className="mt-2 text-sm text-center font-medium text-gray-700">{name}</span></button> );
};

const colorSchemes = { orderan: '#0891B2', operasional: '#2563EB', master: '#16A34A', admin: '#9333EA', laporan: '#D97706' };

const Ikon = {
    // --- 1. TAMBAHKAN IKON BARU UNTUK PERINGATAN/ED ---
    Warning: ({ color = 'currentColor' }) => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg> ),
    
    BuatOrder: ({ color = 'currentColor' }) => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>),
    ProsesOrder: ({ color = 'currentColor' }) => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>),
    PengeluaranBarang: ({ color = 'currentColor' }) => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>),
    BackupRestore: ({ color = 'currentColor' }) => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M5.293 7.293a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 11.414V15a1 1 0 11-2 0v-3.586L6.293 9.707a1 1 0 010-1.414zM15 19v-5h-5m18.707 16.707a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L14 12.586V9a1 1 0 112 0v3.586l1.707 1.707a1 1 0 010 1.414z" /></svg>),
    ProsesFaktur: ({ color = 'currentColor' }) => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> ),
    StokMasuk: ({ color = 'currentColor' }) => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14 m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3 V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg> ),
    StokKeluar: ({ color = 'currentColor' }) => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16l4-4m0 0l-4-4m4 4H3 m5 4v1a3 3 0 003 3h7a3 3 0 003-3 V7a3 3 0 00-3-3H11a3 3 0 00-3 3v1" /></svg> ),
    Retur: ({ color = 'currentColor' }) => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 15v-1a4 4 0 00-4-4H8 m0 0l3 3m-3-3l3-3" /></svg> ),
    FakturTertunda: ({ color = 'currentColor' }) => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2 h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 5a2 2 0 002 2h2a2 2 0 002-2 m-6 9l2 2 4-4" /></svg> ),
    MasterBarang: ({ color = 'currentColor' }) => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4 s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4 s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4 s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg> ),
    Supplier: ({ color = 'currentColor' }) => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m6 0a2 2 0 104 0" /></svg> ),
    Kategori: ({ color = 'currentColor' }) => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 8v-3c0-1.1.9-2 2-2z" /></svg> ),
    User: ({ color = 'currentColor' }) => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> ),
    Depo: ({ color = 'currentColor' }) => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h2M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> ),
    Alokasi: ({ color = 'currentColor' }) => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.862 12.52 9 11.778 9 11c0-.778-.138-1.52-.316-2.342m0 4.684a3 3 0 110-4.684m0 4.684l-3.32-1.405a2.25 2.25 0 00-2.36 3.664l.515.296a2.25 2.25 0 002.36 3.664l3.32-1.405z" /></svg> ),
    Laporan: ({ color = 'currentColor' }) => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> ),
    StockOpname: ({ color = 'currentColor' }) => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>),
    TransferStok: ({ color = 'currentColor' }) => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>),
    KantorPusat: ({ color = 'currentColor' }) => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h6.75M9 11.25h6.75M9 15.75h6.75" /></svg>),
    Toko: ({ color = 'currentColor' }) => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.25a.75.75 0 01-.75-.75v-7.5a.75.75 0 01.75-.75h1.5m1.5 0V3.75c0-1.621.808-3 2.25-3h3.75c1.442 0 2.25 1.379 2.25 3V12m-1.5 0h-9" /></svg> ),
    Lokasi: ({ color = 'currentColor' }) => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg> ),
};

function Dashboard({ user, setPage }) {
  const [stats, setStats] = useState({ itemCount: 0, supplierCount: 0, pendingInvoices: 0 });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', items: [] });

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    // Di sini Anda bisa mengisi kembali logika untuk mengambil data statistik,
    // stok kritis, dan data chart seperti di versi sebelumnya.
    setLoading(false);
  }, [user]);

  const chartOptions = { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Aktivitas Gudang 7 Hari Terakhir' } } };

  const isSuperAdmin = user.role === 'Super Admin';
  const isAdminPusat = user.role === 'Admin Pusat';
  const isSales = user.role === 'Sales Depo';
  const canDoGudangTransaction = ['Super Admin', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang', 'Staf Gudang'].includes(user.role);
  const canAccessMasterData = ['Super Admin', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang'].includes(user.role);
  const canViewLaporan = ['Super Admin', 'Admin Pusat', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang'].includes(user.role);
  const canProcessOrder = ['Super Admin', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang'].includes(user.role);
  
  const menuOrderan = [
    { name: 'Buat Order', icon: <Ikon.BuatOrder />, page: 'buat-order', show: isSales || isSuperAdmin },
    { name: 'Proses Order', icon: <Ikon.ProsesOrder />, page: 'proses-order', show: canProcessOrder },
    { name: 'Faktur Tertunda', icon: <Ikon.FakturTertunda />, page: 'faktur-tertunda', show: true },
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
    { name: 'Toko / Pelanggan', icon: <Ikon.Toko />, page: 'kelola-toko' },
    { name: 'Supplier', icon: <Ikon.Supplier />, page: 'kelola-supplier' },
    { name: 'Kategori', icon: <Ikon.Kategori />, page: 'kelola-kategori' }
  ].map(item => ({...item, category: 'master'}));
  
  // --- 2. MODIFIKASI MENU LAPORAN ---
  const menuLaporan = [
    { name: 'Laporan Depo', icon: <Ikon.Laporan />, page: 'laporan' },
    { name: 'Laporan ED', icon: <Ikon.Warning />, page: 'laporan-kedaluwarsa' }, // <-- MENU BARU DITAMBAHKAN
    { name: 'Dasbor Pusat', icon: <Ikon.KantorPusat />, page: 'kantor-pusat', show: isSuperAdmin || isAdminPusat }
  ].filter(item => typeof item.show === 'undefined' || item.show === true).map(item => ({...item, category: 'laporan'}));

  const menuAdmin = [
    { name: 'Pengguna', icon: <Ikon.User />, page: 'kelola-pengguna' },
    { name: 'Depo', icon: <Ikon.Depo />, page: 'kelola-depo' },
    { name: 'Lokasi Gudang', icon: <Ikon.Lokasi />, page: 'kelola-lokasi' },
    { name: 'Alokasi Supplier', icon: <Ikon.Alokasi />, page: 'alokasi-supplier' },
    { name: 'Backup & Restore', icon: <Ikon.BackupRestore />, page: 'backup-restore' },
  ].map(item => ({...item, category: 'admin'}));

  const mainMenu = [
    { title: "Orderan & Faktur", icon: <Ikon.ProsesOrder />, items: menuOrderan, show: menuOrderan.length > 0 },
    { title: "Aktivitas Gudang", icon: <Ikon.StokMasuk />, items: menuGudang, show: canDoGudangTransaction },
    { title: "Master Data", icon: <Ikon.MasterBarang />, items: menuMaster, show: canAccessMasterData },
    { title: "Laporan & Analitik", icon: <Ikon.Laporan />, items: menuLaporan, show: canViewLaporan },
    { title: "Konfigurasi & Admin", icon: <Ikon.User />, items: menuAdmin, show: isSuperAdmin }
  ].filter(menu => menu.show);

  const handleOpenMenu = (menu) => {
    setModalContent({ title: menu.title, items: menu.items });
    setIsMenuModalOpen(true);
  };

  return (
    <>
      {isMenuModalOpen && ( <MenuModal title={modalContent.title} items={modalContent.items} setPage={setPage} onClose={() => setIsMenuModalOpen(false)} colorSchemes={colorSchemes} /> )}
      <div className="p-4 sm:p-6 bg-gray-100 min-h-screen">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Selamat Datang, {user.fullName}!</h1>
        {!isSales && (
            <>
              <div className="mb-8"><h2 className="text-xl font-semibold text-gray-700 mb-3">Ringkasan Sistem</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><StatCard title="Total Master Barang" value={loading ? '...' : stats.itemCount} icon="📦" color="bg-blue-100 text-blue-600" /><StatCard title="Total Supplier" value={loading ? '...' : stats.supplierCount} icon="🚚" color="bg-green-100 text-green-600" /><StatCard title="Faktur Tertunda" value={loading ? '...' : stats.pendingInvoices} icon="⏳" color="bg-yellow-100 text-yellow-600" /></div></div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8"><div className="lg-col-span-2 card bg-white shadow-md p-4">{loading || !chartData ? <div className="text-center p-10">Memuat data grafik...</div> : <Bar options={chartOptions} data={chartData} />}</div><div className="card bg-white shadow-md p-4"><h3 className="font-bold mb-2 text-gray-700">⚠️ Notifikasi Stok Kritis</h3><div className="space-y-2">{loading ? <div className="text-center text-sm">Memuat...</div> : lowStockItems.length === 0 ? <div className="text-center text-sm text-gray-500 p-4">👍 Stok aman.</div> : lowStockItems.slice(0, 5).map(item => <LowStockAlertItem key={item.id} item={item} onClick={() => setPage('kelola-master-barang')}/>)}</div></div></div>
            </>
        )}
        <div className="mt-10">
          <h2 className="text-2xl font-bold text-gray-800 px-4 mb-4">Menu Utama</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 px-4">
            {mainMenu.map(menu => ( <MainMenuCard key={menu.title} name={menu.title} icon={menu.icon} onClick={() => handleOpenMenu(menu)} category={menu.items[0]?.category || 'admin'} colorSchemes={colorSchemes} /> ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default Dashboard;
