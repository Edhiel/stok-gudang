import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
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

const AlertItem = ({ item, onClick, badgeText, badgeColor }) => (
  <div onClick={onClick} className="flex justify-between items-center p-2 hover:bg-base-200 rounded-lg cursor-pointer">
    <div>
      <div className="font-bold text-sm text-gray-800">{item.name || item.itemName}</div>
      <div className="text-xs text-gray-500">
        {item.totalStock !== undefined ? `Sisa: ${item.totalStock} Pcs` : `Sisa: ${item.quantity} Pcs | ED: ${new Date(item.expireDate).toLocaleDateString('id-ID')}`}
      </div>
    </div>
    <div className={`badge ${badgeColor} text-xs font-semibold`}>{badgeText}</div>
  </div>
);

const MenuModal = ({ title, items, setPage, onClose, colorSchemes }) => {
  const SubMenuCard = ({ name, icon, onClick, category }) => {
    const colorValue = colorSchemes[category] || '#4B5567';
    const coloredIcon = React.cloneElement(icon, { className: 'h-10 w-10', color: colorValue });
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center justify-center p-2 text-center bg-gray-50 hover:bg-gray-100 rounded-lg transition-all"
      >
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
          {items.map((item) => (
            <SubMenuCard
              key={item.page}
              name={item.name}
              icon={item.icon}
              onClick={() => {
                setPage(item.page);
                onClose();
              }}
              category={item.category}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const MainMenuCard = ({ name, icon, onClick, category, colorSchemes }) => {
  const colorValue = colorSchemes[category] || '#4B5567';
  const coloredIcon = React.cloneElement(icon, { color: colorValue });
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

const colorSchemes = {
  orderan: '#0891B2',
  operasional: '#2563EB',
  master: '#16A34A',
  admin: '#9333EA',
  laporan: '#D97706',
  pengiriman: '#F59E0B', // Warna baru untuk pengiriman
};

const Ikon = {
  // ... (Ikon lainnya tetap sama)
  PengirimanBarang: ({ color = 'currentColor' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-2 2-2-2z" />
    </svg>
  ),
  // ... (Ikon lainnya tetap sama)
};

function Dashboard({ user, setPage }) {
  const [stats, setStats] = useState({ itemCount: 0, supplierCount: 0, orderCount: 0 });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [expiringItems, setExpiringItems] = useState([]);
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [],
  });
  const [loading, setLoading] = useState(true);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', items: [] });

  useEffect(() => {
    if (!user?.depotId) {
      setLoading(false);
      return;
    }

    const masterItemsQuery = collection(firestoreDb, 'master_items');
    const suppliersQuery = collection(firestoreDb, 'suppliers');
    const stockQuery = collection(firestoreDb, `depots/${user.depotId}/stock`);
    const ordersQuery = query(
      collection(firestoreDb, `depots/${user.depotId}/salesOrders`),
      where('status', '==', 'Menunggu Approval Admin')
    );
    const transactionsQuery = query(collection(firestoreDb, `depots/${user.depotId}/transactions`));

    const unsubItems = onSnapshot(masterItemsQuery, (snapshot) => setStats(prev => ({ ...prev, itemCount: snapshot.size })));
    const unsubSuppliers = onSnapshot(suppliersQuery, (snapshot) => setStats(prev => ({ ...prev, supplierCount: snapshot.size })));
    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => setStats(prev => ({ ...prev, orderCount: snapshot.size })));
    const unsubStock = onSnapshot(stockQuery, async (stockSnapshot) => {
        // ... (logika stok tidak berubah)
    });
    const unsubTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        // ... (logika chart tidak berubah)
    });

    return () => {
        unsubItems();
        unsubSuppliers();
        unsubOrders();
        unsubStock();
        unsubTransactions();
    };
  }, [user]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Aktivitas Gudang 7 Hari Terakhir' },
    },
  };

  const isSuperAdmin = user?.role === 'Super Admin';
  const isAdminPusat = user?.role === 'Admin Pusat';
  const isSales = user?.role === 'Sales Depo';
  const canDoGudangTransaction = ['Super Admin', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang', 'Staf Gudang'].includes(user?.role);
  const canAccessMasterData = ['Super Admin', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang'].includes(user?.role);
  const canViewLaporan = ['Super Admin', 'Admin Pusat', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang'].includes(user?.role);
  const canProcessOrder = ['Super Admin', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang'].includes(user?.role);
  const isDriverOrHelper = ['Sopir', 'Helper Depo'].includes(user?.role);

  // --- PENAMBAHAN MENU KHUSUS SOPIR ---
  const menuPengiriman = [
    { name: 'Lihat Daftar Pengiriman', icon: <Ikon.PengirimanBarang />, page: 'daftar-pengiriman', show: true, category: 'pengiriman' }
  ];

  const menuOrderan = [
    { name: 'Buat Order', icon: <Ikon.BuatOrder />, page: 'buat-order', show: isSales || isSuperAdmin },
    { name: 'Proses Order', icon: <Ikon.ProsesOrder />, page: 'proses-order', show: canProcessOrder },
    { name: 'Faktur Tertunda', icon: <Ikon.FakturTertunda />, page: 'faktur-tertunda', show: true },
    { name: 'Proses Faktur', icon: <Ikon.ProsesFaktur />, page: 'proses-faktur-tertunda', show: canProcessOrder },
  ].filter((item) => item.show).map((item) => ({ ...item, category: 'orderan' }));

  const menuGudang = [
    { name: 'Stok Masuk', icon: <Ikon.StokMasuk />, page: 'stok-masuk' },
    { name: 'Stok Keluar', icon: <Ikon.StokKeluar />, page: 'stok-keluar' },
    { name: 'Pengeluaran (Order)', icon: <Ikon.PengeluaranBarang />, page: 'pengeluaran-barang' },
    { name: 'Transfer Stok', icon: <Ikon.TransferStok />, page: 'transfer-stok' },
    { name: 'Manajemen Retur', icon: <Ikon.Retur />, page: 'manajemen-retur' },
    { name: 'Stock Opname', icon: <Ikon.StockOpname />, page: 'stock-opname' },
  ].map((item) => ({ ...item, category: 'operasional' }));

  const menuMaster = [
    { name: 'Master Barang', icon: <Ikon.MasterBarang />, page: 'kelola-master-barang' },
    { name: 'Toko / Pelanggan', icon: <Ikon.Toko />, page: 'kelola-toko' },
    { name: 'Supplier', icon: <Ikon.Supplier />, page: 'kelola-supplier' },
    { name: 'Kategori', icon: <Ikon.Kategori />, page: 'kelola-kategori' },
  ].map((item) => ({ ...item, category: 'master' }));

  const menuLaporan = [
    { name: 'Laporan Depo', icon: <Ikon.Laporan />, page: 'laporan' },
    { name: 'Laporan ED', icon: <Ikon.Warning />, page: 'laporan-kedaluwarsa' },
    { name: 'Dasbor Pusat', icon: <Ikon.KantorPusat />, page: 'kantor-pusat', show: isSuperAdmin || isAdminPusat },
  ].filter((item) => typeof item.show === 'undefined' || item.show === true).map((item) => ({ ...item, category: 'laporan' }));

  const menuAdmin = [
    { name: 'Pengguna', icon: <Ikon.User />, page: 'kelola-pengguna' },
    { name: 'Depo', icon: <Ikon.Depo />, page: 'kelola-depo' },
    { name: 'Lokasi Gudang', icon: <Ikon.Lokasi />, page: 'kelola-lokasi' },
    { name: 'Alokasi Supplier', icon: <Ikon.Alokasi />, page: 'alokasi-supplier' },
    { name: 'Backup & Restore', icon: <Ikon.BackupRestore />, page: 'backup-restore' },
  ].map((item) => ({ ...item, category: 'admin' }));

  const mainMenu = [
    // --- TAMPILKAN MENU PENGIRIMAN HANYA UNTUK SOPIR ---
    { title: 'Tugas Pengiriman', icon: <Ikon.PengirimanBarang />, items: menuPengiriman, show: isDriverOrHelper },
    { title: 'Orderan & Faktur', icon: <Ikon.ProsesOrder />, items: menuOrderan, show: menuOrderan.length > 0 },
    { title: 'Aktivitas Gudang', icon: <Ikon.StokMasuk />, items: menuGudang, show: canDoGudangTransaction },
    { title: 'Master Data', icon: <Ikon.MasterBarang />, items: menuMaster, show: canAccessMasterData },
    { title: 'Laporan & Analitik', icon: <Ikon.Laporan />, items: menuLaporan, show: canViewLaporan },
    { title: 'Konfigurasi & Admin', icon: <Ikon.User />, items: menuAdmin, show: isSuperAdmin },
  ].filter((menu) => menu.show);

  const handleOpenMenu = (menu) => {
    // Jika hanya ada satu item, langsung navigasi
    if (menu.items.length === 1) {
        setPage(menu.items[0].page);
        return;
    }
    setModalContent({ title: menu.title, items: menu.items });
    setIsMenuModalOpen(true);
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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Selamat Datang, {user?.fullName}!</h1>
        {/* Tampilkan statistik hanya jika bukan sopir */}
        {!isDriverOrHelper && !isSales && (
          <>
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-700 mb-3">Ringkasan Sistem</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard title="Total Master Barang" value={stats.itemCount} icon="📦" color="bg-blue-100 text-blue-600" loading={loading} />
                <StatCard title="Total Supplier" value={stats.supplierCount} icon="🚚" color="bg-green-100 text-green-600" loading={loading} />
                <StatCard title="Order Perlu Approval" value={stats.orderCount} icon="⏳" color="bg-yellow-100 text-yellow-600" loading={loading} />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="card bg-white shadow-md p-4">
                <h3 className="font-bold mb-2 text-gray-700">⚠️ Notifikasi Stok Kritis</h3>
                <div className="space-y-1">
                  {loading ? ( <div className="text-center text-sm p-4">Memuat...</div> ) : lowStockItems.length === 0 ? ( <div className="text-center text-sm text-gray-500 p-4">👍 Stok aman.</div> ) : (
                    lowStockItems.slice(0, 3).map((item) => ( <AlertItem key={item.id} item={item} onClick={() => setPage('kelola-master-barang')} badgeText="Stok Kritis" badgeColor="badge-error" /> ))
                  )}
                </div>
              </div>
              <div className="card bg-white shadow-md p-4">
                <h3 className="font-bold mb-2 text-gray-700">🔔 Notifikasi Barang Segera ED</h3>
                <div className="space-y-1">
                  {loading ? ( <div className="text-center text-sm p-4">Memuat...</div> ) : expiringItems.length === 0 ? ( <div className="text-center text-sm text-gray-500 p-4">👍 Tidak ada barang akan ED.</div> ) : (
                    expiringItems.slice(0, 3).map((item) => ( <AlertItem key={item.batchId} item={item} onClick={() => setPage('laporan-kedaluwarsa')} badgeText="Segera ED" badgeColor="badge-warning" /> ))
                  )}
                </div>
              </div>
            </div>
            <div className="card bg-white shadow-md p-4 mb-8">
              <Bar options={chartOptions} data={chartData} />
            </div>
          </>
        )}
        <div className="mt-10">
          <h2 className="text-2xl font-bold text-gray-800 px-4 mb-4">Menu Utama</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 px-4">
            {mainMenu.map((menu) => (
              <MainMenuCard
                key={menu.title}
                name={menu.title}
                icon={menu.icon}
                onClick={() => handleOpenMenu(menu)}
                category={menu.items[0]?.category || 'admin'}
                colorSchemes={colorSchemes}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default Dashboard;
