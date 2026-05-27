# Final Full Audit TheraCare Dashboard dan Micro Apps - 2026-05-27

Audit ini dilakukan langsung dari kode aktif di `D:\Project\clinic-monorepo`, bukan dari memori. Fokusnya adalah semua shell dashboard admin, terapis, orang tua, micro-app yang terhubung, kontrak shared API, dan backend route yang menopang flow.

## Status akhir

- Status perbaikan: selesai untuk temuan yang dapat direproduksi dari kode, static scan, build, dan browser smoke.
- Status horizontal scroll: desktop dan mobile smoke menghasilkan `overflowX=false` untuk semua route shell yang dicek.
- Status push: siap dipush setelah commit final audit ini.
- Batasan QA: repo belum memiliki script test otomatis dan lint workspace masih terblokir konfigurasi ESLint v9 yang belum tersedia.

## Cakupan yang diaudit

Workspace aplikasi yang dipetakan dari `apps/*/package.json`:

- Admin: `admin-app`, `admin-attendance`, `admin-programs`, `admin-reports`, `admin-requests`, `admin-rooms`, `admin-scheduling`, `bulk-schedule`, `child-management`, `child-registration`, `clinic-admin`, `clinic-branding-settings`, `monitoring-progress`, `notification-center`, `parents-meeting`, `therapist-management`, `therapist-registration`.
- Therapist: `therapist-app`, `therapist-availability-calendar`, `therapist-dashboard`, `therapist-performance`, `therapist-registration`, `therapist-report`, `therapist-schedule`, `therapist-web-report`.
- Parent: `parent-app`, `parent-portal`, `parent-reports-archive`, `parent-reschedule`, `parent-web-dashboard`, `child-progress`.
- Shared/backend: `shared` modules imported lint/build-time through apps, plus `server`.

## Route dan kontrak utama yang dicek

- Admin shell: `apps/admin-app/src/App.jsx:120-142`
  - `/`, `/scheduling`, `/bulk-schedule`, `/requests`, `/parent-meetings`, `/attendance`, `/therapist-registration`, `/reports`, `/monitoring`, `/children`, `/children/register`, `/children/program-registration`, `/migration`, `/therapists`, `/rooms`, `/programs`, `/notifications`, `/settings/branding`, `/users`, `/therapist-leave-requests`, `/announcements`.
- Therapist shell: `apps/therapist-app/src/App.jsx:123-136`
  - `/`, `/schedule`, `/availability`, `/reports`, `/reports/new`, `/performance`, `/meetings`, `/child-progress`, `/announcements`, `/schedule-updates`, `/leave-requests`, `/settings`.
- Parent shell: `apps/parent-app/src/App.jsx:125-135`
  - `/`, `/reports`, `/reschedule`, `/profile`, `/attendance`, `/progress`, `/announcements`, `/meetings`, `/settings`.
- Backend API mount: `apps/server/src/app.ts:312-329`
  - `/api/sync`, `/api/parents`, `/api/children`, `/api/therapists`, `/api/sessions`, `/api/reports`, `/api/reschedule`, `/api/therapy-periods`, `/api/leave-requests`, `/api/substitute-requests`, `/api/meetings`, `/api/notifications`, `/api/audit-logs`, `/api/developer`, `/api/location`, `/api/admin`, `/api/uploads`, `/api/migration`.

## Metode audit

1. Route map audit
   - Memastikan setiap dashboard utama memiliki route aktif, fallback route, dan protected route.
   - Memastikan route redirect legacy tidak menampilkan halaman pasif.

2. Static no-op scan
   - Scan dilakukan untuk `href="#"`, `javascript:`, handler kosong, `Coming Soon`, `TODO`, `FIXME`, `window.alert`, dan `alert(` di `apps/**/*.jsx` dan `apps/**/*.js`.
   - Hasil akhir: tidak ada match.

3. Mutation response audit
   - Flow yang melakukan create/update/delete/mark-read dicek untuk memastikan tidak menampilkan sukses sebelum `res.ok`.
   - Temuan paling penting ada di admin requests, bulk schedule, notification read, legacy announcements, dan therapist-report standalone.

4. Shared/backend contract audit
   - Cek `apps/shared/api/client.js`, `apps/shared/clinicSettings.js`, `apps/server/src/services/admin.service.ts`, `apps/server/src/services/notification.service.ts`, dan route backend.
   - Fokus utama: payload settings JSON, notification preferences, report save payload, sessionId report harian, dan response shape child list.

5. Browser smoke desktop/mobile
   - Admin shell: 17 route x 2 viewport = 34 checks.
   - Therapist shell: 12 route x 2 viewport = 24 checks.
   - Parent shell: 9 route x 2 viewport = 18 checks.
   - Standalone therapist-report: 1 route x 2 viewport = 2 checks.
   - Total: 78 route/viewport checks.
   - Hasil akhir: 0 horizontal overflow pada route yang dicek.

## Perbaikan yang diterapkan

### 1. Horizontal scroll dashboard dan tombol Panduan

Status: tidak ditemukan overflow horizontal setelah smoke final.

Bukti kode:

- Admin layout sudah membatasi shell dengan `w-full max-w-full overflow-hidden` dan content `overflow-x-hidden`: `apps/admin-app/src/App.jsx:99-118`.
- Therapist layout memiliki guard yang sama: `apps/therapist-app/src/App.jsx:102-121`.
- Parent layout memiliki guard yang sama: `apps/parent-app/src/App.jsx:105-123`.
- `GuideHost` sudah memakai modal/header yang bounded: `apps/shared/ui/GuideHost.jsx:86-104` dan tombol panduan dengan `min-w-0 max-w-full overflow-hidden`: `apps/shared/ui/GuideHost.jsx:272-286`.

QA:

- Browser smoke desktop 1366x900 dan mobile 390x844 menghasilkan `overflowX=false`.
- Route parent `/reports` sempat menghasilkan runtime error sebelum patch, lalu dicek ulang dan `overflowX=false`.

### 2. Standalone therapist report tidak lagi pasif

File:

- `apps/therapist-report/src/main.jsx:3-11`
- `apps/therapist-report/src/components/ReportForm.jsx:66-198`

Masalah:

- Component memakai navigasi router tetapi entrypoint belum dibungkus `BrowserRouter`.
- Form laporan berdiri sendiri sebelumnya tidak benar-benar mengikat sesi backend, toolbar pasif, upload pasif, dan submit bisa terlihat sukses tanpa kontrak report harian yang lengkap.

Perbaikan:

- Entry point dibungkus `BrowserRouter`.
- Form memuat sesi dari `sessionsApi.getForTherapist(currentUser.id)`.
- Submit mewajibkan `selectedSessionId` karena laporan harian backend butuh `sessionId`.
- Payload menyimpan `status: 'ready_for_parent'`, `sessionId`, `therapistId`, `childId`, dan field observasi.
- Submit hanya sukses setelah `reportsApi.save(report)` mengembalikan `res.ok`.
- Toolbar sekarang memasukkan template ke field aktif.
- Upload media memakai `uploadImageFile(file, 'report-media')` dan menyimpan URL hasil upload.

### 3. Bulk schedule tidak lagi memberi sukses palsu

File: `apps/bulk-schedule/src/App.jsx:222`

Masalah:

- Create bulk schedule bisa membuka success modal walaupun API gagal.

Perbaikan:

- Response `sessionsApi.createBulk(newSessionsData)` sekarang divalidasi.
- UI menyimpan error jika API gagal.
- Tombol diset loading/disabled selama request berjalan.
- Success modal hanya tampil setelah backend OK.

### 4. Admin requests action flow dibuat honest

File: `apps/admin-requests/src/App.jsx:14-432`

Masalah:

- Load dan action request belum konsisten membedakan API berhasil vs gagal.
- Reject/process/approve/delete berpotensi mengubah UI lokal sebelum backend benar-benar menerima request.

Perbaikan:

- Ditambah `assertApiOk(response, fallbackMessage)` di `apps/admin-requests/src/App.jsx:14`.
- Load reschedule dan meeting request divalidasi di `apps/admin-requests/src/App.jsx:201-202`.
- Reject meeting/reschedule divalidasi di `apps/admin-requests/src/App.jsx:334-337`.
- Process review divalidasi di `apps/admin-requests/src/App.jsx:352`.
- Approve meeting/reschedule divalidasi di `apps/admin-requests/src/App.jsx:375-381`.
- Delete history divalidasi di `apps/admin-requests/src/App.jsx:421-432`.
- UI sekarang update hanya setelah API OK, bukan sebelum API selesai.

### 5. Notification read flow tidak lagi optimistik tanpa validasi

File:

- `apps/clinic-admin/src/components/Header.jsx:16-65`
- `apps/therapist-app/src/pages/Announcements.jsx:127-155`

Masalah:

- Mark read dan mark all read dapat mengubah UI lokal tanpa memastikan endpoint berhasil.

Perbaikan:

- `notificationsApi.getAll`, `markRead`, dan `markAllRead` dicek `res.ok`.
- Jika gagal, UI mempertahankan state dan menampilkan feedback error.
- Admin header dan therapist announcements sekarang konsisten.

### 6. Legacy admin announcements tidak lagi false-success

File: `apps/admin-app/src/pages/AnnouncementsPage.jsx`

Masalah:

- Legacy page masih ada di repo dan create/update/delete dapat memperlihatkan state sukses walau API gagal.

Perbaikan:

- Load, create, update, dan delete sekarang memeriksa `res.ok`.
- Error ditampilkan sebagai banner.
- Success toast hanya setelah response valid.

Catatan:

- Route aktif admin `/announcements` sekarang redirect ke `/notifications` di `apps/admin-app/src/App.jsx:141`, tetapi file legacy tetap diperbaiki karena masih berada di repo dan dapat dipakai kembali.

### 7. Notification preferences sekarang backend-backed

File:

- `apps/shared/clinicSettings.js:25-78`
- `apps/clinic-branding-settings/src/App.jsx:126-306` dan `apps/clinic-branding-settings/src/App.jsx:971`
- `apps/server/src/services/admin.service.ts:126`
- `apps/server/src/services/notification.service.ts:9-199`

Masalah:

- Setting notifikasi sebelumnya berisiko menjadi kosmetik jika toggle tidak mempengaruhi delivery.

Perbaikan:

- `notificationPreferences` ditambahkan ke default shared settings.
- Client settings menormalisasi JSON/object dan menyimpan object settings sebagai JSON ke backend.
- Public settings backend memasukkan `notificationPreferences`.
- `admin.service.updateSettings` menyimpan object sebagai JSON string.
- `notification.service.create` membaca preference per kategori sebelum membuat in-app notification atau mengirim email.
- Toggle SMS pasif dihapus dari UI karena belum ada channel backend.

Kategori yang didukung:

- `registration_new`
- `session_reminder`
- `reschedule_request`
- `report_uploaded`
- `center_closure`

### 8. Parent progress tidak crash saat shape child response berbeda

File: `apps/parent-app/src/pages/ProgressSummary.jsx:318-338`

Masalah:

- Browser smoke menemukan runtime error `list.some is not a function` ketika `childrenApi.getByParent()` tidak berbentuk array langsung.

Perbaikan:

- Response child sekarang dinormalisasi dari array, `{ children: [] }`, single object, atau fallback kosong.
- `user.children` juga diguard dengan `Array.isArray`.

QA:

- Route parent `/progress` dicek ulang desktop dan mobile.
- Hasil: tidak ada exception, tidak ada horizontal overflow.

### 9. Parent reports archive tidak crash saat child list bukan array

File: `apps/parent-reports-archive/src/App.jsx:577-623`

Masalah:

- Browser smoke menemukan runtime error `availableChildren.find is not a function` pada route parent `/reports`.

Perbaikan:

- Response `childrenApi.getByParent(user.parentId)` dinormalisasi.
- `availableChildren` dipaksa menjadi array sebelum `.find(...)`.

QA:

- Route parent `/reports` dicek ulang desktop dan mobile.
- Hasil: tidak ada exception, tidak ada horizontal overflow.
- Satu network 404 yang terlihat adalah `http://127.0.0.1:4303/favicon.ico`, bukan endpoint aplikasi.

### 10. Stale passive child-progress sidebar dihapus

File: `apps/child-progress/src/components/Sidebar.jsx`

Masalah:

- Component tidak lagi terpakai dan berisi quick-action/sidebar lama yang berisiko menjadi sumber affordance pasif.

Perbaikan:

- File dihapus setelah dicek tidak menjadi import aktif.

### 11. Re-audit tambahan setelah sinkronisasi production

File:

- `apps/bulk-schedule/src/components/Stepper.jsx`
- `apps/shared/sessionIdentity.js`
- `apps/parent-app/src/context/AuthContext.jsx`
- `apps/parent-app/src/pages/AttendanceLog.jsx`
- `apps/parent-app/src/pages/ChildProfile.jsx`
- `apps/parent-app/src/pages/ProgressSummary.jsx`
- `apps/parent-web-dashboard/src/App.jsx`
- `apps/parent-web-dashboard/src/components/Header.jsx`
- `apps/parent-reports-archive/src/App.jsx`
- `apps/parent-reports-archive/src/components/Header.jsx`
- `apps/parent-reschedule/src/components/Header.jsx`

Masalah:

- Stepper bulk schedule masih memakai `href="#"` untuk indikator progress sehingga terlihat seperti action navigasi padahal tidak aktif.
- Beberapa parent micro-app sudah memperbaiki response child list, tetapi belum memakai satu helper shared sehingga shape `{ children: [] }`, array langsung, single object, atau session lama masih bisa berbeda antar dashboard.
- Selector anak di header parent micro-app masih mengasumsikan `nita` selalu ada sebagai value, padahal kontrak backend memakai `id` sebagai identifier utama.

Perbaikan:

- Indikator step bulk schedule diganti dari link kosong menjadi elemen status non-navigasi dengan `aria-current="step"` untuk step aktif.
- Ditambahkan `normalizeChildrenList()` di `apps/shared/sessionIdentity.js`.
- Parent auth/session, parent dashboard, profile, attendance, progress, report archive, reschedule, dan header parent micro-app sekarang memakai helper yang sama.
- Child selector parent sekarang memakai fallback `nita || id`, mencari berdasarkan `nita` atau `id`, dan menyimpan `id || nita` supaya endpoint backend tetap menerima identifier yang valid.

## QA dan hasil command

### Static scan

Command:

```powershell
rg -n 'href="#"|javascript:|onClick=\{\(\) => \{\}\}|onClick=\{\(\) => null\}|Coming Soon|coming soon|TODO|FIXME|window\.alert|alert\(' apps --glob '*.jsx' --glob '*.js'
```

Hasil: tidak ada output.

### Build targeted

Semua command berikut berhasil:

```powershell
npm.cmd --workspace apps/server run build
npm.cmd --workspace apps/admin-app run build
npm.cmd --workspace apps/therapist-app run build
npm.cmd --workspace apps/therapist-report run build
npm.cmd --workspace apps/clinic-branding-settings run build
npm.cmd --workspace apps/bulk-schedule run build
npm.cmd --workspace apps/parent-app run build
npm.cmd --workspace apps/parent-portal run build
npm.cmd --workspace apps/parent-reports-archive run build
npm.cmd --workspace apps/parent-web-dashboard run build
npm.cmd --workspace apps/parent-reschedule run build
npm.cmd --workspace apps/admin-reports run build
npm.cmd --workspace apps/therapist-web-report run build
```

Catatan:

- `npm.cmd --workspaces --if-present run build` juga dijalankan untuk full workspace. Output build Vite dan `tsc` tampil berhasil, tetapi npm workspace runner pernah berakhir dengan native exit `3221225501` pada workspace server. Server kemudian dibuild ulang secara individual dan berhasil dengan `tsc`.
- Ini dicatat sebagai flake/native workspace-runner di Windows, bukan error TypeScript yang tersisa.
- Re-audit tambahan setelah sinkronisasi production menjalankan build targeted pada workspace yang tersentuh dan report surface utama; semua command targeted di atas berhasil.

### Lint

Command lint yang dicoba:

```powershell
npm.cmd --workspace apps/admin-requests run lint
npm.cmd --workspace apps/bulk-schedule run lint
npm.cmd --workspace apps/clinic-branding-settings run lint
npm.cmd --workspace apps/therapist-report run lint
npm.cmd --workspace apps/clinic-admin run lint
npm.cmd --workspace apps/child-progress run lint
```

Hasil:

- Semua lint berhenti sebelum analisis source karena ESLint v9 tidak menemukan `eslint.config.(js|mjs|cjs)`.
- Tidak ada hasil lint yang valid sampai repo menambahkan flat config ESLint.

### Test script

Command:

```powershell
rg -n '"test"\s*:' -g package.json apps package.json
```

Hasil: tidak ada script test otomatis terdaftar di package.json workspace.

### Browser smoke

Tool:

- Dev server lokal untuk admin, therapist, parent, dan standalone therapist-report.
- Mock API lokal untuk response session/data.
- Chrome DevTools Protocol untuk membuka route, menangkap exception, dan mengecek horizontal overflow.

Viewport:

- Desktop: 1366x900.
- Mobile: 390x844.

Hasil:

- Admin: 34 checks, route shell terbuka, tidak ada horizontal overflow.
- Therapist: 24 checks, route shell terbuka, tidak ada horizontal overflow.
- Parent: 18 checks, dua runtime error ditemukan lalu diperbaiki dan dicek ulang.
- Therapist-report standalone: 2 checks, form terbuka setelah BrowserRouter dan report contract patch.
- Re-audit tambahan membuka `parent-portal` lokal pada `/`, `/reports`, `/progress`, dan `/reschedule`; semua route render, `overflowX=false`, dan tidak ada console error dari app.

## Flow status akhir

### Admin

- Dashboard utama: OK, route aktif, protected, no horizontal overflow.
- Scheduling: OK.
- Bulk schedule: OK setelah false-success fix.
- Requests: OK setelah assert API dan action sequencing fix.
- Parent meetings: OK di route shell.
- Attendance: OK di route shell.
- Therapist registration: OK di route shell.
- Reports: OK di route shell.
- Monitoring: OK di route shell.
- Child management/register/program-registration: OK di route shell.
- Center migration: OK di route shell.
- Therapist management: OK di route shell.
- Rooms/programs: OK di route shell.
- Notifications: OK; mark-read action divalidasi.
- Branding/settings: OK; notification preference sekarang mempengaruhi backend delivery.
- Users: OK di route shell.
- Therapist leave requests: OK di route shell.
- Announcements: redirect ke notifications; legacy file sudah diperbaiki.

### Therapist

- Dashboard utama: OK, route aktif, protected, no horizontal overflow.
- Schedule: OK di route shell.
- Availability: OK di route shell.
- Reports dan reports/new: OK di route shell.
- Performance: OK di route shell.
- Parent meetings: OK di route shell.
- Child progress: OK di route shell.
- Announcements: OK; mark-read action divalidasi.
- Schedule updates: OK di route shell.
- Leave requests: OK di route shell.
- Settings: OK di route shell.
- Standalone therapist-report: OK setelah BrowserRouter, backend report save, sessionId guard, toolbar, dan upload diperbaiki.

### Parent

- Dashboard utama: OK, route aktif, protected, no horizontal overflow.
- Reports: OK setelah child-list normalization.
- Reschedule: OK di route shell.
- Profile: OK di route shell.
- Attendance: OK di route shell.
- Progress: OK setelah child-list normalization.
- Announcements: OK di route shell.
- Meetings: OK di route shell.
- Settings: OK di route shell.

## Risiko tersisa dan rekomendasi berikutnya

1. Tambahkan ESLint flat config
   - Repo memakai ESLint v9, sehingga lint tidak berjalan tanpa `eslint.config.js`.
   - Rekomendasi: tambahkan config monorepo lalu jadikan lint gate sebelum production deploy.

2. Tambahkan automated test script
   - Package.json workspace belum mendefinisikan script `test`.
   - Rekomendasi: mulai dari Playwright smoke untuk route role shell dan Vitest untuk shared API normalization.

3. Tambahkan favicon lokal untuk parent shell
   - Smoke menemukan `favicon.ico` lokal 404 pada dev server parent.
   - Ini bukan bug flow, tetapi dapat dirapikan.

4. Jaga untracked media lokal tetap di luar commit audit ini
   - Ada dua file media untracked lokal di `apps/`.
   - Keduanya tidak relevan dengan audit dashboard dan tidak distage.

