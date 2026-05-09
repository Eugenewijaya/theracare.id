import { uploadsApi } from './api/client';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif', 'image/x-icon']);

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.readAsDataURL(file);
  });
}

export async function uploadImageFile(file, kind) {
  if (!file) throw new Error('File gambar belum dipilih');
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error('Format gambar harus JPG, PNG, WebP, SVG, GIF, atau ICO');
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error('Ukuran gambar maksimal 5MB');
  }

  const dataUrl = await readFileAsDataUrl(file);
  const dataBase64 = dataUrl.includes(',') ? dataUrl.split(',').pop() : dataUrl;
  const res = await uploadsApi.image({
    kind,
    fileName: file.name || `${kind}.png`,
    contentType: file.type,
    dataBase64,
  });

  if (!res.ok || !res.data?.data?.url) {
    throw new Error(res.data?.error || 'Upload gambar gagal');
  }
  return res.data.data.url;
}
