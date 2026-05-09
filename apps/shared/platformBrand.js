import platformLogoUrl from './assets/platform-logo.png';

export const PLATFORM_NAME = 'TheraCare';
export { platformLogoUrl };

function inferFaviconType(href) {
  const clean = String(href || '').split('?')[0].toLowerCase();
  if (clean.endsWith('.svg')) return 'image/svg+xml';
  if (clean.endsWith('.ico')) return 'image/x-icon';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

export function applyPlatformFavicon(iconUrl = platformLogoUrl) {
  if (typeof document === 'undefined') return;
  const href = typeof iconUrl === 'string' && iconUrl.trim() ? iconUrl.trim() : platformLogoUrl;

  const selectors = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
  ];

  selectors.forEach((selector) => {
    document.head.querySelectorAll(selector).forEach((existing) => existing.remove());
  });

  const icon = document.createElement('link');
  icon.rel = 'icon';
  icon.type = inferFaviconType(href);
  icon.href = href;
  document.head.appendChild(icon);

  const appleIcon = document.createElement('link');
  appleIcon.rel = 'apple-touch-icon';
  appleIcon.href = href;
  document.head.appendChild(appleIcon);
}
