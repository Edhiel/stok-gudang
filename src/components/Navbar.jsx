import React from 'react';

function Navbar({ user, setPage, handleLogout }) {
  const isSuperAdmin = user.role === 'Super Admin';
  const isAdminPusat = user.role === 'Admin Pusat';
  const isSales = user.role === 'Sales Depo';
  const isGudangUser = ['Super Admin', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang', 'Staf Gudang'].includes(user.role);
  const canAccessMasterData = ['Super Admin', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang'].includes(user.role);
  const canViewLaporan = ['Super Admin', 'Admin Pusat', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang'].includes(user.role);
  const canProcessOrder = ['Super Admin', 'Kepala Depo', 'Admin Depo', 'Kepala Gudang'].includes(user.role);

  return (
    <div className="navbar bg-primary text-primary-content sticky top-0 z-30 shadow-lg print:hidden">
      <div className="navbar-start">
        <a className="btn btn-ghost text-xl" onClick={() => setPage('dashboard')}>
          <span className="ml-2">Stok Gudang</span>
        </a>
      </div>
      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal px-1">
          <li><a onClick={() => setPage('dashboard')}>Dashboard</a></li>
          
          {(isSuperAdmin || isAdminPusat) && (
            <li><a onClick={() => setPage('kantor-pusat')}>Kantor Pusat</a></li>
          )}

          {(isSales || canProcessOrder) && (
            <li tabIndex={0}><details><summary>Orderan</summary><ul className="p-2 bg-base-100 text-base-content w-56">
              {(isSales || isSuperAdmin) && <li><a onClick={() => setPage('buat-order')}>Buat Order Baru</a></li>}
              {canProcessOrder && <li><a onClick={() => setPage('proses-order')}>Proses Order (Admin)</a></li>}
            </ul></details></li>
          )}

          {isGudangUser && (
            <li tabIndex={0}><details><summary>Gudang</summary><ul className="p-2 bg-base-100 text-base-content w-56">
              {canProcessOrder && <li><a onClick={() => setPage('pengeluaran-barang')}>Daftar Pengeluaran</a></li>}
              <li className="menu-title"><span>Transaksi</span></li>
              <li><a onClick={() => setPage('stok-masuk')}>Stok Masuk</a></li>
              <li><a onClick={() => setPage('stok-keluar')}>Stok Keluar</a></li>
              <li><a onClick={() => setPage('manajemen-retur')}>Manajemen Retur</a></li>
              <li><a onClick={() => setPage('stock-opname')}>Stock Opname</a></li>
              <li className="menu-title"><span>Faktur</span></li>
              {canProcessOrder && <li><a onClick={() => setPage('faktur-tertunda')}>Buat Faktur Tertunda</a></li>}
              {canProcessOrder && <li><a onClick={() => setPage('proses-faktur-tertunda')}>Proses Faktur Tertunda</a></li>}
            </ul></details></li>
          )}
          
          {canAccessMasterData && ( <li tabIndex={0}><details><summary>Data Master</summary><ul className="p-2 bg-base-100 text-base-content w-56"><li><a onClick={() => setPage('kelola-master-barang')}>Master Barang</a></li><li><a onClick={() => setPage('kelola-supplier')}>Supplier</a></li><li><a onClick={() => setPage('kelola-kategori')}>Kategori</a></li></ul></details></li> )}
          
          {isSuperAdmin && ( <li tabIndex={0}><details><summary>Administrasi</summary><ul className="p-2 bg-base-100 text-base-content w-52"><li><a onClick={() => setPage('kelola-pengguna')}>Pengguna</a></li><li><a onClick={() => setPage('kelola-depo')}>Depo</a></li><li><a onClick={() => setPage('alokasi-supplier')}>Alokasi Supplier</a></li><li><a onClick={() => setPage('backup-restore')}>Backup & Restore</a></li></ul></details></li> )}
          
          {canViewLaporan && <li><a onClick={() => setPage('laporan')}>Laporan</a></li>}
        </ul>
      </div>
      <div className="navbar-end">
        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
            <div className="w-10 rounded-full bg-base-300 flex items-center justify-center">
              <span className="text-xl text-base-content">{user.fullName?.substring(0, 1).toUpperCase()}</span>
            </div>
          </label>
          <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52 text-base-content">
            <li><a onClick={() => setPage('user-profile')} className="justify-between">Profil</a></li>
            <li><a onClick={handleLogout}>Logout</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
export default Navbar;