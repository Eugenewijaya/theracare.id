import fallbackLogoUrl from './assets/login-logo.svg';

const SCALE_MAP = {
  1: 'Sangat Kurang',
  2: 'Kurang',
  3: 'Cukup',
  4: 'Baik',
  5: 'Sangat Baik',
};

const DEFAULT_CENTER_INFO = {
  clinicName: 'Special Needs Center',
  centerSubtitle: 'Pusat Terapi Anak dan Keluarga',
  centerAddress: 'Alamat pusat terapi dapat diperbarui melalui pengaturan branding.',
  centerPhone: '',
  centerEmail: '',
  centerWebsite: '',
  primaryColor: '#137fec',
  secondaryColor: '#14b8a6',
  logoUrl: '',
};

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

function sanitizeColor(value, fallback) {
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value || '') ? value : fallback;
}

function sanitizeFilePart(value) {
  return String(value || 'laporan')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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

function compact(values) {
  return values.filter((value) => String(value || '').trim());
}

function asList(value) {
  if (Array.isArray(value)) return value.filter((item) => String(item || '').trim());
  if (!value) return [];
  return String(value)
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isPeriodicReport(report) {
  return report?.type === 'periodik' || !!report?.dateFrom || !!report?.progressPoints || !!report?.improvementPoints;
}

function normalizeCenterInfo(settings = {}) {
  const source = { ...DEFAULT_CENTER_INFO, ...settings };
  const phone = source.centerPhone || source.phone || source.adminWhatsApp || '';
  return {
    name: source.centerName || source.clinicName || DEFAULT_CENTER_INFO.clinicName,
    subtitle: source.centerSubtitle || DEFAULT_CENTER_INFO.centerSubtitle,
    address: source.centerAddress || source.address || DEFAULT_CENTER_INFO.centerAddress,
    phone,
    email: source.centerEmail || source.email || '',
    website: source.centerWebsite || source.website || '',
    logoUrl: source.logoUrl || fallbackLogoUrl,
    primaryColor: sanitizeColor(source.primaryColor || source.brandColor, DEFAULT_CENTER_INFO.primaryColor),
    secondaryColor: sanitizeColor(source.secondaryColor, DEFAULT_CENTER_INFO.secondaryColor),
  };
}

function normalizeReport(report = {}) {
  const periodic = isPeriodicReport(report);
  return {
    ...report,
    isPeriodic: periodic,
    reportTypeLabel: periodic ? 'Laporan Periodik' : 'Laporan Harian',
    title: report.title || report.sessionFocus || (periodic ? 'Laporan Periodik Terapi' : 'Laporan Harian Terapi'),
    childName: report.childName || report.child?.name || report.childId || 'Anak',
    therapistName: report.therapistName || report.therapist || report.therapist?.name || '-',
    therapyType: periodic ? (report.program || report.sessionFocus || '-') : (report.therapyType || report.program || report.type || '-'),
    dateLabel: periodic
      ? compact([formatDate(report.dateFrom), formatDate(report.dateTo)]).join(' - ')
      : formatDate(report.date),
    statusLabel: report.status === 'approved' ? 'Siap Dibaca' : report.status ? report.status : 'Draft',
    evaluations: report.evaluations || {},
    progressPoints: asList(report.progressPoints),
    improvementPoints: asList(report.improvementPoints),
  };
}

function renderMeta(label, value) {
  return `
    <div class="meta-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || '-')}</strong>
    </div>
  `;
}

function renderTextSection(title, value) {
  if (!String(value || '').trim()) return '';
  return `
    <section class="section">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(value).replace(/\n/g, '<br>')}</p>
    </section>
  `;
}

function renderListSection(title, items, variant = 'default') {
  const list = asList(items);
  if (!list.length) return '';
  return `
    <section class="section">
      <h2>${escapeHtml(title)}</h2>
      <ul class="point-list ${variant}">
        ${list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    </section>
  `;
}

function renderEvaluations(evaluations) {
  const entries = Object.entries(evaluations || {}).filter(([, value]) => value);
  if (!entries.length) return '';
  return `
    <section class="section">
      <h2>Indikator Capaian Terapi</h2>
      <div class="evaluation-grid">
        ${entries.map(([label, value]) => {
          const numeric = Number(value);
          const pct = Number.isFinite(numeric) ? Math.max(0, Math.min(100, (numeric / 5) * 100)) : 0;
          return `
            <div class="evaluation-card">
              <div class="evaluation-label">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(SCALE_MAP[numeric] || value)}${Number.isFinite(numeric) ? ` (${numeric}/5)` : ''}</strong>
              </div>
              <div class="meter"><span style="width:${pct}%"></span></div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function buildReportHtml(reportInput, settingsInput) {
  const report = normalizeReport(reportInput);
  const center = normalizeCenterInfo(settingsInput);
  const generatedAt = formatDateTime();
  const filename = sanitizeFilePart(`${report.reportTypeLabel}-${report.childName}-${report.date || report.dateFrom || generatedAt}`);
  const contactLine = compact([
    center.phone ? `Telp/WA: ${center.phone}` : '',
    center.email ? `Email: ${center.email}` : '',
    center.website ? `Web: ${center.website}` : '',
  ]).join(' | ');

  return {
    title: filename,
    html: `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(filename)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f8fafc;
      color: #0f172a;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      line-height: 1.5;
    }
    .document {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #ffffff;
      padding: 30px 34px;
      box-shadow: 0 18px 60px rgba(15, 23, 42, 0.12);
    }
    .brand-header {
      display: flex;
      gap: 18px;
      align-items: flex-start;
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
      background: linear-gradient(135deg, #eff6ff, #f0fdfa);
      flex: 0 0 auto;
    }
    .logo-wrap img { width: 100%; height: 100%; object-fit: contain; padding: 8px; }
    .logo-fallback {
      display: none;
      width: 100%;
      height: 100%;
      align-items: center;
      justify-content: center;
      color: ${center.primaryColor};
      font-size: 22px;
      font-weight: 900;
    }
    .brand-copy { flex: 1; min-width: 0; }
    .brand-copy h1 { margin: 0; font-size: 25px; letter-spacing: 0; line-height: 1.12; }
    .brand-copy .subtitle { margin: 4px 0 8px; color: ${center.secondaryColor}; font-weight: 800; font-size: 13px; }
    .brand-copy p { margin: 2px 0; color: #475569; font-size: 11.5px; }
    .doc-chip {
      border: 1px solid #bae6fd;
      background: #f0f9ff;
      color: #0369a1;
      border-radius: 999px;
      padding: 7px 12px;
      font-weight: 900;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .08em;
      white-space: nowrap;
    }
    .report-title { margin: 24px 0 18px; display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; }
    .report-title h2 { margin: 0; font-size: 22px; line-height: 1.18; }
    .report-title p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 22px; }
    .meta-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; background: #f8fafc; }
    .meta-card span { display: block; color: #64748b; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 3px; }
    .meta-card strong { display: block; color: #0f172a; font-size: 13px; }
    .section { margin-top: 18px; padding-top: 16px; border-top: 1px solid #e2e8f0; break-inside: avoid; }
    .section h2 { margin: 0 0 9px; font-size: 14px; color: #0f172a; }
    .section p { margin: 0; color: #334155; font-size: 12.5px; }
    .evaluation-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .evaluation-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; background: #ffffff; }
    .evaluation-label { display: flex; justify-content: space-between; gap: 10px; font-size: 11.5px; color: #334155; margin-bottom: 8px; }
    .evaluation-label strong { color: ${center.primaryColor}; text-align: right; white-space: nowrap; }
    .meter { width: 100%; height: 7px; border-radius: 999px; background: #e2e8f0; overflow: hidden; }
    .meter span { display: block; height: 100%; background: linear-gradient(90deg, ${center.secondaryColor}, ${center.primaryColor}); border-radius: inherit; }
    .point-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
    .point-list li { position: relative; padding-left: 20px; color: #334155; font-size: 12.5px; }
    .point-list li:before { content: ""; position: absolute; left: 0; top: 8px; width: 8px; height: 8px; border-radius: 50%; background: ${center.primaryColor}; }
    .point-list.positive li:before { background: #10b981; }
    .point-list.focus li:before { background: #f59e0b; }
    .note-box { margin-top: 20px; border: 1px solid #bbf7d0; border-radius: 14px; background: #f0fdf4; padding: 14px 16px; break-inside: avoid; }
    .note-box h2 { color: #166534; margin: 0 0 6px; font-size: 14px; }
    .note-box p { color: #166534; margin: 0; font-size: 12.5px; }
    .footer {
      margin-top: 26px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      gap: 18px;
      color: #64748b;
      font-size: 10.5px;
    }
    @media print {
      body { background: #ffffff; }
      .document { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <main class="document">
    <header class="brand-header">
      <div class="logo-wrap">
        <img src="${escapeAttr(center.logoUrl)}" alt="${escapeAttr(center.name)} logo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
        <div class="logo-fallback">${escapeHtml(center.name.charAt(0).toUpperCase())}</div>
      </div>
      <div class="brand-copy">
        <h1>${escapeHtml(center.name)}</h1>
        <div class="subtitle">${escapeHtml(center.subtitle)}</div>
        <p>${escapeHtml(center.address)}</p>
        ${contactLine ? `<p>${escapeHtml(contactLine)}</p>` : ''}
      </div>
      <div class="doc-chip">Laporan Terapi Anak</div>
    </header>

    <section class="report-title">
      <div>
        <h2>${escapeHtml(report.title)}</h2>
        <p>${escapeHtml(report.reportTypeLabel)} untuk pemantauan perkembangan anak.</p>
      </div>
      <div class="doc-chip">${escapeHtml(report.statusLabel)}</div>
    </section>

    <section class="meta-grid">
      ${renderMeta('Nama Anak', report.childName)}
      ${renderMeta('Terapis', report.therapistName)}
      ${renderMeta(report.isPeriodic ? 'Periode' : 'Tanggal Sesi', report.dateLabel)}
      ${renderMeta('Program / Fokus Terapi', report.therapyType)}
    </section>

    ${renderEvaluations(report.evaluations)}
    ${renderTextSection('Catatan Deskriptif', report.description || report.summary)}
    ${renderTextSection('Respons Anak Saat Sesi', report.childResponse)}
    ${renderTextSection('Kendala / Observasi Lanjutan', report.obstacles)}
    ${renderListSection('Pencapaian Periode Ini', report.progressPoints, 'positive')}
    ${renderListSection('Area yang Perlu Ditingkatkan', report.improvementPoints, 'focus')}
    ${report.parentNotes || report.recommendations ? `
      <section class="note-box">
        <h2>Catatan dan Saran untuk Orang Tua</h2>
        <p>${escapeHtml(report.parentNotes || report.recommendations).replace(/\n/g, '<br>')}</p>
      </section>
    ` : ''}

    <footer class="footer">
      <span>Dicetak pada ${escapeHtml(generatedAt)}</span>
      <span>Dokumen pendamping terapi anak. Mohon simpan sesuai kebutuhan keluarga.</span>
    </footer>
  </main>
</body>
</html>`,
  };
}

function writePrintableDocument(targetWindow, html) {
  const targetDocument = targetWindow.document;
  targetDocument.open();
  targetDocument.write(html);
  targetDocument.close();

  const print = () => {
    targetWindow.focus();
    targetWindow.print();
  };

  if (targetDocument.readyState === 'complete') {
    setTimeout(print, 300);
  } else {
    targetWindow.onload = () => setTimeout(print, 300);
  }
}

function printViaIframe(html, title) {
  const iframe = document.createElement('iframe');
  iframe.title = title;
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  document.body.appendChild(iframe);

  writePrintableDocument(iframe.contentWindow, html);
  setTimeout(() => iframe.remove(), 5000);
}

export function openReportPdf(report, centerSettings = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { ok: false, reason: 'browser-unavailable' };
  }

  const { title, html } = buildReportHtml(report, centerSettings);
  const printWindow = window.open('', '_blank', 'width=920,height=1100');
  if (printWindow) {
    writePrintableDocument(printWindow, html);
    return { ok: true, mode: 'window', title };
  }

  printViaIframe(html, title);
  return { ok: true, mode: 'iframe', title };
}

export { buildReportHtml, normalizeCenterInfo };
