import React, { useRef } from 'react';

const TherapistProfile = ({ user, onPhotoUpdate }) => {
    const fileInputRef = useRef(null);
    
    // Default mock photo if not set
    const photoUrl = user?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuCXGy6vGtYPN1BBwn1OuEAuKz7roAvC-58xUPeK66fl3RXh_K6tjlTUj0c665rEJaS7RhjDsQUwrHnIFOzd3Dl5xcavpWq_M0xrt2Abx-lYjzGI9eFdcqM92fIejoiJP-9HbGLOUmhXWZlm7LnAqSZEn-b_eYE9vOREgqyVQykjQxVVfr8AtBSJRK6Ei8FpmCCMhbXkNxYv3sofUOj1X6Mypvglb0apATONynVX839G0U9_3jsNQiDpQp0eEazUSJvAtv79Ahlm5g";

    const handlePhotoClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (onPhotoUpdate) onPhotoUpdate(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="flex p-4">
            <div className="flex w-full flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
                <div className="flex gap-4 items-center">
                    <div className="relative group cursor-pointer" onClick={handlePhotoClick}>
                        <div
                            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full min-h-32 w-32 shadow-sm border-4 border-white dark:border-slate-800"
                            title={user?.name || "Therapist"}
                            style={{ backgroundImage: `url('${photoUrl}')` }}
                        ></div>
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="material-symbols-outlined text-white">photo_camera</span>
                        </div>
                        <input 
                            type="file" 
                            accept="image/*" 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={handleFileChange} 
                        />
                    </div>
                    <div className="flex flex-col justify-center">
                        <p className="text-slate-900 dark:text-slate-100 text-[22px] font-bold leading-tight tracking-[-0.015em]">{user?.name || "Therapist"}</p>
                        <p className="text-slate-600 dark:text-slate-300 text-base font-normal leading-normal">{user?.bio || "Senior Pediatric Therapist · 8 Years Experience"}</p>
                        <p className="text-slate-600 dark:text-slate-300 text-base font-normal leading-normal">Specialization: {user?.specialty || "Autism Spectrum Disorder"}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TherapistProfile;
