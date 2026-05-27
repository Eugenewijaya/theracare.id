# Admin Dashboard and Micro App Audit - 2026-05-27

## Scope

Audit dilakukan pada shell admin dan micro app yang aktif dari navigasi admin:

- Dasbor utama (`/`)
- Penjadwalan tunggal (`/scheduling`)
- Permintaan masuk (`/requests`)
- Parent meeting (`/parent-meetings`)
- Cuti terapis (`/therapist-leave-requests`)
- Data anak (`/children`)
- Pendaftaran program (`/children/program-registration`)
- Migrasi center (`/migration`)
- Data terapis (`/therapists`)
- Manajemen ruangan (`/rooms`)
- Program layanan (`/programs`)
- Kehadiran anak (`/attendance`)
- Pantau perkembangan (`/monitoring`)
- Laporan klinik (`/reports`)
- Pengumuman dan notifikasi (`/notifications`)
- Manajemen pengguna (`/users`)
- Pengaturan dan tampilan (`/settings/branding`)

Audit difokuskan pada scroll horizontal halaman, tombol/link/toggle yang terlihat aktif, dialog konfirmasi, status sukses palsu, dan penggunaan storage lokal.

## Perbaikan Langsung

1. **Dasbor utama - approval kehadiran**
   - Komponen `PendingAttendance` sekarang mengecek `res.ok` dari backend sebelum menampilkan sukses.
   - Jika load atau update status gagal, dashboard menampilkan toast error dan tidak lagi menyebut aksi berhasil.

2. **Kehadiran anak - approval/reject**
   - Aksi approve dan reject sekarang punya try/catch, notice sukses/error, dan reload data hanya setelah API berhasil.
   - Load awal juga menampilkan error jika backend gagal.

3. **Data anak - search header**
   - Search di header Data Anak sekarang terhubung ke state filter yang sama dengan search utama.
   - Input tidak lagi menjadi kontrol kosmetik.

4. **Data anak - pagination palsu**
   - Link `href="#"` pada pagination diganti menjadi kontrol non-navigasi yang disabled dan memiliki label aksesibilitas.
   - Ini menghilangkan link palsu yang sebelumnya dapat menggeser fokus/navigasi tanpa fungsi.

5. **Pendaftaran program/periode**
   - Konfirmasi hapus periode tidak lagi memakai `window.confirm`.
   - Sekarang memakai shared `confirmAction` agar konsisten dengan dialog aplikasi dan aman untuk flow admin.

6. **Pantau perkembangan**
   - Search header sekarang aktif untuk anak, terapis, program, dan status.
   - Tombol Filter sekarang membuka panel filter nyata: status anak, status sesi, periode sesi, dan reset.
   - Export report memakai data yang sudah difilter.

7. **Pengaturan dan tampilan**
   - Tombol/link pada live preview branding diubah menjadi elemen preview non-interaktif, sehingga tidak ada aksi palsu di area pratinjau.

## Hasil Audit Teknis

- Tidak ditemukan lagi `href="#"`, `window.confirm`, atau `window.alert` di surface admin aktif setelah perbaikan.
- Penggunaan `localStorage/sessionStorage` di surface admin aktif hanya tersisa pada `accessGate`, yaitu mekanisme unlock sementara, bukan sumber data operasional.
- Sidebar badge admin tetap berbasis API: reschedule, parent meeting, cuti terapis, dan unread notification.
- Shell admin sudah memiliki `overflow-x-hidden` di layout utama; browser smoke memastikan route yang diuji tidak menghasilkan scroll horizontal halaman.

## Verifikasi

Command yang lolos:

- `git diff --check`
- `npm.cmd --workspace apps/admin-app run build`
- `npm.cmd --workspace apps/clinic-admin run build`
- `npm.cmd --workspace apps/admin-attendance run build`
- `npm.cmd --workspace apps/child-management run build`
- `npm.cmd --workspace apps/monitoring-progress run build`
- `npm.cmd --workspace apps/clinic-branding-settings run build`

Browser smoke dengan API mock lokal:

- Desktop 1366px: `/`, `/attendance`, `/children`, `/children/program-registration?childId=CHILD-001`, `/monitoring`, `/settings/branding`
- Mobile 390px: route yang sama
- Semua route di atas: `hasHorizontalOverflow=false`, Vite overlay `0`.
- Tombol Filter di `/monitoring` diverifikasi membuka panel filter dengan 3 select dan tetap tanpa horizontal overflow.

## Catatan Risiko

- Audit ini menutup masalah konkret yang terdeteksi di admin dashboard dan micro app aktif, tetapi bukan pengganti QA manual penuh untuk semua kombinasi data production.
- Beberapa tabel besar tetap memakai scroll internal pada area tabel bila kontennya memang lebar; yang diverifikasi adalah tidak ada scroll horizontal pada halaman/body.
