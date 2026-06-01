import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { therapistsApi, adminApi, childrenApi } from '../../../shared/api/client';
import { confirmAction, notifyDialog } from '../../../shared/ui/confirmDialog';

function getEditableChildData(child = {}) {
    const nameParts = String(child.name || '').trim().split(/\s+/).filter(Boolean);
    const firstName = child.firstName ?? nameParts[0] ?? '';
    const lastName = child.lastName ?? nameParts.slice(1).join(' ') ?? '';
    return {
        firstName,
        lastName,
        dob: child.dob || '',
        diagnosis: child.diagnosis || '',
        program: child.programs?.[0]?.name || child.program || '',
    };
}

const EditChildModal = ({ child, onClose }) => {
    const navigate = useNavigate();
    const [therapists, setTherapists] = useState([]);
    const [programsList, setProgramsList] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const activePeriod = child.activePeriod || (Array.isArray(child.periods) ? child.periods.find(p => ['active', 'planned'].includes(p.status)) || child.periods[0] : null);
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const primaryTherapistId = child.assignmentSummary?.primaryTherapistId || child.therapistId || '';
    const firstAssistantId = child.assistantTherapistIds?.[0] || '';

    const [formData, setFormData] = useState(() => getEditableChildData(child));
    const [assignmentForm, setAssignmentForm] = useState({
        roleType: 'primary',
        fromTherapistId: primaryTherapistId,
        toTherapistId: '',
        effectiveDate: todayKey,
        transferFutureSessions: true,
        reason: '',
        superAdminPassword: '',
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

    const updateAssignment = (name, value) => {
        setAssignmentForm(prev => ({
            ...prev,
            [name]: value,
            ...(name === 'roleType'
                ? {
                    fromTherapistId: value === 'assistant' ? firstAssistantId : primaryTherapistId,
                    transferFutureSessions: value === 'primary',
                  }
                : {}),
        }));
    };

    const handleSave = async () => {
        const initialData = getEditableChildData(child);
        const normalizedFormData = {
            ...formData,
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            diagnosis: formData.diagnosis.trim(),
        };

        if (!normalizedFormData.firstName) {
            await notifyDialog({
                tone: 'warning',
                icon: 'error',
                title: 'Nama depan wajib diisi',
                message: 'Nama belakang boleh kosong, tetapi nama depan anak tetap wajib diisi.',
            });
            return;
        }

        if (initialData.program && !normalizedFormData.program) {
            await notifyDialog({
                tone: 'warning',
                icon: 'playlist_add',
                title: 'Program utama tidak dikosongkan dari sini',
                message: 'Gunakan Pendaftaran Program untuk mengubah periode atau status program agar sesi, harga, dan jadwal tetap sinkron.',
            });
            return;
        }

        const changedFields = Object.keys(normalizedFormData).filter(key => String(normalizedFormData[key] ?? '') !== String(initialData[key] ?? ''));
        if (changedFields.length === 0) {
            onClose();
            return;
        }

        if (changedFields.length > 0) {
            const confirmed = await confirmAction({
                tone: 'warning',
                icon: 'manage_accounts',
                title: 'Simpan perubahan profil anak?',
                message: 'Perubahan data anak akan masuk audit log dan membuat notifikasi internal admin.',
                details: `Field berubah: ${changedFields.join(', ')}`,
                confirmText: 'Simpan perubahan',
                cancelText: 'Batal',
            });
            if (!confirmed) return;
        }
        setIsSaving(true);
        const updates = { ...normalizedFormData };
        if (updates.program) {
            updates.programs = [{ name: updates.program, color: 'emerald' }];
        }
        
        try {
            const res = await childrenApi.update(child.id || child.nita, updates);
            if (!res.ok) throw new Error(res.data?.error || 'Gagal menyimpan perubahan data anak.');
            // Dispatch event so UI updates
            window.dispatchEvent(new CustomEvent('childUpdated'));
            onClose();
        } catch (e) {
            console.error('Failed to update child', e);
            await notifyDialog({
                tone: 'danger',
                icon: 'error',
                title: 'Perubahan belum tersimpan',
                message: 'Gagal menyimpan perubahan data anak.',
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCriticalReassignment = async () => {
        const roleLabel = assignmentForm.roleType === 'assistant' ? 'terapis pendamping' : 'terapis utama';
        if (!assignmentForm.fromTherapistId || !assignmentForm.toTherapistId) {
            await notifyDialog({ tone: 'warning', title: 'Terapis belum lengkap', message: `Pilih ${roleLabel} lama dan pengganti.` });
            return;
        }
        if (!assignmentForm.reason.trim() || assignmentForm.reason.trim().length < 8) {
            await notifyDialog({ tone: 'warning', title: 'Alasan wajib jelas', message: 'Isi alasan critical decision minimal 8 karakter.' });
            return;
        }
        if (!assignmentForm.superAdminPassword) {
            await notifyDialog({ tone: 'warning', title: 'Password wajib diisi', message: 'Masukkan password super admin untuk menyimpan keputusan kritis.' });
            return;
        }

        const confirmed = await confirmAction({
            tone: 'danger',
            icon: 'rule',
            title: `Critical decision: ganti ${roleLabel}?`,
            message: 'Sistem akan meminta password, mencatat audit log, memberi notifikasi ke terapis sebelumnya, terapis pengganti, orang tua, dan tim pendamping/utama. Riwayat laporan lama tidak akan diganti.',
            details: `Mulai ${assignmentForm.effectiveDate}. Future sessions ${assignmentForm.transferFutureSessions && assignmentForm.roleType === 'primary' ? 'akan dialihkan' : 'tidak dialihkan otomatis'}.`,
            confirmText: 'Simpan critical decision',
            cancelText: 'Batal',
        });
        if (!confirmed) return;

        setIsSaving(true);
        try {
            const res = await childrenApi.reassignTherapist(child.id || child.nita, {
                ...assignmentForm,
                reason: assignmentForm.reason.trim(),
                periodId: activePeriod?.id || undefined,
            });
            if (!res.ok) throw new Error(res.data?.error || res.data?.message || 'Penggantian terapis gagal.');
            const summary = res.data?.data?.summary;
            window.dispatchEvent(new CustomEvent('childUpdated'));
            window.dispatchEvent(new Event('sessionUpdated'));
            window.dispatchEvent(new Event('notificationsUpdated'));
            await notifyDialog({
                tone: 'success',
                icon: 'verified',
                title: 'Critical decision tersimpan',
                message: `${summary?.updatedPeriods || 0} periode diperbarui, ${summary?.transferredSessions || 0} sesi mendatang dialihkan. Riwayat laporan lama tetap memakai terapis sebelumnya.`,
            });
            onClose();
        } catch (e) {
            await notifyDialog({
                tone: 'danger',
                icon: 'error',
                title: 'Penggantian belum tersimpan',
                message: e.message || 'Gagal menyimpan critical decision penggantian terapis.',
            });
        } finally {
            setIsSaving(false);
        }
    };

    const openProgramEnrollment = () => {
        const childId = child.id || child.nita;
        onClose();
        navigate(`/children/program-registration?childId=${encodeURIComponent(childId)}`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
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
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Depan <span className="text-red-500">*</span></label>
                            <input name="firstName" value={formData.firstName} onChange={handleChange} className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-primary focus:border-primary focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Belakang <span className="text-xs font-semibold text-slate-400">(opsional)</span></label>
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
                        <p className="mb-2 text-xs text-slate-500">Untuk membuat periode, sesi, harga, dan jadwal baru gunakan menu Pendaftaran Program.</p>
                        <select name="program" value={formData.program} onChange={handleChange} className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-primary focus:border-primary focus:outline-none">
                            <option value="">Pilih Program...</option>
                            {programsList.map(prog => <option key={prog.id} value={prog.name}>{prog.name}</option>)}
                        </select>
                    </div>

                    <div className="border-t border-red-200 dark:border-red-900/50 pt-4 mt-2">
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
                            <p className="text-sm font-black">Critical decision: penggantian terapis case</p>
                            <p className="mt-1">Gunakan ini saat terapis utama/pendamping resign atau case harus dialihkan. Laporan dan sesi yang sudah selesai tetap atas nama terapis lama.</p>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-1 text-sm font-bold text-slate-700 dark:text-slate-300">
                                Jenis penggantian
                                <select value={assignmentForm.roleType} onChange={e => updateAssignment('roleType', e.target.value)} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                                    <option value="primary">Terapis utama</option>
                                    <option value="assistant">Terapis pendamping</option>
                                </select>
                            </label>
                            <label className="flex flex-col gap-1 text-sm font-bold text-slate-700 dark:text-slate-300">
                                Berlaku mulai
                                <input type="date" value={assignmentForm.effectiveDate} onChange={e => updateAssignment('effectiveDate', e.target.value)} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                            </label>
                            <label className="flex flex-col gap-1 text-sm font-bold text-slate-700 dark:text-slate-300">
                                Terapis sebelumnya
                                <select value={assignmentForm.fromTherapistId} onChange={e => updateAssignment('fromTherapistId', e.target.value)} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                                    <option value="">Pilih terapis lama...</option>
                                    {therapists.map(t => <option key={t.id} value={t.id}>{t.name} ({t.specialty})</option>)}
                                </select>
                            </label>
                            <label className="flex flex-col gap-1 text-sm font-bold text-slate-700 dark:text-slate-300">
                                Terapis pengganti
                                <select value={assignmentForm.toTherapistId} onChange={e => updateAssignment('toTherapistId', e.target.value)} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                                    <option value="">Pilih pengganti...</option>
                                    {therapists.filter(t => t.id !== assignmentForm.fromTherapistId && (t.status || 'active') === 'active').map(t => <option key={t.id} value={t.id}>{t.name} ({t.specialty})</option>)}
                                </select>
                            </label>
                        </div>
                        {assignmentForm.roleType === 'primary' && (
                            <label className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                                <input type="checkbox" checked={assignmentForm.transferFutureSessions} onChange={e => updateAssignment('transferFutureSessions', e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
                                Alihkan sesi mendatang mulai tanggal berlaku. Sesi selesai, laporan, dan histori klinis tidak diganti.
                            </label>
                        )}
                        <label className="mt-3 flex flex-col gap-1 text-sm font-bold text-slate-700 dark:text-slate-300">
                            Alasan critical decision
                            <textarea value={assignmentForm.reason} onChange={e => updateAssignment('reason', e.target.value)} rows={3} placeholder="Contoh: Terapis resign, case dialihkan agar jadwal anak tetap berjalan." className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                        </label>
                        <label className="mt-3 flex flex-col gap-1 text-sm font-bold text-slate-700 dark:text-slate-300">
                            Password super admin
                            <input type="password" value={assignmentForm.superAdminPassword} onChange={e => updateAssignment('superAdminPassword', e.target.value)} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" autoComplete="current-password" />
                        </label>
                        <button type="button" onClick={handleCriticalReassignment} disabled={isSaving} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50">
                            <span className="material-symbols-outlined text-base">rule</span>
                            Simpan Critical Decision
                        </button>
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
                        <div className="mb-3">
                            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">Periode Terapi</h4>
                            <p className="mt-1 text-xs text-slate-500">Riwayat periode aktif dan selesai. Pendaftaran periode baru dikelola dari menu khusus agar jadwal, harga, dan notifikasi sinkron.</p>
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
                        <button type="button" onClick={openProgramEnrollment} disabled={isSaving} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                            <span className="material-symbols-outlined text-base">playlist_add</span>
                            Buka Pendaftaran Program
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
