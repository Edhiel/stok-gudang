import React, { useState, useEffect } from 'react';
import { getAuth, updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import { toast } from 'react-hot-toast';

function UserProfile({ userProfile }) {
  // State untuk form
  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // State untuk notifikasi
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Saat komponen dimuat, isi form nama dengan data user saat ini
  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.fullName || '');
    }
  }, [userProfile]);

  const handleUpdateName = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');

    if (fullName === userProfile.fullName) {
      setError('Nama masih sama, tidak ada yang diubah.');
      toast.error('Nama masih sama, tidak ada yang diubah.');
      return;
    }

    const userDocRef = doc(firestoreDb, 'users', userProfile.uid);
    try {
      await updateDoc(userDocRef, { fullName });
      setSuccess('Nama berhasil diperbarui!');
      toast.success('Nama berhasil diperbarui!');
    } catch (err) {
      setError('Gagal memperbarui nama: ' + err.message);
      toast.error('Gagal memperbarui nama: ' + err.message);
      console.error('Error updating name:', err);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');

    if (newPassword.length < 6) {
      setError('Password baru harus minimal 6 karakter.');
      toast.error('Password baru harus minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      toast.error('Konfirmasi password tidak cocok.');
      return;
    }

    const auth = getAuth();
    const user = auth.currentUser;

    try {
      await updatePassword(user, newPassword);
      setSuccess('Password berhasil diubah! Silakan login kembali jika diminta.');
      toast.success('Password berhasil diubah!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError('Gagal mengubah password: ' + err.message);
      toast.error('Gagal mengubah password: ' + err.message);
      console.error('Error updating password:', err);
    }
  };

  if (!userProfile) {
    return (
      <div className="p-8 text-center">
        <span className="loading loading-dots loading-lg"></span>
        <p className="mt-2">Memuat data profil...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">Profil Pengguna</h1>

      {success && <div role="alert" className="alert alert-success"><span>{success}</span></div>}
      {error && <div role="alert" className="alert alert-error"><span>{error}</span></div>}

      {/* Kartu Informasi Akun */}
      <div className="card bg-white shadow-lg">
        <div className="card-body">
          <h2 className="card-title">Informasi Akun</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="font-bold">Email:</label>
              <p>{userProfile.email}</p>
            </div>
            <div>
              <label className="font-bold">Role:</label>
              <p>{userProfile.role}</p>
            </div>
            <div>
              <label className="font-bold">Depo:</label>
              <p>{userProfile.depotId || 'Tidak ada'}</p>
            </div>
          </div>
          <form onSubmit={handleUpdateName} className="mt-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Nama Lengkap</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input input-bordered"
                required
              />
            </div>
            <div className="form-control mt-4">
              <button type="submit" className="btn btn-primary">
                Simpan Nama
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Kartu Ubah Password */}
      <div className="card bg-white shadow-lg">
        <div className="card-body">
          <h2 className="card-title">Ubah Password</h2>
          <form onSubmit={handleUpdatePassword} className="space-y-4 mt-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Password Baru</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input input-bordered"
                required
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Konfirmasi Password Baru</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input input-bordered"
                required
              />
            </div>
            <div className="form-control mt-4">
              <button type="submit" className="btn btn-secondary">
                Ubah Password
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default UserProfile;
