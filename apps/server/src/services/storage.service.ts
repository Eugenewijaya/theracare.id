import { put } from "@vercel/blob";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

type StorageAssetKind = "logo" | "favicon" | "photo" | "therapist-profile" | "parent-profile" | "child-profile";

type UploadBrandingAssetInput = {
  kind: StorageAssetKind;
  fileName: string;
  contentType: string;
  dataBase64: string;
};

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "asset";
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function bufferToBody(buffer: Buffer, contentType: string) {
  return new Blob([new Uint8Array(buffer)], { type: contentType });
}

function getPublicSupabaseUrl(baseUrl: string, bucket: string, path: string) {
  const publicBase = process.env.SUPABASE_STORAGE_PUBLIC_URL?.replace(/\/+$/, "");
  if (publicBase) return `${publicBase}/${encodePath(path)}`;
  return `${baseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodePath(path)}`;
}

async function uploadToSupabase(path: string, buffer: Buffer, contentType: string) {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_STORAGE_SERVICE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || process.env.STORAGE_BUCKET;
  if (!supabaseUrl || !serviceKey || !bucket) return null;

  const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(path)}`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "x-upsert": "true",
    },
    body: bufferToBody(buffer, contentType),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase Storage upload gagal: ${message || response.statusText}`);
  }

  return getPublicSupabaseUrl(supabaseUrl, bucket, path);
}

async function uploadToGenericCdn(path: string, buffer: Buffer, contentType: string) {
  const uploadBase = process.env.CDN_STORAGE_UPLOAD_URL?.replace(/\/+$/, "");
  const publicBase = (process.env.CDN_STORAGE_PUBLIC_URL || process.env.CDN_PUBLIC_BASE_URL)?.replace(/\/+$/, "");
  if (!uploadBase || !publicBase) return null;

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  if (process.env.CDN_STORAGE_TOKEN) {
    headers.Authorization = `Bearer ${process.env.CDN_STORAGE_TOKEN}`;
  }

  const response = await fetch(`${uploadBase}/${encodePath(path)}`, {
    method: process.env.CDN_STORAGE_METHOD || "PUT",
    headers,
    body: bufferToBody(buffer, contentType),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`CDN storage upload gagal: ${message || response.statusText}`);
  }

  return `${publicBase}/${encodePath(path)}`;
}

export const storageService = {
  async uploadBrandingAsset(input: UploadBrandingAssetInput) {
    const allowedKinds: StorageAssetKind[] = ["logo", "favicon", "photo", "therapist-profile", "parent-profile", "child-profile"];
    if (!allowedKinds.includes(input.kind)) {
      throw new Error("Jenis asset upload tidak valid");
    }
    if (!input.fileName || !input.dataBase64) {
      throw new Error("File upload tidak lengkap");
    }
    if (!ALLOWED_IMAGE_TYPES.has(input.contentType)) {
      throw new Error("Format file tidak didukung. Gunakan PNG, JPG, WebP, SVG, GIF, atau ICO.");
    }

    const buffer = Buffer.from(input.dataBase64, "base64");
    if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
      throw new Error("Ukuran file harus lebih kecil dari 5MB.");
    }

    const path = `uploads/${input.kind}/${Date.now()}-${sanitizeFileName(input.fileName)}`;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(path, buffer, {
        access: "public",
        contentType: input.contentType,
        token: process.env.BLOB_READ_WRITE_TOKEN,
        addRandomSuffix: false,
      });
      return {
        url: blob.url,
        pathname: blob.pathname,
        contentType: input.contentType,
        size: buffer.length,
        provider: "vercel-blob",
      };
    }

    const supabaseUrl = await uploadToSupabase(path, buffer, input.contentType);
    if (supabaseUrl) {
      return {
        url: supabaseUrl,
        pathname: path,
        contentType: input.contentType,
        size: buffer.length,
        provider: "supabase-storage",
      };
    }

    const genericUrl = await uploadToGenericCdn(path, buffer, input.contentType);
    if (genericUrl) {
      return {
        url: genericUrl,
        pathname: path,
        contentType: input.contentType,
        size: buffer.length,
        provider: "generic-cdn",
      };
    }

    throw new Error("Storage bucket belum dikonfigurasi. Set BLOB_READ_WRITE_TOKEN, atau SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_STORAGE_BUCKET, atau CDN_STORAGE_UPLOAD_URL + CDN_STORAGE_PUBLIC_URL.");
  },
};
