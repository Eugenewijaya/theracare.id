import React, { useEffect, useMemo, useState } from 'react';
import { adminApi, migrationApi, therapistsApi } from '../../../shared/api/client';

const todayString = () => new Date().toISOString().slice(0, 10);

const TEMPLATE = [
  'nama orang tua,nomor hp,email orang tua,alamat,nama anak,tanggal lahir,jenis kelamin,diagnosa,sekolah,program,total sesi,sesi sudah berjalan,tanggal mulai,tanggal sesi pertama,tanggal sesi terakhir,terapis utama,terapis pendamping,hari terapi,jam mulai,durasi,ruangan,iep goals,baseline,catatan',
  'Budi Santoso,081234567890,budi@example.com,Jl. Kenanga 1,Andi Santoso,2020-05-15,male,ASD,TK Mawar,Occupational Therapy (OT),24,8,2026-02-01,2026-02-01,2026-05-20,NATHAN260101001,,Senin;Kamis,14:00,60,,Regulasi sensorik;Fokus meja,Mudah terdistraksi saat transisi,Data awal dari IEP Excel',
].join('\n');

const initialManualForm = {
  parentName: '',
  parentPhone: '',
  parentEmail: '',
  parentAddress: '',
  childName: '',
  childDob: '',
  childGender: '',
  diagnosis: '',
  school: '',
  programName: '',
  programId: '',
  totalSessions: 12,
  completedSessions: 0,
  startDate: todayString(),
  firstKnownDate: '',
  lastKnownDate: '',
  therapistId: '',
  assistantTherapistId: '',
  scheduleDay: '',
  startTime: '09:00',
  duration: 60,
  roomId: '',
  goals: '',
  baseline: '',
  notes: '',
};

function parseDelimitedText(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  const delimiter = ['\t', ';', ',']
    .map(candidate => ({ candidate, count: lines[0].split(candidate).length }))
    .sort((a, b) => b.count - a.count)[0].candidate;
  const parseLine = (line) => {
    const cells = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && quoted && next === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  };
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line, rowIndex) => {
    const values = parseLine(line);
    return headers.reduce((row, header, index) => ({
      ...row,
      [header || `column_${index + 1}`]: values[index] || '',
      __rowNumber: rowIndex + 2,
    }), {});
  });
}

function statusTone(status) {
  if (status === 'applied') return 'bg-emerald-100 text-emerald-700';
  if (status === 'failed') return 'bg-red-100 text-red-700';
  if (status === 'needs_review') return 'bg-amber-100 text-amber-700';
  return 'bg-blue-100 text-blue-700';
}

function BatchSummary({ batch }) {
  if (!batch) return null;
  const summary = batch.summary || {};
  const items = [
    { label: 'Total baris', value: summary.totalRows || 0 },
    { label: 'Siap apply', value: summary.readyRows || 0 },
    { label: 'Perlu review', value: summary.blockedRows || 0 },
    { label: 'Applied', value: summary.appliedRows || 0 },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(item => (
        <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">{item.label}</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function RecordTable({ records = [] }) {
  if (!records.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900/60">
        Belum ada hasil dry-run.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-950">
            <tr>
              {['Row', 'Anak', 'Program', 'Progress Awal', 'Terapis', 'Status', 'Catatan'].map(head => (
                <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {records.map(record => {
              const data = record.normalizedData || {};
              const period = data.period || {};
              const child = data.child || {};
              const program = data.program || {};
              const issues = [...(record.errors || []), ...(record.warnings || [])];
              return (
                <tr key={record.id} className="align-top">
                  <td className="px-4 py-3 font-black text-slate-800 dark:text-slate-100">{record.rowNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900 dark:text-white">{child.name || child.id || '-'}</p>
                    <p className="text-xs text-slate-500">{data.parent?.name || data.parent?.phone || '-'}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">{program.type || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">{period.completedSessions || 0}/{period.totalSessions || 0} sesi</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{period.therapistId || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-black ${statusTone(record.status)}`}>
                      {record.status}
                    </span>
                    <p className="mt-1 text-[11px] font-bold text-slate-500">Confidence {record.confidence || 0}%</p>
                  </td>
                  <td className="px-4 py-3">
                    {issues.length ? (
                      <ul className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {issues.slice(0, 4).map(issue => <li key={issue}>{issue}</li>)}
                      </ul>
                    ) : (
                      <span className="text-xs font-bold text-emerald-600">Siap diterapkan</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CenterMigrationPage() {
  const [activeTab, setActiveTab] = useState('import');
  const [programs, setPrograms] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [rawText, setRawText] = useState(TEMPLATE);
  const [fileName, setFileName] = useState('iep-template.csv');
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [manualForm, setManualForm] = useState(initialManualForm);

  useEffect(() => {
    const loadRefs = async () => {
      const [programRes, therapistRes] = await Promise.allSettled([
        adminApi.getPrograms(),
        therapistsApi.getAll(),
      ]);
      if (programRes.status === 'fulfilled' && programRes.value.ok) setPrograms(programRes.value.data?.data || []);
      if (therapistRes.status === 'fulfilled' && therapistRes.value.ok) setTherapists(therapistRes.value.data?.data || []);
    };
    loadRefs();
  }, []);

  const parsedRows = useMemo(() => parseDelimitedText(rawText), [rawText]);
  const hasBlockingRows = Boolean(batch?.records?.some(record => record.status === 'needs_review' || (record.errors || []).length));
  const canApply = Boolean(batch?.id) && !hasBlockingRows && !['applied', 'partially_applied'].includes(batch.status);

  const setManualValue = (key, value) => setManualForm(prev => ({ ...prev, [key]: value }));

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFileName(file.name);
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setMessage({ type: 'warning', text: 'Untuk v1, simpan Excel sebagai CSV atau copy-paste sheet ke area import sebelum dry-run.' });
      return;
    }
    setRawText(await file.text());
  };

  const handleDryRun = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const rows = parseDelimitedText(rawText);
      if (!rows.length) throw new Error('Isi minimal satu baris data setelah header.');
      const res = await migrationApi.dryRun({ sourceType: 'excel_paste', fileName, rows });
      if (!res.ok) throw new Error(res.data?.error || 'Dry-run migrasi gagal.');
      setBatch(res.data?.data || null);
      const summary = res.data?.data?.summary || {};
      setMessage({
        type: summary.blockedRows ? 'warning' : 'success',
        text: `${summary.readyRows || 0}/${summary.totalRows || 0} baris siap. ${summary.blockedRows || 0} baris perlu review.`,
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Dry-run migrasi gagal.' });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!batch?.id) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await migrationApi.applyBatch(batch.id);
      if (!res.ok) throw new Error(res.data?.error || 'Apply migrasi gagal.');
      setBatch(res.data?.data || null);
      const summary = res.data?.data?.summary || {};
      setMessage({ type: summary.failedRows ? 'warning' : 'success', text: `Apply selesai: ${summary.appliedRows || 0} berhasil, ${summary.failedRows || 0} gagal.` });
      window.dispatchEvent(new Event('childUpdated'));
      window.dispatchEvent(new Event('sessionUpdated'));
      window.dispatchEvent(new Event('notificationsUpdated'));
      window.dispatchEvent(new Event('programsUpdated'));
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Apply migrasi gagal.' });
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const selectedProgram = programs.find(program => program.id === manualForm.programId);
      const payload = {
        ...manualForm,
        programName: selectedProgram?.name || manualForm.programName,
      };
      const res = await migrationApi.manualIntake(payload);
      if (!res.ok) throw new Error(res.data?.error || 'Intake manual gagal.');
      setBatch(res.data?.data || null);
      setManualForm(initialManualForm);
      setMessage({ type: 'success', text: 'Intake manual berhasil dibuat sebagai periode berjalan.' });
      window.dispatchEvent(new Event('childUpdated'));
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (error) {
      const details = error?.details?.errors?.join?.(', ');
      setMessage({ type: 'error', text: details || error.message || 'Intake manual gagal.' });
    } finally {
      setLoading(false);
    }
  };

  const messageTone = message?.type === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : message?.type === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-red-200 bg-red-50 text-red-700';

  return (
    <div className="min-h-full bg-background-light dark:bg-background-dark">
      <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-primary">Onboarding Center</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">Migrasi Data & Continuity Mode</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
                Untuk center yang masih memakai kertas, Excel, atau WhatsApp. Data lama masuk sebagai opening balance, lalu sesi baru dilacak penuh di Theracare.
              </p>
            </div>
            <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {[
                ['import', 'Upload / Paste'],
                ['manual', 'Form Manual'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`rounded-lg px-4 py-2 text-sm font-black transition-colors ${activeTab === id ? 'bg-white text-primary shadow-sm dark:bg-slate-950' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {message && (
          <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${messageTone}`}>
            {message.text}
          </div>
        )}

        {activeTab === 'import' ? (
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Import IEP dari Excel/CSV</h2>
                  <p className="mt-1 text-sm text-slate-500">Paste dari Excel atau upload CSV, lalu cek dry-run sebelum apply.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  <span className="material-symbols-outlined text-[18px]">upload_file</span>
                  Pilih CSV
                  <input type="file" accept=".csv,.txt" onChange={handleFile} className="sr-only" />
                </label>
              </div>
              <div className="mt-4 grid gap-3">
                <input
                  value={fileName}
                  onChange={event => setFileName(event.target.value)}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="Nama file / batch"
                />
                <textarea
                  value={rawText}
                  onChange={event => setRawText(event.target.value)}
                  rows={16}
                  spellCheck={false}
                  className="min-h-[360px] rounded-xl border border-slate-300 bg-slate-950 px-3 py-3 font-mono text-xs leading-5 text-slate-100 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700"
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-semibold text-slate-500">{parsedRows.length} baris terdeteksi. `.xlsx` perlu disimpan sebagai CSV atau dipaste dari Excel.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRawText(TEMPLATE)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Reset Template
                    </button>
                    <button
                      type="button"
                      onClick={handleDryRun}
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">rule</span>
                      {loading ? 'Memproses...' : 'Dry-run'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <BatchSummary batch={batch} />
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Review Batch</h2>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!canApply || loading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">task_alt</span>
                  Apply Migrasi
                </button>
              </div>
              <RecordTable records={batch?.records || []} />
            </div>
          </section>
        ) : (
          <form onSubmit={handleManualSubmit} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-3">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Intake dari Form Kertas</h2>
                <p className="mt-1 text-sm text-slate-500">Gunakan ini untuk satu anak/periode berjalan. Sistem menyimpan sesi lama sebagai opening balance, bukan sesi palsu.</p>
              </div>
              {[
                ['parentName', 'Nama Orang Tua/Wali', 'text'],
                ['parentPhone', 'Nomor HP', 'tel'],
                ['parentEmail', 'Email Orang Tua', 'email'],
                ['parentAddress', 'Alamat', 'text'],
                ['childName', 'Nama Anak', 'text'],
                ['childDob', 'Tanggal Lahir Anak', 'date'],
                ['diagnosis', 'Diagnosa/Kondisi', 'text'],
                ['school', 'Sekolah', 'text'],
                ['totalSessions', 'Total Sesi Paket', 'number'],
                ['completedSessions', 'Sesi Sudah Berjalan', 'number'],
                ['startDate', 'Tanggal Mulai Periode', 'date'],
                ['firstKnownDate', 'Tanggal Sesi Pertama Lama', 'date'],
                ['lastKnownDate', 'Tanggal Sesi Terakhir Lama', 'date'],
                ['scheduleDay', 'Hari Terapi', 'text'],
                ['startTime', 'Jam Mulai', 'time'],
                ['duration', 'Durasi Menit', 'number'],
                ['roomId', 'Ruangan', 'text'],
              ].map(([key, label, type]) => (
                <label key={key} className="grid gap-1.5">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{label}</span>
                  <input
                    type={type}
                    value={manualForm[key] || ''}
                    onChange={event => setManualValue(key, event.target.value)}
                    className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
              ))}
              <label className="grid gap-1.5">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Jenis Kelamin</span>
                <select
                  value={manualForm.childGender}
                  onChange={event => setManualValue('childGender', event.target.value)}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">Pilih</option>
                  <option value="male">Laki-laki</option>
                  <option value="female">Perempuan</option>
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Program Layanan</span>
                <select
                  value={manualForm.programId}
                  onChange={event => {
                    const program = programs.find(item => item.id === event.target.value);
                    setManualForm(prev => ({ ...prev, programId: event.target.value, programName: program?.name || prev.programName }));
                  }}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">Isi manual / pilih program</option>
                  {programs.map(program => <option key={program.id} value={program.id}>{program.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Program Manual</span>
                <input
                  value={manualForm.programName}
                  onChange={event => setManualValue('programName', event.target.value)}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Terapis Utama</span>
                <select
                  value={manualForm.therapistId}
                  onChange={event => setManualValue('therapistId', event.target.value)}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">Pilih terapis</option>
                  {therapists.map(therapist => <option key={therapist.id} value={therapist.id}>{therapist.name} - {therapist.id}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Terapis Pendamping</span>
                <select
                  value={manualForm.assistantTherapistId}
                  onChange={event => setManualValue('assistantTherapistId', event.target.value)}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">Opsional</option>
                  {therapists.map(therapist => <option key={therapist.id} value={therapist.id}>{therapist.name} - {therapist.id}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 lg:col-span-3">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">IEP Goals</span>
                <textarea
                  rows={3}
                  value={manualForm.goals}
                  onChange={event => setManualValue('goals', event.target.value)}
                  placeholder="Pisahkan beberapa goal dengan titik koma."
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label className="grid gap-1.5 lg:col-span-3">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Baseline & Catatan Migrasi</span>
                <textarea
                  rows={3}
                  value={`${manualForm.baseline}${manualForm.notes ? `\n${manualForm.notes}` : ''}`}
                  onChange={event => {
                    const [baseline, ...rest] = event.target.value.split(/\r?\n/);
                    setManualForm(prev => ({ ...prev, baseline, notes: rest.join('\n') }));
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end border-t border-slate-200 pt-5 dark:border-slate-800">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">playlist_add_check</span>
                {loading ? 'Menyimpan...' : 'Buat Periode Berjalan'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
