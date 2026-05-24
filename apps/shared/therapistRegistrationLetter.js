import QRCode from 'qrcode';
import fallbackLogoUrl from './assets/login-logo.svg';
import { normalizeCenterInfo } from './reportPdf.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function sanitizeFilePart(value) {
  return String(value || 'surat-registrasi')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function formatDate(value) {
  if (!value) return '-';
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateTime(date = new Date()) {
  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ensureUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, '');
  return `https://${raw.replace(/\/+$/, '')}`;
}

export function getTherapistLoginUrl(settings = {}) {
  const configured = ensureUrl(
    import.meta.env.VITE_THERAPIST_APP_URL
      || import.meta.env.VITE_THERAPIST_PORTAL_URL
      || settings.therapistPortalUrl
      || '',
  );
  if (configured) return configured.endsWith('/login') ? configured : `${configured}/login`;

  if (typeof window !== 'undefined') {
    const current = new URL(window.location.href);
    const host = current.host
      .replace(/^admin[.-]/i, 'therapist.')
      .replace(/admin-app/i, 'therapist-app')
      .replace(/admin/i, 'therapist');
    return `${current.protocol}//${host}/login`;
  }

  const website = ensureUrl(settings.centerWebsite || settings.website || '');
  return website ? `${website}/login` : '/login';
}

function getTherapistSpecialty(therapist = {}) {
  return therapist.specialty || therapist.specialization || therapist.roleTitle || 'Terapis';
}

function getTherapistName(therapist = {}) {
  return therapist.name || therapist.fullName || therapist.user?.name || '-';
}

function getTherapistEmail(therapist = {}) {
  return therapist.email || therapist.user?.email || '-';
}

function getTherapistPhone(therapist = {}) {
  return therapist.phone || therapist.user?.phone || '';
}

function renderMeta(label, value) {
  return `
    <div class="meta-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || '-')}</strong>
    </div>
  `;
}

function renderSchedule(schedule = {}) {
  const entries = Object.entries(schedule || {})
    .filter(([, value]) => value && (value.start || value.end));
  if (entries.length === 0) return '<p class="muted">Jadwal kerja belum diisi.</p>';
  return `
    <div class="schedule-grid">
      ${entries.map(([day, value]) => `
        <div class="schedule-card">
          <span>${escapeHtml(day)}</span>
          <strong>${escapeHtml(value.start || '-')} - ${escapeHtml(value.end || '-')}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

async function makeQrDataUrl(loginUrl) {
  try {
    return await QRCode.toDataURL(loginUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 164,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
  } catch {
    return '';
  }
}

async function buildTherapistRegistrationHtml({ therapist = {}, temporaryPassword = '', centerSettings = {}, loginUrl = '' }) {
  const center = normalizeCenterInfo({ ...centerSettings, logoUrl: centerSettings.logoUrl || fallbackLogoUrl });
  const generatedAt = formatDateTime();
  const login = loginUrl || getTherapistLoginUrl(centerSettings);
  const qrDataUrl = await makeQrDataUrl(login);
  const name = getTherapistName(therapist);
  const filename = sanitizeFilePart(`Surat-Registrasi-${name}-${therapist.nit || therapist.id || generatedAt}`);
  const phone = getTherapistPhone(therapist);
  const contactLine = [
    center.phone ? `Telp/WA: ${center.phone}` : '',
    center.email ? `Email: ${center.email}` : '',
    center.website ? `Web: ${center.website}` : '',
  ].filter(Boolean).join(' | ');

  return {
    title: filename,
    html: `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(filename)}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f8fafc;
      color: #0f172a;
      font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      line-height: 1.5;
    }
    .document {
      position: relative;
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      overflow: hidden;
      background: #ffffff;
      padding: 30px 34px;
      box-shadow: 0 18px 60px rgba(15, 23, 42, 0.12);
    }
    .watermark {
      position: absolute;
      inset: 42% auto auto 50%;
      z-index: 0;
      transform: translate(-50%, -50%) rotate(-24deg);
      color: rgba(220, 38, 38, 0.08);
      font-size: 72px;
      font-weight: 950;
      letter-spacing: .08em;
      white-space: nowrap;
      pointer-events: none;
    }
    .content { position: relative; z-index: 1; }
    .brand-header {
      display: flex;
      align-items: center;
      gap: 18px;
      padding-bottom: 18px;
      border-bottom: 4px solid ${center.primaryColor};
    }
    .logo-wrap {
      width: 78px;
      height: 78px;
      border: 1px solid #dbeafe;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: #eff6ff;
      flex: 0 0 auto;
    }
    .logo-wrap img { width: 100%; height: 100%; object-fit: contain; padding: 8px; }
    .brand-copy { flex: 1; min-width: 0; }
    .brand-copy h1 { margin: 0; font-size: 25px; letter-spacing: 0; line-height: 1.12; }
    .brand-copy .subtitle { margin: 4px 0 8px; color: ${center.secondaryColor}; font-weight: 800; font-size: 13px; }
    .brand-copy p { margin: 2px 0; color: #475569; font-size: 11.5px; }
    .secret-chip {
      border: 1px solid #fecaca;
      background: #fef2f2;
      color: #b91c1c;
      border-radius: 999px;
      padding: 8px 13px;
      font-weight: 950;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .1em;
      white-space: nowrap;
    }
    .title-row { margin: 24px 0 18px; display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; }
    .title-row h2 { margin: 0; font-size: 22px; line-height: 1.18; }
    .title-row p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 18px; }
    .meta-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; background: rgba(248, 250, 252, 0.92); }
    .meta-card span { display: block; color: #64748b; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 3px; }
    .meta-card strong { display: block; color: #0f172a; font-size: 13px; word-break: break-word; }
    .login-box {
      display: grid;
      grid-template-columns: 1fr 180px;
      gap: 16px;
      margin: 18px 0;
      border: 1px solid #bfdbfe;
      border-radius: 16px;
      background: #eff6ff;
      padding: 16px;
      break-inside: avoid;
    }
    .login-box h3, .section h3 { margin: 0 0 8px; font-size: 14px; color: #0f172a; }
    .login-url { margin-top: 8px; color: #1d4ed8; font-size: 12px; font-weight: 900; word-break: break-all; }
    .secret-value {
      display: inline-flex;
      margin-top: 8px;
      border: 1px dashed #b91c1c;
      border-radius: 10px;
      background: #fff;
      padding: 8px 10px;
      color: #991b1b;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-weight: 950;
      letter-spacing: .04em;
    }
    .qr-wrap { display: flex; align-items: center; justify-content: center; border-radius: 14px; background: #ffffff; padding: 10px; }
    .qr-wrap img { width: 150px; height: 150px; object-fit: contain; }
    .section { margin-top: 18px; padding-top: 16px; border-top: 1px solid #e2e8f0; break-inside: avoid; }
    .section p, .muted { margin: 0; color: #334155; font-size: 12.5px; }
    .schedule-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .schedule-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 9px 10px; background: #ffffff; }
    .schedule-card span { display: block; color: #64748b; font-size: 10px; font-weight: 900; text-transform: uppercase; }
    .schedule-card strong { display: block; color: #0f172a; font-size: 12px; margin-top: 2px; }
    .warning-box { margin-top: 18px; border: 1px solid #fed7aa; border-radius: 14px; background: #fff7ed; padding: 14px 16px; break-inside: avoid; }
    .warning-box h3 { margin: 0 0 6px; color: #9a3412; font-size: 14px; }
    .warning-box p { margin: 0; color: #9a3412; font-size: 12.5px; }
    .footer {
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      gap: 18px;
      color: #64748b;
      font-size: 10.5px;
    }
    @media screen and (max-width: 720px) {
      .document { width: 100%; min-height: auto; padding: 22px 18px; }
      .brand-header, .title-row, .footer { flex-direction: column; align-items: flex-start; }
      .meta-grid, .login-box, .schedule-grid { grid-template-columns: 1fr; }
      .qr-wrap { justify-content: flex-start; }
    }
    @media print {
      body { background: #ffffff; }
      .document { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <main class="document">
    <div class="watermark">RAHASIA</div>
    <div class="content">
      <header class="brand-header">
        <div class="logo-wrap">
          <img src="${escapeAttr(center.logoUrl || fallbackLogoUrl)}" alt="${escapeAttr(center.name)} logo">
        </div>
        <div class="brand-copy">
          <h1>${escapeHtml(center.name)}</h1>
          <div class="subtitle">${escapeHtml(center.subtitle)}</div>
          <p>${escapeHtml(center.address)}</p>
          ${contactLine ? `<p>${escapeHtml(contactLine)}</p>` : ''}
        </div>
        <div class="secret-chip">Dokumen Rahasia</div>
      </header>

      <section class="title-row">
        <div>
          <h2>Surat Registrasi Akun Terapis</h2>
          <p>Dokumen akses awal Therapist Portal. Simpan dan kirimkan hanya kepada pemilik akun.</p>
        </div>
        <div class="secret-chip">${escapeHtml(getTherapistSpecialty(therapist))}</div>
      </section>

      <section class="meta-grid">
        ${renderMeta('Nama Terapis', name)}
        ${renderMeta('NIT', therapist.nit || therapist.id || '-')}
        ${renderMeta('Peran / Spesialisasi', getTherapistSpecialty(therapist))}
        ${renderMeta('Nomor STR', therapist.strNumber || '-')}
        ${renderMeta('Masa Berlaku STR', formatDate(therapist.strExpiry))}
        ${renderMeta('Email', getTherapistEmail(therapist))}
        ${renderMeta('Nomor WhatsApp', phone || '-')}
        ${renderMeta('Ruangan Utama', therapist.primaryRoom || '-')}
      </section>

      <section class="login-box">
        <div>
          <h3>Informasi Login Awal</h3>
          <p>Gunakan NIT dan password sementara berikut untuk login pertama kali.</p>
          ${renderMeta('Link Login', login)}
          <div class="login-url">${escapeHtml(login)}</div>
          ${renderMeta('NIT / Username', therapist.nit || therapist.id || '-')}
          <div>
            <span class="secret-value">${temporaryPassword ? escapeHtml(temporaryPassword) : 'Password tidak ditampilkan. Reset password jika perlu.'}</span>
          </div>
        </div>
        <div class="qr-wrap">
          ${qrDataUrl ? `<img src="${escapeAttr(qrDataUrl)}" alt="QR login Therapist Portal">` : '<strong>QR tidak tersedia</strong>'}
        </div>
      </section>

      <section class="section">
        <h3>Jadwal Kerja Terdaftar</h3>
        ${renderSchedule(therapist.schedule)}
      </section>

      <section class="section">
        <h3>Detail Kualifikasi</h3>
        <p>Pendidikan: ${escapeHtml([therapist.educationLevel, therapist.educationField, therapist.educationInstitution].filter(Boolean).join(' - ') || '-')}</p>
        <p>Pengalaman: ${escapeHtml(therapist.yearsExperience || '-')}</p>
        <p>Bahasa: ${escapeHtml(therapist.languages || '-')}</p>
      </section>

      <section class="warning-box">
        <h3>Wajib diperbarui setelah login pertama</h3>
        <p>Terapis wajib segera mengganti password sementara, memeriksa email, nomor WhatsApp, STR, jadwal kerja, dan informasi profil. Jika ada data tidak sesuai, hubungi admin pusat terapi sebelum menggunakan akun untuk operasional.</p>
      </section>

      <footer class="footer">
        <span>Dibuat pada ${escapeHtml(generatedAt)}</span>
        <span>Dokumen ini bersifat rahasia dan hanya untuk pemilik akun terdaftar.</span>
      </footer>
    </div>
  </main>
</body>
</html>`,
  };
}

function buildPreviewHtml(html, title) {
  const toolbar = `
    <div class="print-toolbar">
      <div>
        <strong>Preview Surat Registrasi</strong>
        <span>${escapeHtml(title)}</span>
      </div>
      <div class="print-toolbar-actions">
        <button type="button" onclick="window.print()">Cetak / Simpan PDF</button>
        <button type="button" class="secondary" onclick="window.close()">Tutup</button>
      </div>
    </div>
  `;
  const toolbarStyles = `
    .print-toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 12px 20px;
      background: #0f172a;
      color: #ffffff;
      box-shadow: 0 10px 32px rgba(15, 23, 42, 0.22);
    }
    .print-toolbar strong { display: block; font-size: 14px; line-height: 1.2; }
    .print-toolbar span { display: block; color: #cbd5e1; font-size: 11px; margin-top: 2px; }
    .print-toolbar-actions { display: flex; gap: 10px; align-items: center; }
    .print-toolbar button {
      border: 0;
      border-radius: 10px;
      padding: 9px 14px;
      background: #2563eb;
      color: #ffffff;
      font-weight: 800;
      font-size: 12px;
      cursor: pointer;
    }
    .print-toolbar button.secondary { background: #334155; }
    .print-toolbar button:hover { filter: brightness(1.08); }
    @media print { .print-toolbar { display: none !important; } }
  `;
  return html
    .replace('</style>', `${toolbarStyles}</style>`)
    .replace('<body>', `<body>${toolbar}`);
}

function openBlobPreview(html, title) {
  if (typeof URL === 'undefined' || typeof Blob === 'undefined') return false;
  const blob = new Blob([buildPreviewHtml(html, title)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

export async function openTherapistRegistrationLetter({ therapist = {}, temporaryPassword = '', centerSettings = {}, loginUrl = '' }) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { ok: false, reason: 'browser-unavailable' };
  }

  const { title, html } = await buildTherapistRegistrationHtml({ therapist, temporaryPassword, centerSettings, loginUrl });
  const printWindow = window.open('', '_blank', 'width=920,height=1100');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(buildPreviewHtml(html, title));
    printWindow.document.close();
    setTimeout(() => printWindow.focus(), 120);
    return { ok: true, mode: 'preview', title };
  }
  if (openBlobPreview(html, title)) return { ok: true, mode: 'blob-preview', title };
  return { ok: false, reason: 'popup-blocked', title };
}

export function normalizePhoneForWhatsApp(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
}

export function buildTherapistRegistrationWhatsAppUrl({ therapist = {}, centerSettings = {}, loginUrl = '' }) {
  const phone = normalizePhoneForWhatsApp(getTherapistPhone(therapist));
  if (!phone) return '';
  const center = normalizeCenterInfo(centerSettings);
  const login = loginUrl || getTherapistLoginUrl(centerSettings);
  const message = [
    `Halo ${getTherapistName(therapist)}, akun Therapist Portal Anda telah dibuat oleh ${center.name}.`,
    '',
    `Link login: ${login}`,
    `NIT / Username: ${therapist.nit || therapist.id || '-'}`,
    '',
    'Password sementara ada di dokumen registrasi rahasia yang dikirim admin. Demi keamanan, segera ubah password dan periksa data profil setelah berhasil login.',
  ].join('\n');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export { buildTherapistRegistrationHtml };
