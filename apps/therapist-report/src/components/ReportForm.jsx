import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllChildren } from '../../../shared/clinicDataStore';

const ReportForm = () => {
    const navigate = useNavigate();
    const [submitted, setSubmitted] = useState(false);
    const [selectedChild, setSelectedChild] = useState('');
    const [children, setChildren] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        setChildren(getAllChildren() || []);
    }, []);
    const [aspects, setAspects] = useState({
        fineMotor: true,
        grossMotor: false,
        speech: false,
        cognitive: false,
        social: true,
        selfCare: false
    });

    const [rating, setRating] = useState(4); // 4/5 default

    const toggleAspect = (key) => setAspects(prev => ({ ...prev, [key]: !prev[key] }));

    const handleSubmit = () => {
        if (!selectedChild) {
            setError('Please select a child before submitting the report.');
            return;
        }
        setError('');
        setSubmitted(true);
    };

    return (
        <form className="flex flex-col gap-8">
            
            {/* Error Message */}
            {error && (
                <div className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-900/50 flex items-center gap-2 text-sm font-bold animate-in fade-in">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    {error}
                </div>
            )}

            {/* Child Selection */}
            <div className="flex flex-col gap-3">
                <label className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Patient Context</label>
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">person_search</span>
                    <select 
                        value={selectedChild}
                        onChange={(e) => setSelectedChild(e.target.value)}
                        className={`w-full appearance-none pl-12 pr-10 py-3.5 rounded-xl border bg-white dark:bg-slate-900 text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 ${!selectedChild ? 'text-slate-400 border-slate-200 dark:border-slate-800' : 'text-slate-900 dark:text-white border-teal-200 dark:border-teal-800'}`}
                    >
                        <option value="" disabled>Select child assigned to your session...</option>
                        {children.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.program || 'Therapy Session'})</option>
                        ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[20px]">expand_more</span>
                </div>
            </div>

            {/* Therapy Aspects */}
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-end">
                    <label className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Therapy Aspects</label>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Select multiple</span>
                </div>
                <div className="flex gap-3 flex-wrap">
                    <label className="cursor-pointer group">
                        <input type="checkbox" className="peer sr-only" checked={aspects.fineMotor} onChange={() => toggleAspect('fineMotor')} />
                        <div className="flex h-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-5 transition-all peer-checked:bg-teal-500/20 peer-checked:text-teal-600 dark:peer-checked:text-teal-400 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                            <span className="text-sm font-medium">Fine Motor Skills</span>
                        </div>
                    </label>
                    <label className="cursor-pointer group">
                        <input type="checkbox" className="peer sr-only" checked={aspects.grossMotor} onChange={() => toggleAspect('grossMotor')} />
                        <div className="flex h-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-5 transition-all peer-checked:bg-teal-500/20 peer-checked:text-teal-600 dark:peer-checked:text-teal-400 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                            <span className="text-sm font-medium">Gross Motor Skills</span>
                        </div>
                    </label>
                    <label className="cursor-pointer group">
                        <input type="checkbox" className="peer sr-only" checked={aspects.speech} onChange={() => toggleAspect('speech')} />
                        <div className="flex h-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-5 transition-all peer-checked:bg-teal-500/20 peer-checked:text-teal-600 dark:peer-checked:text-teal-400 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                            <span className="text-sm font-medium">Speech</span>
                        </div>
                    </label>
                    <label className="cursor-pointer group">
                        <input type="checkbox" className="peer sr-only" checked={aspects.cognitive} onChange={() => toggleAspect('cognitive')} />
                        <div className="flex h-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-5 transition-all peer-checked:bg-teal-500/20 peer-checked:text-teal-600 dark:peer-checked:text-teal-400 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                            <span className="text-sm font-medium">Cognitive</span>
                        </div>
                    </label>
                    <label className="cursor-pointer group">
                        <input type="checkbox" className="peer sr-only" checked={aspects.social} onChange={() => toggleAspect('social')} />
                        <div className="flex h-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-5 transition-all peer-checked:bg-teal-500/20 peer-checked:text-teal-600 dark:peer-checked:text-teal-400 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                            <span className="text-sm font-medium">Social Emotional</span>
                        </div>
                    </label>
                    <label className="cursor-pointer group">
                        <input type="checkbox" className="peer sr-only" checked={aspects.selfCare} onChange={() => toggleAspect('selfCare')} />
                        <div className="flex h-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-5 transition-all peer-checked:bg-teal-500/20 peer-checked:text-teal-600 dark:peer-checked:text-teal-400 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                            <span className="text-sm font-medium">Self-Care</span>
                        </div>
                    </label>
                </div>
            </div>

            {/* Activity Description */}
            <div className="flex flex-col gap-3">
                <label className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Activity Description</label>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-teal-500/50 focus-within:border-teal-500 transition-all">
                    <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 px-3 py-2 flex items-center gap-1">
                        <button type="button" className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
                            <span className="material-symbols-outlined text-lg">format_bold</span>
                        </button>
                        <button type="button" className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
                            <span className="material-symbols-outlined text-lg">format_italic</span>
                        </button>
                        <button type="button" className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
                            <span className="material-symbols-outlined text-lg">format_underlined</span>
                        </button>
                        <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                        <button type="button" className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
                            <span className="material-symbols-outlined text-lg">format_list_bulleted</span>
                        </button>
                        <button type="button" className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
                            <span className="material-symbols-outlined text-lg">format_list_numbered</span>
                        </button>
                    </div>
                    <textarea
                        className="w-full bg-transparent border-none p-4 min-h-[120px] resize-y text-slate-900 dark:text-slate-100 focus:ring-0 placeholder:text-slate-400"
                        placeholder="Describe the activities performed during the session..."
                    ></textarea>
                </div>
            </div>

            {/* Child Response & Obstacles */}
            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 flex flex-col gap-3">
                    <label className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Child's Response</label>
                    <textarea className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 min-h-[100px] resize-y text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all placeholder:text-slate-400" placeholder="How did the child react to the activities?"></textarea>
                </div>
                <div className="flex-1 flex flex-col gap-3">
                    <label className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Obstacles</label>
                    <textarea className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 min-h-[100px] resize-y text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all placeholder:text-slate-400" placeholder="Note any challenges or difficulties encountered..."></textarea>
                </div>
            </div>

            {/* Achievement Rating */}
            <div className="flex flex-col gap-3">
                <label className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Achievement Rating</label>
                <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((starIndex) => (
                        <button key={starIndex} type="button" onClick={() => setRating(starIndex)} className={starIndex <= rating ? "text-teal-500 hover:scale-110 transition-transform" : "text-slate-300 dark:text-slate-600 hover:scale-110 transition-transform hover:text-teal-500/50"}>
                            <span className="material-symbols-outlined text-3xl" style={starIndex <= rating ? { fontVariationSettings: "'FILL' 1" } : {}}>star</span>
                        </button>
                    ))}
                    <span className="ml-3 text-sm font-medium text-slate-600 dark:text-slate-400">{rating} / 5</span>
                </div>
            </div>

            {/* Recommendations */}
            <div className="flex flex-col gap-3">
                <label className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Recommendations for Parents</label>
                <textarea className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 min-h-[100px] resize-y text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all placeholder:text-slate-400" placeholder="Suggested activities or practices for home..."></textarea>
            </div>

            {/* Internal Notes */}
            <div className="flex flex-col gap-3 p-5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 rounded-xl">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-600 dark:text-amber-500">lock</span>
                    <label className="text-lg font-bold leading-tight tracking-tight text-amber-900 dark:text-amber-500">Internal Notes <span className="text-sm font-normal ml-2 opacity-75">(Clinic use only)</span></label>
                </div>
                <textarea className="w-full bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3 min-h-[80px] resize-y text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all placeholder:text-slate-400" placeholder="Confidential observations or notes for the clinical team..."></textarea>
            </div>

            {/* Media Upload */}
            <div className="flex flex-col gap-3">
                <label className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Media Upload</label>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                    <div className="bg-teal-500/10 text-teal-600 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-3xl">cloud_upload</span>
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Click to upload or drag and drop</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">SVG, PNG, JPG or MP4 (max. 50MB)</p>
                </div>
            </div>

            {submitted ? (
                <div className="flex flex-col items-center gap-4 py-10 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 ring-8 ring-green-50 dark:ring-green-900/10">
                        <span className="material-symbols-outlined text-4xl">check_circle</span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Report Submitted!</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">The session report has been securely saved to the patient record.</p>
                    <button type="button" onClick={() => navigate('/')} className="mt-4 px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold shadow-md hover:-translate-y-0.5 transition-all">
                        Back to Dashboard
                    </button>
                </div>
            ) : (
                <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-100 dark:border-slate-800 mt-4">
                    <button type="button" onClick={handleSubmit} className="px-8 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-bold shadow-lg shadow-teal-500/20 hover:bg-teal-600 focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all hover:-translate-y-0.5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">send</span>
                        Submit Report
                    </button>
                </div>
            )}

        </form>
    );
};

export default ReportForm;
