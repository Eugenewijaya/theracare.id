import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './components/Header';
import ChildTable from './components/ChildTable';
import { childrenApi, adminApi } from '../../shared/api/client';
import { confirmAction, notifyDialog } from '../../shared/ui/confirmDialog';

function App() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm]       = useState('');
    const [programFilter, setProgramFilter] = useState('');
    const [statusFilter, setStatusFilter]   = useState('');
    const [allChildren, setAllChildren]     = useState([]);
    const [programs, setPrograms]           = useState([]);
    const [loading, setLoading]             = useState(true);
    const [error, setError]                 = useState('');

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [cRes, pRes] = await Promise.all([
                childrenApi.getAll(),
                adminApi.getPrograms()
            ]);
            if (!cRes.ok) throw new Error(cRes.data?.error || 'Data anak gagal dimuat dari backend.');
            setAllChildren(cRes.data?.data || []);
            setPrograms(pRes.ok ? pRes.data?.data || [] : []);
        } catch (e) {
            console.error('Failed to load child management data', e);
            setAllChildren([]);
            setError(e.message || 'Data anak gagal dimuat dari backend.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        window.addEventListener('childUpdated', loadData);
        const interval = window.setInterval(loadData, 30000);
        return () => {
            window.clearInterval(interval);
            window.removeEventListener('childUpdated', loadData);
        };
    }, []);

    const handleDeleteChild = async (child) => {
        const confirmed = await confirmAction({
            tone: 'danger',
            title: `Hapus data ${child.name}?`,
            message: 'Data yang sudah punya sesi, laporan, rating, atau request akan ditolak server. Tindakan ini juga masuk audit log.',
            confirmText: 'Hapus data anak',
            cancelText: 'Batal',
        });
        if (!confirmed) return;
        const res = await childrenApi.delete(child.id);
        if (!res.ok) {
            await notifyDialog({
                tone: 'danger',
                icon: 'error',
                title: 'Data anak belum terhapus',
                message: res.data?.error || res.data?.message || res.data?.data?.reason || 'Gagal menghapus data anak.',
            });
            return;
        }
        setAllChildren(prev => prev.filter(item => item.id !== child.id));
        window.dispatchEvent(new Event('childUpdated'));
        await notifyDialog({
            tone: 'success',
            icon: 'check_circle',
            title: 'Data anak terhapus',
            message: `Data anak ${child.name} berhasil dihapus dan tercatat di audit log.`,
        });
    };

    const filtered = allChildren.filter(child => {
        const name    = child.name || `${child.firstName || ''} ${child.lastName || ''}`;
        const id      = child.id || '';
        const program = child.programs ? child.programs.map(p => p.name || p).join(' ') : (child.program || '');
        const matchSearch   = name.toLowerCase().includes(searchTerm.toLowerCase()) || id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchProgram  = programFilter ? program.includes(programFilter) : true;
        const matchStatus   = statusFilter  ? (child.status || 'active') === statusFilter : true;
        return matchSearch && matchProgram && matchStatus;
    });

    return (
        <div className="layout-container flex h-full min-w-0 grow flex-col overflow-x-hidden bg-background-light dark:bg-background-dark">
            <div className="flex min-w-0 flex-1 justify-center px-4 py-5 md:px-8 xl:px-10">
                <div className="layout-content-container flex w-full max-w-[1500px] min-w-0 flex-1 flex-col">
                    <Header searchValue={searchTerm} onSearchChange={setSearchTerm} />
                    <main className="flex flex-col gap-6 px-4 md:px-0">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <h1 className="text-slate-900 dark:text-slate-100 text-2xl md:text-[28px] font-bold leading-tight tracking-[-0.015em]">Child Management</h1>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => navigate('/children/program-registration')}
                                    className="px-4 py-2 rounded-lg border border-primary/20 bg-primary/10 text-primary font-bold hover:bg-primary/15 transition-colors flex items-center gap-2 text-sm whitespace-nowrap">
                                    <span className="material-symbols-outlined text-[20px]">playlist_add</span>
                                    Daftarkan Program
                                </button>
                                <button onClick={() => navigate('/children/register')}
                                    className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 text-sm shadow-sm shadow-primary/20 whitespace-nowrap">
                                    <span className="material-symbols-outlined text-[20px]">add</span>
                                    Add New Child
                                </button>
                            </div>
                        </div>

                        {/* Filters */}
                        <section className="flex flex-col lg:flex-row gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
                            <div className="flex-1 min-w-[200px]">
                                <label className="flex flex-col min-w-40 h-10 w-full">
                                    <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                                        <div className="text-slate-500 dark:text-slate-400 flex border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 items-center justify-center pl-4 rounded-l-lg border-r-0">
                                            <span className="material-symbols-outlined">search</span>
                                        </div>
                                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                            className="form-input flex w-full min-w-0 flex-1 resize-none rounded-lg text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-1 focus:ring-primary border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary h-full placeholder:text-slate-500 px-4 rounded-l-none border-l-0 pl-2 text-sm"
                                            placeholder="Search by name or ID..." />
                                    </div>
                                </label>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <select value={programFilter} onChange={e => setProgramFilter(e.target.value)}
                                    className="form-input rounded-lg text-slate-900 dark:text-slate-100 focus:outline-0 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-10 px-4 text-sm cursor-pointer min-w-40">
                                    <option value="">Semua Program</option>
                                    {programs.map(p => (
                                        <option key={p.id} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                                    className="form-input rounded-lg text-slate-900 dark:text-slate-100 focus:outline-0 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-10 px-4 text-sm cursor-pointer min-w-36">
                                    <option value="">All Status</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="pending">Pending</option>
                                </select>
                            </div>
                        </section>

                        {loading ? (
                            <div className="text-center py-10">Loading children data...</div>
                        ) : error ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
                                {error}
                            </div>
                        ) : (
                            <ChildTable children={filtered} onDelete={handleDeleteChild} />
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}

export default App;
