import React, { useState } from 'react';
import { adminApi } from '../../../shared/api/client';

const SupportWidget = () => {
    const [sent, setSent] = useState(false);

    const handleReachOut = async () => {
        try {
            const res = await adminApi.getPublicSettings();
            const phone = res.data?.data?.adminWhatsApp || '6281234567890';
            window.open(`https://wa.me/${phone}`, '_blank');
        } catch (e) {
            window.open(`https://wa.me/6281234567890`, '_blank');
        }
    };
    return (
        <div className="bg-gradient-to-br from-teal-900 to-slate-900 p-7 rounded-3xl text-white shadow-xl shadow-teal-900/20 relative overflow-hidden group">
            {/* Abstract Decorative Background Elements */}
            <div className="absolute -right-8 -top-8 w-40 h-40 bg-teal-500/20 rounded-full blur-2xl group-hover:bg-teal-400/30 transition-colors duration-500"></div>
            <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-cyan-500/20 rounded-full blur-2xl group-hover:bg-cyan-400/30 transition-colors duration-500"></div>
            
            <div className="relative z-10 flex flex-col items-start gap-4">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10">
                    <span className="material-symbols-outlined text-[24px] text-teal-300">support_agent</span>
                </div>
                
                <div>
                    <h3 className="text-xl font-extrabold mb-1.5 tracking-tight text-white group-hover:text-teal-100 transition-colors">Need Assistance?</h3>
                    <p className="text-sm font-medium text-slate-300/90 leading-relaxed">Contact the TheraCare clinic admin or IT support team for immediate help.</p>
                </div>

                <button onClick={handleReachOut} className={`mt-2 w-full py-3 bg-white hover:bg-[#25D366]/10 text-slate-900 hover:text-[#25D366] rounded-xl text-sm font-bold shadow-lg shadow-black/20 hover:shadow-black/30 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2`}>
                    <span className="material-symbols-outlined text-[18px]">chat</span> Chat via WhatsApp
                </button>
            </div>
        </div>
    );
};

export default SupportWidget;
