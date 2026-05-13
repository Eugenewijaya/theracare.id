import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginExperience, { LoginInput, loginInputClassName } from '../../../shared/ui/LoginExperience';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, error: authError, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from && location.state.from !== '/login' ? location.state.from : '/';

  useEffect(() => {
    if (isAuthenticated) navigate(redirectTo, { replace: true });
  }, [isAuthenticated, navigate, redirectTo]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Masukkan NIT dan password.');
      return;
    }

    setError('');
    setIsLoading(true);
    const success = await login(username.trim(), password, remember);
    setIsLoading(false);

    if (success) {
      navigate(redirectTo, { replace: true });
    } else {
      setError(authError || 'NIT atau password tidak valid. Hubungi admin jika Anda lupa kredensial.');
    }
  };

  return (
    <LoginExperience
      portalKey="therapist"
      portalName="Therapist Portal"
      subtitle="Akses jadwal, laporan, dan progres terapi."
      description="Portal klinis untuk melihat sesi hari ini, membuat laporan, memantau perkembangan anak, dan menerima pengumuman."
      formTitle="Masuk sebagai terapis"
      formDescription="Gunakan NIT dan password yang dibuat oleh admin."
      submitLabel="Masuk ke Therapist Portal"
      remember={remember}
      onRememberChange={setRemember}
      error={error || authError}
      isLoading={isLoading}
      onSubmit={handleSubmit}
    >
      <LoginInput id="username" label="NIT (Nomor Induk Terapis)" icon="badge">
        <input
          id="username"
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value.toUpperCase().replace(/\s/g, ''))}
          placeholder="NIT dari admin"
          className={`${loginInputClassName} font-mono tracking-wide`}
          autoComplete="username"
          disabled={isLoading}
        />
      </LoginInput>

      <LoginInput id="password" label="Password" icon="lock">
        <input
          id="password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Masukkan password"
          className={`${loginInputClassName} pr-12`}
          autoComplete="current-password"
          disabled={isLoading}
        />
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
        >
          <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
        </button>
      </LoginInput>
    </LoginExperience>
  );
}
