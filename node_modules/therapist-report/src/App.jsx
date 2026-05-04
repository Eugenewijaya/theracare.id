import React from 'react';
import Header from './components/Header';
import ReportForm from './components/ReportForm';

function App() {
    return (
        <>
            <div className="layout-container flex h-full grow flex-col">
                <div className="px-4 md:px-10 lg:px-40 flex flex-1 justify-center py-5">
                    <div className="layout-content-container flex flex-col max-w-[960px] flex-1 w-full bg-white dark:bg-slate-900 shadow-sm rounded-xl overflow-hidden">
                        <Header />
                        <main className="flex-1 p-6 md:p-10 flex flex-col gap-8">
                            <div className="flex flex-col gap-2 border-b border-slate-100 dark:border-slate-800 pb-6">
                                <h1 className="text-3xl md:text-4xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">Daily Therapy Report Form</h1>
                                <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-relaxed">Document child progress and session details securely.</p>
                            </div>
                            <ReportForm />
                        </main>
                    </div>
                </div>
            </div>
        </>
    );
}

export default App;
