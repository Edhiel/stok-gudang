import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { firestoreDb } from '../firebaseConfig'; // Hanya impor firestoreDb
import toast from 'react-hot-toast';

function KelolaPengguna({ userProfile, setPage }) {
  const [users, setUsers] = useState([]);
  const [depots, setDepots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedDepot, setSelectedDepot] = useState('');
  const roles = [
    'Super Admin',
    'Admin Pusat',
    'Kepala Depo',
    'Kepala Gudang',
    'Admin Depo',
    'Staf Gudang',
    'Sales Depo',
    'Sopir',
    'Helper',
    'Menunggu Persetujuan',
  ];

  useEffect(() => {
    // Cek akses Super Admin
    if (!userProfile || userProfile.role !== 'Super Admin') {
      toast.error('Akses ditolak. Hanya Super Admin yang dapat mengelola pengguna.');
      setPage('dashboard');
      return;
    }

    setLoading(true);

    // Ambil data depo dari Firestore
    const unsubscribeDepots = onSnapshot(
      collection(firestoreDb, 'depots'),
      (snapshot) => {
        const depotList = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().info?.name || doc.id, // Konsisten dengan TransferStok.jsx
        }));
        setDepots(depotList);
      },
      (error) => {
        console.error('Gagal memuat data depo:', error);
        toast.error('Gagal memuat data depo: ' + error.message);
      }
    );

    // Ambil data pengguna dari Firestore
    const unsubscribeUsers = onSnapshot(
      collection(firestoreDb, 'users'),
      (snapshot) => {
        const userList = snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
        setUsers(userList);
        setLoading(false);
      },
      (error) => {
        console.error('Gagal memuat data pengguna:', error);
        toast.error('Gagal memuat data pengguna: ' + error.message);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeDepots();
      unsubscribeUsers();
    };
  }, [userProfile, setPage]);

  const handleEditClick = (user) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setSelectedDepot(user.depotId || '');
    document.getElementById('edit_modal').showModal();
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    const userDocRef = doc(firestoreDb, 'users', editingUser.uid);
    try {
      await updateDoc(userDocRef, {
        role: selectedRole,
        depotId: selectedRole === 'Admin Pusat' || selectedRole === 'Super Admin' ? null : selectedDepot,
      });
      toast.success('Data pengguna berhasil diperbarui.');
      document.getElementById('edit_modal').close();
      setEditingUser(null);
      setSelectedRole('');
      setSelectedDepot('');
    } catch (error) {
      toast.error('Gagal memperbarui data pengguna: ' + error.message);
      console.error('Gagal update user:', error);
    }
  };

  const handleResetPassword = async (email) => {
    if (!window.confirm(`Anda akan mengirim email reset password ke ${email}. Lanjutkan?`)) {
      return;
    }
    const auth = getAuth();
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Email untuk reset password berhasil dikirim.');
    } catch (error) {
      toast.error('Gagal mengirim email: ' + error.message);
      console.error('Gagal reset password:', error);
    }
  };

  const handleDeleteUser = async (user) => {
    if (
      !window.confirm(
        `PERINGATAN: Anda akan menghapus data pengguna "${user.fullName}". Aksi ini tidak bisa dibatalkan. Lanjutkan?`
      )
    ) {
      return;
    }
    try {
      await deleteDoc(doc(firestoreDb, 'users', user.uid));
      toast.success('Data pengguna berhasil dihapus dari database.');
      toast('Perhatian: Akun login pengguna ini tidak terhapus. Harap nonaktifkan manual dari Firebase Authentication Console.', {
        icon: 'ℹ️',
      });
    } catch (error) {
      toast.error('Gagal menghapus data pengguna: ' + error.message);
      console.error('Gagal hapus user:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <span className="loading loading-spinner loading-lg"></span>
        <p>Memuat data pengguna...</p>
      </div>
    );
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
                <td>{depots.find((d) => d.id === user.depotId)?.name || 'Pusat'}</td>
                <td className="flex gap-2">
                  {user.role === 'Menunggu Persetujuan' ? (
                    <button onClick={() => handleEditClick(user)} className="btn btn-sm btn-success">
                      Setujui
                    </button>
                  ) : (
                    <button onClick={() => handleEditClick(user)} className="btn btn-sm btn-info">
                      Edit
                    </button>
                  )}
                  <button onClick={() => handleDeleteUser(user)} className="btn btn-sm btn-error">
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dialog id="edit_modal" className="modal">
        <div className="modal-box">
          <button
            onClick={() => document.getElementById('edit_modal').close()}
            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          >
            ✕
          </button>
          <h3 className="font-bold text-lg">Edit Pengguna: {editingUser?.fullName}</h3>
          <div className="form-control w-full mt-4">
            <label className="label">
              <span className="label-text font-bold">Ubah Jabatan / Role</span>
            </label>
            <select
              className="select select-bordered"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="form-control w-full mt-4">
            <label className="label">
              <span className="label-text font-bold">Tugaskan ke Depo</span>
            </label>
            <select
              className="select select-bordered"
              value={selectedDepot}
              onChange={(e) => setSelectedDepot(e.target.value)}
              disabled={selectedRole === 'Admin Pusat' || selectedRole === 'Super Admin'}
            >
              <option value="">(Tidak Ditugaskan)</option>
              {depots.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="divider">Aksi Lanjutan</div>
          <button
            className="btn btn-sm btn-outline btn-warning w-full"
            onClick={() => handleResetPassword(editingUser?.email)}
          >
            Kirim Email Reset Password
          </button>
          <div className="modal-action">
            <button className="btn btn-primary" onClick={handleUpdateUser}>
              Simpan Perubahan
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
}

export default KelolaPengguna;
