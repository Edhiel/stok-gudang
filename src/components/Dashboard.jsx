import React, { useState, useEffect } from 'react';
import { ref, onValue, query, orderByChild, startAt } from 'firebase/database';
import { db } from '../firebaseConfig';

import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// --- KOMPONEN KECIL (TIDAK BERUBAH) ---
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

// --- KOMPONEN BARU: MODAL UNTUK MENAMPILKAN SUB-MENU ---
const MenuModal = ({ title, items, setPage, onClose, colorSchemes }) => {
    // Komponen kecil untuk ikon di dalam modal
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
                            onClick={() => {
                                setPage(item.page);
                                onClose(); // Tutup modal setelah diklik
                            }}
                            category={item.category}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};


// --- IKON & SKEMA WARNA (TIDAK BERUBAH) ---
const Ikon = { /* ...isi semua ikon SVG Anda di sini, sama seperti sebelumnya... */ };
const colorSchemes = { /* ...isi skema warna Anda di sini, sama seperti sebelumnya... */ };


function Dashboard({ user, setPage }) {
  // --- SEMUA STATE DAN LOGIKA useEffect (TIDAK BERUBAH) ---
  const [stats, setStats] = useState({ itemCount: 0, supplierCount: 0, pendingInvoices: 0 });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', items: [] });

  useEffect(() => {
    // ...semua logika useEffect Anda untuk mengambil data tetap di sini...
    setLoading(false);
  }, [user]);

  const chartOptions = { /* ...opsi chart tidak berubah... */ };

  // --- KUMPULAN HAK AKSES & DEFINISI MENU (TIDAK BERUBAH) ---
  const isSuperAdmin = user.role === 'Super Admin';
  // ...definisi hak akses lainnya...
  const menuOrderan = [ /* ...definisi menuOrderan... */ ].filter(item => item.show).map(item => ({...item, category: 'orderan'}));
  const menuGudang = [ /* ...definisi menuGudang... */ ].map(item => ({...item, category: 'operasional'}));
  const menuMaster = [ /* ...definisi menuMaster... */ ].map(item => ({...item, category: 'master'}));
  const menuLaporan = [ /* ...definisi menuLaporan... */ ].map(item => ({...item, category: 'laporan'}));
  const menuAdmin = [ /* ...definisi menuAdmin... */ ].map(item => ({...item, category: 'admin'}));

  
  // --- KUMPULAN MENU UTAMA UNTUK TAMPILAN RINGKAS ---
  const mainMenu = [
    { title: "Orderan & Faktur", icon: <Ikon.ProsesOrder />, items: menuOrderan, show: menuOrderan.length > 0 },
    { title: "Aktivitas Gudang", icon: <Ikon.StokMasuk />, items: menuGudang, show: canDoGudangTransaction },
    { title: "Master Data", icon: <Ikon.MasterBarang />, items: menuMaster, show: canAccessMasterData },
    { title: "Laporan & Analitik", icon: <Ikon.Laporan />, items: menuLaporan, show: canViewLaporan },
    { title: "Konfigurasi & Admin", icon: <Ikon.Pengguna />, items: menuAdmin, show: isSuperAdmin }
  ].filter(menu => menu.show);


  const handleOpenMenu = (menu) => {
    setModalContent({ title: menu.title, items: menu.items });
    setIsMenuModalOpen(true);
  };


  return (
    <>
      {/* --- Tampilan Modal (akan muncul saat state-nya aktif) --- */}
      {isMenuModalOpen && (
        <MenuModal
          title={modalContent.title}
          items={modalContent.items}
          setPage={setPage}
          onClose={() => setIsMenuModalOpen(false)}
          colorSchemes={colorSchemes}
        />
      )}

      {/* --- Tampilan Dashboard Utama --- */}
      <div className="p-4 sm:p-6 bg-gray-100 min-h-screen">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Selamat Datang, {user.fullName}!</h1>
        
        {/* --- Bagian Widget & Grafik (Sama seperti sebelumnya) --- */}
        {!isSales && (
            <>
                {/* ...kode widget statistik dan grafik Anda di sini... */}
            </>
        )}
        
        {/* --- TAMPILAN MENU UTAMA YANG RINGKAS --- */}
        <div className="mt-10">
          <h2 className="text-2xl font-bold text-gray-800 px-4 mb-4">Menu Utama</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 px-4">
            {mainMenu.map(menu => (
              <MenuCard
                key={menu.title}
                name={menu.title}
                icon={menu.icon}
                onClick={() => handleOpenMenu(menu)}
                category={menu.items[0].category} // Ambil kategori dari item pertama
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