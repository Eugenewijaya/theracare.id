import React, { useEffect, useMemo, useRef, useState } from 'react';
import { authApi } from '../api/client';

function getInitials(name = '') {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'U';
}

function getErrorMessage(data, fallback) {
  if (!data) return fallback;
  return data.message || data.error || data.raw || fallback;
}

function PasswordField({ id, label, placeholder, value, visible, onChange, onToggle }) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={event => onChange(id, event.target.value)}
        placeholder={placeholder}
        autoComplete={id === 'currentPassword' ? 'current-password' : 'new-password'}
        className="w-full border-0 border-b border-slate-300 bg-transparent px-1 py-3 pr-10 text-sm text-slate-800 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-0 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
      />
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1 text-primary hover:bg-primary/10"
        aria-label={visible ? `Sembunyikan ${label}` : `Tampilkan ${label}`}
      >
        <span className="material-symbols-outlined text-[20px]">{visible ? 'visibility' : 'visibility_off'}</span>
      </button>
    </label>
  );
}

function ChangePasswordModal({ isOpen, onClose, onChanged }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [visible, setVisible] = useState({ currentPassword: false, newPassword: false, confirmPassword: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setVisible({ currentPassword: false, newPassword: false, confirmPassword: false });
      setSubmitting(false);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const update = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setError('');
  };

  const toggleVisibility = (key) => {
    setVisible(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError('Semua kolom password wajib diisi.');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('Konfirmasi password baru tidak sama.');
      return;
    }
    if (form.currentPassword === form.newPassword) {
      setError('Password baru harus berbeda dari password lama.');
      return;
    }

    setSubmitting(true);
    const res = await authApi.changePassword(form.currentPassword, form.newPassword, true);
    if (!res.ok) {
      setSubmitting(false);
      setError(getErrorMessage(res.data, 'Gagal mengubah password. Periksa password lama lalu coba lagi.'));
      return;
    }

    await onChanged?.();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/55 p-4" onClick={onClose}>
      <form
        data-testid="change-password-modal"
        className="w-full max-w-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:p-7"
        onClick={event => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="mb-5 flex items-center gap-3 border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
          <span className="material-symbols-outlined text-[20px]">key</span>
          Ubah Password
        </div>

        <div className="space-y-2">
          <PasswordField id="currentPassword" label="Password lama" placeholder="Password Lama" value={form.currentPassword} visible={visible.currentPassword} onChange={update} onToggle={toggleVisibility} />
          <PasswordField id="newPassword" label="Password baru" placeholder="Password Baru" value={form.newPassword} visible={visible.newPassword} onChange={update} onToggle={toggleVisibility} />
          <PasswordField id="confirmPassword" label="Konfirmasi password baru" placeholder="Konfirmasi password baru" value={form.confirmPassword} visible={visible.confirmPassword} onChange={update} onToggle={toggleVisibility} />
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-8 flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="min-w-24 rounded-md border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="min-w-44 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Menyimpan...' : 'Ubah dan Logout'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PortalProfileMenu({
  user,
  role = 'parent',
  childrenCount = 0,
  onLogout,
  onNavigateProfile,
  onNavigateAnnouncements,
  onNavigateSettings,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const profile = useMemo(() => {
    const isAdmin = role === 'admin';
    const isTherapist = role === 'therapist';
    const name = user?.name || user?.parentName || (isAdmin ? 'Admin' : isTherapist ? 'Therapist' : 'Parent');
    const email = user?.email || '';
    const id = isAdmin
      ? (user?.id || user?.userId || user?.role || '')
      : isTherapist
        ? (user?.nit || user?.id || '')
        : (user?.parentId || user?.phone || user?.id || '');
    const avatar = user?.avatar || user?.photoUrl || user?.image || user?.user?.image || '';
    const initials = getInitials(name);
    const title = isAdmin
      ? (user?.role || 'Administrator')
      : isTherapist
        ? (user?.specialty || user?.specialization || 'Clinical Team')
        : (user?.phone || 'Parent / Guardian');
    const stats = isAdmin
      ? [
          ['Role', user?.role || 'admin'],
          ['Status', user?.status || 'Aktif'],
          ['Email', email || '-'],
          ['ID', id || '-'],
        ]
      : isTherapist
      ? [
          ['Spesialisasi', user?.specialty || user?.specialization || '-'],
          ['Status', user?.status || 'Aktif'],
          ['NIT', user?.nit || '-'],
          ['Email', email || '-'],
        ]
      : [
          ['No. HP', user?.phone || '-'],
          ['Status', user?.status || 'Aktif'],
          ['Anak', childrenCount ? `${childrenCount} anak` : (user?.childName || '-')],
          ['Email', email || '-'],
        ];
    return { avatar, email, id, initials, isAdmin, isTherapist, name, stats, title };
  }, [childrenCount, role, user]);

  const handleLogout = async () => {
    setOpen(false);
    await onLogout?.();
  };

  const handlePasswordChanged = async () => {
    setPasswordOpen(false);
    await handleLogout();
  };

  const action = (icon, label, onClick, tone = 'slate') => (
    <button
      type="button"
      data-testid={label === 'Ubah Kata Sandi' ? 'change-password-button' : undefined}
      onClick={() => {
        setOpen(false);
        onClick?.();
      }}
      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
        tone === 'red'
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30'
          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
      }`}
    >
      <span className="material-symbols-outlined text-[19px]">{icon}</span>
      {label}
    </button>
  );

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        data-testid="portal-profile-button"
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 rounded-full p-1 pr-2 text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        title="Profil & Akun"
      >
        <span
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-cover bg-center text-sm font-black text-white ring-2 ring-primary/20"
          style={profile.avatar ? { backgroundImage: `url("${profile.avatar}")` } : { backgroundColor: '#0f766e' }}
        >
          {!profile.avatar && profile.initials}
        </span>
        <span className="hidden min-w-0 max-w-[120px] text-left text-sm font-bold sm:block">
          <span className="block truncate">{profile.name.split(' ')[0]}</span>
        </span>
        <span className="material-symbols-outlined text-[18px] text-slate-400">expand_more</span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-[250] w-[calc(100vw-32px)] max-w-[310px] rounded-lg border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cover bg-center text-base font-black text-white"
              style={profile.avatar ? { backgroundImage: `url("${profile.avatar}")` } : { backgroundColor: '#0f766e' }}
            >
              {!profile.avatar && profile.initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-black uppercase text-slate-800 dark:text-white">{profile.name}</p>
                <span className="flex items-center gap-1 text-xs">
                  <span
                    className="inline-block h-3 w-5 rounded-[2px] border border-slate-200"
                    style={{ background: 'linear-gradient(to bottom, #dc2626 0 50%, #fff 50% 100%)' }}
                    aria-hidden="true"
                  />
                  <span className="material-symbols-outlined text-[16px] text-slate-500">expand_more</span>
                </span>
              </div>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{profile.id || profile.email || profile.title}</p>
            </div>
          </div>

          <div className="my-4 border-t border-slate-200 dark:border-slate-700" />

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {profile.stats.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <p className="mb-1 text-[11px] font-black text-slate-600 dark:text-slate-400">{label}</p>
                {label === 'Status' ? (
                  <span className="inline-flex rounded-md bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    {value}
                  </span>
                ) : (
                  <p className="truncate text-xs leading-5 text-slate-600 dark:text-slate-300">{value}</p>
                )}
              </div>
            ))}
          </div>

          <div className="my-4 border-t border-dashed border-slate-200 dark:border-slate-700" />
          <div className="space-y-1">
            {onNavigateProfile && action('person', profile.isAdmin ? 'Manajemen Akun' : profile.isTherapist ? 'Kelola Profil' : 'Profil Anak', onNavigateProfile)}
            {onNavigateAnnouncements && action('campaign', 'Pengumuman', onNavigateAnnouncements)}
            {onNavigateSettings && action('settings', 'Pengaturan', onNavigateSettings)}
          </div>

          <div className="my-3 border-t border-dashed border-slate-200 dark:border-slate-700" />
          {action('edit', 'Ubah Kata Sandi', () => setPasswordOpen(true))}
          <div className="my-3 border-t border-dashed border-slate-200 dark:border-slate-700" />
          {action('logout', 'Keluar', handleLogout, 'red')}
        </div>
      )}

      <ChangePasswordModal
        isOpen={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        onChanged={handlePasswordChanged}
      />
    </div>
  );
}
