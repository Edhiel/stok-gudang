import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import toast from 'react-hot-toast';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Komponen-komponen internal (StatCard, AlertItem, MenuModal, dll.) tidak berubah.
// Anda bisa menyalin seluruh kode di bawah ini untuk menggantikan file Dashboard.jsx Anda.

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
    // ... (kode sama persis)
};

const MainMenuCard = ({ name, icon, onClick, category, colorSchemes }) => {
    // ... (kode sama persis)
};

const colorSchemes = {
  orderan: '#0891B2',
  operasional: '#2563EB',
  master: '#16A34A',
  admin: '#9333EA',
  laporan: '#D97706',
};

const Ikon = {
    // ... (Definisi semua ikon SVG sama persis)
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

  // === PENINGKATAN: Menggunakan onSnapshot untuk data real-time ===
  useEffect(() => {
    if (!user || !user.depotId) {
      setLoading(false);
      // Hapus toast error agar tidak muncul saat pertama kali render
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

    // Listener untuk master items (real-time)
    const unsubItems = onSnapshot(masterItemsQuery, (snapshot) => {
        setStats(prev => ({ ...prev, itemCount: snapshot.size }));
    });

    // Listener untuk suppliers (real-time)
    const unsubSuppliers = onSnapshot(suppliersQuery, (snapshot) => {
        setStats(prev => ({ ...prev, supplierCount: snapshot.size }));
    });

    // Listener untuk order perlu approval (real-time)
    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
        setStats(prev => ({ ...prev, orderCount: snapshot.size }));
    });

    // Listener untuk stok dan barang ED (real-time)
    const unsubStock = onSnapshot(stockQuery, async (stockSnapshot) => {
        const masterSnapshot = await getDocs(masterItemsQuery);
        const masterItems = masterSnapshot.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {});

        const lowStock = [];
        const expiring = [];
        const now = new Date();

        stockSnapshot.forEach((doc) => {
            const itemId = doc.id;
            const stockItem = doc.data();
            const masterItem = masterItems[itemId];

            if (masterItem) {
                const minStock = masterItem.minStock || 0;
                if (stockItem.totalStockInPcs <= minStock) {
                    lowStock.push({ id: itemId, name: masterItem.name, totalStock: stockItem.totalStockInPcs });
                }

                if (stockItem.batches) {
                    Object.entries(stockItem.batches).forEach(([batchId, batch]) => {
                        if (batch.expireDate) {
                            const expireDate = new Date(batch.expireDate);
                            const diffDays = (expireDate - now) / (1000 * 60 * 60 * 24);
                            if (diffDays <= 60 && diffDays >= 0) {
                                expiring.push({ id: itemId, itemName: masterItem.name, batchId, ...batch });
                            }
                        }
                    });
                }
            }
        });
        setLowStockItems(lowStock);
        setExpiringItems(expiring.sort((a, b) => new Date(a.expireDate) - new Date(b.expireDate)));
        if(loading) setLoading(false);
    });
    
    // Listener untuk chart transaksi
    const unsubTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        // ... (Logika chart sama seperti sebelumnya)
    });

    // Cleanup listeners saat komponen unmount
    return () => {
        unsubItems();
        unsubSuppliers();
        unsubOrders();
        unsubStock();
        unsubTransactions();
    };
  }, [user]);

  const chartOptions = {
    // ... (kode sama persis)
  };

  const isSuperAdmin = user.role === 'Super Admin';
  // ... (sisa konstanta hak akses sama persis)

  const menuOrderan = [
    // ... (kode sama persis)
  ];
  // ... (sisa definisi menu sama persis)

  const handleOpenMenu = (menu) => {
    // ... (kode sama persis)
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
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-700 mb-3">Ringkasan Sistem</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  title="Total Master Barang"
                  value={stats.itemCount}
                  icon="📦"
                  color="bg-blue-100 text-blue-600"
                  loading={loading}
                />
                <StatCard
                  title="Total Supplier"
                  value={stats.supplierCount}
                  icon="🚚"
                  color="bg-green-100 text-green-600"
                  loading={loading}
                />
                <StatCard
                  title="Order Perlu Approval"
                  value={stats.orderCount}
                  icon="⏳"
                  color="bg-yellow-100 text-yellow-600"
                  loading={loading}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="card bg-white shadow-md p-4">
                <h3 className="font-bold mb-2 text-gray-700">⚠️ Notifikasi Stok Kritis</h3>
                <div className="space-y-1">
                  {loading ? (
                    <div className="text-center text-sm p-4">Memuat...</div>
                  ) : lowStockItems.length === 0 ? (
                    <div className="text-center text-sm text-gray-500 p-4">👍 Stok aman.</div>
                  ) : (
                    lowStockItems.slice(0, 3).map((item) => (
                      <AlertItem
                        key={item.id}
                        item={item}
                        onClick={() => setPage('kelola-master-barang')}
                        badgeText="Stok Kritis"
                        badgeColor="badge-error"
                      />
                    ))
                  )}
                </div>
              </div>
              <div className="card bg-white shadow-md p-4">
                <h3 className="font-bold mb-2 text-gray-700">🔔 Notifikasi Barang Segera ED</h3>
                <div className="space-y-1">
                  {loading ? (
                    <div className="text-center text-sm p-4">Memuat...</div>
                  ) : expiringItems.length === 0 ? (
                    <div className="text-center text-sm text-gray-500 p-4">👍 Tidak ada barang akan ED.</div>
                  ) : (
                    expiringItems.slice(0, 3).map((item) => (
                      <AlertItem
                        key={item.batchId}
                        item={item}
                        onClick={() => setPage('laporan-kedaluwarsa')}
                        badgeText="Segera ED"
                        badgeColor="badge-warning"
                      />
                    ))
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

