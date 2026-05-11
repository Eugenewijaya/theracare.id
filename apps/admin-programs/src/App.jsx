import React, { useState, useMemo, useEffect } from 'react';
import { adminApi } from '../../shared/api/client';

const normalizeProgram = (program) => ({
  ...program,
  code: program?.code || '',
  target: program?.target || '',
  goals: Array.isArray(program?.goals) ? program.goals : [],
});

const parsePricing = (settings = {}) => {
  try {
    const raw = settings.programPricing;
    return typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
  } catch {
    return {};
  }
};

const parseMoney = (value) => {
  const numeric = String(value || '').replace(/[^\d]/g, '');
  return numeric ? Number(numeric) : 0;
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  if (!amount) return 'Belum diset';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
};

function App() {
  const [programs, setPrograms] = useState([]);
  const [programPricing, setProgramPricing] = useState({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [res, settingsRes] = await Promise.all([
          adminApi.getPrograms(),
          adminApi.getSettings(),
        ]);
        if (!res.ok) throw new Error(res.data?.error || 'Gagal memuat program');
        setPrograms((res.data?.data || []).map(normalizeProgram));
        if (settingsRes.ok) setProgramPricing(parsePricing(settingsRes.data?.data));
      } catch (e) {
        console.error(e);
        showToast(e.message || 'Gagal memuat program', 'error');
      }
    };
    load();
    const interval = window.setInterval(load, 30000);
    return () => window.clearInterval(interval);
  }, []);
  const [toast, setToast] = useState(null);
  const [formError, setFormError] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Form states
  const [formData, setFormData] = useState({ name: '', code: '', target: '', duration: 45, pricePerSession: '', pricePerMonth: '', goals: [''] });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Handlers ---
  const handleOpenCreate = () => {
    setEditingProgram(null);
    setFormData({ name: '', code: '', target: '', duration: 45, pricePerSession: '', pricePerMonth: '', goals: [''] });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (prog) => {
    setEditingProgram(prog);
    const normalized = normalizeProgram(prog);
    const pricing = programPricing[normalized.code] || {};
    setFormData({
      ...normalized,
      pricePerSession: pricing.pricePerSession || '',
      pricePerMonth: pricing.pricePerMonth || '',
      goals: [...normalized.goals],
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProgram(null);
    setFormError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setFormError('Nama program dan kode wajib diisi.');
      return;
    }
    setFormError('');
    
    // Clean empty goals
    const cleanedData = {
      ...formData,
      goals: formData.goals.filter(g => g.trim() !== '')
    };
    const programPayload = {
      name: cleanedData.name,
      code: cleanedData.code,
      target: cleanedData.target,
      duration: cleanedData.duration,
      goals: cleanedData.goals,
    };
    const nextCode = cleanedData.code.trim().toUpperCase();
    const nextPricing = {
      ...programPricing,
      [nextCode]: {
        pricePerSession: parseMoney(cleanedData.pricePerSession),
        pricePerMonth: parseMoney(cleanedData.pricePerMonth),
      },
    };
    if (editingProgram?.code && editingProgram.code !== nextCode) {
      delete nextPricing[editingProgram.code];
    }

    try {
      let saveRes;
      if (editingProgram) {
        saveRes = await adminApi.updateProgram(editingProgram.id, programPayload);
      } else {
        saveRes = await adminApi.createProgram(programPayload);
      }
      if (!saveRes.ok) throw new Error(saveRes.data?.error || saveRes.data?.message || 'Gagal menyimpan program');
      const pricingRes = await adminApi.updateSettings({ programPricing: JSON.stringify(nextPricing) });
      if (!pricingRes.ok) throw new Error(pricingRes.data?.error || 'Program tersimpan, tetapi harga gagal disimpan.');
      setProgramPricing(nextPricing);
      showToast(
        editingProgram
          ? `Program "${cleanedData.name}" berhasil diperbarui.`
          : `Program "${cleanedData.name}" berhasil ditambahkan.`
      );
      handleCloseModal();
      const res = await adminApi.getPrograms();
      if (!res.ok) throw new Error(res.data?.error || 'Gagal memuat ulang program');
      setPrograms((res.data?.data || []).map(normalizeProgram));
    } catch(e) {
      showToast(e.message || 'Terjadi kesalahan', 'error');
    }
  };

  const handleDelete = async () => {
    const name = deleteConfirm.name;
    try {
      const deleteRes = await adminApi.deleteProgram(deleteConfirm.id);
      if (!deleteRes.ok) throw new Error(deleteRes.data?.error || deleteRes.data?.message || 'Gagal menghapus program');
      const nextPricing = { ...programPricing };
      delete nextPricing[deleteConfirm.code];
      await adminApi.updateSettings({ programPricing: JSON.stringify(nextPricing) });
      setProgramPricing(nextPricing);
      setDeleteConfirm(null);
      showToast(`Program "${name}" telah dihapus.`, 'warning');
      const res = await adminApi.getPrograms();
      if (!res.ok) throw new Error(res.data?.error || 'Gagal memuat ulang program');
      setPrograms((res.data?.data || []).map(normalizeProgram));
    } catch(e) {
      showToast(e.message || 'Gagal menghapus program', 'error');
    }
  };

  // --- Form Goal Array Handlers ---
  const handleGoalChange = (index, value) => {
    const newGoals = [...formData.goals];
    newGoals[index] = value;
    setFormData({ ...formData, goals: newGoals });
  };

  const addGoalField = () => {
    setFormData({ ...formData, goals: [...formData.goals, ''] });
  };

  const removeGoalField = (index) => {
    if (formData.goals.length === 1) {
      setFormData({ ...formData, goals: [''] });
    } else {
      const newGoals = formData.goals.filter((_, i) => i !== index);
      setFormData({ ...formData, goals: newGoals });
    }
  };

  // --- Filtering ---
  const filteredPrograms = useMemo(() => {
    return programs.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.target.toLowerCase().includes(search.toLowerCase())
    );
  }, [programs, search]);

  return (
    <>
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold border backdrop-blur-sm transition-all ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : toast.type === 'warning' ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {toast.type === 'success' ? 'check_circle' : toast.type === 'warning' ? 'warning' : 'error'}
          </span>
          {toast.msg}
        </div>
      )}
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 w-full overflow-hidden text-slate-900 dark:text-slate-100 font-sans">
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1 items-center flex gap-2">
              <span className="material-symbols-outlined text-primary text-3xl">menu_book</span>
              Program Management
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Define and manage therapeutic programs and goals.</p>
          </div>
          <button 
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-slate-900 font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Add Program
          </button>
        </header>

        {/* Filters */}
        <div className="px-4 sm:px-8 py-4 sm:py-5 flex flex-wrap items-center gap-4 shrink-0 bg-white dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input 
              type="text" 
              placeholder="Search by name, code, or target area..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm transition-all"
            />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Showing {filteredPrograms.length} program{filteredPrograms.length !== 1 && 's'}
          </p>
        </div>

        {/* Card Grid */}
        <div className="flex-1 overflow-auto p-8">
          {filteredPrograms.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50">search_off</span>
              <p>No programs found matching "{search}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredPrograms.map(prog => (
                <div key={prog.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <div className="px-2.5 py-1 bg-primary/10 text-blue-700 dark:text-primary rounded-md text-xs font-bold tracking-wider">
                        {prog.code}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleOpenEdit(prog)} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1" title="Edit">
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button onClick={() => setDeleteConfirm(prog)} className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1" title="Delete">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight mb-1">{prog.name}</h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">{prog.target}</p>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="rounded-lg border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/20 p-2">
                        <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Per Sesi</p>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{formatCurrency(programPricing[prog.code]?.pricePerSession)}</p>
                      </div>
                      <div className="rounded-lg border border-sky-100 dark:border-sky-900/40 bg-sky-50 dark:bg-sky-900/20 p-2">
                        <p className="text-[10px] font-black uppercase tracking-wide text-sky-700 dark:text-sky-300">Per Bulan</p>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{formatCurrency(programPricing[prog.code]?.pricePerMonth)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-4 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700/50">
                      <span className="material-symbols-outlined text-[16px] text-slate-400">schedule</span>
                      Default Duration: {prog.duration} mins
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">Key Goals</h4>
                      <ul className="flex flex-col gap-1.5">
                        {prog.goals.slice(0, 3).map((goal, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                            <span className="material-symbols-outlined text-[14px] text-primary mt-0.5 shrink-0">check_circle</span>
                            <span className="leading-snug">{goal}</span>
                          </li>
                        ))}
                        {prog.goals.length > 3 && (
                          <li className="text-xs text-slate-400 italic mt-1">
                            + {prog.goals.length - 3} more goals...
                          </li>
                        )}
                        {prog.goals.length === 0 && (
                          <li className="text-xs text-slate-400 italic">No goals defined</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* --- CREATE / EDIT MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  {editingProgram ? 'edit' : 'add_box'}
                </span>
                {editingProgram ? 'Edit Program Details' : 'Create New Program'}
              </h2>
              <button type="button" onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <form id="program-form" onSubmit={handleSave} className="flex flex-col gap-5">
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    {formError}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Program Name</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="e.g. Occupational Therapy"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm shadow-sm"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Abbreviation / Code</label>
                    <input 
                      type="text" 
                      required
                      value={formData.code}
                      onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                      placeholder="e.g. OT"
                      maxLength={5}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm uppercase shadow-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Target Domain</label>
                    <input 
                      type="text" 
                      required
                      value={formData.target}
                      onChange={e => setFormData({...formData, target: e.target.value})}
                      placeholder="e.g. Fine Motor Skills"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Default Session Duration (mins)</label>
                    <input 
                      type="number" 
                      min="15" max="180" step="15"
                      value={formData.duration}
                      onChange={e => setFormData({...formData, duration: parseInt(e.target.value) || 45})}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm shadow-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Harga per Sesi</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.pricePerSession}
                      onChange={e => setFormData({...formData, pricePerSession: e.target.value})}
                      placeholder="Contoh: 350000"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Harga per Bulan</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.pricePerMonth}
                      onChange={e => setFormData({...formData, pricePerMonth: e.target.value})}
                      placeholder="Contoh: 2400000"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm shadow-sm"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Default Program Goals</label>
                    <button 
                      type="button" 
                      onClick={addGoalField}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span> Add Goal
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {formData.goals.map((goal, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-slate-400 text-sm font-bold w-4 text-center">{index + 1}.</span>
                        <input 
                          type="text"
                          value={goal}
                          onChange={e => handleGoalChange(index, e.target.value)}
                          placeholder="Enter a milestone or goal..."
                          className="flex-1 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                        />
                        <button 
                          type="button" 
                          onClick={() => removeGoalField(index)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 shrink-0">
              <button 
                type="button" 
                onClick={handleCloseModal}
                className="px-4 py-2 rounded-lg font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="program-form"
                className="px-5 py-2 rounded-lg font-bold bg-primary text-slate-900 hover:bg-primary/90 transition-colors shadow-sm text-sm"
              >
                {editingProgram ? 'Save Changes' : 'Create Program'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col text-center p-6">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Delete Program?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">{deleteConfirm.name} ({deleteConfirm.code})</span>? This could affect children currently registered under this program.
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
}

export default App;
