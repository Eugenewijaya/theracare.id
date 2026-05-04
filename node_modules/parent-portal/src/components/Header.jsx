import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Header = () => {
    const navigate = useNavigate();
    return (
        <header className="bg-surface-light dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo & Brand */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 text-primary">
                            <span className="material-symbols-outlined text-2xl">family_restroom</span>
                        </div>
                        <h1 className="text-xl font-bold tracking-tight">Parent Portal</h1>
                    </div>
                    {/* Navigation Links */}
                    <nav className="hidden md:flex space-x-8">
                        <Link to="/" className="text-primary border-b-2 border-primary px-1 pt-1 text-sm font-medium h-16 flex items-center">Dashboard</Link>
                        <Link to="/progress" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300 px-1 pt-1 border-b-2 border-transparent text-sm font-medium h-16 flex items-center transition-colors">Programs</Link>
                        <Link to="/reschedule" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300 px-1 pt-1 border-b-2 border-transparent text-sm font-medium h-16 flex items-center transition-colors">Schedule</Link>
                        <Link to="/reports" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300 px-1 pt-1 border-b-2 border-transparent text-sm font-medium h-16 flex items-center transition-colors">Reports</Link>
                    </nav>
                    {/* User Actions */}
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate('/announcements')}
                            className="p-2 text-slate-500 dark:text-slate-400 hover:text-primary transition-colors rounded-full hover:bg-primary/5"
                        >
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <div
                            onClick={() => navigate('/settings')}
                            className="size-10 rounded-full bg-slate-200 dark:bg-slate-700 bg-cover bg-center ring-2 ring-primary/20 cursor-pointer hover:ring-primary transition-all shadow-sm"
                            title="User profile picture of a parent"
                            style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDm9834A5eVDBOTuoE1dZHhvG7wTEuNgJZdn6qkzirGVw5FwsbgjfxmsYIo6hAzCICaFFNBQ-6iXwtDy34LARjy1edk9Ji5eYwaZwIlO_jS6rhDPFdQQuhCccQwKhtBqnzK4AWhXEhuOIeuCYq3SzuUTRuw30ZTJMZdRG1Wt_hICf0jwuAQZ91W8TKyclTLV-fhRKw50FkRcx1FUWtZa8VlCU9zozq9pXIDApic4p8e2GvV8KyuHD6WO9dfyZQA0FYJCzXOX03bSA')" }}
                        >
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
