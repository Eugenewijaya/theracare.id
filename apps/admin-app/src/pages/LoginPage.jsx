import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginExperience, { LoginInput, loginInputClassName } from '../../../shared/ui/LoginExperience';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const { login, error: authError, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setLocalError('Masukkan email dan password.');
      return;
    }

    setLocalError('');
    setIsLoading(true);
    const success = await login(email.trim(), password, remember);
    setIsLoading(false);
    if (success) navigate('/', { replace: true });
  };

  return (
    <LoginExperience
      portalKey="admin"
      portalName="Portal Admin"
      subtitle="Kelola operasional klinik dari satu tempat."
      description="Akses dashboard admin untuk registrasi keluarga, jadwal terapi, laporan, notifikasi, dan branding klinik."
      formTitle="Masuk sebagai admin"
      formDescription="Gunakan email admin yang terdaftar di sistem."
      submitLabel="Masuk ke Admin"
      remember={remember}
      onRememberChange={setRemember}
      error={localError || authError}
      isLoading={isLoading}
      onSubmit={handleSubmit}
    >
      <LoginInput id="email" label="Email Admin" icon="mail">
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@clinic.id"
          className={loginInputClassName}
          autoComplete="email"
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
