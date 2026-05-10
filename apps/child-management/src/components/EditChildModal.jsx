import React, { useState, useEffect } from 'react';
import { therapistsApi, adminApi, childrenApi, therapyPeriodsApi } from '../../../shared/api/client';

const DAY_OPTIONS = [
    { value: 'Monday', label: 'Senin' },
    { value: 'Tuesday', label: 'Selasa' },
    { value: 'Wednesday', label: 'Rabu' },
    { value: 'Thursday', label: 'Kamis' },
    { value: 'Friday', label: 'Jumat' },
    { value: 'Saturday', label: 'Sabtu' },
    { value: 'Sunday', label: 'Minggu' },
];

const EditChildModal = ({ child, onClose }) => {
    const [therapists, setTherapists] = useState([]);
    const [programsList, setProgramsList] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const activePeriod = child.activePeriod || (Array.isArray(child.periods) ? child.periods.find(p => ['active', 'planned'].includes(p.status)) || child.periods[0] : null);
    const [periodDraft, setPeriodDraft] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        totalSessions: activePeriod?.totalSessions || 12,
        pricePerSession: activePeriod?.pricePerSession || 0,
        pricePerMonth: activePeriod?.pricePerMonth || 0,
        billingMode: activePeriod?.billingMode || 'per_session',
        therapyDays: [],
        sessionStartTime: '09:00',
        sessionDuration: '60',
    });

    const [formData, setFormData] = useState({
        firstName: child.firstName || child.name?.split(' ')[0] || '',
        lastName: child.lastName || child.name?.split(' ').slice(1).join(' ') || '',
        dob: child.dob || '',
        diagnosis: child.diagnosis || '',
        program: child.programs?.[0]?.name || child.program || '',
        therapistId: child.therapistId || ''
    });
    
    useEffect(() => {
        const loadFormData = async () => {
            try {
                const [tRes, pRes] = await Promise.all([
                    therapistsApi.getAll(),
                    adminApi.getPrograms()
                ]);
                setTherapists(tRes.data?.data || []);
                setProgramsList(pRes.data?.data || []);
            } catch (e) {
                console.error('Failed to load therapists/programs', e);
            }
        };
        loadFormData();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        // Build updates
        const updates = { ...formData };
        if (updates.program) {
            updates.programs = [{ name: updates.program, color: 'emerald' }];
        }
        
        // Find therapist name for display purposes if needed
        const t = therapists.find(th => th.id === updates.therapistId);
        if (t) updates.therapist = t.name;

        try {
            await childrenApi.update(child.id || child.nita, updates);
            // Dispatch event so UI updates
            window.dispatchEvent(new CustomEvent('childUpdated'));
            onClose();
        } catch (e) {
            console.error('Failed to update child', e);
            alert('Failed to save changes.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateNextPeriod = async () => {
        const selectedProgram = programsList.find(program => program.name === formData.program);
        const scheduleRules = Array.isArray(periodDraft.therapyDays)
            ? periodDraft.therapyDays.map(day => ({
                day,
                startTime: periodDraft.sessionStartTime || '09:00',
                duration: `${periodDraft.sessionDuration || 60} mins`,
                therapistId: formData.therapistId || child.therapistId,
            }))
            : [];
        const payload = {
            childId: child.id || child.nita,
            programId: selectedProgram?.id || activePeriod?.programId || child.programs?.[0]?.programId,
            therapyProgramId: activePeriod?.therapyProgramId,
            type: formData.program || activePeriod?.programName || child.program || 'Program Terapi',
            startDate: periodDraft.startDate,
            endDate: periodDraft.endDate || null,
            totalSessions: Number(periodDraft.totalSessions || 12),
            pricePerSession: Number(periodDraft.pricePerSession || 0),
            pricePerMonth: Number(periodDraft.pricePerMonth || 0),
            billingMode: periodDraft.billingMode,
            scheduleRules,
            generateSessions: scheduleRules.length > 0,
        };
        if (!payload.startDate || !payload.totalSessions) {
            alert('Tanggal mulai dan jumlah sesi periode wajib diisi.');
            return;
        }
        if (scheduleRules.length > 0 && !scheduleRules.every(rule => rule.therapistId)) {
            alert('Pilih terapis utama sebelum generate jadwal periode.');
            return;
        }
        setIsSaving(true);
        try {
            const res = activePeriod?.id
                ? await therapyPeriodsApi.renew(activePeriod.id, payload)
                : await therapyPeriodsApi.create(payload);
            if (!res.ok) throw new Error(res.data?.error || 'Gagal membuat periode baru.');
            window.dispatchEvent(new CustomEvent('childUpdated'));
            alert('Periode terapi baru berhasil dibuat.');
            onClose();
        } catch (e) {
            console.error('Failed to create therapy period', e);
            alert(e.message || 'Gagal membuat periode baru.');
        } finally {
            setIsSaving(false);
        }
    };

    const togglePeriodDay = (day) => {
        setPeriodDraft(prev => {
            const current = Array.isArray(prev.therapyDays) ? prev.therapyDays : [];
            return {
                ...prev,
                therapyDays: current.includes(day) ? current.filter(item => item !== day) : [...current, day],
            };
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
                <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">edit</span>
                        Edit Profil Anak
                    </h3>
                    <button onClick={onClose} disabled={isSaving} className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-50">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Depan</label>
                            <input name="firstName" value={formData.firstName} onChange={handleChange} className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-primary focus:border-primary focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Belakang</label>
                            <input name="lastName" value={formData.lastName} onChange={handleChange} className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-primary focus:border-primary focus:outline-none" />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tanggal Lahir</label>
                        <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-primary focus:border-primary focus:outline-none" />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Diagnosa / Kondisi</label>
                        <input name="diagnosis" value={formData.diagnosis} onChange={handleChange} className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-primary focus:border-primary focus:outline-none" />
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Program Utama</label>
                        <select name="program" value={formData.program} onChange={handleChange} className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-primary focus:border-primary focus:outline-none">
                            <option value="">Pilih Program...</option>
                            {programsList.map(prog => <option key={prog.id} value={prog.name}>{prog.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Terapis Utama</label>
                        <select name="therapistId" value={formData.therapistId} onChange={handleChange} className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-primary focus:border-primary focus:outline-none">
                            <option value="">Pilih Terapis...</option>
                            {therapists.map(t => <option key={t.id} value={t.id}>{t.name} ({t.specialty})</option>)}
                        </select>
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
                        <div className="mb-3">
                            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">Periode Terapi</h4>
                            <p className="mt-1 text-xs text-slate-500">Gunakan ini untuk lanjut periode setelah sesi sebelumnya selesai.</p>
                        </div>
                        {Array.isArray(child.periods) && child.periods.length > 0 ? (
                            <div className="mb-4 flex flex-col gap-2">
                                {child.periods.map(period => (
                                    <div key={period.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold text-slate-800 dark:text-slate-100">{period.name} - {period.programName}</span>
                                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">{period.status}</span>
                                        </div>
                                        <p className="mt-1 text-slate-500">{period.startDate} sampai {period.endDate || 'selesai sesi'} - {period.sessionLabel}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">Belum ada periode terapi tersimpan.</p>
                        )}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Mulai Periode Baru</label>
                                <input type="date" value={periodDraft.startDate} onChange={e => setPeriodDraft(p => ({ ...p, startDate: e.target.value }))} className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-primary focus:border-primary focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Selesai</label>
                                <input type="date" value={periodDraft.endDate} onChange={e => setPeriodDraft(p => ({ ...p, endDate: e.target.value }))} className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-primary focus:border-primary focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Jumlah Sesi</label>
                                <input type="number" min="1" value={periodDraft.totalSessions} onChange={e => setPeriodDraft(p => ({ ...p, totalSessions: e.target.value }))} className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-primary focus:border-primary focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Mode Biaya</label>
                                <select value={periodDraft.billingMode} onChange={e => setPeriodDraft(p => ({ ...p, billingMode: e.target.value }))} className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-primary focus:border-primary focus:outline-none">
                                    <option value="per_session">Per sesi</option>
                                    <option value="per_month">Per bulan</option>
                                    <option value="package">Paket/periode</option>
                                </select>
                            </div>
                        </div>
                        <div className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Generate jadwal dari periode</p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {DAY_OPTIONS.map(day => (
                                    <button
                                        type="button"
                                        key={day.value}
                                        onClick={() => togglePeriodDay(day.value)}
                                        className={`h-9 rounded-lg border px-2 text-xs font-bold transition-colors ${periodDraft.therapyDays.includes(day.value) ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                                    >
                                        {day.label}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <input type="time" value={periodDraft.sessionStartTime} onChange={e => setPeriodDraft(p => ({ ...p, sessionStartTime: e.target.value }))} className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-primary focus:border-primary focus:outline-none" />
                                <select value={periodDraft.sessionDuration} onChange={e => setPeriodDraft(p => ({ ...p, sessionDuration: e.target.value }))} className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-primary focus:border-primary focus:outline-none">
                                    <option value="30">30 menit</option>
                                    <option value="45">45 menit</option>
                                    <option value="60">60 menit</option>
                                    <option value="90">90 menit</option>
                                </select>
                            </div>
                        </div>
                        <button type="button" onClick={handleCreateNextPeriod} disabled={isSaving} className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                            {activePeriod ? 'Lanjutkan ke Periode Baru' : 'Buat Periode Terapi'}
                        </button>
                    </div>
                </div>
                
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                    <button onClick={onClose} disabled={isSaving} className="px-4 py-2 rounded-lg font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">Batal</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 rounded-lg font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50">
                        {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditChildModal;
