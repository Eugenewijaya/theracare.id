import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password');
      return;
    }
    
    const success = await login(username, password);
    
    if (success) {
      navigate('/');
    } else {
      setError('ID Terapis atau password tidak valid. Hubungi Admin jika Anda lupa kredensial.');
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 overflow-hidden px-4 font-sans selection:bg-teal-500/30">
      
      {/* Animated Background Blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-5xl pointer-events-none opacity-60 dark:opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-teal-400/30 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob"></div>
        <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-cyan-400/30 blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[600px] h-[600px] rounded-full bg-emerald-400/20 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-4000"></div>
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        {/* Header / Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative group cursor-default">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-500"></div>
            <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-xl shadow-teal-900/10 mb-5 text-white ring-1 ring-white/20">
              <span className="material-symbols-outlined text-[32px] drop-shadow-md" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">TheraCare</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1.5 uppercase tracking-widest">Therapist Portal</p>
        </div>

        {/* Glassmorphism Card */}
        <div className="backdrop-blur-2xl bg-white/70 dark:bg-slate-900/70 rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-black/50 border border-white/40 dark:border-slate-700/50 p-8 sm:p-10 transition-all duration-300">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-sm font-bold text-slate-700 dark:text-slate-300">NIT (Nomor Induk Terapis)</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors text-[20px]">person</span>
                <input 
                  id="username" 
                  type="text" 
                  value={username} 
                  onChange={e => setUsername(e.target.value.toUpperCase().replace(/\s/g, ''))} 
                  placeholder="e.g. SARAH260411001" 
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/50 dark:bg-slate-950/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none text-sm font-medium transition-all" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-bold text-slate-700 dark:text-slate-300">Password</label>
                <a href="#" className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors">Forgot?</a>
              </div>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors text-[20px]">lock</span>
                <input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="Enter your password" 
                  className="w-full pl-11 pr-12 py-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/50 dark:bg-slate-950/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none text-sm font-medium transition-all" 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-500 transition-colors focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold px-4 py-3 rounded-xl border border-red-100 dark:border-red-900/50 flex items-center gap-2 animate-in slide-in-from-top-1 fade-in duration-200">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {error}
              </div>
            )}

            <div className="flex items-center">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="peer sr-only" />
                  <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 rounded bg-white/50 dark:bg-slate-900/50 peer-checked:bg-teal-500 peer-checked:border-teal-500 transition-all"></div>
                  <span className="material-symbols-outlined absolute text-white text-[14px] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                </div>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">Keep me signed in</span>
              </label>
            </div>

            <button 
              type="submit" 
              className="mt-2 w-full py-3.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold rounded-xl shadow-lg shadow-teal-500/25 transition-all duration-300 hover:shadow-teal-500/40 hover:-translate-y-0.5 text-sm flex items-center justify-center gap-2 relative overflow-hidden group"
            >
              <div className="absolute inset-0 w-full h-full bg-white/20 group-hover:translate-x-full transition-transform duration-500 -translate-x-full skew-x-12"></div>
              <span>Sign In Securely</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </form>
        </div>

        <div className="text-center mt-8 space-y-4">
          {/* Demo Hint */}
          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-900/40 rounded-2xl p-4 text-left animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300">
            <h3 className="text-teal-700 dark:text-teal-400 text-xs font-bold flex items-center gap-1.5 mb-2 uppercase tracking-wider">
              <span className="material-symbols-outlined text-[16px]">info</span>
              Kredensial Demo
            </h3>
            <div className="space-y-1 font-mono text-[11px]">
              <p className="text-teal-600 dark:text-teal-400">NIT: <strong className="text-slate-900 dark:text-white">SARAH260411001</strong></p>
              <p className="text-teal-600 dark:text-teal-400">PW: <strong className="text-slate-900 dark:text-white">Clinic@1234</strong></p>
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">TheraCare Clinical Platform v2.1.0</p>
            <div className="flex items-center justify-center gap-4 text-xs font-medium text-slate-400 dark:text-slate-500">
              <a href="#" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Terms</a>
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
              <a href="#" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Privacy</a>
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
              <a href="#" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Help</a>
            </div>
          </div>
        </div>

      </div>

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
