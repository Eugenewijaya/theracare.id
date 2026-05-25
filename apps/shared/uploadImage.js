import { uploadsApi } from './api/client';

const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_DIRECT_UPLOAD_BYTES = 2.5 * 1024 * 1024;
const TARGET_RASTER_BYTES = 1.2 * 1024 * 1024;
const MAX_RASTER_DIMENSION = 1600;
const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/gif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);
const COMPRESSIBLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function inferContentType(file) {
  const name = (file?.name || '').toLowerCase();
  if (file?.type) {
    return file.type === 'image/jpg' ? 'image/jpeg' : file.type;
  }
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.svg')) return 'image/svg+xml';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.ico')) return 'image/x-icon';
  return '';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.readAsDataURL(file);
  });
}

function replaceExtension(fileName, extension) {
  const base = (fileName || 'image').replace(/\.[a-z0-9]+$/i, '') || 'image';
  return `${base}.${extension}`;
}

function dataUrlToBase64(dataUrl) {
  return dataUrl.includes(',') ? dataUrl.split(',').pop() : dataUrl;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gagal memproses gambar'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('Gagal mengompres gambar'));
      else resolve(blob);
    }, type, quality);
  });
}

async function compressRasterImage(file, options = {}) {
  if (typeof document === 'undefined') return null;
  const targetBytes = options.targetBytes || TARGET_RASTER_BYTES;
  const maxDimension = options.maxDimension || MAX_RASTER_DIMENSION;
  const image = await loadImageFromFile(file);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) return null;

  let scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  let quality = 0.86;
  let bestBlob = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    bestBlob = blob;
    if (blob.size <= targetBytes) break;
    if (quality > 0.62) {
      quality -= 0.08;
    } else {
      scale *= 0.82;
    }
  }

  return bestBlob;
}

export async function prepareImageUploadPayload(file, kind, options = {}) {
  if (!file) throw new Error('File gambar belum dipilih');
  const contentType = inferContentType(file);
  if (!ACCEPTED_TYPES.has(contentType)) {
    throw new Error('Format gambar harus JPG, PNG, WebP, SVG, GIF, atau ICO');
  }
  if (file.size <= 0 || file.size > (options.maxSourceBytes || MAX_SOURCE_IMAGE_BYTES)) {
    throw new Error('Ukuran gambar maksimal 10MB');
  }

  let uploadFile = file;
  let uploadContentType = contentType;
  let uploadFileName = file.name || `${kind}.png`;
  let compressed = false;

  if (COMPRESSIBLE_TYPES.has(contentType)) {
    const compressedBlob = await compressRasterImage(file, options);
    if (compressedBlob && compressedBlob.size < file.size) {
      uploadFile = compressedBlob;
      uploadContentType = 'image/jpeg';
      uploadFileName = replaceExtension(uploadFileName, 'jpg');
      compressed = true;
    }
  }

  if (uploadFile.size > (options.maxUploadBytes || MAX_DIRECT_UPLOAD_BYTES)) {
    throw new Error('Ukuran gambar terlalu besar untuk koneksi web. Gunakan gambar di bawah 2.5MB atau kompres terlebih dahulu.');
  }

  const dataUrl = await readFileAsDataUrl(uploadFile);
  return {
    kind,
    fileName: uploadFileName,
    contentType: uploadContentType,
    dataBase64: dataUrlToBase64(dataUrl),
    originalSize: file.size,
    uploadSize: uploadFile.size,
    compressed,
  };
}

export async function uploadImageFile(file, kind, options = {}) {
  const payload = await prepareImageUploadPayload(file, kind, options);
  const res = await uploadsApi.image(payload);

  if (!res.ok || !res.data?.data?.url) {
    throw new Error(res.data?.error || 'Upload gambar gagal');
  }
  return res.data.data.url;
}
