import React from 'react';

export function ClinicLogoMark({
  logoUrl,
  name = 'TheraCare',
  color = '#137fec',
  icon = 'health_and_safety',
  className = 'h-10 w-10',
  imageClassName = '',
}) {
  const hasLogo = typeof logoUrl === 'string' && logoUrl.trim().length > 0;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm ${className}`}
      style={{ backgroundColor: hasLogo ? '#ffffff' : color, color: hasLogo ? color : '#ffffff' }}
      aria-label={`${name} logo`}
    >
      {hasLogo ? (
        <img src={logoUrl} alt={`${name} logo`} className={`h-full w-full object-contain p-1 ${imageClassName}`} />
      ) : (
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      )}
    </div>
  );
}

export default ClinicLogoMark;
