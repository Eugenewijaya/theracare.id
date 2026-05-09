import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicSettings, user } from "../db/schema.js";

type NotificationEmailInput = {
  type?: string | null;
  title: string;
  message: string;
  targetRole: string;
  targetUserId?: string;
  relatedId?: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function isEmailEnabled() {
  return Boolean(process.env.RESEND_API_KEY) && process.env.EMAIL_ENABLED !== "false";
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeColor(value?: string) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "#2563eb";
}

async function getSettingsMap() {
  const rows = await db.select().from(clinicSettings);
  return Object.fromEntries(rows.map((row) => [row.key, row.value || ""]));
}

async function getRecipients(input: NotificationEmailInput) {
  if (input.targetUserId) {
    return db.select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(and(eq(user.id, input.targetUserId), eq(user.status, "active")));
  }

  return db.select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(and(eq(user.role, input.targetRole), eq(user.status, "active")));
}

function dashboardUrlForRole(role: string, settings: Record<string, string>) {
  if (role === "admin") return process.env.ADMIN_APP_URL || settings.centerWebsite || "";
  if (role === "therapist") return process.env.THERAPIST_APP_URL || settings.centerWebsite || "";
  if (role === "parent") return process.env.PARENT_APP_URL || settings.centerWebsite || "";
  return settings.centerWebsite || "";
}

function buildNotificationHtml(input: NotificationEmailInput, recipientName: string, settings: Record<string, string>) {
  const clinicName = settings.clinicName || "TheraCare";
  const tagline = settings.centerSubtitle || "Special Needs Center";
  const primaryColor = normalizeColor(settings.primaryColor);
  const secondaryColor = normalizeColor(settings.secondaryColor || "#0f766e");
  const logoUrl = settings.logoUrl || "";
  const centerPhotoUrl = settings.centerPhotoUrl || "";
  const dashboardUrl = dashboardUrlForRole(input.targetRole, settings);
  const address = settings.centerAddress || "";
  const phone = settings.centerPhone || "";
  const email = settings.centerEmail || "";
  const website = settings.centerWebsite || dashboardUrl;
  const preheader = `${clinicName}: ${input.title}`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;background:#f5f7fb;font-family:Inter,Arial,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 20px 50px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:0;background:${primaryColor};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding:28px 30px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="vertical-align:middle;">
                            ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" width="52" height="52" alt="${escapeHtml(clinicName)}" style="display:block;border-radius:14px;background:#fff;padding:6px;object-fit:contain;" />` : `<div style="width:52px;height:52px;border-radius:14px;background:#fff;color:${primaryColor};font-size:24px;font-weight:800;line-height:52px;text-align:center;">T</div>`}
                          </td>
                          <td style="padding-left:14px;vertical-align:middle;">
                            <div style="font-size:20px;line-height:1.2;font-weight:800;color:#ffffff;">${escapeHtml(clinicName)}</div>
                            <div style="font-size:13px;line-height:1.5;font-weight:700;color:rgba(255,255,255,0.82);letter-spacing:0.06em;text-transform:uppercase;">${escapeHtml(tagline)}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${centerPhotoUrl ? `<tr><td><img src="${escapeHtml(centerPhotoUrl)}" alt="${escapeHtml(clinicName)}" style="display:block;width:100%;max-height:190px;object-fit:cover;" /></td></tr>` : ""}
            <tr>
              <td style="padding:34px 30px 28px;">
                <div style="display:inline-block;margin-bottom:18px;padding:7px 12px;border-radius:999px;background:${secondaryColor}18;color:${secondaryColor};font-size:12px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(input.type || "notification")}</div>
                <h1 style="margin:0 0 14px;font-size:28px;line-height:1.18;font-weight:850;color:#0f172a;">${escapeHtml(input.title)}</h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.75;color:#475569;white-space:pre-line;">Halo ${escapeHtml(recipientName || "Bapak/Ibu")},</p>
                <div style="margin:0 0 28px;padding:20px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;color:#334155;font-size:15px;line-height:1.7;white-space:pre-line;">${escapeHtml(input.message)}</div>
                ${dashboardUrl ? `<a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:13px 20px;border-radius:14px;background:${primaryColor};color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;">Buka Dashboard</a>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 30px;background:#0f172a;color:#cbd5e1;">
                <div style="font-size:14px;font-weight:800;color:#ffffff;margin-bottom:8px;">${escapeHtml(clinicName)}</div>
                <div style="font-size:12px;line-height:1.7;color:#cbd5e1;">
                  ${address ? `${escapeHtml(address)}<br />` : ""}
                  ${phone ? `Telp/WA: ${escapeHtml(phone)}<br />` : ""}
                  ${email ? `Email: ${escapeHtml(email)}<br />` : ""}
                  ${website ? `Website: ${escapeHtml(website)}` : ""}
                </div>
                <div style="margin-top:16px;border-top:1px solid rgba(255,255,255,0.12);padding-top:14px;font-size:11px;line-height:1.6;color:#94a3b8;">
                  Email ini dikirim otomatis oleh platform ${escapeHtml(clinicName)}. Mohon tidak membalas email ini kecuali alamat balasan sudah diarahkan oleh admin.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendViaResend(to: string, subject: string, html: string) {
  const from = process.env.EMAIL_FROM || "TheraCare <onboarding@resend.dev>";
  const payload: Record<string, unknown> = { from, to, subject, html };
  if (process.env.EMAIL_REPLY_TO) payload.reply_to = process.env.EMAIL_REPLY_TO;

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Email gagal dikirim: ${message || response.statusText}`);
  }
}

export const emailService = {
  async sendNotification(input: NotificationEmailInput) {
    if (!isEmailEnabled()) return { skipped: true, reason: "Email belum dikonfigurasi" };

    const [settings, recipients] = await Promise.all([
      getSettingsMap(),
      getRecipients(input),
    ]);
    const validRecipients = recipients.filter((recipient) => recipient.email && !recipient.email.endsWith("@parent.theracare.id"));
    if (validRecipients.length === 0) return { skipped: true, reason: "Tidak ada recipient email valid" };

    const clinicName = settings.clinicName || "TheraCare";
    const subject = `[${clinicName}] ${input.title}`;
    const results = await Promise.allSettled(
      validRecipients.map((recipient) => sendViaResend(
        recipient.email,
        subject,
        buildNotificationHtml(input, recipient.name, settings),
      ))
    );

    const failed = results.filter((result) => result.status === "rejected").length;
    return {
      sent: results.length - failed,
      failed,
    };
  },
};
