import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { firestoreDb } from '../firebaseConfig';
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
    if (!userProfile || userProfile.role !== 'Super Admin') {
      toast.error('Akses ditolak. Hanya Super Admin yang dapat mengelola pengguna.');
      setPage('dashboard');
      return;
    }

    setLoading(true);

    const unsubscribeDepots = onSnapshot(collection(firestoreDb, 'depots'), (snapshot) => {
        const depotList = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || doc.id,
        }));
        setDepots(depotList);
      }, (error) => {
        console.error('Gagal memuat data depo:', error);
        toast.error('Gagal memuat data depo: ' + error.message);
      }
    );

    const unsubscribeUsers = onSnapshot(collection(firestoreDb, 'users'), (snapshot) => {
        const userList = snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
        
        // --- PENINGKATAN: Mengurutkan pengguna berdasarkan Depo ---
        const sortedUsers = userList.sort((a, b) => {
            const depotA = a.depotId || 'Z_PUSAT'; // Taruh yang tidak punya depo (pusat) di akhir
            const depotB = b.depotId || 'Z_PUSAT';
            if (depotA < depotB) return -1;
            if (depotA > depotB) return 1;
            // Jika depo sama, urutkan berdasarkan nama
            return a.fullName.localeCompare(b.fullName);
        });

        setUsers(sortedUsers);
        setLoading(false);
      }, (error) => {
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
    // ... (Fungsi ini tidak berubah)
  };

  const handleResetPassword = async (email) => {
    // ... (Fungsi ini tidak berubah)
  };

  const handleDeleteUser = async (user) => {
    // ... (Fungsi ini tidak berubah)
  };
  
  // --- PENINGKATAN: Logika untuk render baris dengan grup ---
  let lastDepotId = null; // Variabel untuk melacak grup depo terakhir
  
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
              <th className="w-60">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const currentDepotId = user.depotId || 'PUSAT';
              const showHeader = currentDepotId !== lastDepotId;
              lastDepotId = currentDepotId;
              const depotName = depots.find(d => d.id === user.depotId)?.name || 'KANTOR PUSAT';

              return (
                <React.Fragment key={user.uid}>
                  {showHeader && (
                    <tr className="bg-base-200 sticky top-0">
                      <td colSpan="4" className="font-bold text-base-content">
                        DEPO: {depotName}
                      </td>
                    </tr>
                  )}
                  <tr className={user.role === 'Menunggu Persetujuan' ? 'bg-yellow-100' : ''}>
                    <td>{user.fullName}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`badge ${user.role === 'Menunggu Persetujuan' ? 'badge-warning' : 'badge-ghost'}`}>
                        {user.role}
                      </span>
                    </td>
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
                </React.Fragment>
              );
            })}
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
              <option value="">(Kantor Pusat / Tidak Ditugaskan)</option>
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
