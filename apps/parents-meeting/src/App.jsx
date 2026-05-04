import React, { useState } from 'react';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const TIMES = ['09:00 AM', '09:30 AM', '10:00 AM', '11:30 AM', '01:00 PM', '02:30 PM'];
const MEETING_TYPES = ['In-person', 'Video Call', 'Phone Call'];
const OBJECTIVES = ['Monthly Review', 'Quarterly Eval', 'Incident Report', 'Goal Setting'];

const INITIAL_MEETINGS = [
    { id: 1, child: 'Emma Thompson', parent: 'Mrs. Thompson', therapist: 'Dr. Sarah Jenkins', date: 'Oct 5, 2023', time: '10:00 AM', type: 'In-person', objective: 'Monthly Review' },
];

function App() {
    const [selectedDate, setSelectedDate] = useState(5);
    const [selectedTime, setSelectedTime] = useState('10:00 AM');
    const [meetings, setMeetings] = useState(INITIAL_MEETINGS);
    const [confirmModal, setConfirmModal] = useState(false);
    const [editModal, setEditModal] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);
    const [toast, setToast] = useState('');
    const [form, setForm] = useState({ child: '', type: 'In-person', objective: 'Monthly Review', notes: '' });
    const [editDraft, setEditDraft] = useState(null);

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const handleSchedule = () => {
        if (!form.child) return;
        setConfirmModal(true);
    };

    const confirmSchedule = () => {
        const newMeeting = {
            id: Date.now(),
            child: form.child,
            parent: 'Auto-filled',
            therapist: 'Dr. Sarah Jenkins',
            date: `Oct ${selectedDate}, 2023`,
            time: selectedTime,
            type: form.type,
            objective: form.objective,
        };
        setMeetings(prev => [...prev, newMeeting]);
        setConfirmModal(false);
        setForm({ child: '', type: 'In-person', objective: 'Monthly Review', notes: '' });
        showToast('Meeting invitation sent successfully!');
    };

    const openEdit = (m) => { setEditDraft({ ...m }); setEditModal(m.id); };
    const saveEdit = () => {
        setMeetings(prev => prev.map(m => m.id === editModal ? { ...m, ...editDraft } : m));
        setEditModal(null);
        showToast('Meeting updated.');
    };
    const confirmDelete = () => {
        setMeetings(prev => prev.filter(m => m.id !== deleteModal));
        setDeleteModal(null);
        showToast('Meeting cancelled.');
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
                <h2 className="text-2xl font-bold">Schedule Parents Meeting</h2>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Booking Form */}
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                        {/* Left Column: Selectors */}
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-2">Child</label>
                                <div className="relative">
                                    <select value={form.child} onChange={e => setForm(p => ({...p, child: e.target.value}))} className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:border-primary focus:ring-primary shadow-sm h-12 pl-4 pr-10 appearance-none">
                                        <option value="">Select child</option>
                                        <option value="Emma Thompson">Emma Thompson</option>
                                        <option value="Liam Davis">Liam Davis</option>
                                        <option value="Noah Wilson">Noah Wilson</option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500"><span className="material-symbols-outlined">expand_more</span></div>
                                </div>
                                {!form.child && <p className="text-xs text-red-500 mt-1">Please select a child to continue.</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Parent / Guardian</label>
                                <div className="relative">
                                    <select className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm h-12 pl-4 pr-10 appearance-none" disabled>
                                        <option>{form.child ? 'Auto-filled from child record' : 'Select child first'}</option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500"><span className="material-symbols-outlined">expand_more</span></div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Meeting Type</label>
                                        <div className="relative">
                                            <select value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value}))} className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:border-primary focus:ring-primary shadow-sm h-12 pl-4 pr-10 appearance-none">
                                                {MEETING_TYPES.map(t => <option key={t}>{t}</option>)}
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500"><span className="material-symbols-outlined">expand_more</span></div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Objective</label>
                                        <div className="relative">
                                            <select value={form.objective} onChange={e => setForm(p => ({...p, objective: e.target.value}))} className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:border-primary focus:ring-primary shadow-sm h-12 pl-4 pr-10 appearance-none">
                                                {OBJECTIVES.map(o => <option key={o}>{o}</option>)}
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500"><span className="material-symbols-outlined">expand_more</span></div>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                                    <textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:border-primary focus:ring-primary shadow-sm p-3 resize-none h-24" placeholder="Add additional context..."></textarea>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Calendar & Time */}
                        <div className="flex flex-col gap-6">
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <button className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><span className="material-symbols-outlined">chevron_left</span></button>
                                    <h3 className="font-bold text-lg">October 2023</h3>
                                    <button className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><span className="material-symbols-outlined">chevron_right</span></button>
                                </div>
                                <div className="grid grid-cols-7 text-center mb-2">
                                    {['SU','MO','TU','WE','TH','FR','SA'].map(d => <div key={d} className="text-xs font-semibold text-slate-500 dark:text-slate-400 py-1">{d}</div>)}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    <div className="h-10"></div><div className="h-10"></div><div className="h-10"></div>
                                    {DAYS.map(d => (
                                        <button key={d} onClick={() => setSelectedDate(d)} className={`h-10 w-full flex items-center justify-center rounded-full text-sm transition-colors ${selectedDate === d ? 'bg-primary text-slate-900 font-bold shadow-md' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}>{d}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-semibold text-sm">Available Times for Oct {selectedDate}</h4>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">Timezone: EST</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {TIMES.map(t => (
                                        <button key={t} onClick={() => setSelectedTime(t)} className={`py-2.5 rounded-lg border transition-colors text-sm font-medium ${selectedTime === t ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary hover:text-primary'}`}>{t}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scheduled Meetings List */}
                {meetings.length > 0 && (
                    <div className="px-6 pb-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                        <h3 className="text-lg font-bold mb-4">Scheduled Meetings</h3>
                        <div className="flex flex-col gap-3">
                            {meetings.map(m => (
                                <div key={m.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 group">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-primary/10 p-2 rounded-lg text-primary">
                                            <span className="material-symbols-outlined text-[20px]">{m.type === 'Video Call' ? 'videocam' : m.type === 'Phone Call' ? 'phone' : 'groups'}</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">{m.child}</p>
                                            <p className="text-xs text-slate-500">{m.date} · {m.time} · {m.type}</p>
                                            <p className="text-xs text-slate-400">{m.objective}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEdit(m)} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-primary transition-colors">
                                            <span className="material-symbols-outlined text-[18px]">edit</span>
                                        </button>
                                        <button onClick={() => setDeleteModal(m.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-500 transition-colors">
                                            <span className="material-symbols-outlined text-[18px]">cancel</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-end gap-3 shrink-0">
                <button
                    onClick={handleSchedule}
                    disabled={!form.child}
                    className="px-6 py-2.5 rounded-lg font-semibold bg-primary text-slate-900 hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className="material-symbols-outlined text-sm">send</span>
                    Send Invitation
                </button>
            </div>

            {/* Confirm Scheduling Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setConfirmModal(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col gap-5" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <span className="material-symbols-outlined text-3xl" style={{fontVariationSettings:"'FILL' 1"}}>send</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mb-1">Confirm Meeting</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">An invitation will be sent for:</p>
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 flex flex-col gap-2 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500">Child</span><span className="font-bold">{form.child}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-bold">Oct {selectedDate}, 2023</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Time</span><span className="font-bold">{selectedTime}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="font-bold">{form.type}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Objective</span><span className="font-bold">{form.objective}</span></div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmModal(false)} className="flex-1 px-5 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors">Cancel</button>
                            <button onClick={confirmSchedule} className="flex-1 px-5 py-3 rounded-xl font-bold bg-primary text-slate-900 hover:bg-primary/90 shadow-md transition-colors">Confirm & Send</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Meeting Modal */}
            {editModal && editDraft && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setEditModal(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col gap-5" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Edit Meeting</h2>
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Meeting Type</label>
                                <select value={editDraft.type} onChange={e => setEditDraft(p => ({...p, type: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100">
                                    {MEETING_TYPES.map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Objective</label>
                                <select value={editDraft.objective} onChange={e => setEditDraft(p => ({...p, objective: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-slate-100">
                                    {OBJECTIVES.map(o => <option key={o}>{o}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setEditModal(null)} className="flex-1 px-5 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors">Cancel</button>
                            <button onClick={saveEdit} className="flex-1 px-5 py-3 rounded-xl font-bold bg-primary text-slate-900 hover:bg-primary/90 shadow-md transition-colors">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Meeting Modal */}
            {deleteModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setDeleteModal(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col gap-5 text-center" onClick={e => e.stopPropagation()}>
                        <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 mx-auto">
                            <span className="material-symbols-outlined text-3xl">event_busy</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mb-1">Cancel Meeting?</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">This meeting will be removed and the parent will be notified.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteModal(null)} className="flex-1 px-5 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors">Keep</button>
                            <button onClick={confirmDelete} className="flex-1 px-5 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 shadow-md transition-colors">Cancel Meeting</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-teal-400 text-[18px]">check_circle</span>
                    {toast}
                </div>
            )}
        </div>
    );
}

export default App;
