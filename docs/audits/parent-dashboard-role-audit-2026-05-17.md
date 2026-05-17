# Parent Dashboard Role Audit - 2026-05-17

## Scope

Audit dilakukan pada parent-facing microapps:

- `apps/parent-app`
- `apps/parent-web-dashboard`
- `apps/parent-reports-archive`
- `apps/parent-reschedule`
- `apps/parents-meeting`
- `apps/parent-portal`
- backend route terkait parent, child, session, report, reschedule, notification

Fokus audit: storage lokal, sinkronisasi data real antar-role, penjadwalan/reschedule, pelaporan, profil parent/anak, notifikasi, redirect, dan komponen kosmetik yang tidak terhubung ke backend.

## Findings And Fixes

1. Parent session masih tersebar di `localStorage/sessionStorage`.
   - Dibuat `apps/shared/api/parentSession.js`.
   - `AuthContext` parent sekarang membaca session lewat `authApi.getSession()` dan `parentsApi.getMe()`.
   - Child selection memakai event shared `parentChildSelectionChanged`, bukan rewrite storage dan reload halaman.

2. Header parent memakai notification read state lokal dan announcement sebagai dropdown notifikasi.
   - Dibuat `apps/shared/ui/ParentPortalHeader.jsx`.
   - Header dashboard, reports, dan reschedule sekarang memakai `notificationsApi.getAll()`, `markRead()`, dan `markAllRead()`.
   - Tidak ada lagi `read_notifs` lokal.

3. Parent dashboard memakai endpoint admin settings.
   - Parent dashboard dan sidebar support sekarang memakai `adminApi.getPublicSettings()`.
   - Tombol WhatsApp admin menjadi disabled jika nomor belum dikonfigurasi, bukan membuka nomor fallback palsu.

4. Settings parent memberi false-success.
   - Simpan profil sekarang memakai `parentsApi.update()` dan backend mengizinkan parent memperbarui profilnya sendiri.
   - Toggle email/SMS dinonaktifkan dan diberi status dalam pengembangan; notifikasi aktif tetap via notification center.

5. Reschedule parent belum cukup menjaga alur.
   - Form sekarang memakai parent profile real dan active child real.
   - Submit memeriksa `res.ok`, menampilkan riwayat request, mencegah duplicate active request, dan reload status dari backend.
   - Backend memvalidasi parent owns child, session belongs to child, dan active request conflict.

6. Reports archive masih bergantung ke session storage.
   - Reports archive sekarang memakai `parentsApi.getMe()`, `childrenApi.getByParent()`, report visibility real, session rating real, dan active child event.
   - Parent-visible report status tetap dibatasi ke `approved`, `published`, dan `ready_for_parent`.

7. Parent portal lama masih statis.
   - `apps/parent-portal` sekarang menjadi shell yang merender modul parent real: dashboard, reports, dan reschedule.
   - Komponen statis lama dengan data contoh dihapus.

8. Backend read access parent terlalu longgar di beberapa endpoint.
   - `children/by-parent`, `children/:id`, `parents/:id`, `reschedule/parent/:id`, `sessions/child/:id/*`, `sessions/:id`, dan session rating sekarang memeriksa ownership parent atau role yang valid.

## Verification

- Scan parent microapps:
  - Tidak ditemukan `localStorage`, `sessionStorage`, `parent_user`, `read_notifs`, `href="#"`, `window.location.reload`, `alert(`.
  - Tidak ditemukan penggunaan `adminApi.getSettings()` di parent-facing apps.
  - Tidak ditemukan data contoh lama seperti nama dummy pada parent-facing apps.
- Targeted builds:
  - `npm.cmd --workspace apps/parent-app run build`
  - `npm.cmd --workspace apps/parent-web-dashboard run build`
  - `npm.cmd --workspace apps/parent-reschedule run build`
  - `npm.cmd --workspace apps/parent-reports-archive run build`
  - `npm.cmd --workspace apps/parent-portal run build`
  - `npm.cmd --workspace apps/parents-meeting run build`
  - `npm.cmd --workspace apps/server run build`
- Full build:
  - `npm.cmd --workspaces --if-present run build`
- Diff check:
  - `git diff --check`
- Preview smoke:
  - `parent-app` returned HTTP 200 for `/login`, `/`, `/reports`, `/reschedule`, `/settings`.
  - `parent-portal` returned HTTP 200 for `/`, `/reports`, `/reschedule`.

## Cross-Role Review Notes

- Admin, therapist, and parent builds all pass in the same full-workspace build.
- Parent reschedule now writes to the same backend contract that admin and therapist review.
- Parent report visibility remains aligned with therapist report submission and admin approval states.
- Parent child/profile/session reads are now ownership-checked in backend, reducing accidental cross-parent data exposure.

## Recommended Next Improvements

1. Add automated contract tests for parent ownership guards:
   - parent cannot read another parent's child, session, rating, or reschedule request.
   - admin can still manage all records.
   - therapist can only access own assigned sessions where needed.

2. Add backend-backed notification preferences table before enabling email/SMS toggles.

3. Add e2e tests for cross-role reschedule:
   - parent request -> therapist response -> admin review -> parent notification -> schedule changed.

4. Add e2e tests for report visibility:
   - therapist draft not visible to parent.
   - admin-approved or ready-for-parent report visible to parent.
   - parent rating saved only for own child session.

5. Normalize old standalone parent microapps into one canonical parent shell to avoid future duplicate UI drift.

## Production Note

Code is build-verified and ready to push. Actual production rollout still depends on the configured deployment branch/platform picking up this pushed branch or merging it into the deployment branch.
