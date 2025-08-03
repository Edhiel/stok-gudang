import React, { useState, useEffect } from 'react';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const roles = [
    'Super Admin', 'Admin Pusat', 'Kepala Depo', 'Kepala Gudang', 
    'Admin Depo', 'Staf Gudang', 'Sales Depo', 'Sopir', 'Helper Depo', 'Menunggu Persetujuan',
  ];

  useEffect(() => {
    if (userProfile?.role !== 'Super Admin') {
      toast.error('Akses ditolak.');
      setPage('dashboard');
      return;
    }

    const unsubDepots = onSnapshot(collection(firestoreDb, 'depots'), (snapshot) => {
        const depotList = snapshot.docs.map((doc) => ({ id: doc.id, name: doc.data().name || doc.id }));
        setDepots(depotList);
      });

    const unsubUsers = onSnapshot(collection(firestoreDb, 'users'), (snapshot) => {
        const userList = snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
        const sortedUsers = userList.sort((a, b) => {
            const depotA = a.depotId || 'Z_PUSAT';
            const depotB = b.depotId || 'Z_PUSAT';
            if (depotA < depotB) return -1;
            if (depotA > depotB) return 1;
            return a.fullName.localeCompare(b.fullName);
        });
        setUsers(sortedUsers);
        setLoading(false);
      });

    return () => {
      unsubDepots();
      unsubUsers();
    };
  }, [userProfile, setPage]);

  const handleEditClick = (user) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setSelectedDepot(user.depotId || '');
    document.getElementById('edit_modal').showModal();
  };

  // --- FUNGSI YANG DIPERBAIKI ---
  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    const rolesThatNeedDepot = ['Kepala Depo', 'Kepala Gudang', 'Admin Depo', 'Staf Gudang', 'Sales Depo', 'Sopir', 'Helper Depo'];
    
    // Validasi: Pastikan role yang butuh depo sudah memilih depo
    if (rolesThatNeedDepot.includes(selectedRole) && !selectedDepot) {
        toast.error(`Pengguna dengan peran "${selectedRole}" harus ditugaskan ke sebuah depo.`);
        return;
    }

    setIsSubmitting(true);
    const userDocRef = doc(firestoreDb, 'users', editingUser.uid);
    const updatedData = {
      role: selectedRole,
      depotId: selectedDepot || null,
    };

    // Logika khusus: role pusat tidak boleh punya depo
    if (selectedRole === 'Admin Pusat' || selectedRole === 'Super Admin') {
      updatedData.depotId = null;
    }

    try {
      await updateDoc(userDocRef, updatedData);
      toast.success(`Data ${editingUser.fullName} berhasil diperbarui.`);
      document.getElementById('edit_modal').close();
      setEditingUser(null);
    } catch (error) {
      toast.error('Gagal memperbarui data: ' + error.message);
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (email) => {
    if (!email) {
        toast.error("Email pengguna tidak ditemukan.");
        return;
    }
    if (window.confirm(`Anda yakin ingin mengirim email reset password ke ${email}?`)) {
        const auth = getAuth();
        try {
            await sendPasswordResetEmail(auth, email);
            toast.success(`Email reset password telah dikirim ke ${email}.`);
        } catch (error) {
            toast.error("Gagal mengirim email: " + error.message);
        }
    }
  };

  const handleDeleteUser = async (user) => {
    // Keamanan: Mencegah Super Admin menghapus akunnya sendiri
    if (user.uid === userProfile.uid) {
        toast.error("Anda tidak dapat menghapus akun Anda sendiri.");
        return;
    }

    if (window.confirm(`PERINGATAN: Anda akan menghapus pengguna ${user.fullName} secara permanen. Aksi ini tidak dapat dibatalkan. Lanjutkan?`)) {
        try {
            const userDocRef = doc(firestoreDb, 'users', user.uid);
            await deleteDoc(userDocRef);
            toast.success(`Pengguna ${user.fullName} berhasil dihapus.`);
            // Note: Fungsi untuk menghapus user dari Firebase Authentication perlu dijalankan dari backend (Cloud Function) untuk keamanan.
        } catch (error) {
            toast.error("Gagal menghapus pengguna: " + error.message);
        }
    }
  };
  
  let lastDepotId = null;
  
  if (loading) {
    return <div className="p-8 text-center"><span className="loading loading-spinner loading-lg"></span></div>;
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
                      <td colSpan="4" className="font-bold text-base-content">DEPO: {depotName}</td>
                    </tr>
                  )}
                  <tr className={user.role === 'Menunggu Persetujuan' ? 'bg-yellow-100' : ''}>
                    <td>{user.fullName}</td>
                    <td>{user.email}</td>
                    <td><span className={`badge ${user.role === 'Menunggu Persetujuan' ? 'badge-warning' : 'badge-ghost'}`}>{user.role}</span></td>
                    <td className="flex gap-2">
                      {user.role === 'Menunggu Persetujuan' ? (
                        <button onClick={() => handleEditClick(user)} className="btn btn-sm btn-success">Setujui</button>
                      ) : (
                        <button onClick={() => handleEditClick(user)} className="btn btn-sm btn-info">Edit</button>
                      )}
                      <button onClick={() => handleDeleteUser(user)} className="btn btn-sm btn-error">Hapus</button>
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
          <button onClick={() => document.getElementById('edit_modal').close()} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          <h3 className="font-bold text-lg">Edit Pengguna: {editingUser?.fullName}</h3>
          <div className="form-control w-full mt-4">
            <label className="label"><span className="label-text font-bold">Ubah Jabatan / Role</span></label>
            <select className="select select-bordered" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
              {roles.map((r) => (<option key={r} value={r}>{r}</option>))}
            </select>
          </div>
          <div className="form-control w-full mt-4">
            <label className="label"><span className="label-text font-bold">Tugaskan ke Depo</span></label>
            <select
              className="select select-bordered"
              value={selectedDepot}
              onChange={(e) => setSelectedDepot(e.target.value)}
              disabled={selectedRole === 'Admin Pusat' || selectedRole === 'Super Admin'}
            >
              <option value="">(Kantor Pusat / Tidak Ditugaskan)</option>
              {depots.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
            </select>
          </div>
          <div className="divider">Aksi Lanjutan</div>
          <button className="btn btn-sm btn-outline btn-warning w-full" onClick={() => handleResetPassword(editingUser?.email)}>Kirim Email Reset Password</button>
          <div className="modal-action">
            <button className="btn btn-primary" onClick={handleUpdateUser} disabled={isSubmitting}>
              {isSubmitting ? <span className="loading loading-spinner"></span> : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop"><button>close</button></form>
      </dialog>
    </div>
  );
}

export default KelolaPengguna;
