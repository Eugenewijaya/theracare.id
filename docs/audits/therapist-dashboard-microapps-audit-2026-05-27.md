# Audit Dasbor Terapis dan Micro App - 2026-05-27

## Scope

Audit mencakup shell `apps/therapist-app` dan micro app aktif yang dirender dari navigasi terapis:

- `/` - `apps/therapist-dashboard`
- `/schedule` - `apps/therapist-schedule`
- `/schedule-updates` - `apps/therapist-app/src/pages/ScheduleUpdates.jsx`
- `/leave-requests` - `apps/therapist-app/src/pages/LeaveRequests.jsx`
- `/availability` - `apps/therapist-availability-calendar`
- `/reports` dan `/reports/new` - `apps/therapist-web-report`
- `/performance` - `apps/therapist-performance`
- `/meetings` - `apps/parents-meeting` mode terapis
- `/child-progress` - `apps/child-progress`
- `/announcements` - `apps/therapist-app/src/pages/Announcements.jsx`
- `/settings` - `apps/therapist-app/src/pages/Settings.jsx`

## Temuan Utama

1. Dashboard utama masih memiliki risiko aksi sukses palsu pada mulai/akhiri sesi dan simpan catatan.
   - `TimelineList` dan `WelcomeFocus` sebelumnya tidak memeriksa `res.ok` setelah memanggil `sessionsApi.updateStatus` atau `sessionsApi.saveNotes`.
   - Ada bug runtime di `TimelineList`: tombol `Mulai Sesi` memanggil `setTimeLeft`, tetapi state itu tidak ada.

2. Beberapa loader micro app diam-diam mengosongkan data saat API gagal.
   - Area terdampak: dashboard schedule summary, timeline, report composer, availability calendar, performance, parent meeting, schedule updates, leave requests, child progress, dan announcements.
   - Perilaku ini berisiko membuat operator mengira data memang kosong.

3. Halaman `Notifikasi & Pengumuman` masih memakai `window.confirm` untuk keputusan hapus periode berjalan.
   - Ini tidak konsisten dengan dialog konfirmasi lain di therapist app dan kurang jelas untuk aksi berisiko.

4. Sidebar standalone di micro app terapis masih memakai `href="#"`.
   - Area terdampak: `therapist-schedule`, `therapist-web-report`, dan `therapist-availability-calendar`.
   - Saat micro app dibuka standalone, link terlihat aktif tetapi tidak mengarah ke flow sebenarnya.

5. `therapist-performance` masih membaca `localStorage` langsung untuk menentukan remembered identity.
   - Ini sudah diganti ke helper shared `isPortalUserRemembered('therapist')` agar konsisten dengan session identity terbaru.

## Perbaikan Langsung

1. Aksi sesi dan catatan sekarang memvalidasi respons API.
   - `TimelineList` memeriksa `res.ok` untuk load timeline, mulai sesi, akhiri sesi, auto-finish, dan simpan catatan.
   - Bug `setTimeLeft` yang tidak ada sudah dihapus.
   - `WelcomeFocus` memeriksa transisi active/done sebelum menutup modal akhiri sesi.

2. Loader kritis sekarang menampilkan error eksplisit.
   - Dashboard schedule summary, recent activity, report data, availability calendar, performance stats, parent meeting, leave requests, child progress, schedule updates, dan announcements sekarang menolak respons gagal dengan pesan UI.

3. Konfirmasi hapus periode di therapist announcements sudah memakai `confirmAction`.
   - Dialog menampilkan tone, icon, detail alasan admin, tombol batal, dan label aksi yang eksplisit.

4. Link dummy sidebar standalone sudah diganti ke route nyata.
   - Dashboard `/`
   - Jadwal `/schedule`
   - Laporan `/reports`
   - Ketersediaan `/availability`
   - Kemajuan Anak `/child-progress`
   - Pengaturan `/settings`
   - Login `/login`

5. Session identity di performance tidak lagi membaca `localStorage` langsung.
   - Penyimpanan profile edit tetap lewat `storeTherapistUser`, dengan remembered mode dari helper shared.

## Status Audit Kontrol

- Tidak ditemukan lagi `href="#"` pada surface terapis yang diaudit.
- Tidak ditemukan lagi `window.confirm`, `window.alert`, atau `alert(` pada surface terapis yang diaudit.
- Tidak ditemukan lagi penggunaan langsung `localStorage` atau `sessionStorage` pada surface terapis yang diaudit.
- Aksi utama yang mengubah state sekarang memiliki guard `res.ok` dan pesan error yang terlihat.
- Tabel jadwal mingguan/bulanan tetap memakai overflow internal untuk tabel lebar, bukan page-level horizontal scroll.

## Verifikasi

Checklist yang dijalankan:

- Static scan untuk `href="#"`, `window.confirm`, `window.alert`, `alert(`, `localStorage`, `sessionStorage`, dan `setTimeLeft` pada surface terapis aktif.
- `git diff --check`.
- Build workspace terkait:
  - `npm.cmd --workspace apps/therapist-app run build`
  - `npm.cmd --workspace apps/therapist-dashboard run build`
  - `npm.cmd --workspace apps/therapist-schedule run build`
  - `npm.cmd --workspace apps/therapist-availability-calendar run build`
  - `npm.cmd --workspace apps/therapist-web-report run build`
  - `npm.cmd --workspace apps/therapist-performance run build`
  - `npm.cmd --workspace apps/parents-meeting run build`
  - `npm.cmd --workspace apps/child-progress run build`
- Browser smoke test dengan mock API lokal untuk 12 route desktop dan 12 route mobile:
  - Tidak ada redirect ke `/login`.
  - Tidak ada Vite overlay.
  - Tidak ada page-level horizontal overflow di desktop 1366px atau mobile 390px.
  - Toggle `Tampilkan jadwal` dashboard membuka tabel mingguan tanpa overflow.
  - Toggle `Bulan` availability calendar membuka mode bulanan tanpa overflow.
  - Aksi `Setujui penghapusan` membuka dialog `confirmAction`, bukan native `window.confirm`.

Catatan: Browser plugin Codex tidak menemukan pane aktif, sehingga smoke test dijalankan via Chrome DevTools Protocol lokal. Mobile smoke memakai geolocation permission override agar gate lokasi terapis tidak menutup konten route.

Status push production dicatat terpisah setelah commit dan push selesai.
