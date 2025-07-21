import React, { useState, useEffect } from 'react';
// Impor fungsi-fungsi baru yang dibutuhkan dari Firebase
import { ref, onValue, update, remove } from 'firebase/database';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { db } from '../firebaseConfig';

function KelolaPengguna() {
  const [users, setUsers] = useState([]);
  const [depots, setDepots] = useState([]);
  const [loading, setLoading] = useState(true);

  // State untuk modal edit
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedDepot, setSelectedDepot] = useState('');

  // Daftar Jabatan/Role
  const roles = ['Super Admin', 'Kepala Depo', 'Admin Depo', 'Sales Depo', 'Menunggu Persetujuan'];

  useEffect(() => {
    const usersRef = ref(db, 'users/');
    const depotsRef = ref(db, 'depots/');

    // Listener untuk data pengguna
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      const userList = data ? Object.keys(data).map(key => ({ uid: key, ...data[key] })) : [];
      setUsers(userList);
      setLoading(false);
    });

    // Listener untuk data depo
    const unsubscribeDepots = onValue(depotsRef, (snapshot) => {
      const data = snapshot.val();
      const depotList = data ? Object.keys(data).map(key => ({ id: key, ...data[key].info })) : [];
      setDepots(depotList);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeDepots();
    };
  }, []);

  // Fungsi saat tombol "Edit" atau "Setujui" di klik
  const handleEditClick = (user) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setSelectedDepot(user.depotId || '');
    document.getElementById('edit_modal').showModal();
  };

  // Fungsi untuk menyimpan perubahan role/depo
  const handleUpdateUser = async () => {
    if (!editingUser) return;

    const userRef = ref(db, 'users/' + editingUser.uid);
    try {
      await update(userRef, {
        role: selectedRole,
        depotId: selectedDepot,
      });
      alert('Data pengguna berhasil diperbarui.');
      document.getElementById('edit_modal').close();
      setEditingUser(null);
    } catch (error) {
      alert('Gagal memperbarui data pengguna.');
      console.error("Gagal update user:", error);
    }
  };

  // --- FUNGSI BARU: RESET PASSWORD ---
  const handleResetPassword = async (email) => {
    if (!window.confirm(`Anda akan mengirim email reset password ke ${email}. Lanjutkan?`)) {
        return;
    }
    const auth = getAuth();
    try {
        await sendPasswordResetEmail(auth, email);
        alert('Email untuk reset password berhasil dikirim.');
    } catch (error) {
        alert('Gagal mengirim email. Error: ' + error.message);
        console.error("Gagal reset password:", error);
    }
  };
  
  // --- FUNGSI BARU: HAPUS PENGGUNA ---
  const handleDeleteUser = async (user) => {
    if (!window.confirm(`PERINGATAN: Anda akan menghapus data pengguna "${user.fullName}". Aksi ini tidak bisa dibatalkan. Lanjutkan?`)) {
        return;
    }
    try {
        // Hanya menghapus data dari Realtime Database
        await remove(ref(db, 'users/' + user.uid));
        alert('Data pengguna berhasil dihapus dari database.');
    } catch (error) {
        alert('Gagal menghapus data pengguna.');
        console.error("Gagal hapus user:", error);
    }
  };
  if (loading) {
    return <div className="p-8"><span className="loading loading-spinner"></span></div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Kelola Pengguna</h1>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="table table-zebra w-full">
          <thead className="bg-gray-200">
            <tr>
              <th>Nama Lengkap</th>
              <th>Email</th>
              <th>Jabatan / Role</th>
              <th>Depo</th>
              <th className="w-60">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.uid} className={user.role === 'Menunggu Persetujuan' ? 'bg-yellow-100' : ''}>
                <td>{user.fullName}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`badge ${user.role === 'Menunggu Persetujuan' ? 'badge-warning' : 'badge-ghost'}`}>
                    {user.role}
                  </span>
                </td>
                <td>{user.depotId || 'Belum Ditugaskan'}</td>
                <td className="flex gap-2">
                  {user.role === 'Menunggu Persetujuan' ? (
                    <button onClick={() => handleEditClick(user)} className="btn btn-sm btn-success">Setujui</button>
                  ) : (
                    <button onClick={() => handleEditClick(user)} className="btn btn-sm btn-info">Edit</button>
                  )}
                  <button onClick={() => handleDeleteUser(user)} className="btn btn-sm btn-error">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal untuk Edit User */}
      <dialog id="edit_modal" className="modal">
        <div className="modal-box">
          <button onClick={() => document.getElementById('edit_modal').close()} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          <h3 className="font-bold text-lg">Edit Pengguna: {editingUser?.fullName}</h3>
          
          <div className="form-control w-full mt-4">
            <label className="label"><span className="label-text">Ubah Jabatan / Role</span></label>
            <select className="select select-bordered" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="form-control w-full mt-4">
            <label className="label"><span className="label-text">Tugaskan ke Depo</span></label>
            <select className="select select-bordered" value={selectedDepot} onChange={(e) => setSelectedDepot(e.target.value)}>
              <option value="">(Tidak Ditugaskan)</option>
              {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="divider">Aksi Lanjutan</div>

          <button className="btn btn-sm btn-outline btn-warning w-full" onClick={() => handleResetPassword(editingUser?.email)}>
            Kirim Email Reset Password
          </button>

          <div className="modal-action">
            <button className="btn btn-primary" onClick={handleUpdateUser}>Simpan Perubahan</button>
          </div>
        </div>
        {/* Klik di luar modal untuk menutup */}
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
}

export default KelolaPengguna;