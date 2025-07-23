import React, { useState, useEffect } from 'react';
import { ref, onValue, query, orderByChild, startAt } from 'firebase/database';
import { db } from '../firebaseConfig';

import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// --- KOMPONEN KECIL (Helper Components) ---
// Komponen-komponen ini tidak bergantung pada data 'user', jadi aman diletakkan di luar.
const StatCard = ({ title, value, icon, color }) => (
  <div className={`card bg-white shadow-md p-4 flex flex-row items-center`}>
    <div className={`text-3xl p-3 rounded-lg ${color}`}>{icon}</div>
    <div className="ml-4">
      <div className="text-gray-500 text-sm font-semibold">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  </div>
);
const LowStockAlertItem = ({ item, onClick }) => (
    <div onClick={onClick} className="flex justify-between items-center p-2 hover:bg-red-50 rounded-lg cursor-pointer">
        <div>
            <div className="font-bold text-sm text-gray-800">{item.name}</div>
            <div className="text-xs text-gray-500">Sisa: {item.totalStock} Pcs</div>
        </div>
        <div className="font-bold text-red-500 text-sm">Stok Kritis</div>
    </div>
);
const MenuModal = ({ title, items, setPage, onClose, colorSchemes }) => {
    const SubMenuCard = ({ name, icon, onClick, category }) => {
        const colorClass = colorSchemes[category] || 'text-gray-600';
        const coloredIcon = React.cloneElement(icon, { className: `h-10 w-10 ${colorClass}` });
        return (
            <button onClick={onClick} className="flex flex-col items-center justify-center p-2 text-center bg-gray-50 hover:bg-gray-100 rounded-lg transition-all">
                {coloredIcon}
                <span className="mt-2 text-xs font-medium text-gray-700">{name}</span>
            </button>
        );
    };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">{title}</h3>
                    <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">✕</button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                    {items.map(item => (
                        <SubMenuCard
                            key={item.page}
                            name={item.name}
                            icon={item.icon}
                            onClick={() => { setPage(item.page); onClose(); }}
                            category={item.category}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- Objek Ikon & Skema Warna (Bisa di luar karena tidak bergantung 'user') ---
const Ikon = { /* ... Salin SEMUA ikon SVG Anda dari file sebelumnya ke sini ... */ };
const colorSchemes = { /* ... Salin skema warna Anda dari file sebelumnya ke sini ... */ };


// --- KOMPONEN UTAMA DASHBOARD ---
function Dashboard({ user, setPage }) {
  // State
  const [stats, setStats] = useState({ itemCount: 0, supplierCount: 0, pendingInvoices: 0 });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', items: [] });

  // useEffect untuk mengambil data...
  useEffect(() => {
    // ...semua logika useEffect Anda untuk mengambil data tetap di sini...
    setLoading(false);
  }, [user]);

  const chartOptions = { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Aktivitas Gudang 7 Hari Terakhir' } } };

  // ==================================================================
  // === BLOK YANG DIPINDAHKAN - SEKARANG BERADA DI DALAM KOMPONEN ===
  // ==================================================================
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
    { name: 'Supplier', icon: <Ikon.Supplier />, page: 'kelola-supplier' },
    { name: 'Kategori', icon: <Ikon.Kategori />, page: 'kelola-kategori' }
  ].map(item => ({...item, category: 'master'}));

  const menuLaporan = [
    { name: 'Laporan Depo', icon: <Ikon.Laporan />, page: 'laporan' },
    { name: 'Dasbor Pusat', icon: <Ikon.KantorPusat />, page: 'kantor-pusat', show: isSuperAdmin || isAdminPusat }
  ].filter(item => item.show !== false).map(item => ({...item, category: 'laporan'}));

  const menuAdmin = [
    { name: 'Pengguna', icon: <Ikon.Pengguna />, page: 'kelola-pengguna' },
    { name: 'Depo', icon: <Ikon.Depo />, page: 'kelola-depo' },
    { name: 'Alokasi Supplier', icon: <Ikon.Alokasi />, page: 'alokasi-supplier' },
    { name: 'Backup & Restore', icon: <Ikon.BackupRestore />, page: 'backup-restore' },
  ].map(item => ({...item, category: 'admin'}));

  const mainMenu = [
    { title: "Orderan & Faktur", icon: <Ikon.ProsesOrder />, items: menuOrderan, show: menuOrderan.length > 0 },
    { title: "Aktivitas Gudang", icon: <Ikon.StokMasuk />, items: menuGudang, show: canDoGudangTransaction },
    { title: "Master Data", icon: <Ikon.MasterBarang />, items: menuMaster, show: canAccessMasterData },
    { title: "Laporan & Analitik", icon: <Ikon.Laporan />, items: menuLaporan, show: canViewLaporan },
    { title: "Konfigurasi & Admin", icon: <Ikon.Pengguna />, items: menuAdmin, show: isSuperAdmin }
  ].filter(menu => menu.show);
  // ==================================================================
  // === AKHIR DARI BLOK YANG DIPINDAHKAN ===
  // ==================================================================

  const handleOpenMenu = (menu) => {
    setModalContent({ title: menu.title, items: menu.items });
    setIsMenuModalOpen(true);
  };
  
  // Komponen kecil untuk ikon menu utama yang besar
  const MainMenuCard = ({ name, icon, onClick, category }) => {
    const colorClass = colorSchemes[category] || 'text-gray-600';
    const coloredIcon = React.cloneElement(icon, { className: `h-8 w-8 sm:h-12 sm:w-12 ${colorClass}` });
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

  return (
    <>
      {isMenuModalOpen && (
        <MenuModal
          title={modalContent.title}
          items={modalContent.items}
          setPage={setPage}
          onClose={() => setIsMenuModalOpen(false)}
          colorSchemes={colorSchemes}
        />
      )}

      <div className="p-4 sm:p-6 bg-gray-100 min-h-screen">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Selamat Datang, {user.fullName}!</h1>
        
        {!isSales && (
            <>
              {/* Widget Statistik & Grafik */}
            </>
        )}
        
        <div className="mt-10">
          <h2 className="text-2xl font-bold text-gray-800 px-4 mb-4">Menu Utama</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 px-4">
            {mainMenu.map(menu => (
              <MainMenuCard
                key={menu.title}
                name={menu.title}
                icon={menu.icon}
                onClick={() => handleOpenMenu(menu)}
                category={menu.items[0]?.category || 'admin'} // Ambil kategori dari item pertama
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default Dashboard;