import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, error: authError } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!phone.trim()) {
      setError('Masukkan Nomor HP Anda.');
      return;
    }
    if (!password.trim()) {
      setError('Masukkan password Anda.');
      return;
    }

    setIsLoading(true);
    // Small delay to feel responsive
    await new Promise(r => setTimeout(r, 400));

    const success = await login(phone.trim(), password);
    setIsLoading(false);

    if (success) {
      navigate('/');
    } else {
      setError(authError || 'Nomor HP atau password tidak valid. Pastikan sesuai dengan data registrasi.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-sky-50 to-cyan-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 px-4 relative overflow-hidden">

      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-sky-400/20 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-5%] w-[500px] h-[500px] rounded-full bg-cyan-400/15 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 shadow-lg shadow-sky-500/30 mb-4 relative">
            <div className="absolute inset-0 rounded-2xl bg-sky-400/40 blur-xl" />
            <span className="material-symbols-outlined text-white text-[32px] relative" style={{ fontVariationSettings: "'FILL' 1" }}>family_restroom</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Parent Portal</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">TheraCare Clinic Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-black/40 border border-white/60 dark:border-slate-700/50 p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Phone Field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Nomor HP Orang Tua
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors text-[20px]">call</span>
                <input
                  id="phone"
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value.trim())}
                  placeholder="e.g. 08111000001"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none text-sm font-medium transition-all font-mono tracking-wider"
                />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-[13px]">info</span>
                Gunakan nomor HP yang terdaftar saat registrasi
              </p>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-bold text-slate-700 dark:text-slate-300">Password</label>
                <a href="#" className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 transition-colors">Lupa Password?</a>
              </div>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors text-[20px]">lock</span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Masukkan password Anda"
                  className="w-full pl-11 pr-12 py-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none text-sm font-medium transition-all"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-500 transition-colors focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 text-xs font-semibold px-4 py-3 rounded-xl flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">error</span>
                {error}
              </div>
            )}

            {/* Remember Me */}
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className="relative flex items-center justify-center">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="peer sr-only" />
                <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 rounded bg-white/60 dark:bg-slate-900/50 peer-checked:bg-sky-500 peer-checked:border-sky-500 transition-all"></div>
                <span className="material-symbols-outlined absolute text-white text-[14px] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
              </div>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">Ingat saya</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 w-full py-3.5 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 disabled:opacity-70 text-white font-bold rounded-xl shadow-lg shadow-sky-500/25 transition-all hover:shadow-sky-500/40 hover:-translate-y-0.5 disabled:hover:translate-y-0 text-sm flex items-center justify-center gap-2 relative overflow-hidden group"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  Masuk ke Portal
                </>
              )}
            </button>
          </form>

          {/* Demo Hint */}
          <div className="mt-5 p-3 bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/50 rounded-xl">
            <p className="text-xs font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1 mb-1">
              <span className="material-symbols-outlined text-[14px]">info</span>
              Akun Demo
            </p>
            <p className="text-xs text-sky-600 dark:text-sky-400 font-mono">
              No HP: <strong>08111000001</strong> &nbsp;|&nbsp; Password: <strong>TheraCare@2024</strong>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
          © 2026 Evid Wijaya. All rights reserved.
        </p>
      </div>
    </div>
  );
}
