import React, { useState, useEffect, lazy, Suspense } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestoreDb } from './firebaseConfig';
import { Toaster, toast } from 'react-hot-toast';

// Komponen Halaman Login & Register tidak perlu di-lazy load
import Login from './components/Login';
import Register from './components/Register';
import Navbar from './components/Navbar';

// === Lazy Loading Components ===
// Komponen utama akan dimuat hanya saat dibutuhkan
const Dashboard = lazy(() => import('./components/Dashboard'));
const KelolaPengguna = lazy(() => import('./components/KelolaPengguna'));
const KelolaDepo = lazy(() => import('./components/KelolaDepo'));
const KelolaSupplier = lazy(() => import('./components/KelolaSupplier'));
const KelolaMasterBarang = lazy(() => import('./components/KelolaMasterBarang'));
const AlokasiSupplier = lazy(() => import('./components/AlokasiSupplier'));
const KelolaKategori = lazy(() => import('./components/KelolaKategori'));
const StokMasuk = lazy(() => import('./components/StokMasuk'));
const StokKeluar = lazy(() => import('./components/StokKeluar'));
const FakturTertunda = lazy(() => import('./components/FakturTertunda'));
const KelolaFakturTertunda = lazy(() => import('./components/KelolaFakturTertunda'));
const ManajemenRetur = lazy(() => import('./components/ManajemenRetur'));
const Laporan = lazy(() => import('./components/Laporan'));
const LaporanKedaluwarsa = lazy(() => import('./components/LaporanKedaluwarsa'));
const BackupRestore = lazy(() => import('./components/BackupRestore'));
const BuatOrder = lazy(() => import('./components/BuatOrder'));
const ProsesOrder = lazy(() => import('./components/ProsesOrder'));
const ProsesPengeluaranGudang = lazy(() => import('./components/ProsesPengeluaranGudang'));
const StockOpname = lazy(() => import('./components/StockOpname'));
const UserProfile = lazy(() => import('./components/UserProfile'));
const KantorPusat = lazy(() => import('./components/KantorPusat'));
const TransferStok = lazy(() => import('./components/TransferStok'));
const KelolaToko = lazy(() => import('./components/KelolaToko'));
const KelolaLokasi = lazy(() => import('./components/KelolaLokasi'));

// Komponen loading sederhana untuk Suspense
const LoadingFallback = () => (
  <div className="flex justify-center items-center h-screen">
    <span className="loading loading-spinner loading-lg"></span>
  </div>
);

function App() {
  const [userProfile, setUserProfile] = useState(null);
  const [authPage, setAuthPage] = useState('login');
  const [mainPage, setMainPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userDocRef = doc(firestoreDb, 'users', user.uid);
        getDoc(userDocRef)
          .then((docSnap) => {
            if (docSnap.exists()) {
              setUserProfile({ uid: user.uid, ...docSnap.data() });
            } else {
              toast.error('Data pengguna tidak ditemukan!');
              signOut(auth);
            }
          })
          .catch((error) => {
            console.error('Gagal mengambil data user dari Firestore:', error);
            toast.error('Gagal memuat data pengguna! Silakan coba lagi.');
            signOut(auth);
          })
          .finally(() => {
            setLoading(false);
          });
      } else {
        setUserProfile(null);
        setAuthPage('login');
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMainPage('dashboard');
      toast.success('Berhasil logout!');
    } catch (error) {
      toast.error('Gagal logout! Silakan coba lagi.');
    }
  };

  const renderMainContent = () => {
    if (!userProfile) return null;

    if (userProfile.role === 'Menunggu Persetujuan') {
      return (
        <div className="p-8 text-center">
          <h1 className="text-2xl font-bold">Akun Anda Sedang Ditinjau</h1>
          <p className="mt-2">Harap tunggu persetujuan dari Super Admin.</p>
        </div>
      );
    }

    const isSuperAdmin = userProfile.role === 'Super Admin';
    const isAdminPusat = userProfile.role === 'Admin Pusat';
    const isSales = userProfile.role === 'Sales Depo';
    const canDoGudangTransaction = ['Super Admin', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang', 'Staf Gudang'].includes(
      userProfile.role
    );
    const canAccessMasterData = ['Super Admin', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang'].includes(userProfile.role);
    const canViewLaporan = ['Super Admin', 'Admin Pusat', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang'].includes(
      userProfile.role
    );
    const canProcessOrder = ['Super Admin', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang'].includes(userProfile.role);
    const isDriverOrHelper = ['Sopir', 'Helper Depo'].includes(userProfile.role);

    let ComponentToRender;

    switch (mainPage) {
      case 'buat-order':
        if (isSales || isSuperAdmin) ComponentToRender = <BuatOrder userProfile={userProfile} />;
        break;
      case 'proses-order':
        if (canProcessOrder || isSuperAdmin) ComponentToRender = <ProsesOrder userProfile={userProfile} />;
        break;
      case 'stok-masuk':
        if (canDoGudangTransaction || isSuperAdmin) ComponentToRender = <StokMasuk userProfile={userProfile} />;
        break;
      case 'stok-keluar':
        if (canDoGudangTransaction || isSuperAdmin) ComponentToRender = <StokKeluar userProfile={userProfile} />;
        break;
      case 'manajemen-retur':
        if (canDoGudangTransaction || isDriverOrHelper || isSuperAdmin) ComponentToRender = <ManajemenRetur userProfile={userProfile} />;
        break;
      case 'stock-opname':
        if (canDoGudangTransaction || isSuperAdmin) ComponentToRender = <StockOpname userProfile={userProfile} />;
        break;
      case 'pengeluaran-barang':
        if (canDoGudangTransaction || isDriverOrHelper || isSuperAdmin) ComponentToRender = <ProsesPengeluaranGudang userProfile={userProfile} />;
        break;
      case 'transfer-stok':
        if (canAccessMasterData || isSuperAdmin) ComponentToRender = <TransferStok userProfile={userProfile} />;
        break;
      case 'faktur-tertunda':
        ComponentToRender = <FakturTertunda userProfile={userProfile} setPage={setMainPage} />;
        break;
      case 'proses-faktur-tertunda':
        if (canProcessOrder || isSuperAdmin) ComponentToRender = <KelolaFakturTertunda userProfile={userProfile} />;
        break;
      case 'kelola-master-barang':
        if (canAccessMasterData || isSuperAdmin) ComponentToRender = <KelolaMasterBarang userProfile={userProfile} />;
        break;
      case 'kelola-toko':
        if (canAccessMasterData || isSuperAdmin) ComponentToRender = <KelolaToko userProfile={userProfile} />;
        break;
      case 'kelola-supplier':
        if (canAccessMasterData || isSuperAdmin) ComponentToRender = <KelolaSupplier userProfile={userProfile} />;
        break;
      case 'kelola-kategori':
        if (canAccessMasterData || isSuperAdmin) ComponentToRender = <KelolaKategori userProfile={userProfile} />;
        break;
      case 'laporan':
        if (canViewLaporan || isSuperAdmin) ComponentToRender = <Laporan userProfile={userProfile} />;
        break;
      case 'laporan-kedaluwarsa':
        if (canViewLaporan || isSuperAdmin) ComponentToRender = <LaporanKedaluwarsa userProfile={userProfile} />;
        break;
      case 'kantor-pusat':
        if (isAdminPusat || isSuperAdmin) ComponentToRender = <KantorPusat userProfile={userProfile} />;
        break;
      case 'kelola-pengguna':
        if (isSuperAdmin) ComponentToRender = <KelolaPengguna userProfile={userProfile} setPage={setMainPage} />;
        break;
      case 'kelola-depo':
        if (isSuperAdmin) ComponentToRender = <KelolaDepo userProfile={userProfile} />;
        break;
      case 'kelola-lokasi':
        if (canAccessMasterData || isSuperAdmin) ComponentToRender = <KelolaLokasi userProfile={userProfile} />;
        break;
      case 'alokasi-supplier':
        if (isSuperAdmin) ComponentToRender = <AlokasiSupplier userProfile={userProfile} setPage={setMainPage} />;
        break;
      case 'backup-restore':
        if (isSuperAdmin) ComponentToRender = <BackupRestore userProfile={userProfile} />;
        break;
      case 'user-profile':
        ComponentToRender = <UserProfile userProfile={userProfile} />;
        break;
      default:
        ComponentToRender = <Dashboard user={userProfile} setPage={setMainPage} />;
    }

    // Jika ComponentToRender tidak ter-assign (karena hak akses), kembali ke Dashboard
    return ComponentToRender || <Dashboard user={userProfile} setPage={setMainPage} />;
  };

  if (loading) {
    return <LoadingFallback />;
  }

  return (
    <div className="min-h-screen bg-base-200">
      <Toaster position="top-right" reverseOrder={false} />
      {userProfile ? (
        <>
          <Navbar user={userProfile} setPage={setMainPage} handleLogout={handleLogout} />
          <Suspense fallback={<LoadingFallback />}>
            {renderMainContent()}
          </Suspense>
        </>
      ) : (
        <main className="flex items-center justify-center h-screen">
          {authPage === 'login' && <Login setPage={setAuthPage} />}
          {authPage === 'register' && <Register setPage={setAuthPage} />}
        </main>
      )}
    </div>
  );
}

export default App;

