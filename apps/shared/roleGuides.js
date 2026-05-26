const commonSessionStep = 'Buka notifikasi untuk melihat hasil review, revisi, atau perubahan jadwal.';

export const ROLE_GUIDES = {
  admin: {
    title: 'Buku Panduan Admin',
    intro: 'Panduan ini merangkum cara kerja menu admin, input penting, dan alur keputusan agar operasional klinik tetap terlacak.',
    tour: [
      {
        title: 'Mulai dari menu kiri',
        body: 'Gunakan sidebar untuk pindah fitur. Setiap menu memiliki tombol info untuk membuka panduan fitur tersebut.',
      },
      {
        title: 'Cek permintaan masuk',
        body: 'Prioritaskan jadwal ulang, parent meeting, cuti, dan keputusan kritis sebelum mengubah data master.',
      },
      {
        title: 'Review sebelum simpan',
        body: 'Untuk data berdampak besar seperti migrasi, pergantian terapis, dan jadwal, cek ringkasan lalu simpan agar audit log tetap jelas.',
      },
      {
        title: 'Pantau notifikasi',
        body: 'Setelah tindakan admin, sistem mengirim notifikasi ke role terkait. Gunakan pusat notifikasi untuk memastikan pesan masuk.',
      },
    ],
    features: [
      {
        id: 'dashboard',
        label: 'Dasbor',
        purpose: 'Melihat ringkasan operasional, tugas tertunda, dan status klinik hari ini.',
        steps: ['Buka Dasbor.', 'Cek kartu ringkasan dan aktivitas terbaru.', 'Klik pintasan tugas yang perlu ditindaklanjuti.'],
        flow: ['Dasbor', 'Lihat prioritas', 'Buka modul terkait', commonSessionStep],
      },
      {
        id: 'scheduling',
        label: 'Penjadwalan Tunggal',
        purpose: 'Membuat atau mengubah sesi terapi dengan validasi konflik ruangan, terapis, anak, dan jam kerja.',
        steps: ['Pilih tanggal dan jam sesi.', 'Pilih anak, program, terapis, dan ruangan.', 'Cek label konflik atau unavailable.', 'Simpan hanya jika ringkasan sudah benar.'],
        flow: ['Tanggal', 'Anak/program', 'Terapis/ruangan', 'Validasi konflik', 'Simpan jadwal'],
      },
      {
        id: 'requests',
        label: 'Permintaan Masuk',
        purpose: 'Meninjau permintaan jadwal ulang dan permintaan lain yang menunggu keputusan admin.',
        steps: ['Buka daftar pending.', 'Cek alasan, tanggal asal, dan opsi pengganti.', 'Setujui, revisi, atau tolak dengan catatan.', 'Pastikan notifikasi terkirim.'],
        flow: ['Permintaan pending', 'Review detail', 'Ambil keputusan', 'Notifikasi role terkait'],
      },
      {
        id: 'parent-meetings',
        label: 'Parent Meeting',
        purpose: 'Mengatur jadwal meeting orang tua, terapis, dan admin.',
        steps: ['Pilih request meeting.', 'Cek peserta dan waktu tersedia.', 'Tetapkan jadwal atau minta revisi.', 'Pantau status kehadiran/konfirmasi.'],
        flow: ['Request meeting', 'Cek peserta', 'Tentukan jadwal', 'Konfirmasi'],
      },
      {
        id: 'therapist-leave-requests',
        label: 'Cuti Terapis',
        purpose: 'Mengevaluasi pengajuan cuti dan dampaknya ke jadwal anak.',
        steps: ['Buka pengajuan cuti pending.', 'Cek sesi terdampak dan batas perubahan.', 'Setujui/tolak dengan alasan.', 'Atur substitute atau reschedule jika perlu.'],
        flow: ['Pengajuan cuti', 'Cek dampak jadwal', 'Keputusan admin', 'Substitute/reschedule'],
      },
      {
        id: 'children',
        label: 'Data Anak',
        purpose: 'Mengelola profil anak, orang tua, program aktif, periode terapi, dan assignment terapis.',
        steps: ['Cari anak berdasarkan nama atau status.', 'Buka detail sebelum edit.', 'Ubah hanya field yang perlu.', 'Gunakan alur pergantian terapis untuk perubahan case yang kritis.'],
        flow: ['Cari anak', 'Review data', 'Edit/assign', 'Simpan audit'],
      },
      {
        id: 'program-registration',
        label: 'Pendaftaran Program',
        purpose: 'Mendaftarkan anak ke program/periode terapi dengan paket sesi dan jadwal aktif.',
        steps: ['Pilih anak dan program.', 'Isi total sesi, tanggal mulai, dan jadwal.', 'Pilih terapis utama/pendamping.', 'Simpan periode aktif.'],
        flow: ['Pilih anak', 'Program/paket', 'Terapis/jadwal', 'Periode aktif'],
      },
      {
        id: 'migration',
        label: 'Migrasi Center',
        purpose: 'Memasukkan data center manual/semi-manual ke Theracare tanpa mengarang detail histori lama.',
        steps: ['Pilih input manual atau import IEP Excel/CSV.', 'Jalankan dry-run dan perbaiki baris ambigu.', 'Review opening balance sesi lama.', 'Apply batch setelah data valid.'],
        flow: ['Sumber data', 'Dry-run', 'Review mapping', 'Apply', 'Periode berjalan'],
      },
      {
        id: 'therapists',
        label: 'Data Terapis',
        purpose: 'Mengelola profil, kredensial, status aktif, dan assignment terapis.',
        steps: ['Cari terapis.', 'Cek status aktif dan spesialisasi.', 'Gunakan aksi edit/registrasi sesuai kebutuhan.', 'Untuk resign, gunakan alur pengganti case agar histori tetap milik terapis lama.'],
        flow: ['Cari terapis', 'Cek status', 'Edit/registrasi', 'Audit perubahan'],
      },
      {
        id: 'rooms',
        label: 'Manajemen Ruangan',
        purpose: 'Mengelola ruangan agar penjadwalan dapat memvalidasi konflik ruang.',
        steps: ['Tambah atau edit ruangan.', 'Isi kapasitas/status.', 'Nonaktifkan ruangan yang tidak dipakai.', 'Cek konflik di jadwal setelah perubahan.'],
        flow: ['Data ruangan', 'Status/kebutuhan', 'Simpan', 'Validasi jadwal'],
      },
      {
        id: 'programs',
        label: 'Program Layanan',
        purpose: 'Menjaga daftar program klinik yang dipakai saat pendaftaran dan laporan.',
        steps: ['Tambah/edit program.', 'Isi nama, deskripsi, dan status.', 'Nonaktifkan program lama daripada menghapus data historis.', 'Cek pendaftaran aktif yang memakai program tersebut.'],
        flow: ['Program', 'Detail layanan', 'Status aktif', 'Dipakai periode'],
      },
      {
        id: 'attendance',
        label: 'Kehadiran Anak',
        purpose: 'Melihat dan memvalidasi kehadiran sesi terapi.',
        steps: ['Filter tanggal atau anak.', 'Cek status hadir, izin, batal, atau no-show.', 'Gunakan data ini untuk progress dan laporan akhir.'],
        flow: ['Filter data', 'Review status', 'Koreksi bila perlu', 'Masuk laporan'],
      },
      {
        id: 'monitoring',
        label: 'Pantau Perkembangan',
        purpose: 'Memantau progress anak lintas sesi, target, laporan, dan periode.',
        steps: ['Pilih anak/periode.', 'Cek target IEP dan progress sesi.', 'Bandingkan laporan historis dan digital.', 'Tindaklanjuti jika progress tertahan.'],
        flow: ['Pilih anak', 'Target IEP', 'Sesi/laporan', 'Tindak lanjut'],
      },
      {
        id: 'reports',
        label: 'Laporan Klinik',
        purpose: 'Meninjau laporan sesi, laporan akhir, revisi, dan kontribusi terapis.',
        steps: ['Filter anak, terapis, atau periode.', 'Buka detail laporan.', 'Minta revisi jika data kurang.', 'Pastikan laporan final memuat histori penuh.'],
        flow: ['Filter laporan', 'Review isi', 'Approve/revisi', 'Finalisasi'],
      },
      {
        id: 'notifications',
        label: 'Pengumuman & Notifikasi',
        purpose: 'Mengirim pengumuman dan memantau pesan sistem lintas role.',
        steps: ['Pilih target role atau penerima.', 'Tulis pesan ringkas dan jelas.', 'Kirim.', 'Cek badge/unread untuk memastikan pesan masuk.'],
        flow: ['Target', 'Pesan', 'Kirim', 'Pantau status'],
      },
      {
        id: 'users',
        label: 'Manajemen Pengguna',
        purpose: 'Mengelola akun, role, akses, dan keamanan perangkat.',
        steps: ['Cari user.', 'Cek role dan status.', 'Ubah akses hanya sesuai kebutuhan.', 'Gunakan logout perangkat bila ada risiko keamanan.'],
        flow: ['User', 'Role/status', 'Aksi akses', 'Audit keamanan'],
      },
      {
        id: 'branding',
        label: 'Pengaturan & Tampilan',
        purpose: 'Mengatur identitas klinik yang muncul di portal.',
        steps: ['Unggah logo atau pilih warna.', 'Cek preview.', 'Simpan.', 'Refresh portal lain untuk memastikan tampilan sinkron.'],
        flow: ['Identitas klinik', 'Preview', 'Simpan', 'Sinkron portal'],
      },
    ],
  },
  therapist: {
    title: 'Buku Panduan Terapis',
    intro: 'Panduan ini membantu terapis menjalankan jadwal, laporan, cuti, ketersediaan, dan komunikasi orang tua secara konsisten.',
    tour: [
      { title: 'Lihat jadwal hari ini', body: 'Mulai dari Dasbor atau Jadwal Terapi untuk mengetahui sesi aktif dan perubahan terbaru.' },
      { title: 'Isi laporan setelah sesi', body: 'Gunakan Laporan Anak setelah sesi selesai agar progress anak dan laporan akhir tetap lengkap.' },
      { title: 'Kelola perubahan jadwal', body: 'Pembaruan Jadwal dan Pengajuan Cuti dipakai untuk komunikasi resmi dengan admin.' },
      { title: 'Buka tombol info', body: 'Setiap menu memiliki tombol info yang menjelaskan alur kerja fitur tersebut.' },
    ],
    features: [
      {
        id: 'dashboard',
        label: 'Dasbor',
        purpose: 'Melihat ringkasan sesi, notifikasi, dan tugas klinis.',
        steps: ['Buka Dasbor.', 'Cek sesi hari ini dan notifikasi.', 'Masuk ke jadwal atau laporan sesuai tugas.'],
        flow: ['Dasbor', 'Sesi hari ini', 'Aksi klinis', 'Notifikasi'],
      },
      {
        id: 'schedule',
        label: 'Jadwal Terapi',
        purpose: 'Melihat sesi yang menjadi tanggung jawab terapis.',
        steps: ['Pilih tanggal.', 'Cek jam, anak, ruangan, dan status.', 'Ikuti perubahan dari admin sebelum sesi dimulai.'],
        flow: ['Tanggal', 'Detail sesi', 'Status', 'Pelaksanaan'],
      },
      {
        id: 'schedule-updates',
        label: 'Pembaruan Jadwal',
        purpose: 'Melihat perubahan jadwal, substitute, dan hasil reschedule.',
        steps: ['Buka update terbaru.', 'Baca alasan dan tanggal efektif.', 'Konfirmasi jika diminta.', 'Cek jadwal setelah update diterima.'],
        flow: ['Update masuk', 'Review detail', 'Konfirmasi', 'Jadwal diperbarui'],
      },
      {
        id: 'leave-requests',
        label: 'Pengajuan Cuti',
        purpose: 'Mengajukan cuti dengan data yang cukup untuk admin mengecek dampak jadwal.',
        steps: ['Pilih tanggal cuti.', 'Isi alasan dan catatan.', 'Kirim ke admin.', 'Pantau hasil approval dan instruksi pengganti.'],
        flow: ['Tanggal cuti', 'Alasan', 'Kirim', 'Approval admin'],
      },
      {
        id: 'availability',
        label: 'Ketersediaan',
        purpose: 'Mengatur jam kerja dan jam off agar admin tidak menjadwalkan sesi di luar ketersediaan.',
        steps: ['Pilih hari.', 'Isi jam tersedia dan jam off.', 'Simpan perubahan.', 'Pastikan label unavailable muncul sesuai jam off.'],
        flow: ['Hari', 'Jam kerja/off', 'Simpan', 'Dipakai validasi jadwal'],
      },
      {
        id: 'reports',
        label: 'Laporan Anak',
        purpose: 'Membuat laporan sesi, update progress, dan catatan klinis.',
        steps: ['Pilih sesi/anak.', 'Isi target, respons, prompt, dan catatan.', 'Review sebelum submit.', 'Kirim laporan untuk admin/orang tua sesuai status.'],
        flow: ['Pilih sesi', 'Isi klinis', 'Review', 'Submit laporan'],
      },
      {
        id: 'performance',
        label: 'Kinerja',
        purpose: 'Melihat performa pribadi, jumlah sesi, laporan, dan ketepatan tugas.',
        steps: ['Buka periode yang ingin dilihat.', 'Cek metrik sesi dan laporan.', 'Gunakan insight untuk memperbaiki kelengkapan laporan.'],
        flow: ['Periode', 'Metrik kerja', 'Evaluasi', 'Perbaikan'],
      },
      {
        id: 'meetings',
        label: 'Pertemuan Orang Tua',
        purpose: 'Mengikuti atau mengonfirmasi meeting dengan orang tua.',
        steps: ['Buka daftar meeting.', 'Cek jadwal dan agenda.', 'Konfirmasi atau ikuti instruksi admin.', 'Catat hasil jika diperlukan.'],
        flow: ['Meeting', 'Agenda', 'Konfirmasi', 'Tindak lanjut'],
      },
      {
        id: 'child-progress',
        label: 'Kemajuan Anak',
        purpose: 'Melihat progress anak yang ditangani lintas sesi dan target.',
        steps: ['Pilih anak.', 'Cek target aktif dan capaian.', 'Gunakan data ini saat menulis laporan atau meeting.'],
        flow: ['Pilih anak', 'Target', 'Progress', 'Catatan klinis'],
      },
      {
        id: 'announcements',
        label: 'Notifikasi',
        purpose: 'Membaca pengumuman klinik dan pesan sistem.',
        steps: ['Buka notifikasi.', 'Baca pesan belum dibaca.', 'Ikuti instruksi jika ada aksi lanjutan.'],
        flow: ['Notifikasi', 'Baca', 'Tindak lanjuti'],
      },
      {
        id: 'settings',
        label: 'Pengaturan',
        purpose: 'Mengelola preferensi akun dan informasi profil.',
        steps: ['Buka pengaturan.', 'Cek data profil.', 'Ubah preferensi yang tersedia.', 'Simpan.'],
        flow: ['Profil', 'Preferensi', 'Simpan'],
      },
    ],
  },
  parent: {
    title: 'Buku Panduan Orang Tua',
    intro: 'Panduan ini membantu orang tua membaca progress, laporan, kehadiran, meeting, dan pengajuan jadwal ulang.',
    tour: [
      { title: 'Mulai dari ringkasan anak', body: 'Dasbor menampilkan ringkasan sesi, progress, dan notifikasi penting.' },
      { title: 'Baca laporan dan progress', body: 'Gunakan Kemajuan Anak dan Daftar Laporan untuk melihat perkembangan dari sesi ke sesi.' },
      { title: 'Ajukan perubahan resmi', body: 'Gunakan Penjadwalan Ulang untuk request perubahan jadwal, bukan chat informal.' },
      { title: 'Panduan selalu tersedia', body: 'Tekan tombol info di menu atau tombol Panduan untuk membuka bantuan kapan saja.' },
    ],
    features: [
      {
        id: 'dashboard',
        label: 'Dasbor',
        purpose: 'Melihat ringkasan anak, jadwal, laporan baru, dan notifikasi.',
        steps: ['Buka Dasbor.', 'Cek kartu ringkasan.', 'Klik item yang perlu dibaca atau ditindaklanjuti.'],
        flow: ['Dasbor', 'Ringkasan', 'Detail', 'Tindak lanjut'],
      },
      {
        id: 'progress',
        label: 'Kemajuan Anak',
        purpose: 'Membaca perkembangan target terapi dalam periode berjalan.',
        steps: ['Pilih anak/periode jika tersedia.', 'Cek target dan status progress.', 'Bandingkan dengan laporan sesi terbaru.'],
        flow: ['Anak/periode', 'Target', 'Progress', 'Diskusi meeting'],
      },
      {
        id: 'profile',
        label: 'Profil Anak',
        purpose: 'Melihat data anak, program, dan informasi wali.',
        steps: ['Buka Profil Anak.', 'Cek data dasar dan program.', 'Hubungi admin jika ada data yang perlu diperbaiki.'],
        flow: ['Profil', 'Data program', 'Validasi', 'Hubungi admin'],
      },
      {
        id: 'attendance',
        label: 'Log Kehadiran',
        purpose: 'Melihat riwayat hadir, izin, batal, atau sesi selesai.',
        steps: ['Filter periode.', 'Cek status tiap sesi.', 'Gunakan data ini saat menanyakan progress atau paket sesi.'],
        flow: ['Periode', 'Status sesi', 'Riwayat', 'Pertanyaan ke admin'],
      },
      {
        id: 'reports',
        label: 'Daftar Laporan',
        purpose: 'Membaca laporan sesi dan laporan akhir yang tersedia untuk orang tua.',
        steps: ['Buka laporan terbaru.', 'Baca target, respons, dan catatan.', 'Unduh atau simpan PDF jika tersedia.', 'Ajukan pertanyaan lewat jalur resmi bila perlu.'],
        flow: ['Laporan', 'Baca detail', 'Unduh', 'Tindak lanjut'],
      },
      {
        id: 'reschedule',
        label: 'Penjadwalan Ulang',
        purpose: 'Mengajukan perubahan jadwal terapi dengan alasan dan opsi waktu pengganti.',
        steps: ['Pilih sesi yang ingin diubah.', 'Isi alasan dan opsi waktu.', 'Kirim request.', 'Pantau hasil keputusan admin.'],
        flow: ['Pilih sesi', 'Alasan/opsi', 'Kirim', 'Keputusan admin'],
      },
      {
        id: 'announcements',
        label: 'Pengumuman',
        purpose: 'Membaca pengumuman klinik dan perubahan layanan.',
        steps: ['Buka Pengumuman.', 'Baca pesan belum dibaca.', 'Ikuti instruksi jika ada perubahan jadwal atau layanan.'],
        flow: ['Pengumuman', 'Baca', 'Tindak lanjut'],
      },
      {
        id: 'meetings',
        label: 'Parent Meeting',
        purpose: 'Melihat dan mengikuti jadwal meeting dengan klinik.',
        steps: ['Buka daftar meeting.', 'Cek agenda dan jadwal.', 'Konfirmasi kehadiran jika diminta.', 'Siapkan pertanyaan terkait progress anak.'],
        flow: ['Meeting', 'Agenda', 'Konfirmasi', 'Diskusi progress'],
      },
      {
        id: 'settings',
        label: 'Pengaturan',
        purpose: 'Mengatur profil akun dan preferensi portal.',
        steps: ['Buka pengaturan.', 'Cek data akun.', 'Ubah preferensi yang tersedia.', 'Simpan perubahan.'],
        flow: ['Akun', 'Preferensi', 'Simpan'],
      },
    ],
  },
};

export function getRoleGuide(role) {
  return ROLE_GUIDES[role] || null;
}

export function getFeatureGuide(role, featureId) {
  const guide = getRoleGuide(role);
  if (!guide) return null;
  return guide.features.find((feature) => feature.id === featureId) || null;
}
