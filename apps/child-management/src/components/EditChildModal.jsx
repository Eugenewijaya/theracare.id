import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { therapistsApi, adminApi, childrenApi } from '../../../shared/api/client';
import { confirmAction, notifyDialog } from '../../../shared/ui/confirmDialog';

const EditChildModal = ({ child, onClose }) => {
    const navigate = useNavigate();
    const [therapists, setTherapists] = useState([]);
    const [programsList, setProgramsList] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const activePeriod = child.activePeriod || (Array.isArray(child.periods) ? child.periods.find(p => ['active', 'planned'].includes(p.status)) || child.periods[0] : null);

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
        const changedFields = Object.keys(formData).filter(key => String(formData[key] || '') !== String({
            firstName: child.firstName || child.name?.split(' ')[0] || '',
            lastName: child.lastName || child.name?.split(' ').slice(1).join(' ') || '',
            dob: child.dob || '',
            diagnosis: child.diagnosis || '',
            program: child.programs?.[0]?.name || child.program || '',
            therapistId: child.therapistId || '',
        }[key] || ''));
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

    const openProgramEnrollment = () => {
        const childId = child.id || child.nita;
        onClose();
        navigate(`/children/program-registration?childId=${encodeURIComponent(childId)}`);
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
                        <p className="mb-2 text-xs text-slate-500">Untuk membuat periode, sesi, harga, dan jadwal baru gunakan menu Pendaftaran Program.</p>
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
