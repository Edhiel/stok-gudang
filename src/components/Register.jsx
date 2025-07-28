import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, db } from '../firebaseConfig';

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
  [span_0](start_span)const [fullName, setFullName] = useState('');[span_0](end_span)
  [span_1](start_span)const [email, setEmail] = useState('');[span_1](end_span)
  [span_2](start_span)const [password, setPassword] = useState('');[span_2](end_span)
  const [confirmPassword, setConfirmPassword] = useState(''); // State baru
  [span_3](start_span)const [message, setMessage] = useState('');[span_3](end_span)
  [span_4](start_span)const [error, setError] = useState('');[span_4](end_span)
  const [showPassword, setShowPassword] = useState(false); // State baru
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); // State baru

  const handleRegister = async (e) => {
    [span_5](start_span)e.preventDefault();[span_5](end_span)
    setMessage('');
    setError('');

    // Validasi konfirmasi password
    if (password !== confirmPassword) {
      setError('Password dan konfirmasi password tidak cocok.');
      return;
    }
    
    try {
      [span_6](start_span)const userCredential = await createUserWithEmailAndPassword(auth, email, password);[span_6](end_span)
      [span_7](start_span)const user = userCredential.user;[span_7](end_span)

      await set(ref(db, 'users/' + user.uid), {
        fullName: fullName,
        email: email,
        role: 'Menunggu Persetujuan',
        depotId: null,
      [span_8](start_span)});[span_8](end_span)

      [span_9](start_span)setMessage('Registrasi berhasil! Akun Anda akan segera diaktifkan oleh Admin.');[span_9](end_span)
      [span_10](start_span)setFullName('');[span_10](end_span)
      [span_11](start_span)setEmail('');[span_11](end_span)
      [span_12](start_span)setPassword('');[span_12](end_span)
      setConfirmPassword('');
    } catch (err) {
      [span_13](start_span)if (err.code === 'auth/email-already-in-use') {[span_13](end_span)
        [span_14](start_span)setError('Email ini sudah terdaftar.');[span_14](end_span)
      [span_15](start_span)} else if (err.code === 'auth/weak-password') {[span_15](end_span)
        [span_16](start_span)setError('Password terlalu lemah. Minimal 6 karakter.');[span_16](end_span)
      [span_17](start_span)} else {[span_17](end_span)
        [span_18](start_span)setError('Terjadi kesalahan. Coba lagi nanti.');[span_18](end_span)
      }
      [span_19](start_span)console.error("Error saat registrasi:", err);[span_19](end_span)
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

          {/* Input Password dengan Ikon Mata */}
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

          {/* Input Konfirmasi Password dengan Ikon Mata */}
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
