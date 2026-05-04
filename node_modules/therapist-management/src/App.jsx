import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './components/Header';
import TherapistCard from './components/TherapistCard';
import { getAllTherapists, getAllPrograms } from '../../shared/clinicDataStore';

function App() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [specializationFilter, setSpecializationFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [therapists, setTherapists] = useState([]);
    const [programs, setPrograms] = useState([]);

    useEffect(() => {
        const load = () => {
            const raw = getAllTherapists() || [];
            // Transform store structure to the card structure
            const transformed = raw.map(t => {
                const specArray = t.specializations ? t.specializations : t.specialization ? [t.specialization] : [];
                return {
                    name: t.name,
                    id: t.id,
                    avatar: t.avatar || '',
                    specializations: specArray,
                    status: t.status === 'active' ? 'Active' : t.status === 'inactive' ? 'Inactive' : 'On Break',
                    statusColor: t.status === 'active' ? 'green' : t.status === 'inactive' ? 'slate' : 'orange',
                    sessionsToday: 0,
                    inactive: t.status === 'inactive',
                };
            });
            setTherapists(transformed);
            setPrograms(getAllPrograms());
        };
        load();
        window.addEventListener('clinicDataUpdated', load);
        return () => window.removeEventListener('clinicDataUpdated', load);
    }, []);

    const filteredTherapists = therapists.filter(t => {
        const matchesSearch = !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSpec = specializationFilter ? t.specializations.some(s => s.toLowerCase().includes(specializationFilter.toLowerCase())) : true;
        const matchesStatus = statusFilter ? t.status.toLowerCase() === statusFilter.toLowerCase() : true;
        return matchesSearch && matchesSpec && matchesStatus;
    });

    return (
        <>
            <Header searchValue={searchQuery} onSearchChange={setSearchQuery} />
            <main className="px-4 sm:px-10 flex flex-1 justify-center py-6 sm:py-8">
                <div className="layout-content-container flex flex-col max-w-[1200px] flex-1 w-full">

                    {/* Page Header */}
                    <div className="flex flex-wrap justify-between gap-3 mb-6 items-center">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-slate-900 dark:text-white tracking-tight text-3xl font-bold leading-tight">Therapist Management</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">Manage clinic therapists, specializations, and availability</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => navigate('/therapist-registration')}
                                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-background-dark rounded-lg font-bold hover:bg-primary/90 transition-colors shadow-sm"
                            >
                                <span className="material-symbols-outlined text-sm">add</span>
                                Add New Therapist
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-4 mb-6 pb-6 border-b border-slate-200 dark:border-primary/20">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Specialization:</span>
                            <select 
                                value={specializationFilter}
                                onChange={(e) => setSpecializationFilter(e.target.value)}
                                className="form-select bg-white dark:bg-primary/10 border border-slate-300 dark:border-primary/30 rounded-lg text-slate-700 dark:text-slate-300 text-sm focus:ring-primary focus:border-primary"
                            >
                                <option value="">All Specializations</option>
                                {programs.map(p => (
                                    <option key={p.id} value={p.name}>{p.name} ({p.code})</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Status:</span>
                            <select 
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="form-select bg-white dark:bg-primary/10 border border-slate-300 dark:border-primary/30 rounded-lg text-slate-700 dark:text-slate-300 text-sm focus:ring-primary focus:border-primary"
                            >
                                <option value="">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="On Break">On Break</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    {/* Therapist Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredTherapists.map((t) => (
                            <TherapistCard key={t.id} {...t} />
                        ))}
                    </div>

                </div>
            </main>
        </>
    );
}

export default App;
