import React, { useState, useEffect } from 'react';
import { parentsApi } from '../../../shared/api/client';

export default function RegistrationModeStep({ onSelectMode, onSelectParent }) {
    const [mode, setMode] = useState(null); // 'new' | 'existing'
    const [parents, setParents] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedParentId, setSelectedParentId] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                const res = await parentsApi.getAll();
                setParents(res.data?.data || []);
            } catch (e) {
                console.error(e);
            }
        };
        load();
    }, []);

    const filteredParents = parents.filter(p =>
        (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.phone || '').includes(search)
    );

    const handleSelectMode = (m) => {
        setMode(m);
        if (m === 'new') {
            onSelectMode('new');
        }
    };

    const handleConfirmParent = () => {
        const parent = parents.find(p => p.id === selectedParentId);
        if (parent) {
            onSelectMode('existing');
            onSelectParent(parent);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Pilih jenis pendaftaran yang ingin dilakukan:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Card: New Family */}
                <button
                    type="button"
                    onClick={() => handleSelectMode('new')}
                    className={`group relative flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all duration-200 text-left ${
                        mode === 'new'
                            ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                            : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                >
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
                        mode === 'new'
                            ? 'bg-primary/20 text-primary'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-primary group-hover:bg-primary/10'
                    }`}>
                        <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>group_add</span>
                    </div>
                    <div className="text-center">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Keluarga Baru</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            Daftarkan orang tua baru beserta data anak dan program terapi.
                        </p>
                    </div>
                    {mode === 'new' && (
                        <span className="absolute top-3 right-3 material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    )}
                </button>

                {/* Card: Existing Parent */}
                <button
                    type="button"
                    onClick={() => handleSelectMode('existing')}
                    className={`group relative flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all duration-200 text-left ${
                        mode === 'existing'
                            ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                            : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                >
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
                        mode === 'existing'
                            ? 'bg-primary/20 text-primary'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-primary group-hover:bg-primary/10'
                    }`}>
                        <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>person_add</span>
                    </div>
                    <div className="text-center">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Tambah Anak</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            Tambahkan anak baru ke orang tua yang sudah terdaftar di sistem.
                        </p>
                    </div>
                    {mode === 'existing' && (
                        <span className="absolute top-3 right-3 material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    )}
                </button>
            </div>

            {/* Parent Selector (only for "existing" mode) */}
            {mode === 'existing' && (
                <div className="flex flex-col gap-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 fade-in duration-300">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-primary">search</span>
                        Pilih Orang Tua
                    </h4>

                    {/* Search */}
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Cari nama atau nomor telepon..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                        />
                    </div>

                    {/* Parent List */}
                    <div className="max-h-56 overflow-y-auto flex flex-col gap-1.5 pr-1">
                        {filteredParents.length === 0 ? (
                            <p className="text-center text-sm text-slate-400 py-6">
                                {parents.length === 0 ? 'Belum ada data orang tua. Gunakan mode "Keluarga Baru".' : 'Tidak ditemukan.'}
                            </p>
                        ) : (
                            filteredParents.map(p => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setSelectedParentId(p.id)}
                                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left transition-all ${
                                        selectedParentId === p.id
                                            ? 'bg-primary/10 border-2 border-primary shadow-sm'
                                            : 'bg-white dark:bg-slate-900 border-2 border-transparent hover:border-slate-200 dark:hover:border-slate-600'
                                    }`}
                                >
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                                        selectedParentId === p.id ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}>
                                        {p.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{p.name}</p>
                                        <p className="text-xs text-slate-400 truncate">{p.phone} · {(p.children || []).length} anak terdaftar</p>
                                    </div>
                                    {selectedParentId === p.id && (
                                        <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    {/* Confirm Button */}
                    {selectedParentId && (
                        <button
                            type="button"
                            onClick={handleConfirmParent}
                            className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-2 mt-1"
                        >
                            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            Lanjut Input Data Anak
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
