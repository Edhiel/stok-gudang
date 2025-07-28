import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
// --- 1. Perubahan Import ---
import { doc, setDoc } from "firebase/firestore"; 
import { auth, firestoreDb } from '../firebaseConfig'; // <-- Gunakan firestoreDb

// Komponen Ikon Mata
const EyeIcon = ({ onClick }) => (
    <svg onClick={onClick} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 cursor-pointer text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
);

const EyeOffIcon = ({ onClick }) => (
    <svg onClick={onClick} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 cursor-pointer text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 .854-2.705 2.796-5.016 5.21-6.31M19.542 7A8.97 8.97 0 0012 5c-.95 0-1.87.13-2.75.385m0 0A12.001 12.001 0 015.21 6.31m0 0" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.98 8.223A12.022 12.022 0 002.458 12c1.274 4.057 5.064 7 9.542 7a10.024 10.024 0 004.99-1.311m-1.57-1.57A3.007 3.007 0 0115 12a3 3 0 11-3.41-2.99M15 12h.01M4.98 4.98l14.04 14.04" />
    </svg>
);

function Register({ setPage }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (password !== confirmPassword) {
      setError('Password dan konfirmasi password tidak cocok.');
      return;
    }
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // --- 2. Perubahan Logika Penyimpanan ---
      // Data pengguna sekarang disimpan ke Firestore
      await setDoc(doc(firestoreDb, "users", user.uid), {
        fullName: fullName,
        email: email,
        role: 'Menunggu Persetujuan',
        depotId: null,
      });

      setMessage('Registrasi berhasil! Akun Anda akan segera diaktifkan oleh Admin.');
      setFullName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
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
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="minimal 6 karakter" 
                className="input input-bordered w-full pr-10" 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                {showPassword ? 
                  <EyeOffIcon onClick={() => setShowPassword(false)} /> : 
                  <EyeIcon onClick={() => setShowPassword(true)} />
                }
              </div>
            </div>
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text">Konfirmasi Password</span></label>
            <div className="relative">
              <input 
                type={showConfirmPassword ? "text" : "password"} 
                placeholder="Ketik ulang password" 
                className="input input-bordered w-full pr-10" 
                required 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                {showConfirmPassword ? 
                  <EyeOffIcon onClick={() => setShowConfirmPassword(false)} /> : 
                  <EyeIcon onClick={() => setShowConfirmPassword(true)} />
                }
              </div>
            </div>
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
