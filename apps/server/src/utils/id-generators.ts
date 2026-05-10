/**
 * Generate NITA — Nomor Induk Terapi Anak
 * Format: YYMMDD + NNN (3-digit sequence)
 */
export function generateNITA(sequence: number): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const seq = String(sequence).padStart(3, "0");
  return `${yy}${mm}${dd}${seq}`;
}

/**
 * Generate NIT — Nomor Induk Terapis
 * Format: FIRSTNAME + YYMMDD + NNN
 */
export function generateNIT(name: string, sequence: number): string {
  const firstName = (name || "Terapis")
    .split(" ")[0]
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const seq = String(sequence).padStart(3, "0");
  return `${firstName}${yy}${mm}${dd}${seq}`;
}

/**
 * Generate temporary password
 */
export function generateTempPassword(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `Klinik@${num}`;
}

/**
 * Fixed temporary password for admin reset during MVP testing.
 */
export function generatePortalResetPassword(): string {
  return process.env.PORTAL_RESET_PASSWORD?.trim() || "Klinik@2211";
}

/**
 * Generate unique ID with prefix
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

/**
 * Generate sequential ID with prefix and padding
 */
export function generateSeqId(prefix: string, sequence: number, pad = 4): string {
  return `${prefix}-${String(sequence).padStart(pad, "0")}`;
}
