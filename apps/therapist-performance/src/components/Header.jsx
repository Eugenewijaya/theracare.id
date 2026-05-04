import React from 'react';
import { useNavigate } from 'react-router-dom';

const Header = ({ searchValue, onSearchChange }) => {
    const navigate = useNavigate();

    return (
        <header className="hidden lg:flex flex-wrap sm:flex-nowrap items-center justify-between border-b border-solid border-b-slate-200 dark:border-b-primary/20 px-4 sm:px-10 py-3 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8 w-full sm:w-auto">
                <div className="flex items-center gap-4 text-primary shrink-0">
                    <span className="material-symbols-outlined text-2xl">medical_services</span>
                    <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em]">Therapist Performance</h2>
                </div>
                <label className="flex flex-col w-full sm:min-w-40 sm:max-w-64 h-10 shrink-0">
                    <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                        <div className="text-slate-500 dark:text-slate-400 flex border-none bg-slate-100 dark:bg-primary/10 items-center justify-center pl-4 rounded-l-lg border-r-0">
                            <span className="material-symbols-outlined text-xl">search</span>
                        </div>
                        <input 
                            value={searchValue || ''}
                            onChange={(e) => onSearchChange?.(e.target.value)}
                            className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-0 border-none bg-slate-100 dark:bg-primary/10 focus:border-none h-full placeholder:text-slate-500 dark:placeholder:text-slate-400 px-4 rounded-l-none border-l-0 pl-2 text-base font-normal leading-normal" 
                            placeholder="Search growth items or feedback..." 
                        />
                    </div>
                </label>
            </div>
            <div className="hidden sm:flex flex-1 justify-end gap-8 shrink-0">
                <div className="flex gap-2">
                    <button className="flex items-center justify-center rounded-lg h-10 bg-slate-100 dark:bg-primary/10 text-slate-900 dark:text-slate-100 px-2.5">
                        <span className="material-symbols-outlined text-xl">notifications</span>
                    </button>
                    <button className="flex items-center justify-center rounded-lg h-10 bg-slate-100 dark:bg-primary/10 text-slate-900 dark:text-slate-100 px-2.5">
                        <span className="material-symbols-outlined text-xl">settings</span>
                    </button>
                </div>
                <div
                    onClick={() => navigate('/performance')}
                    className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all shrink-0"
                    title="User avatar"
                    style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBTzvaHtWKXAN3WuwjUrQ632QaywZF5CJhiuqMNZix2c2ByAJg5zZkiB6F_X4nyX3tRdj9S2STfT8fF0eGbWaXdDyQ_Aka-deymlQMkhR0lHZkCG9eLXLXj4-IlGYqjw7JcU4jFgEEvuIuodvlLiz6UBVyaxhyJZwH06S1PQ6QpVaCM7gZqJQ37zr6a35ZzoVY0DSYrOkn65w6shqLUW6heUE7ev4VB_D_v7gjWFdngux4DVsnz-LEocu9Ulfi465vUuiiwAvjuBw')" }}
                ></div>
            </div>
        </header>
    );
};

export default Header;
