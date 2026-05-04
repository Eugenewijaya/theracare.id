import React from 'react';

const MiniCalendar = () => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-900">October 2023</h3>
                <div className="flex gap-1">
                    <button className="text-slate-400 hover:text-slate-900"><span className="material-symbols-outlined text-[20px]">chevron_left</span></button>
                    <button className="text-slate-400 hover:text-slate-900"><span className="material-symbols-outlined text-[20px]">chevron_right</span></button>
                </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
                <div className="font-medium text-slate-400">Mo</div>
                <div className="font-medium text-slate-400">Tu</div>
                <div className="font-medium text-slate-400">We</div>
                <div className="font-medium text-slate-400">Th</div>
                <div className="font-medium text-slate-400">Fr</div>
                <div className="font-medium text-slate-400">Sa</div>
                <div className="font-medium text-slate-400">Su</div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium text-slate-700">
                <div className="p-1.5 text-slate-300">25</div>
                <div className="p-1.5 text-slate-300">26</div>
                <div className="p-1.5 text-slate-300">27</div>
                <div className="p-1.5 text-slate-300">28</div>
                <div className="p-1.5 text-slate-300">29</div>
                <div className="p-1.5 text-slate-300">30</div>
                <div className="p-1.5">1</div>
                <div className="p-1.5">2</div>
                <div className="p-1.5">3</div>
                <div className="p-1.5">4</div>
                <div className="p-1.5">5</div>
                <div className="p-1.5">6</div>
                <div className="p-1.5 text-slate-400">7</div>
                <div className="p-1.5 text-slate-400">8</div>
                <div className="p-1.5">9</div>
                <div className="p-1.5 bg-primary text-slate-900 rounded-md font-bold shadow-sm">10</div>
                <div className="p-1.5">11</div>
                <div className="p-1.5">12</div>
                <div className="p-1.5">13</div>
                <div className="p-1.5 text-slate-400">14</div>
                <div className="p-1.5 text-slate-400">15</div>
            </div>
        </div>
    );
};

export default MiniCalendar;
