import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginExperience, { LoginInput, loginInputClassName } from '../../../shared/ui/LoginExperience';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
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
    setError('');

    if (!identifier.trim()) {
      setError('Masukkan nomor telepon, Parent ID, atau email orang tua.');
      return;
    }
    if (!password.trim()) {
      setError('Masukkan password.');
      return;
    }

    setIsLoading(true);
    const success = await login(identifier.trim(), password, remember);
    setIsLoading(false);

    if (success) {
      navigate(redirectTo, { replace: true });
    } else {
      setError(authError || 'Identitas login atau password tidak valid. Pastikan sesuai dengan data orang tua yang terdaftar.');
    }
  };

  return (
    <LoginExperience
      portalKey="parent"
      portalName="Portal Orang Tua"
      subtitle="Pantau perkembangan anak dengan lebih jelas."
      description="Lihat jadwal terapi, laporan perkembangan, reschedule, dan pengumuman klinik dari satu portal keluarga."
      formTitle="Masuk sebagai orang tua"
      formDescription="Gunakan nomor telepon, Parent ID, atau email orang tua yang didaftarkan admin."
      submitLabel="Masuk ke Portal Orang Tua"
      remember={remember}
      onRememberChange={setRemember}
      error={error || authError}
      isLoading={isLoading}
      onSubmit={handleSubmit}
    >
      <LoginInput id="identifier" label="Nomor Telepon / Parent ID / Email" icon="badge">
        <input
          id="identifier"
          type="text"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value.trim())}
          placeholder="08xx, P-0001, atau email"
          className={loginInputClassName}
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
