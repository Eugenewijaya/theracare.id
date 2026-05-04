import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { therapistsApi, adminApi } from '../../shared/api/client';

// ─── Pop-up Notification ─────────────────────────────────────────────────────
function PopupNotif({ popup, onClose }) {
    if (!popup) return null;
    const cfg = {
        success: { icon: 'check_circle', bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-700', icon_color: 'text-emerald-600', text: 'text-emerald-800 dark:text-emerald-200' },
        error:   { icon: 'error',        bg: 'bg-red-50 dark:bg-red-900/30',     border: 'border-red-200 dark:border-red-700',     icon_color: 'text-red-600',     text: 'text-red-800 dark:text-red-200' },
        info:    { icon: 'info',         bg: 'bg-blue-50 dark:bg-blue-900/30',   border: 'border-blue-200 dark:border-blue-700',   icon_color: 'text-blue-600',    text: 'text-blue-800 dark:text-blue-200' },
    }[popup.type || 'info'];
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
            <div className={`${cfg.bg} ${cfg.border} border rounded-2xl shadow-2xl p-6 max-w-sm w-full flex flex-col items-center gap-3 text-center`} onClick={e => e.stopPropagation()}>
                <span className={`material-symbols-outlined text-5xl ${cfg.icon_color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
                {popup.title && <h3 className={`text-lg font-bold ${cfg.text}`}>{popup.title}</h3>}
                <p className={`text-sm ${cfg.text} opacity-90`}>{popup.message}</p>
                <button onClick={onClose} className={`mt-1 px-6 py-2 rounded-xl font-bold text-sm ${popup.type === 'success' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : popup.type === 'error' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                    OK
                </button>
            </div>
        </div>
    );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
const STEPS = ['Personal Info', 'Qualifications', 'Work Schedule', 'Review'];
function Stepper({ current }) {
    return (
        <div className="w-full">
            <div className="flex items-center justify-between relative before:absolute before:top-[20px] before:-translate-y-1/2 before:h-0.5 before:w-full before:bg-slate-200 dark:before:bg-slate-700 before:z-0">
                {STEPS.map((label, idx) => {
                    const step = idx + 1;
                    const isActive = step === current;
                    const isDone = step < current;
                    return (
                        <div key={label} className="relative z-10 flex flex-col items-center gap-2 bg-background-light dark:bg-background-dark px-2">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ring-4 ring-background-light dark:ring-background-dark transition-all duration-300 ${
                                isDone ? 'bg-emerald-500 text-white shadow-md shadow-emerald-300/40'
                                : isActive ? 'bg-primary text-white shadow-md shadow-primary/30'
                                : 'bg-white dark:bg-slate-800 text-slate-500 border-2 border-slate-300 dark:border-slate-600'
                            }`}>
                                {isDone ? <span className="material-symbols-outlined text-[20px]">check</span> : step}
                            </div>
                            <span className={`text-xs font-semibold transition-colors ${isActive ? 'text-primary' : isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>{label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Reusable Field Components ────────────────────────────────────────────────
function Field({ label, required, children, hint }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {children}
            {hint && <p className="text-xs text-slate-400">{hint}</p>}
        </div>
    );
}
const inputCls = "w-full h-11 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-shadow text-sm";
const selectCls = inputCls + " appearance-none cursor-pointer";

// ─── STEP 1: Personal Info ─────────────────────────────────────────────────
function Step1({ data, onChange }) {
    const [showPass, setShowPass] = useState(false);
    const generatePassword = () => {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
        let pass = 'Tc@' + Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        onChange('tempPassword', pass);
    };
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <Field label="Nama Depan" required>
                <input type="text" value={data.firstName} onChange={e => onChange('firstName', e.target.value)} required className={inputCls} placeholder="e.g. Sarah" />
            </Field>
            <Field label="Nama Belakang" required>
                <input type="text" value={data.lastName} onChange={e => onChange('lastName', e.target.value)} required className={inputCls} placeholder="e.g. Jenkins" />
            </Field>
            <Field label="Alamat Email" required className="md:col-span-2">
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px]">mail</span>
                    <input type="email" value={data.email} onChange={e => onChange('email', e.target.value)} required className={inputCls + " pl-10"} placeholder="sarah.jenkins@klinik.com" />
                </div>
            </Field>
            <Field label="Nomor Telepon" required>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px]">call</span>
                    <input type="tel" value={data.phone} onChange={e => onChange('phone', e.target.value)} required className={inputCls + " pl-10"} placeholder="08xx-xxxx-xxxx" />
                </div>
            </Field>
            <Field label="Spesialisasi Utama" required>
                <select value={data.specialty} onChange={e => onChange('specialty', e.target.value)} required className={selectCls}>
                    <option value="" disabled>Pilih spesialisasi...</option>
                    {data.programs && data.programs.map(p => (
                        <option key={p.id} value={`${p.name} (${p.code})`}>{p.name} ({p.code})</option>
                    ))}
                    <option value="Lainnya">Lainnya</option>
                </select>
                {data.specialty === 'Lainnya' && (
                    <input type="text" value={data.customSpecialty} onChange={e => onChange('customSpecialty', e.target.value)} className={inputCls + " mt-2"} placeholder="Masukkan spesialisasi..." required />
                )}
            </Field>

            {/* Account Setup */}
            <div className="md:col-span-2 mt-2 pt-5 border-t border-slate-200 dark:border-slate-800">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-slate-500">lock</span>
                    Pengaturan Akun
                </h3>
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <Field label="Password Sementara" required hint="Sampaikan password ini secara langsung kepada terapis untuk login pertama kali.">
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px]">key</span>
                                <input type={showPass ? 'text' : 'password'} value={data.tempPassword} onChange={e => onChange('tempPassword', e.target.value)} required className={inputCls + " pl-10 pr-10"} placeholder="e.g. TheraCare2024!" />
                                <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <span className="material-symbols-outlined text-[20px]">{showPass ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            </div>
                        </Field>
                    </div>
                    <button type="button" onClick={generatePassword} className="h-11 px-4 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 flex-shrink-0">
                        <span className="material-symbols-outlined text-[18px]">autorenew</span>
                        Generate
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── STEP 2: Qualifications ────────────────────────────────────────────────
function Step2({ data, onChange }) {
    const addCert = () => onChange('certifications', [...(data.certifications || []), { name: '', year: '', institution: '' }]);
    const removeCert = (i) => onChange('certifications', data.certifications.filter((_, idx) => idx !== i));
    const updateCert = (i, field, val) => {
        const updated = [...data.certifications];
        updated[i] = { ...updated[i], [field]: val };
        onChange('certifications', updated);
    };
    const EDUCATION_LEVELS = ['D3', 'S1', 'S2', 'S3', 'Profes'];
    return (
        <div className="flex flex-col gap-6">
            {/* Education */}
            <div>
                <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">school</span>
                    Riwayat Pendidikan
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Jenjang Pendidikan" required>
                        <select value={data.educationLevel} onChange={e => onChange('educationLevel', e.target.value)} required className={selectCls}>
                            <option value="">Pilih jenjang...</option>
                            {EDUCATION_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </Field>
                    <Field label="Bidang Studi / Jurusan" required>
                        <input type="text" value={data.educationField} onChange={e => onChange('educationField', e.target.value)} required className={inputCls} placeholder="e.g. Terapi Okupasi" />
                    </Field>
                    <Field label="Institusi Pendidikan" required>
                        <input type="text" value={data.educationInstitution} onChange={e => onChange('educationInstitution', e.target.value)} required className={inputCls} placeholder="e.g. Universitas Indonesia" />
                    </Field>
                    <Field label="Tahun Lulus">
                        <input type="number" value={data.graduationYear} onChange={e => onChange('graduationYear', e.target.value)} className={inputCls} placeholder="e.g. 2020" min="1980" max={new Date().getFullYear()} />
                    </Field>
                    <Field label="Nomor STR (Surat Tanda Registrasi)" required hint="Nomor lisensi resmi terapis.">
                        <input type="text" value={data.strNumber} onChange={e => onChange('strNumber', e.target.value)} required className={inputCls} placeholder="e.g. STR-OT-2024-001" />
                    </Field>
                    <Field label="Masa Berlaku STR">
                        <input type="date" value={data.strExpiry} onChange={e => onChange('strExpiry', e.target.value)} className={inputCls} />
                    </Field>
                </div>
            </div>

            {/* Certifications */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[20px]">workspace_premium</span>
                        Sertifikat & Pelatihan
                    </h3>
                    <button type="button" onClick={addCert} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors">
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        Tambah Sertifikat
                    </button>
                </div>
                {(!data.certifications || data.certifications.length === 0) ? (
                    <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                        <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">workspace_premium</span>
                        <p className="text-sm text-slate-400">Belum ada sertifikat. Klik "Tambah Sertifikat" untuk menambahkan.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {data.certifications.map((cert, i) => (
                            <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 relative">
                                <button type="button" onClick={() => removeCert(i)} className="absolute top-3 right-3 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                                <Field label={`Nama Sertifikat ${i + 1}`}>
                                    <input type="text" value={cert.name} onChange={e => updateCert(i, 'name', e.target.value)} className={inputCls} placeholder="e.g. Certified OT Specialist" />
                                </Field>
                                <Field label="Institusi Penyelenggara">
                                    <input type="text" value={cert.institution} onChange={e => updateCert(i, 'institution', e.target.value)} className={inputCls} placeholder="e.g. IOTI" />
                                </Field>
                                <Field label="Tahun">
                                    <input type="number" value={cert.year} onChange={e => updateCert(i, 'year', e.target.value)} className={inputCls} placeholder="e.g. 2023" min="2000" max={new Date().getFullYear()} />
                                </Field>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Years of Experience */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">military_tech</span>
                    Pengalaman Kerja
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Tahun Pengalaman" required>
                        <select value={data.yearsExperience} onChange={e => onChange('yearsExperience', e.target.value)} required className={selectCls}>
                            <option value="">Pilih...</option>
                            <option value="Kurang dari 1 tahun">Kurang dari 1 tahun</option>
                            <option value="1-2 tahun">1–2 tahun</option>
                            <option value="3-5 tahun">3–5 tahun</option>
                            <option value="6-10 tahun">6–10 tahun</option>
                            <option value="Lebih dari 10 tahun">Lebih dari 10 tahun</option>
                        </select>
                    </Field>
                    <Field label="Bahasa yang Dikuasai">
                        <input type="text" value={data.languages} onChange={e => onChange('languages', e.target.value)} className={inputCls} placeholder="e.g. Bahasa Indonesia, Inggris" />
                    </Field>
                    <div className="md:col-span-2">
                        <Field label="Catatan Tambahan / Bio Singkat" hint="Opsional. Akan ditampilkan pada profil terapis.">
                            <textarea value={data.bio} onChange={e => onChange('bio', e.target.value)} rows={3} className={inputCls + " h-auto py-3 resize-none"} placeholder="Deskripsikan pendekatan terapi dan keahlian khusus..." />
                        </Field>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── STEP 3: Work Schedule ─────────────────────────────────────────────────
const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
function Step3({ data, onChange }) {
    const toggleDay = (day) => {
        const sched = data.schedule || {};
        const existing = sched[day];
        onChange('schedule', {
            ...sched,
            [day]: existing ? undefined : { start: '08:00', end: '17:00' }
        });
    };
    const updateTime = (day, field, val) => {
        const sched = { ...(data.schedule || {}) };
        sched[day] = { ...sched[day], [field]: val };
        onChange('schedule', sched);
    };
    const sched = data.schedule || {};
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">calendar_month</span>
                    Jadwal Kerja Mingguan
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Pilih hari kerja dan atur jam layanan terapis.</p>
                <div className="flex flex-col gap-3">
                    {DAYS.map(day => {
                        const active = !!sched[day];
                        return (
                            <div key={day} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${active ? 'border-primary/40 bg-primary/5 dark:bg-primary/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'}`}>
                                <label className="flex items-center gap-3 cursor-pointer min-w-[120px]">
                                    <div onClick={() => toggleDay(day)} className={`relative w-11 h-6 rounded-full transition-colors duration-300 cursor-pointer flex-shrink-0 ${active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${active ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                    <span className={`text-sm font-semibold ${active ? 'text-primary' : 'text-slate-500'}`}>{day}</span>
                                </label>
                                {active ? (
                                    <div className="flex items-center gap-2 flex-1">
                                        <Field label="Mulai">
                                            <input type="time" value={sched[day]?.start || '08:00'} onChange={e => updateTime(day, 'start', e.target.value)} className={inputCls + " w-36"} />
                                        </Field>
                                        <span className="text-slate-400 font-bold pt-5">–</span>
                                        <Field label="Selesai">
                                            <input type="time" value={sched[day]?.end || '17:00'} onChange={e => updateTime(day, 'end', e.target.value)} className={inputCls + " w-36"} />
                                        </Field>
                                        <div className="pt-5 text-xs text-slate-400 font-medium">
                                            {sched[day]?.start && sched[day]?.end && (() => {
                                                const [sh, sm] = sched[day].start.split(':').map(Number);
                                                const [eh, em] = sched[day].end.split(':').map(Number);
                                                const diff = (eh * 60 + em) - (sh * 60 + sm);
                                                if (diff <= 0) return null;
                                                return `${Math.floor(diff / 60)}j ${diff % 60}m`;
                                            })()}
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-xs text-slate-400 italic">Tidak aktif / libur</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">person_pin_circle</span>
                    Penugasan Ruangan
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Ruangan Utama">
                        <select value={data.primaryRoom} onChange={e => onChange('primaryRoom', e.target.value)} className={selectCls}>
                            <option value="">Pilih ruangan...</option>
                            <option value="Sensory Room 1">Sensory Room 1</option>
                            <option value="Sensory Room 2">Sensory Room 2</option>
                            <option value="Speech Room A">Speech Room A</option>
                            <option value="Speech Room B">Speech Room B</option>
                            <option value="OT Room Large">OT Room Large</option>
                        </select>
                    </Field>
                    <Field label="Kapasitas Klien per Hari" hint="Maksimal anak yang dilayani per hari kerja.">
                        <input type="number" value={data.maxClients} onChange={e => onChange('maxClients', e.target.value)} className={inputCls} placeholder="e.g. 6" min="1" max="20" />
                    </Field>
                </div>
            </div>
        </div>
    );
}

// ─── STEP 4: Review ────────────────────────────────────────────────────────
function Step4({ data }) {
    const activeDays = Object.entries(data.schedule || {}).filter(([, v]) => v).map(([day, times]) => `${day} (${times.start}–${times.end})`);
    const fullSpec = data.specialty === 'Lainnya' ? data.customSpecialty : data.specialty;
    return (
        <div className="flex flex-col gap-6">
            <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[22px] mt-0.5">info</span>
                <p className="text-sm text-primary font-medium">Periksa kembali semua data sebelum mendaftarkan terapis. Setelah didaftarkan, NIT (Nomor Identitas Terapis) akan dibuat otomatis.</p>
            </div>

            {/* Personal & Account */}
            <ReviewSection title="Informasi Personal & Akun" icon="badge">
                <ReviewRow label="Nama Lengkap" value={`${data.firstName} ${data.lastName}`} />
                <ReviewRow label="Email" value={data.email} />
                <ReviewRow label="Telepon" value={data.phone} />
                <ReviewRow label="Spesialisasi" value={<span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold">{fullSpec || '—'}</span>} />
                <ReviewRow label="Password Sementara" value={<code className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs font-mono">{'●'.repeat(data.tempPassword?.length || 8)}</code>} />
            </ReviewSection>

            {/* Qualifications */}
            <ReviewSection title="Kualifikasi" icon="school">
                <ReviewRow label="Pendidikan" value={`${data.educationLevel || '—'} ${data.educationField ? '– ' + data.educationField : ''}`} />
                <ReviewRow label="Institusi" value={data.educationInstitution || '—'} />
                <ReviewRow label="Nomor STR" value={data.strNumber || '—'} />
                <ReviewRow label="Pengalaman" value={data.yearsExperience || '—'} />
                {data.certifications?.length > 0 && (
                    <ReviewRow label="Sertifikat" value={
                        <div className="flex flex-wrap gap-1">
                            {data.certifications.filter(c => c.name).map((c, i) => (
                                <span key={i} className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded text-xs font-medium">{c.name} {c.year && `(${c.year})`}</span>
                            ))}
                        </div>
                    } />
                )}
            </ReviewSection>

            {/* Schedule */}
            <ReviewSection title="Jadwal Kerja" icon="calendar_month">
                {activeDays.length > 0 ? (
                    <ReviewRow label="Hari Aktif" value={
                        <div className="flex flex-wrap gap-1">
                            {activeDays.map((d, i) => <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs font-medium">{d}</span>)}
                        </div>
                    } />
                ) : (
                    <p className="text-sm text-amber-600 italic">Belum ada jadwal yang dipilih.</p>
                )}
                {data.primaryRoom && <ReviewRow label="Ruangan Utama" value={data.primaryRoom} />}
                {data.maxClients && <ReviewRow label="Kapasitas per Hari" value={`${data.maxClients} klien`} />}
            </ReviewSection>
        </div>
    );
}

function ReviewSection({ title, icon, children }) {
    return (
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">{icon}</span>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{title}</h4>
            </div>
            <div className="p-5 flex flex-col gap-3">{children}</div>
        </div>
    );
}

function ReviewRow({ label, value }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 sm:w-40 flex-shrink-0">{label}</span>
            <span className="text-sm text-slate-900 dark:text-slate-100 font-medium">{value || '—'}</span>
        </div>
    );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
const EMPTY_DATA = {
    // Step 1
    firstName: '', lastName: '', email: '', phone: '', specialty: '', customSpecialty: '', tempPassword: '',
    // Step 2
    educationLevel: '', educationField: '', educationInstitution: '', graduationYear: '',
    strNumber: '', strExpiry: '', certifications: [], yearsExperience: '', languages: '', bio: '',
    // Step 3
    schedule: {}, primaryRoom: '', maxClients: '',
};

function App() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState(EMPTY_DATA);
    const [programs, setPrograms] = useState([]);
    const [popup, setPopup] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const pRes = await adminApi.getPrograms();
                setPrograms(pRes.data?.data || []);
            } catch (e) {}
        };
        load();
    }, []);

    const showPopup = (type, title, message) => setPopup({ type, title, message });
    const closePopup = () => {
        if (popup?.onClose) popup.onClose();
        setPopup(null);
    };

    const updateField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const validateStep = (step) => {
        if (step === 1) {
            if (!formData.firstName.trim()) return 'Nama depan wajib diisi.';
            if (!formData.lastName.trim()) return 'Nama belakang wajib diisi.';
            if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) return 'Email tidak valid.';
            if (!formData.phone.trim()) return 'Nomor telepon wajib diisi.';
            if (!formData.specialty) return 'Spesialisasi wajib dipilih.';
            if (formData.specialty === 'Lainnya' && !formData.customSpecialty.trim()) return 'Masukkan spesialisasi kustom.';
            if (!formData.tempPassword.trim() || formData.tempPassword.length < 6) return 'Password minimal 6 karakter.';
        }
        if (step === 2) {
            if (!formData.educationLevel) return 'Jenjang pendidikan wajib dipilih.';
            if (!formData.educationField.trim()) return 'Bidang studi wajib diisi.';
            if (!formData.educationInstitution.trim()) return 'Institusi pendidikan wajib diisi.';
            if (!formData.strNumber.trim()) return 'Nomor STR wajib diisi.';
            if (!formData.yearsExperience) return 'Tahun pengalaman wajib dipilih.';
        }
        return null;
    };

    const isStepValid = !validateStep(currentStep);

    const handleNext = () => {
        const error = validateStep(currentStep);
        if (error) {
            showPopup('error', 'Validasi Gagal', error);
            return;
        }
        setCurrentStep(p => p + 1);
    };

    const handleBack = () => setCurrentStep(p => p - 1);

    const handleSubmit = async () => {
        const scheduleEmpty = Object.values(formData.schedule).filter(Boolean).length === 0;
        if (scheduleEmpty) {
            showPopup('error', 'Jadwal Diperlukan', 'Pilih setidaknya satu hari kerja untuk terapis.');
            return;
        }
        setSubmitting(true);
        try {
            const fullName = `${formData.firstName} ${formData.lastName}`.trim();
            const specialization = formData.specialty === 'Lainnya' ? formData.customSpecialty : formData.specialty;
            
            const res = await therapistsApi.create({
                name: fullName,
                phone: formData.phone,
                email: formData.email,
                specialization,
                specialty: specialization,
                educationLevel: formData.educationLevel,
                educationField: formData.educationField,
                educationInstitution: formData.educationInstitution,
                strNumber: formData.strNumber,
                strExpiry: formData.strExpiry,
                yearsExperience: formData.yearsExperience,
                certifications: formData.certifications.filter(c => c.name.trim()),
                languages: formData.languages,
                bio: formData.bio,
                schedule: formData.schedule,
                primaryRoom: formData.primaryRoom,
                maxClients: formData.maxClients ? parseInt(formData.maxClients) : null,
                tempPassword: formData.tempPassword,
            });

            const therapist = res.data?.data || {};

            setPopup({
                type: 'success',
                title: 'Terapis Berhasil Didaftarkan!',
                message: `${fullName} telah berhasil didaftarkan dengan NIT: ${therapist.nit || 'Generated'}. Password sementara: ${formData.tempPassword}`,
                onClose: () => navigate('/therapists'),
            });
        } catch (err) {
            showPopup('error', 'Gagal Mendaftarkan', 'Terjadi kesalahan. Silakan coba lagi.');
        } finally {
            setSubmitting(false);
        }
    };

    const STEP_TITLES = [
        { title: 'Informasi Personal', desc: 'Data kontak, spesialisasi, dan pengaturan akun.' },
        { title: 'Kualifikasi & Sertifikasi', desc: 'Pendidikan, lisensi STR, dan pengalaman terapis.' },
        { title: 'Jadwal & Ruangan', desc: 'Hari kerja, jam layanan, dan penugasan ruangan.' },
        { title: 'Review & Konfirmasi', desc: 'Periksa semua data sebelum menyimpan.' },
    ];

    return (
        <main className="min-h-screen bg-background-light dark:bg-background-dark">
            <PopupNotif popup={popup} onClose={closePopup} />

            {/* Header */}
            <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-8 py-4 flex items-center gap-4 sticky top-0 z-30">
                <button onClick={() => navigate('/therapists')} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                </button>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <span className="material-symbols-outlined text-primary text-[22px]">person_add</span>
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Pendaftaran Terapis Baru</h1>
                        <p className="text-xs text-slate-500">Langkah {currentStep} dari {STEPS.length}</p>
                    </div>
                </div>
            </header>

            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
                {/* Stepper */}
                <Stepper current={currentStep} />

                {/* Form Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    {/* Card Header */}
                    <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{STEP_TITLES[currentStep - 1].title}</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{STEP_TITLES[currentStep - 1].desc}</p>
                    </div>

                    {/* Card Body */}
                    <div className="p-6">
                        {currentStep === 1 && <Step1 data={{...formData, programs}} onChange={updateField} />}
                        {currentStep === 2 && <Step2 data={formData} onChange={updateField} />}
                        {currentStep === 3 && <Step3 data={formData} onChange={updateField} />}
                        {currentStep === 4 && <Step4 data={formData} />}
                    </div>

                    {/* Card Footer */}
                    <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={currentStep === 1 ? () => navigate('/therapists') : handleBack}
                            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">{currentStep === 1 ? 'close' : 'arrow_back'}</span>
                            {currentStep === 1 ? 'Batal' : 'Kembali'}
                        </button>

                        {currentStep < 4 ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={!isStepValid}
                                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Lanjut ke {STEPS[currentStep]}
                                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-60"
                            >
                                <span className="material-symbols-outlined text-[18px]">{submitting ? 'hourglass_empty' : 'person_add'}</span>
                                {submitting ? 'Mendaftarkan...' : 'Daftarkan Terapis'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}

export default App;
