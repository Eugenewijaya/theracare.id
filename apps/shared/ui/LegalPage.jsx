import React from 'react';
import logoSrc from '../assets/login-logo.svg';

const CONTENT = {
  privacy: {
    title: 'Privacy Policy',
    body: [
      'TheraCare menyimpan data akun, jadwal terapi, laporan, dan notifikasi untuk kebutuhan operasional klinik.',
      'Akses data dibatasi berdasarkan role admin, therapist, dan parent. Data klinis tidak ditampilkan di portal yang tidak berwenang.',
      'Untuk permintaan koreksi atau penghapusan data, hubungi administrator klinik.',
    ],
  },
  terms: {
    title: 'Terms of Service',
    body: [
      'Portal ini hanya boleh digunakan oleh akun yang dibuat oleh administrator klinik.',
      'Pengguna wajib menjaga kerahasiaan password sementara dan segera menggantinya bila diminta oleh klinik.',
      'Aktivitas di portal dapat dicatat untuk keamanan dan audit operasional.',
    ],
  },
  copyright: {
    title: 'Copyright Information',
    body: [
      'Copyright 2026 Evid Wijaya. All rights reserved.',
      'Logo dan foto pada halaman login saat ini adalah placeholder sementara dan dapat diganti dengan aset resmi Special Need Center.',
      'Kode, desain, dan konten aplikasi tidak boleh digunakan ulang tanpa izin pemilik.',
    ],
  },
};

export default function LegalPage({ type = 'privacy', portalName = 'TheraCare' }) {
  const content = CONTENT[type] || CONTENT.privacy;

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-950">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60">
        <div className="flex flex-col items-center text-center">
          <img src={logoSrc} alt="Temporary clinic logo" className="h-16 w-16" />
          <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-slate-500">{portalName}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">{content.title}</h1>
        </div>

        <div className="mt-8 space-y-4 text-sm leading-7 text-slate-600">
          {content.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 pt-6 text-sm font-bold">
          <a href="/login" className="rounded-xl bg-slate-950 px-5 py-2.5 text-white hover:bg-slate-800">Kembali ke Login</a>
          <a href="mailto:support@theracare.id" className="rounded-xl border border-slate-200 px-5 py-2.5 text-slate-700 hover:bg-slate-50">Hubungi Support</a>
        </div>
      </div>
    </main>
  );
}
