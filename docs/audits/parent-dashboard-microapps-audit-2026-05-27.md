# Parent Dashboard And Microapps Audit - 2026-05-27

## Scope

Audit dilakukan untuk permukaan orang tua aktif dan microapp yang terkait:

- `apps/parent-app`
- `apps/parent-portal`
- `apps/parent-web-dashboard`
- `apps/parent-reports-archive`
- `apps/parent-reschedule`
- `apps/parents-meeting`
- shared parent session, API, guide, notification, and preference helpers

Fokus audit: navigasi sidebar dan shell, route standalone microapp, tombol dan toggle, alur laporan, alur reschedule, log kehadiran, profil anak, kemajuan anak, pengumuman, parent meeting, settings, fallback local storage, false-success state, dan scroll samping desktop/mobile.

## Findings And Fixes

1. `parent-portal` belum setara dengan route parent-app.
   - Ditambahkan route standalone untuk `/attendance`, `/progress`, dan `/meetings`.
   - Wildcard lama tidak lagi diam-diam melempar route parent yang valid ke `/`.

2. Pengumuman masih memakai konfirmasi native untuk approval penghapusan periode.
   - `window.confirm` diganti ke `confirmAction`.
   - Dialog sekarang menampilkan konteks keputusan, tombol kembali, tone per aksi, dan tetap menunggu `therapyPeriodsApi.respondDeletionRequest`.

3. Settings menampilkan toggle email/WA seperti pengaturan backend, padahal belum ada endpoint preferensi parent.
   - Ditambahkan helper shared `apps/shared/parentPreferences.js`.
   - `Settings` tidak lagi membaca `localStorage` langsung.
   - Copy UI diperjelas: toggle adalah preferensi perangkat ini, sedangkan pengiriman email/WA tetap dikelola admin center.

4. Header microapp parent dashboard, report archive, dan reschedule mengabaikan status API.
   - Load daftar anak, notifikasi, mark read, dan mark all read sekarang mengecek `res.ok`.
   - Kontrol header dibuat wrap, bukan `overflow-x-auto`, untuk menghindari scroll samping pada viewport kecil.

5. Dashboard utama bisa terlihat kosong saat session API gagal atau saat akun hanya punya `parentId`.
   - `parent-web-dashboard` sekarang menurunkan `targetChildId` dari profil anak aktif.
   - Upcoming session, completed session, dan profile child gagal dengan pesan error visible dan tombol retry, bukan silent empty state.

6. Arsip laporan masih punya beberapa silent failure.
   - Load child, program filter, report list, completed sessions, dan program mapping sekarang memeriksa `res.ok`.
   - Error load tampil di halaman dengan tombol retry.

7. Profil anak dan log kehadiran bisa loading tanpa akhir ketika API gagal atau child belum terhubung.
   - Ditambahkan loading, empty/error state, dan tombol retry.
   - Filter program log kehadiran sekarang mengambil opsi dari data rekam kehadiran yang benar, bukan daftar program admin yang bisa tidak cocok dengan `session.focus`.

8. Parent meeting dan ringkasan progress perlu error state yang lebih jujur.
   - Parent meeting load dan response sekarang memeriksa `res.ok` dan menampilkan error/retry.
   - Progress summary menampilkan warning bila sebagian report/session anak gagal dimuat.

9. Reschedule parent tetap backend-backed.
   - Load sessions, pending requests, preview slot, dan submit sudah memeriksa `res.ok`.
   - Patch dilakukan pada header shared microapp agar child switcher/notifikasi tidak memberi sukses palsu.

## Verification

Static checks:

- `git diff --check` lulus.
- Scan active parent surfaces lulus untuk `window.confirm`, `window.alert`, `alert(`, `href="#"`, direct `localStorage`, dan direct `sessionStorage`.
- Scan active parent surfaces lulus untuk `dummy`, `mock`, `coming soon`, dan `window.location.reload`.

Builds:

- `npm.cmd --workspace apps/parent-app run build`
- `npm.cmd --workspace apps/parent-portal run build`
- `npm.cmd --workspace apps/parent-web-dashboard run build -- --debug`
- `npm.cmd --workspace apps/parent-reports-archive run build`
- `npm.cmd --workspace apps/parent-reschedule run build`
- `npm.cmd --workspace apps/parents-meeting run build`

Browser smoke with mock API:

- Desktop `1366x900`: `/`, `/reports`, `/reschedule`, `/profile`, `/attendance`, `/progress`, `/announcements`, `/meetings`, `/settings` all loaded with `overflow=0`.
- Mobile `390x844`: same route set loaded with `overflow=0`.
- Settings: theme toggle and save preference produced the new local-device preference notice.
- Announcements: approval button opened the shared `confirmAction` dialog.
- Meetings: parent approval button completed and showed confirmed state.
- Network 404 observed only for dev `favicon.ico`; no route data 404 or visible load-error copy in the smoke route set.
