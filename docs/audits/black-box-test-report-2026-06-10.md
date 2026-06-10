# Laporan Audit dan Black-Box TheraCare

Tanggal: 10 Juni 2026

## Ringkasan

- API end-to-end: **59 lulus, 0 gagal, 0 dilewati**.
- UI smoke: **41 route utama** pada portal Admin, Terapis, dan Orang Tua berhasil dimuat sesuai hak akses.
- Build produksi: server dan tiga portal berhasil dibangun.
- Responsive smoke: tiga portal lulus pada viewport `390x844` tanpa overflow horizontal.
- Database pengujian: database PostgreSQL terpisah `bbt_20260610_0da56d`, bukan database produksi.

## Cakupan Alur

Pengujian dimulai dari reset database, seed konfigurasi dasar, login Admin, registrasi Terapis, registrasi Orang Tua dan Anak, pembuatan periode dan sesi, operasional sesi, laporan, reschedule, substitusi, pertemuan, cuti Terapis, cuti Anak, tanggal merah, penutupan/perpanjangan periode, migrasi, notifikasi, audit, sampai pergantian Terapis kritis.

Portal yang diuji:

- Admin: 21 route utama.
- Terapis: 11 route utama.
- Orang Tua: 9 route utama.

Pengujian interaktif UI mencakup login dan reload sesi, pilihan anak, form reschedule, opsi jam `:00/:30`, tracking keputusan, form cuti Anak, konfigurasi jadwal off, serta tampilan mobile.

## Bug yang Ditemukan dan Diperbaiki

1. Seed dan reset gagal membuat Admin karena pendaftaran publik dinonaktifkan.
   Perbaikan: gunakan API admin `createUser` dan refresh akun secara idempoten.
2. Reset database meninggalkan beberapa data operasional.
   Perbaikan: bersihkan period deletion, one-time visit, preferensi notifikasi, lokasi, kebijakan perangkat, dan metadata sesi.
3. Periode aktif yang belum memenuhi jumlah sesi dapat ditutup.
   Perbaikan: validasi jumlah sesi selesai/hangus dan tolak dengan HTTP `409`.
4. Penghapusan jadwal off yang sudah menghasilkan sesi pengganti memberi error `500`.
   Perbaikan: kembalikan konflik bisnis HTTP `409`.
5. Apply migrasi gagal setelah dry-run berhasil karena payload program Anak tidak lengkap.
   Perbaikan: bentuk `therapyProgramsList` yang valid dan cegah pembuatan periode ganda.
6. Reload portal Terapis/Orang Tua gagal ketika cookie Admin masih aktif.
   Perbaikan: token portal eksplisit diprioritaskan atas cookie lintas portal.
7. Respons sesi token tidak memiliki `session.userId`, sehingga Admin dianggap logout.
   Perbaikan: samakan kontrak respons fallback dengan sesi Better Auth.

## Bukti Fitur Kritis

- Reschedule menerima jam hanya dalam interval 30 menit dan preview selesai tanpa loop recheck.
- Hak akses Parent dibatasi pada keluarga sendiri.
- Konflik Anak, Terapis, ruangan, dan jam kerja ditolak.
- Cuti Anak dapat dikonfirmasi, dipersingkat, dibatalkan, dan memulihkan jadwal.
- Tanggal merah Indonesia berhasil diambil, diterapkan satu kali, dan dibersihkan.
- Jadwal off mendukung kontak Orang Tua, pindah manual, serta penggantian otomatis H-1 setelah periode.
- Periode belum selesai tidak dapat ditutup; periode selesai dapat ditutup idempoten dan diperpanjang sekali.
- Histori laporan dan sesi tetap mempertahankan atribusi Terapis lama saat pergantian kritis.

## Batas Verifikasi

- Pembuatan backup branch Neon tidak dijalankan karena `NEON_API_KEY` lingkungan saat ini ditolak oleh Neon. Kegagalan aman halaman Database Guard tetap lulus.
- Izin lokasi browser sengaja tidak diberikan. Endpoint penyimpanan sinyal lokasi diuji melalui API dan lulus.
