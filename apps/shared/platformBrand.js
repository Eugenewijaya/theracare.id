import platformLogoUrl from './assets/platform-logo.png';

export const PLATFORM_NAME = 'TheraCare';
export { platformLogoUrl };

export function applyPlatformFavicon() {
  if (typeof document === 'undefined') return;

  const selectors = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
  ];

  selectors.forEach((selector) => {
    const existing = document.head.querySelector(selector);
    if (existing) existing.remove();
  });

  const icon = document.createElement('link');
  icon.rel = 'icon';
  icon.type = 'image/png';
  icon.href = platformLogoUrl;
  document.head.appendChild(icon);

  const appleIcon = document.createElement('link');
  appleIcon.rel = 'apple-touch-icon';
  appleIcon.href = platformLogoUrl;
  document.head.appendChild(appleIcon);
}
