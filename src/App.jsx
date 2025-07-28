import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestoreDb } from './firebaseConfig';
import { Toaster, toast } from 'react-hot-toast';
import Login from './components/Login';
import Register from './components/Register';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import KelolaPengguna from './components/KelolaPengguna';
import KelolaDepo from './components/KelolaDepo';
import KelolaSupplier from './components/KelolaSupplier';
import KelolaMasterBarang from './components/KelolaMasterBarang';
import AlokasiSupplier from './components/AlokasiSupplier';
import KelolaKategori from './components/KelolaKategori';
import StokMasuk from './components/StokMasuk';
import StokKeluar from './components/StokKeluar';
import FakturTertunda from './components/FakturTertunda';
import KelolaFakturTertunda from './components/KelolaFakturTertunda';
import ManajemenRetur from './components/ManajemenRetur';
import Laporan from './components/Laporan';
import LaporanKedaluwarsa from './components/LaporanKedaluwarsa';
import BackupRestore from './components/BackupRestore';
import BuatOrder from './components/BuatOrder';
import ProsesOrder from './components/ProsesOrder';
import ProsesPengeluaranGudang from './components/ProsesPengeluaranGudang';
import StockOpname from './components/StockOpname';
import UserProfile from './components/UserProfile';
import KantorPusat from './components/KantorPusat';
import TransferStok from './components/TransferStok';
import KelolaToko from './components/KelolaToko';
import KelolaLokasi from './components/KelolaLokasi';

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
              console.error('No such user document in Firestore!');
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
      console.error('Gagal logout:', error);
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

    switch (mainPage) {
      case 'buat-order':
        if (isSales || isSuperAdmin) return <BuatOrder userProfile={userProfile} />;
        break;
      case 'proses-order':
        if (canProcessOrder || isSuperAdmin) return <ProsesOrder userProfile={userProfile} />;
        break;
      case 'stok-masuk':
        if (canDoGudangTransaction || isSuperAdmin) return <StokMasuk userProfile={userProfile} />;
        break;
      case 'stok-keluar':
        if (canDoGudangTransaction || isSuperAdmin) return <StokKeluar userProfile={userProfile} />;
        break;
      case 'manajemen-retur':
        if (canDoGudangTransaction || isDriverOrHelper || isSuperAdmin) return <ManajemenRetur userProfile={userProfile} />;
        break;
      case 'stock-opname':
        if (canDoGudangTransaction || isSuperAdmin) return <StockOpname userProfile={userProfile} />;
        break;
      case 'pengeluaran-barang':
        if (canDoGudangTransaction || isDriverOrHelper || isSuperAdmin) return <ProsesPengeluaranGudang userProfile={userProfile} />;
        break;
      case 'transfer-stok':
        if (canAccessMasterData || isSuperAdmin) return <TransferStok userProfile={userProfile} />;
        break;
      case 'faktur-tertunda':
        return <FakturTertunda userProfile={userProfile} />;
      case 'proses-faktur-tertunda':
        if (canProcessOrder || isSuperAdmin) return <KelolaFakturTertunda userProfile={userProfile} />;
        break;
      case 'kelola-master-barang':
        if (canAccessMasterData || isSuperAdmin) return <KelolaMasterBarang userProfile={userProfile} />;
        break;
      case 'kelola-toko':
        if (canAccessMasterData || isSuperAdmin) return <KelolaToko userProfile={userProfile} />;
        break;
      case 'kelola-supplier':
        if (canAccessMasterData || isSuperAdmin) return <KelolaSupplier userProfile={userProfile} />;
        break;
      case 'kelola-kategori':
        if (canAccessMasterData || isSuperAdmin) return <KelolaKategori userProfile={userProfile} />;
        break;
      case 'laporan':
        if (canViewLaporan || isSuperAdmin) return <Laporan userProfile={userProfile} />;
        break;
      case 'laporan-kedaluwarsa':
        if (canViewLaporan || isSuperAdmin) return <LaporanKedaluwarsa userProfile={userProfile} />;
        break;
      case 'kantor-pusat':
        if (isAdminPusat || isSuperAdmin) return <KantorPusat userProfile={userProfile} />;
        break;
      case 'kelola-pengguna':
        if (isSuperAdmin) return <KelolaPengguna userProfile={userProfile} />;
        break;
      case 'kelola-depo':
        if (isSuperAdmin) return <KelolaDepo userProfile={userProfile} />;
        break;
      case 'kelola-lokasi':
        if (canAccessMasterData || isSuperAdmin) return <KelolaLokasi userProfile={userProfile} />;
        break;
      case 'alokasi-supplier':
        if (isSuperAdmin) return <AlokasiSupplier userProfile={userProfile} />;
        break;
      case 'backup-restore':
        if (isSuperAdmin) return <BackupRestore userProfile={userProfile} />;
        break;
      case 'user-profile':
        return <UserProfile userProfile={userProfile} />;
      default:
        return <Dashboard user={userProfile} setPage={setMainPage} />;
    }

    return <Dashboard user={userProfile} setPage={setMainPage} />;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-2">Memuat data pengguna...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <Toaster position="top-right" reverseOrder={false} />
      {userProfile ? (
        <>
          <Navbar user={userProfile} setPage={setMainPage} handleLogout={handleLogout} />
          {renderMainContent()}
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
