# Inventaris Fitur dan Matriks Black-Box TheraCare

Tanggal audit: 10 Juni 2026
Lingkup: portal Admin, Terapis, Orang Tua, API server, dan alur lintas aktor
Metode: pengujian API end-to-end pada database terisolasi, dilanjutkan smoke test UI pada tiga portal

## 1. Urutan Proses Bisnis End-to-End

1. **Persiapan klinik**
   - Admin masuk, mengatur identitas klinik, jam operasional, program, ruangan, hari libur, dan pengguna.
2. **Registrasi tenaga terapi**
   - Admin mendaftarkan terapis, kompetensi, jadwal kerja, dan kredensial portal.
   - Terapis masuk dengan NIT, memeriksa profil, jadwal, serta pengaturan.
3. **Registrasi keluarga dan anak**
   - Admin membuat akun orang tua baru atau memilih akun yang sudah ada.
   - Admin mendaftarkan anak, profil klinis, kontak, dan foto.
   - Orang tua masuk dengan email/nomor telepon dan melihat anak yang menjadi hak aksesnya.
4. **Pendaftaran program terapi**
   - Admin membuat periode terapi, memilih program, terapis, jumlah sesi, rentang tanggal, hari, jam, dan ruangan.
   - Sistem memvalidasi konflik anak, terapis, ruangan, jam operasional, hari libur, serta cuti.
   - Admin menghasilkan seluruh sesi periode.
5. **Operasional sesi**
   - Jadwal tampil pada Admin, Terapis, dan Orang Tua sesuai hak akses.
   - Admin mengonfirmasi kehadiran; Terapis memulai/menyelesaikan sesi dan menyimpan catatan.
6. **Laporan dan progres**
   - Terapis menyimpan draf atau mengirim laporan harian/evaluasi/akhir.
   - Admin meninjau, meminta revisi, atau menyetujui.
   - Orang tua membaca laporan yang telah tersedia dan memberi rating sesi.
7. **Perubahan jadwal**
   - Orang tua mengecek slot preferensi per 30 menit dan mengirim permintaan reschedule.
   - Terapis menyetujui/menolak; Admin memutuskan dan menerapkan perubahan.
   - Admin juga dapat membatalkan sesi, membuat sesi pengganti, kunjungan satu kali, atau terapis pengganti.
8. **Pertemuan dan komunikasi**
   - Terapis/Admin mengajukan pertemuan; Admin meninjau; Orang tua mengonfirmasi.
   - Pengumuman dan notifikasi disalurkan ke peran sasaran.
9. **Cuti dan hari libur**
   - Terapis mengajukan cuti dan Admin memutuskan.
   - Admin mencatat cuti anak berdasarkan konfirmasi orang tua, memindahkan sesi, merevisi, membatalkan, atau mencoba ulang kegagalan.
   - Admin menetapkan hari libur/tanggal merah, menghubungi orang tua, menjadwalkan manual, atau menjalankan penggantian otomatis H-1.
10. **Penutupan periode**
    - Sistem memeriksa seluruh sesi dan laporan akhir.
    - Admin menutup periode yang memenuhi syarat, lalu memperpanjang ke periode berikutnya bila diperlukan.
    - Penghapusan periode memakai alur permintaan dan persetujuan, bukan menghilangkan histori secara sepihak.

## 2. Inventaris Portal Admin

| Modul | Aksi yang tersedia | Ketergantungan/hasil lintas aktor |
| --- | --- | --- |
| Login dan sesi | Masuk, keluar, proteksi rute, refresh sesi, lokasi perangkat | Membuka seluruh fungsi Admin |
| Dasbor | Statistik, jadwal mingguan, kehadiran tertunda, peringatan operasional | Ringkasan data Terapis, Anak, sesi, laporan |
| Penjadwalan | Lihat kalender, filter anak/terapis, tambah/edit/hapus sesi, sesi satu kali, pembatalan dengan kebijakan, sesi pengganti, terapis substitusi | Jadwal berubah di portal Terapis/Orang Tua dan menghasilkan notifikasi |
| Permintaan masuk | Filter, proses, setujui/tolak/hapus reschedule dan substitusi | Keputusan tampil pada pemohon dan pihak terkait |
| Pertemuan orang tua | Buat, tinjau, jadwalkan, hapus | Terapis dan Orang Tua menerima status/perubahan |
| Kehadiran | Konfirmasi hadir atau tolak/batalkan | Status sesi dan statistik berubah |
| Registrasi terapis | Data identitas, NIT, spesialisasi, sertifikat, jadwal kerja, password, surat registrasi | Membuat akun portal Terapis |
| Data terapis | Lihat profil, edit, jadwal kerja, status aktif, reset password, WhatsApp, surat registrasi, hapus | Mempengaruhi penjadwalan dan akses Terapis |
| Data anak | Lihat, edit, hapus, hubungi orang tua, ganti terapis biasa/kritis | Mempengaruhi seluruh jadwal dan histori anak |
| Registrasi anak | Orang tua baru/lama, data anak, data klinis, program awal, jadwal awal | Membuat akun Orang Tua, Anak, periode, dan sesi |
| Program anak | Buat/edit periode, hasilkan sesi, minta penghapusan, tanggapi penghapusan, hapus periode batal, tutup, perpanjang | Mengatur siklus terapi dan histori |
| Cuti anak | Buat draf, konfirmasi dan pindahkan sesi, revisi durasi/strategi, batalkan, coba ulang | Jadwal Terapis/Orang Tua dan notifikasi diperbarui |
| Cuti terapis | Lihat, setujui, tolak, kembalikan ke pending | Ketersediaan dan konflik sesi Terapis |
| Ruangan | Tambah, edit, ubah status, hapus | Validasi bentrok ruangan |
| Program master | Tambah, edit, sasaran, tujuan, durasi, hapus | Pilihan periode dan laporan |
| Hari libur dan branding | Identitas, warna, aset, jam operasional, ambil tanggal merah Indonesia, aktif/nonaktif hari libur, hubungi orang tua, pindah manual, proses otomatis | Memblokir jadwal dan memindahkan sesi terdampak |
| Laporan | Filter, buka pratinjau, minta revisi, setujui, ekspor PDF, hapus | Laporan tersedia untuk Orang Tua |
| Monitoring | Filter progres, indikator risiko, ekspor, cetak | Agregasi sesi dan laporan |
| Pengumuman/notifikasi | Buat per target peran, tandai baca, hapus, tab inbox/pengumuman | Diterima Admin/Terapis/Orang Tua sesuai target |
| Pengguna | Tab Orang Tua/Terapis, edit, aktif/nonaktif, reset password, salin password, hapus | Mengatur akses portal |
| Migrasi | Unggah data, dry-run, lihat batch, apply, manual intake | Membuat data operasional secara terkontrol |
| Database guard | Lihat penggunaan/kuota, refresh, buat backup branch | Operasional dan pemulihan database |
| Audit dan perangkat | Audit log, sinyal lokasi, sesi perangkat, kebijakan akses | Kontrol keamanan dan jejak perubahan |

## 3. Inventaris Portal Terapis

| Modul | Aksi yang tersedia | Ketergantungan/hasil lintas aktor |
| --- | --- | --- |
| Login dan sesi | Masuk dengan NIT, keluar, proteksi rute, refresh profil, lokasi perangkat | Status akun harus aktif |
| Dasbor | Lihat sesi hari ini, timeline, profil anak, simpan catatan singkat, bantuan | Data sesi dari Admin |
| Jadwal | Filter/navigasi jadwal, buka detail, tandai aktif/selesai, simpan catatan | Status terlihat Admin dan Orang Tua |
| Ketersediaan | Kalender jam kerja, hari libur, cuti, sesi terisi | Referensi validasi penjadwalan |
| Laporan | Buat laporan harian/evaluasi/akhir, simpan draf, kirim, edit revisi, unduh | Admin meninjau; Orang Tua menerima hasil |
| Performa | Statistik sesi/laporan, profil, ubah foto | Agregasi operasional |
| Pertemuan | Ajukan pertemuan dan lihat status | Admin meninjau; Orang Tua merespons |
| Progres anak | Lihat histori sesi/laporan anak yang ditangani | Terbatas pada relasi Terapis |
| Pengumuman | Baca pengumuman sasaran Terapis | Dibuat Admin |
| Perubahan jadwal | Lihat reschedule/substitusi, setujui atau tolak dengan alasan | Admin menyelesaikan keputusan |
| Cuti | Ajukan cuti, lihat kuota/batas perubahan/status | Admin memutuskan |
| Pengaturan | Tema, bahasa, notifikasi, preferensi lokal | Preferensi perangkat |

## 4. Inventaris Portal Orang Tua

| Modul | Aksi yang tersedia | Ketergantungan/hasil lintas aktor |
| --- | --- | --- |
| Login dan sesi | Masuk dengan email/telepon, pilih anak, keluar, proteksi rute | Akun dan anak dibuat Admin |
| Dasbor | Lihat jadwal, progres, notifikasi, pindah anak aktif | Data lintas sesi/laporan |
| Profil anak | Lihat data anak dan ubah foto | Hak akses hanya anak sendiri |
| Kehadiran | Lihat histori kehadiran, filter, unduh | Status dari Admin/Terapis |
| Progres | Ringkasan capaian dan tren | Laporan yang tersedia |
| Arsip laporan | Filter/buka/unduh laporan, beri rating sesi | Laporan dari Terapis dan review Admin |
| Reschedule | Pilih sesi, cek slot preferensi 30 menit, kirim alasan/catatan, lihat status | Terapis merespons; Admin memutuskan |
| Pengumuman | Baca pengumuman sasaran Orang Tua | Dibuat Admin |
| Pertemuan | Lihat undangan, terima/tolak, beri catatan | Dibuat Terapis/Admin |
| Pengaturan | Tema, bahasa, notifikasi, preferensi lokal | Preferensi perangkat |

## 5. Matriks Black-Box

Hasil eksekusi 10 Juni 2026:

- API end-to-end: `59/59` lulus pada database terisolasi.
- UI smoke: `41/41` route utama dapat dibuka setelah login sesuai peran tanpa error konsol.
- Responsive smoke: Admin, Terapis, dan Orang Tua lulus pada viewport `390x844` tanpa overflow horizontal.
- Rincian bukti dan bug yang diperbaiki tersedia di `docs/audits/black-box-test-report-2026-06-10.md`.

### A. Platform, autentikasi, dan otorisasi

| ID | Skenario | Ekspektasi |
| --- | --- | --- |
| AUTH-01 | Health dan koneksi database | Server merespons sehat dan query database berhasil |
| AUTH-02 | Rute terproteksi tanpa sesi | `401`, tanpa kebocoran data |
| AUTH-03 | Admin login benar/salah/logout | Kredensial benar membuat sesi; salah ditolak; logout menghapus sesi |
| AUTH-04 | Terapis login NIT benar/salah/nonaktif | Hanya akun aktif dan password benar yang diterima |
| AUTH-05 | Orang Tua login email/telepon benar/salah/nonaktif | Kedua identifier valid; akun nonaktif ditolak |
| AUTH-06 | Isolasi peran | Parent/Terapis tidak dapat memanggil aksi Admin |
| AUTH-07 | Isolasi kepemilikan | Parent tidak dapat membaca anak lain; Terapis tidak dapat membaca data di luar relasi |
| AUTH-08 | Reset password dan login ulang | Password lama gagal, password reset berhasil |
| AUTH-09 | Sinyal lokasi dan sesi perangkat | Sinyal tersimpan pada pengguna yang benar |
| AUTH-10 | Cookie portal lain dan token eksplisit aktif bersamaan | Token eksplisit menentukan identitas; sesi tidak tertukar lintas portal |

### B. Master data dan registrasi

| ID | Skenario | Ekspektasi |
| --- | --- | --- |
| REG-01 | CRUD program | Tambah/edit/baca/hapus bekerja; duplikat/invalid ditolak |
| REG-02 | CRUD ruangan | Tambah/edit/status/hapus bekerja; konflik referensi ditolak aman |
| REG-03 | Registrasi Terapis lengkap | Akun, profil, NIT, jadwal, password sementara terbentuk |
| REG-04 | Edit/status/reset Terapis | Perubahan tersimpan dan akses mengikuti status |
| REG-05 | Registrasi Orang Tua | Email/telepon dapat dipakai login dan duplikat ditolak |
| REG-06 | Edit/status/reset Orang Tua | Perubahan tersimpan dan akses mengikuti status |
| REG-07 | Registrasi anak pada Orang Tua baru | Parent dan child terbentuk atomik |
| REG-08 | Registrasi anak pada Orang Tua lama | Child kedua terhubung tanpa membuat parent duplikat |
| REG-09 | Edit profil/foto anak | Perubahan terlihat lintas portal |
| REG-10 | Ganti Terapis biasa/kritis | Sesi mendatang berubah; histori lama mempertahankan atribusi |
| REG-11 | Hapus data yang masih direferensikan | Ditolak dengan pesan bisnis, bukan error database mentah |

### C. Periode dan penjadwalan

| ID | Skenario | Ekspektasi |
| --- | --- | --- |
| SCH-01 | Buat periode valid | Periode aktif terbentuk dengan total sesi dan pola jadwal |
| SCH-02 | Generate sesi periode | Jumlah/tanggal/jam/ruangan sesuai pola dan rentang |
| SCH-03 | Jadwal tampil lintas peran | Admin, Terapis terkait, dan Parent pemilik melihat sesi yang sama |
| SCH-04 | Bentrok anak | Sesi tumpang tindih ditolak |
| SCH-05 | Bentrok Terapis | Terapis tidak dapat memiliki dua sesi tumpang tindih |
| SCH-06 | Bentrok ruangan | Ruangan tidak dapat dipakai dua sesi tumpang tindih |
| SCH-07 | Di luar jam kerja Terapis | Ditolak |
| SCH-08 | Di luar jam operasional klinik | Ditolak |
| SCH-09 | Hari libur/cuti | Slot ditolak atau tidak ditawarkan |
| SCH-10 | Tambah/edit/hapus sesi tunggal | Perubahan konsisten lintas portal |
| SCH-11 | Kunjungan satu kali | Tidak mengubah kuota periode reguler |
| SCH-12 | Pembatalan forfeit | Sesi batal tidak menghasilkan pengganti |
| SCH-13 | Pembatalan replacement | Sesi pengganti tercatat dan tidak bentrok |
| SCH-14 | Terapis substitusi | Terapis baru menerima permintaan dan histori tetap benar |

### D. Operasional sesi, laporan, dan progres

| ID | Skenario | Ekspektasi |
| --- | --- | --- |
| OPS-01 | Admin konfirmasi kehadiran | Status hadir tersimpan dan tampil di histori |
| OPS-02 | Admin menolak kehadiran | Status kembali sesuai aturan tanpa merusak sesi |
| OPS-03 | Terapis memulai sesi | Hanya Terapis terkait dan transisi status valid |
| OPS-04 | Terapis menyelesaikan sesi | Status selesai dan waktu pembaruan tersimpan |
| OPS-05 | Simpan catatan sesi | Catatan hanya dapat diubah pihak berwenang |
| REP-01 | Terapis simpan draf laporan harian | Draf terlihat Terapis, belum dianggap final |
| REP-02 | Terapis kirim laporan | Status masuk antrean review Admin |
| REP-03 | Admin meminta revisi | Catatan review tampil dan Terapis dapat mengedit |
| REP-04 | Terapis kirim ulang revisi | Status kembali ke review |
| REP-05 | Admin menyetujui laporan | Laporan tersedia bagi Parent |
| REP-06 | Laporan evaluasi dan akhir | Tipe, periode, dan isi tersimpan benar |
| REP-07 | Rating sesi oleh Parent | Hanya pemilik anak dan sesi selesai yang dapat memberi rating |
| REP-08 | Monitoring/performa | Agregasi sesuai data sumber |

### E. Reschedule, substitusi, dan pertemuan

| ID | Skenario | Ekspektasi |
| --- | --- | --- |
| RSC-01 | Preview preferensi per 30 menit | Slot berinterval `00/30`, hasil stabil, tidak recheck tanpa akhir |
| RSC-02 | Preview slot valid | Mengembalikan ketersediaan dan alasan konflik yang benar |
| RSC-03 | Parent membuat reschedule | Request terhubung ke sesi/anak/pemilik yang benar |
| RSC-04 | Parent mencoba sesi anak lain | Ditolak |
| RSC-05 | Terapis menyetujui/menolak | Keputusan dan alasan tersimpan |
| RSC-06 | Admin menyetujui | Sesi berpindah tepat sekali dan notifikasi terkirim |
| RSC-07 | Admin menolak/menghapus | Jadwal asli tetap dan status konsisten |
| RSC-08 | Request diproses dua kali | Idempoten atau ditolak sebagai status tidak valid |
| SUB-01 | Admin membuat permintaan substitusi | Request sampai ke Terapis pengganti |
| SUB-02 | Terapis menerima/menolak substitusi | Sesi hanya berubah jika keputusan valid |
| MTG-01 | Terapis/Admin membuat pertemuan | Undangan tampil pada Parent |
| MTG-02 | Admin review pertemuan | Status dan jadwal final tersimpan |
| MTG-03 | Parent menerima/menolak | Respons tampil pada Admin/Terapis |

### F. Cuti anak, cuti Terapis, dan hari libur

| ID | Skenario | Ekspektasi |
| --- | --- | --- |
| CLV-01 | Admin membuat draf cuti anak | Rentang, media konfirmasi, dan strategi tersimpan |
| CLV-02 | Konfirmasi cuti dua minggu | Sesi terdampak pindah ke slot terdekat setelah cuti/periode |
| CLV-03 | Revisi cuti dua minggu menjadi satu | Sesi minggu aktif dipulihkan; sisa mengikuti keputusan Admin |
| CLV-04 | Batal cuti | Jadwal dipulihkan jika slot masih tersedia, konflik dilaporkan |
| CLV-05 | Retry pemindahan gagal | Hanya item gagal yang dicoba ulang |
| CLV-06 | Notifikasi cuti | Admin, Terapis, dan Parent menerima informasi yang relevan |
| TLV-01 | Terapis mengajukan cuti | Batas tanggal/perubahan divalidasi |
| TLV-02 | Admin setujui/tolak/kembalikan | Status dan catatan terlihat Terapis |
| TLV-03 | Jadwal pada cuti Terapis | Penjadwalan baru ditolak atau membutuhkan substitusi |
| HLD-01 | Ambil tanggal merah Indonesia | Daftar tahun yang diminta tampil tanpa duplikat |
| HLD-02 | Aktifkan hari libur | Sesi pada tanggal tersebut menjadi impact, bukan hilang |
| HLD-03 | Catat kontak Orang Tua | Media, hasil, dan waktu konfirmasi tersimpan |
| HLD-04 | Pindah manual setelah konfirmasi | Sesi pindah ke tanggal yang dipilih dan tervalidasi |
| HLD-05 | Tanpa konfirmasi sampai H-1 | Proses otomatis memilih hari terdekat setelah periode |
| HLD-06 | Nonaktifkan/hapus hari libur | Tidak merusak sesi yang sudah dipindahkan |
| HLD-07 | Notifikasi hari libur | Parent dan Terapis menerima tanggal lama/baru dan alasan |

### G. Penutupan periode, komunikasi, dan operasional Admin

| ID | Skenario | Ekspektasi |
| --- | --- | --- |
| PER-01 | Tutup periode belum selesai | Ditolak dan menyebut prasyarat yang kurang |
| PER-02 | Tutup periode selesai + laporan akhir | Berhasil dan terkunci sebagai selesai |
| PER-03 | Perpanjang periode aktif/batal | Ditolak |
| PER-04 | Perpanjang periode selesai | Periode baru terbentuk tanpa menggandakan histori |
| PER-05 | Permintaan penghapusan periode | Memerlukan alur respons dan audit |
| COM-01 | Pengumuman per target peran | Hanya target yang dapat melihat |
| COM-02 | Notifikasi read/read-all/delete | Jumlah unread konsisten |
| COM-03 | Auto refresh/sync version | Perubahan lintas portal terdeteksi tanpa reload penuh |
| MIG-01 | Migrasi dry-run invalid/valid | Invalid memberi daftar error; valid membuat batch |
| MIG-02 | Apply batch sekali | Data terbentuk tepat sekali |
| MIG-03 | Manual intake | Menghasilkan entitas yang lengkap atau rollback |
| SEC-01 | Audit log | Aksi kritis memiliki aktor, target, waktu, dan detail |
| DB-01 | Database usage | Status tersedia atau kegagalan konfigurasi dijelaskan aman |
| DB-02 | Backup branch | Tidak diuji pada database terisolasi tanpa kredensial Neon valid |

## 6. Kriteria Lulus

- Tidak ada error `5xx` untuk input bisnis yang seharusnya menghasilkan validasi `4xx`.
- Tidak ada kebocoran data lintas Parent, Terapis, atau peran.
- Perubahan lintas portal terlihat pada sumber data yang sama.
- Operasi status kritis tidak dapat diproses dua kali.
- Konflik anak, Terapis, ruangan, cuti, dan hari libur menghasilkan alasan yang dapat ditindaklanjuti.
- Tidak ada loop polling/recheck tanpa batas.
- Semua data pengujian berada pada database terisolasi dan database tersebut dihapus setelah pengujian.
