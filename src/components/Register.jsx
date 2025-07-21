import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, db } from '../firebaseConfig';

function Register({ setPage }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      // 1. Membuat akun di Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Menyimpan detail pengguna dengan role default
      await set(ref(db, 'users/' + user.uid), {
        fullName: fullName,
        email: email,
        role: 'Menunggu Persetujuan', // <-- Role default untuk pengguna baru
        depotId: null, // Belum ditugaskan ke depo manapun
      });

      setMessage('Registrasi berhasil! Akun Anda akan segera diaktifkan oleh Admin.');
      // Kosongkan form
      setFullName('');
      setEmail('');
      setPassword('');

    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Email ini sudah terdaftar.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password terlalu lemah. Minimal 6 karakter.');
      } else {
        setError('Terjadi kesalahan. Coba lagi nanti.');
      }
      console.error("Error saat registrasi:", err);
    }
  };

  return (
    <div className="flex justify-center items-center p-4">
      <div className="card w-full max-w-md shadow-2xl bg-base-100">
        <form className="card-body" onSubmit={handleRegister}>
          <h2 className="card-title text-2xl">Register Akun Baru</h2>
          
          {message && <div role="alert" className="alert alert-success"><span>{message}</span></div>}
          {error && <div role="alert" className="alert alert-error"><span>{error}</span></div>}

          <div className="form-control">
            <label className="label"><span className="label-text">Nama Lengkap</span></label>
            <input type="text" placeholder="Nama Lengkap Anda" className="input input-bordered" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Email</span></label>
            <input type="email" placeholder="contoh@email.com" className="input input-bordered" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Password</span></label>
            <input type="password" placeholder="minimal 6 karakter" className="input input-bordered" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          
          <div className="form-control mt-6">
            <button type="submit" className="btn btn-primary">Register</button>
          </div>
          <div className="text-center mt-2">
            <a href="#" onClick={() => setPage('login')} className="link link-hover">
              Sudah punya akun? Kembali ke Login
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Register;