# Parent Dashboard Main Audit - 2026-05-17

## Scope

Audit dilakukan di branch `main` setelah branch ini disinkronkan dengan `eugene/main`.

Area parent-facing yang dicek:

- `apps/parent-app`
- `apps/parent-web-dashboard`
- `apps/parent-reports-archive`
- `apps/parent-reschedule`
- `apps/parents-meeting`
- `apps/parent-portal`
- shared session/API helpers
- backend route terkait child, session, report, reschedule, dan parent ownership

Fokus audit: local/session storage langsung di microapp, data dummy, link pasif, alur redirect, parent portal statis, penjadwalan/reschedule, laporan, dan sinkronisasi role parent-admin-therapist.

## Findings And Fixes

1. Header parent masih membaca `localStorage` langsung untuk mempertahankan pilihan anak.
   - Ditambah helper shared `isParentUserRemembered()` di `apps/shared/sessionIdentity.js`.
   - Header parent dashboard, report archive, dan reschedule sekarang memakai helper shared, bukan akses storage langsung di microapp.

2. Standalone parent dashboard dan report archive memakai `useNavigate()` tanpa router wrapper.
   - `apps/parent-web-dashboard/src/main.jsx` dan `apps/parent-reports-archive/src/main.jsx` sekarang dibungkus `BrowserRouter`.
   - `react-router-dom` ditambahkan ke package manifest app yang memang memakai router.

3. `apps/parent-portal` masih memakai komponen statis lama.
   - Parent portal sekarang menjadi shell router yang merender modul real:
     - dashboard: `apps/parent-web-dashboard`
     - reports: `apps/parent-reports-archive`
     - reschedule: `apps/parent-reschedule`
   - Komponen statis lama di `apps/parent-portal/src/components` dihapus.

4. Masih ada file Sidebar stale berisi data dummy, link `#`, dan fallback WhatsApp palsu.
   - Sidebar tidak terpakai di dashboard/report archive dihapus agar tidak menjadi sumber regresi.

5. Tombol WhatsApp admin bisa membuka URL invalid jika nomor belum dikonfigurasi.
   - Dashboard parent sekarang menampilkan aksi WhatsApp hanya jika nomor admin valid.
   - Jika belum ada nomor, UI menampilkan status disabled yang eksplisit, bukan link palsu.

6. Tombol `Online (Coming Soon)` adalah affordance pasif.
   - Diganti menjadi indikator status `Sesi onsite`, bukan tombol aksi.

7. Backend ownership guard sudah tersedia di `main`.
   - Parent child/session/report/reschedule reads sudah memeriksa parent ownership atau role valid.
   - Tidak perlu mengambil ulang versi backend dari branch audit lama karena `main` sudah lebih baru dan lebih lengkap.

## Verification

Scan parent-facing apps:

- Tidak ditemukan akses langsung `localStorage`, `sessionStorage`, `parent_user`, atau `read_notifs` di microapp parent.
- Tidak ditemukan `href="#"`, `window.location.reload`, atau `alert(`.
- Tidak ditemukan data dummy lama seperti `Dr. Emily`, `Sarah Jenkins`, `Leo`, `mock`, atau `dummy`.
- Tidak ditemukan `adminApi.getSettings()` di app parent-facing.

Build yang lulus:

- `npm.cmd --workspace apps/parent-app run build`
- `npm.cmd --workspace apps/parent-web-dashboard run build`
- `npm.cmd --workspace apps/parent-reschedule run build`
- `npm.cmd --workspace apps/parent-reports-archive run build`
- `npm.cmd --workspace apps/parent-portal run build`
- `npm.cmd --workspace apps/parents-meeting run build`
- `npm.cmd --workspace apps/server run build`
- `npm.cmd --workspaces --if-present run build`

Browser smoke:

- `parent-portal` preview `http://127.0.0.1:4181/` terbuka dengan konten dashboard.
- `http://127.0.0.1:4181/reports` terbuka dengan halaman arsip laporan.
- `http://127.0.0.1:4181/reschedule` terbuka dengan halaman reschedule.
- Tidak ada console error pada route yang dicek.

## Follow-Up Improvements

1. Tambahkan automated tests untuk parent ownership:
   - parent tidak bisa membaca child/session/report/reschedule milik parent lain.
   - admin tetap bisa mengelola semua data.
   - therapist hanya bisa mengakses sesi yang ditugaskan.

2. Tambahkan e2e cross-role reschedule:
   - parent submit request.
   - therapist memberi response.
   - admin approve/reject.
   - parent menerima update dan schedule berubah.

3. Tambahkan e2e report visibility:
   - draft therapist tidak tampil ke parent.
   - `approved`, `published`, dan `ready_for_parent` tampil ke parent.
   - rating parent hanya bisa dibuat untuk sesi anak sendiri.

4. Audit dependency security secara terpisah.
   - `npm install --package-lock-only` melaporkan 9 vulnerability dari dependency tree yang ada.
   - Belum dijalankan `npm audit fix` karena bisa mengubah banyak dependency di luar scope push ini.
