export const LANGUAGE_STORAGE_KEY = 'theracare_language';
export const LANGUAGE_CHANGED_EVENT = 'theracareLanguageChanged';
export const DEFAULT_LANGUAGE = 'id';

export const SUPPORTED_LANGUAGES = [
  { code: 'id', label: 'Bahasa Indonesia', shortLabel: 'Indonesia', nativeLabel: 'Indonesia', htmlLang: 'id' },
  { code: 'en', label: 'English', shortLabel: 'English', nativeLabel: 'English', htmlLang: 'en' },
  { code: 'zh', label: '中文 (China)', shortLabel: 'China', nativeLabel: '中文', htmlLang: 'zh-CN' },
];

const ENTRIES = [
  ['dashboard', { id: 'Dasbor', en: 'Dashboard', zh: '仪表盘' }],
  ['admin_dashboard', { id: 'Dashboard Admin', en: 'Admin Dashboard', zh: '管理员仪表盘' }],
  ['therapist_portal', { id: 'Portal Terapis', en: 'Therapist Portal', zh: '治疗师门户' }],
  ['parent_portal', { id: 'Portal Orang Tua', en: 'Parent Portal', zh: '家长门户' }],
  ['admin_panel', { id: 'Panel Admin', en: 'Admin Panel', zh: '管理面板' }],
  ['therapist', { id: 'Terapis', en: 'Therapist', zh: '治疗师' }],
  ['parent', { id: 'Orang Tua', en: 'Parent', zh: '家长' }],
  ['settings', { id: 'Pengaturan', en: 'Settings', zh: '设置' }],
  ['settings_helper', { id: 'Kelola akun, preferensi, dan keamanan.', en: 'Manage account, preferences, and security.', zh: '管理账户、偏好和安全。' }],
  ['therapist_settings_helper', { id: 'Kelola preferensi tampilan portal terapis.', en: 'Manage therapist portal display preferences.', zh: '管理治疗师门户显示偏好。' }],
  ['appearance_settings', { id: 'Pengaturan & Tampilan', en: 'Settings & Appearance', zh: '设置与外观' }],
  ['global_settings', { id: 'Pengaturan Global', en: 'Global Settings', zh: '全局设置' }],
  ['manage_configurations', { id: 'Kelola konfigurasi', en: 'Manage configurations', zh: '管理配置' }],
  ['branding', { id: 'Branding', en: 'Branding', zh: '品牌' }],
  ['general', { id: 'Umum', en: 'General', zh: '通用' }],
  ['notifications', { id: 'Notifikasi', en: 'Notifications', zh: '通知' }],
  ['schedule', { id: 'Jadwal', en: 'Schedule', zh: '日程' }],
  ['scheduling', { id: 'Penjadwalan', en: 'Scheduling', zh: '排班' }],
  ['reports', { id: 'Laporan', en: 'Reports', zh: '报告' }],
  ['report', { id: 'Laporan', en: 'Report', zh: '报告' }],
  ['progress', { id: 'Perkembangan', en: 'Progress', zh: '进展' }],
  ['performance', { id: 'Kinerja', en: 'Performance', zh: '绩效' }],
  ['availability', { id: 'Ketersediaan', en: 'Availability', zh: '可用时间' }],
  ['leave_requests', { id: 'Pengajuan Cuti', en: 'Leave Requests', zh: '请假申请' }],
  ['schedule_updates', { id: 'Pembaruan Jadwal', en: 'Schedule Updates', zh: '日程更新' }],
  ['parent_meeting', { id: 'Pertemuan Orang Tua', en: 'Parent Meeting', zh: '家长会议' }],
  ['incoming_requests', { id: 'Permintaan Masuk', en: 'Incoming Requests', zh: '待处理请求' }],
  ['clinic_management', { id: 'Manajemen Klinik', en: 'Clinic Management', zh: '诊所管理' }],
  ['analytics_reports', { id: 'Analitik & Laporan', en: 'Analytics & Reports', zh: '分析与报告' }],
  ['system', { id: 'Sistem', en: 'System', zh: '系统' }],
  ['children_data', { id: 'Data Anak', en: 'Children Data', zh: '儿童资料' }],
  ['therapist_data', { id: 'Data Terapis', en: 'Therapist Data', zh: '治疗师资料' }],
  ['room_management', { id: 'Manajemen Ruangan', en: 'Room Management', zh: '房间管理' }],
  ['service_programs', { id: 'Program Layanan', en: 'Service Programs', zh: '服务项目' }],
  ['child_attendance', { id: 'Kehadiran Anak', en: 'Child Attendance', zh: '儿童出勤' }],
  ['monitor_progress', { id: 'Pantau Perkembangan', en: 'Monitor Progress', zh: '进展监控' }],
  ['clinic_reports', { id: 'Laporan Klinik', en: 'Clinic Reports', zh: '诊所报告' }],
  ['announcements_notifications', { id: 'Pengumuman & Notifikasi', en: 'Announcements & Notifications', zh: '公告与通知' }],
  ['user_management', { id: 'Manajemen Pengguna', en: 'User Management', zh: '用户管理' }],
  ['logout', { id: 'Keluar', en: 'Sign Out', zh: '退出' }],
  ['save_changes', { id: 'Simpan Perubahan', en: 'Save Changes', zh: '保存更改' }],
  ['save', { id: 'Simpan', en: 'Save', zh: '保存' }],
  ['cancel', { id: 'Batal', en: 'Cancel', zh: '取消' }],
  ['refresh', { id: 'Perbarui', en: 'Refresh', zh: '刷新' }],
  ['loading', { id: 'Memuat...', en: 'Loading...', zh: '加载中...' }],
  ['language_display', { id: 'Bahasa Tampilan', en: 'Display Language', zh: '显示语言' }],
  ['language_helper', { id: 'Pilih bahasa portal. Istilah umum seperti Dashboard, email, dan WhatsApp tetap dipertahankan jika lebih familiar.', en: 'Choose the portal language. Familiar terms such as Dashboard, email, and WhatsApp are preserved when clearer.', zh: '选择门户语言。Dashboard、email 和 WhatsApp 等常用术语会在更清晰时保留。' }],
  ['language_default_note', { id: 'Default sistem: Bahasa Indonesia.', en: 'System default: Indonesian.', zh: '系统默认：印尼语。' }],
  ['language_choice', { id: 'Pilihan Bahasa', en: 'Language Choice', zh: '语言选择' }],
  ['active', { id: 'Aktif', en: 'Active', zh: '启用' }],
  ['account_profile', { id: 'Profil Akun', en: 'Account Profile', zh: '账户资料' }],
  ['profile_admin_managed', { id: 'Data login dikelola admin dan akan diperbarui otomatis ketika kontak orang tua berubah.', en: 'Login data is managed by admin and updates automatically when parent contact details change.', zh: '登录资料由管理员管理，家长联系方式变更后会自动更新。' }],
  ['parent_profile_load_error', { id: 'Profil orang tua belum bisa dimuat dari server.', en: 'Parent profile could not be loaded from the server yet.', zh: '暂时无法从服务器加载家长资料。' }],
  ['full_name', { id: 'Nama Lengkap', en: 'Full Name', zh: '姓名' }],
  ['phone_number', { id: 'Nomor Telepon', en: 'Phone Number', zh: '电话号码' }],
  ['not_configured_by_admin', { id: 'Belum diatur admin', en: 'Not set by admin', zh: '管理员尚未设置' }],
  ['notification_preferences', { id: 'Preferensi Notifikasi', en: 'Notification Preferences', zh: '通知偏好' }],
  ['email_notifications', { id: 'Notifikasi Email', en: 'Email Notifications', zh: '邮件通知' }],
  ['email_notifications_helper', { id: 'Terima pengingat jadwal dan laporan ke email.', en: 'Receive schedule reminders and reports by email.', zh: '通过邮件接收日程提醒和报告。' }],
  ['sms_whatsapp_notifications', { id: 'Notifikasi SMS / WhatsApp', en: 'SMS / WhatsApp Notifications', zh: '短信 / WhatsApp 通知' }],
  ['urgent_schedule_notifications', { id: 'Pemberitahuan darurat atau penjadwalan batal.', en: 'Emergency alerts or canceled scheduling notices.', zh: '紧急提醒或排班取消通知。' }],
  ['display', { id: 'Tampilan', en: 'Display', zh: '显示' }],
  ['application_theme', { id: 'Tema Aplikasi', en: 'Application Theme', zh: '应用主题' }],
  ['application_theme_helper', { id: 'Beralih antara mode Terang (Light) dan Gelap (Dark).', en: 'Switch between Light and Dark mode.', zh: '在浅色和深色模式之间切换。' }],
  ['save_preferences', { id: 'Simpan Preferensi', en: 'Save Preferences', zh: '保存偏好' }],
  ['preferences_saved', { id: 'Preferensi berhasil disimpan.', en: 'Preferences saved.', zh: '偏好已保存。' }],
  ['light_mode', { id: 'Light Mode', en: 'Light Mode', zh: '浅色模式' }],
  ['dark_mode', { id: 'Dark Mode', en: 'Dark Mode', zh: '深色模式' }],
  ['parent_id', { id: 'Parent ID', en: 'Parent ID', zh: '家长 ID' }],
  ['parent_login_label', { id: 'Nomor Telepon / Parent ID / Email', en: 'Phone Number / Parent ID / Email', zh: '电话号码 / 家长 ID / Email' }],
  ['parent_login_placeholder', { id: '08xx, P-0001, atau email', en: '08xx, P-0001, or email', zh: '08xx、P-0001 或 Email' }],
  ['parent_login_description', { id: 'Gunakan nomor telepon, Parent ID, atau email orang tua yang didaftarkan admin.', en: 'Use the phone number, Parent ID, or parent email registered by admin.', zh: '使用管理员登记的电话号码、家长 ID 或家长 Email。' }],
  ['parent_login_required', { id: 'Masukkan nomor telepon, Parent ID, atau email orang tua.', en: 'Enter the parent phone number, Parent ID, or email.', zh: '请输入家长电话号码、家长 ID 或 Email。' }],
  ['edit_parent_data', { id: 'Edit Data Orang Tua', en: 'Edit Parent Data', zh: '编辑家长资料' }],
  ['edit_login', { id: 'Edit Login', en: 'Edit Login', zh: '编辑登录' }],
  ['edit_login_contact', { id: 'Edit kontak login', en: 'Edit login contact', zh: '编辑登录联系方式' }],
  ['back', { id: 'Kembali', en: 'Back', zh: '返回' }],
  ['open_menu', { id: 'Buka menu', en: 'Open menu', zh: '打开菜单' }],
  ['close_menu', { id: 'Tutup menu', en: 'Close menu', zh: '关闭菜单' }],
  ['center_name', { id: 'Nama Center', en: 'Center Name', zh: '中心名称' }],
  ['center_description', { id: 'Deskripsi Center', en: 'Center Description', zh: '中心描述' }],
  ['center_logo', { id: 'Logo Center', en: 'Center Logo', zh: '中心标志' }],
  ['center_photo', { id: 'Foto Center', en: 'Center Photo', zh: '中心照片' }],
  ['brand_colors', { id: 'Warna Brand', en: 'Brand Colors', zh: '品牌颜色' }],
  ['primary_brand_color', { id: 'Warna Brand Utama', en: 'Primary Brand Color', zh: '主品牌色' }],
  ['secondary_accent', { id: 'Aksen Sekunder', en: 'Secondary Accent', zh: '辅助色' }],
  ['live_preview', { id: 'Pratinjau Langsung', en: 'Live Preview', zh: '实时预览' }],
  ['upload_logo', { id: 'Upload Logo', en: 'Upload Logo', zh: '上传标志' }],
  ['upload_photo', { id: 'Upload Foto', en: 'Upload Photo', zh: '上传照片' }],
  ['uploading', { id: 'Mengunggah...', en: 'Uploading...', zh: '上传中...' }],
  ['general_identity', { id: 'Identitas Umum', en: 'General Identity', zh: '基本信息' }],
  ['logos_iconography', { id: 'Logo & Ikon', en: 'Logos & Iconography', zh: '标志与图标' }],
  ['notification_channels', { id: 'Kanal Notifikasi', en: 'Notification Channels', zh: '通知渠道' }],
  ['in_app', { id: 'In-App', en: 'In-App', zh: '应用内' }],
  ['email', { id: 'Email', en: 'Email', zh: '电子邮件' }],
  ['whatsapp', { id: 'WhatsApp', en: 'WhatsApp', zh: 'WhatsApp' }],
];

const phraseToKey = new Map();
const keyToEntry = new Map(ENTRIES);

function normalizePhrase(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

ENTRIES.forEach(([key, values]) => {
  Object.values(values).forEach((value) => phraseToKey.set(normalizePhrase(value), key));
});

export function normalizeLanguage(value) {
  return SUPPORTED_LANGUAGES.some((item) => item.code === value) ? value : DEFAULT_LANGUAGE;
}

export function readLanguage() {
  try {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function writeLanguage(language) {
  const next = normalizeLanguage(language);
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGED_EVENT, { detail: { language: next } }));
  }
  return next;
}

export function translatePhrase(value, language = readLanguage()) {
  const normalized = normalizePhrase(value);
  const key = phraseToKey.get(normalized);
  if (!key) return null;
  return keyToEntry.get(key)?.[normalizeLanguage(language)] || null;
}

export function getLanguageMeta(language = readLanguage()) {
  return SUPPORTED_LANGUAGES.find((item) => item.code === normalizeLanguage(language)) || SUPPORTED_LANGUAGES[0];
}
