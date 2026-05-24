import React, { useEffect } from 'react';
import { applyPlatformFavicon, platformLogoUrl } from '../platformBrand';
import { useClinicSettings } from '../clinicSettings';

const UPDATED_AT = '8 Mei 2026';

const CONTENT = {
  privacy: {
    eyebrow: 'Kebijakan Privasi',
    title: 'Privacy Policy',
    intro: 'Halaman ini menjelaskan jenis data yang diproses oleh TheraCare, alasan pemrosesan, dan bagaimana akses data dibatasi di portal admin, therapist, dan parent.',
    sections: [
      {
        title: 'Data yang diproses',
        items: [
          'Data akun: nama, email, nomor HP, role, dan status akun.',
          'Data pusat terapi: jadwal sesi, anak terdaftar, program terapi, laporan, request reschedule, dan notifikasi.',
          'Data aktivitas: status login, status baca notifikasi, dan perubahan data yang dilakukan melalui dashboard.',
        ],
      },
      {
        title: 'Penggunaan data',
        items: [
          'Membuat dan mengelola akun yang didaftarkan oleh admin.',
          'Menampilkan jadwal, laporan, dan progres kepada role yang berwenang.',
          'Mengirim notifikasi terkait pengumuman, jadwal, reschedule, dan laporan yang sudah dipublikasikan.',
        ],
      },
      {
        title: 'Pembatasan akses',
        items: [
          'Admin dapat mengelola data operasional pusat terapi.',
          'Therapist hanya menggunakan data yang relevan dengan sesi dan laporan terapi.',
          'Parent hanya melihat data anak yang terhubung dengan akun parent tersebut.',
        ],
      },
      {
        title: 'Permintaan data',
        items: [
          'Permintaan koreksi data harus diajukan kepada admin pusat terapi.',
          'Permintaan penghapusan data terapi dapat dibatasi bila data masih dibutuhkan untuk audit, laporan, atau kewajiban operasional.',
        ],
      },
    ],
  },
  terms: {
    eyebrow: 'Ketentuan Layanan',
    title: 'Terms of Service',
    intro: 'Dengan menggunakan portal TheraCare, pengguna menyetujui bahwa akses hanya dipakai untuk kebutuhan layanan terapi anak dan sesuai role yang diberikan oleh admin.',
    sections: [
      {
        title: 'Akses akun',
        items: [
          'Akun parent dan therapist dibuat oleh admin melalui prosedur registrasi.',
          'Pengguna wajib menjaga kerahasiaan password akun.',
          'Admin dapat menangguhkan akun bila terdapat risiko keamanan atau penyalahgunaan.',
        ],
      },
      {
        title: 'Penggunaan portal',
        items: [
          'Portal digunakan untuk melihat dan mengelola informasi terapi sesuai hak akses.',
          'Pengguna tidak boleh mencoba membuka data yang bukan miliknya atau bukan bagian dari tanggung jawabnya.',
          'Data yang tampil di portal harus diverifikasi kembali oleh pihak pusat terapi bila digunakan untuk keputusan layanan penting.',
        ],
      },
      {
        title: 'Ketersediaan layanan',
        items: [
          'Layanan dapat berhenti sementara karena maintenance, deploy, atau gangguan provider.',
          'Fitur baru dapat berubah selama fase pengembangan dan pilot operasional.',
        ],
      },
      {
        title: 'Keamanan',
        items: [
          'Logout dari perangkat bersama setelah selesai menggunakan portal.',
          'Laporkan akses mencurigakan kepada admin pusat terapi atau support.',
        ],
      },
    ],
  },
  copyright: {
    eyebrow: 'Hak Cipta',
    title: 'Copyright Information',
    intro: 'Informasi ini menjelaskan kepemilikan konten, placeholder visual, dan batas penggunaan ulang aset TheraCare.',
    sections: [
      {
        title: 'Kepemilikan',
        items: [
          'Copyright 2026 Evid Wijaya. All rights reserved.',
          'Kode, desain, copywriting, dan susunan UI aplikasi dilindungi sebagai bagian dari platform TheraCare.',
        ],
      },
      {
        title: 'Aset sementara',
        items: [
          'Logo dan gambar pada halaman login saat ini adalah placeholder sementara.',
          'Aset tersebut disiapkan agar layout dapat diuji sebelum logo Special Need Center dan foto resmi dimasukkan.',
        ],
      },
      {
        title: 'Penggunaan ulang',
        items: [
          'Aset dan kode tidak boleh disalin, dijual, atau dipakai ulang tanpa izin pemilik.',
          'Materi resmi pusat terapi harus menggunakan logo dan foto yang sudah disetujui pengelola.',
        ],
      },
    ],
  },
};

const NAV_ITEMS = [
  { type: 'privacy', label: 'Privacy Policy', href: '/privacy' },
  { type: 'terms', label: 'Terms', href: '/terms' },
  { type: 'copyright', label: 'Copyright', href: '/copyright' },
];

export default function LegalPage({ type = 'privacy', portalName = 'TheraCare' }) {
  const content = CONTENT[type] || CONTENT.privacy;
  const { settings } = useClinicSettings();
  const centerLogoSrc = settings.logoUrl || platformLogoUrl;
  const centerName = settings.clinicName || 'TheraCare';
  const supportEmail = settings.centerEmail || 'support@theracare.id';

  useEffect(() => {
    applyPlatformFavicon(settings.faviconUrl || settings.logoUrl);
  }, [settings.faviconUrl, settings.logoUrl]);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:py-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <img src={centerLogoSrc} alt={`${centerName} logo`} className="h-24 w-auto max-w-[260px] object-contain" />
            <p className="mt-4 text-xs font-black uppercase tracking-[0.24em] text-slate-500">{portalName} - {centerName}</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{content.title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">{content.intro}</p>
          </div>

          <nav className="mt-7 flex flex-wrap items-center justify-center gap-2">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.type}
                href={item.href}
                className={`rounded-xl border px-4 py-2 text-sm font-extrabold transition ${
                  item.type === type
                    ? 'border-slate-950 bg-slate-950 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {content.sections.map((section, index) => (
            <article key={section.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <h2 className="text-lg font-black tracking-tight">{section.title}</h2>
              </div>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Terakhir diperbarui</p>
              <p className="mt-1 text-sm font-bold text-slate-700">{UPDATED_AT}</p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm font-bold">
              <a href="/login" className="rounded-xl bg-slate-950 px-5 py-2.5 text-white hover:bg-slate-800">Kembali ke Login</a>
              <a href={`mailto:${supportEmail}`} className="rounded-xl border border-slate-200 px-5 py-2.5 text-slate-700 hover:bg-slate-50">Hubungi Support</a>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
