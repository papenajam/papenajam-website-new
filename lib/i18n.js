// ============================================================
// INTERNATIONALIZATION (i18n) SYSTEM
// Supported: Indonesian (id) - default, English (en)
// ============================================================

export const LANGUAGES = {
  id: { code: 'id', name: 'Indonesia', flag: '🇮🇩', label: 'ID' },
  en: { code: 'en', name: 'English', flag: '🇬🇧', label: 'EN' },
};

export const DEFAULT_LANGUAGE = 'id';
export const LANGUAGE_COOKIE = 'pa_lang';
export const LANGUAGE_STORAGE_KEY = 'pa_language';

// ============================================================
// TRANSLATION DICTIONARIES
// ============================================================
export const translations = {
  id: {
    // --- SITE META ---
    siteName: 'Pengadilan Agama Penajam',
    siteSubtitle: 'Kelas I B',
    tagline: 'Memberikan Keadilan yang Cepat, Sederhana, dan Berbiaya Ringan',
    underMA: 'Mahkamah Agung Republik Indonesia',

    // --- NAVIGATION ---
    nav: {
      home: 'Beranda',
      profile: 'Profil',
      services: 'Layanan',
      caseInfo: 'Informasi Perkara',
      news: 'Berita',
      announcements: 'Pengumuman',
      contact: 'Kontak',
      digitalServices: 'Layanan Digital',
      courtSchedule: 'Agenda Sidang',
      decisions: 'Putusan',
      caseSearch: 'Pencarian Perkara',
      admin: 'Admin',
      skipToContent: 'Lewati ke konten utama',
    },

    // --- HERO ---
    hero: {
      seeServices: 'Lihat Layanan',
      contactUs: 'Hubungi Kami',
      caseThisYear: 'Perkara Tahun Ini',
      caseDone: 'Perkara Selesai',
      caseOngoing: 'Perkara Berjalan',
    },

    // --- PROFILE ---
    profile: {
      title: 'Profil Pengadilan',
      subtitle: 'Mengenal Pengadilan Agama Penajam lebih dekat',
      vision: 'Visi',
      mission: 'Misi',
      history: 'Sejarah',
      location: 'Lokasi',
      address: 'Alamat',
    },

    // --- SERVICES ---
    services: {
      title: 'Layanan Kami',
      subtitle: 'Berbagai layanan yang tersedia untuk masyarakat',
      moreInfo: 'Selengkapnya',
    },

    // --- CASE SEARCH ---
    caseSearch: {
      title: 'Informasi Perkara',
      subtitle: 'Cari informasi perkara Anda dengan mudah',
      label: 'Nomor Perkara atau Nama Pihak',
      placeholder: 'Masukkan nomor perkara atau nama pihak (contoh: 0001/Pdt.G/2025)',
      yearLabel: 'Tahun',
      yearPlaceholder: 'Contoh: 2025',
      searchBtn: 'Cari Perkara',
      searching: 'Mencari...',
      resultTitle: 'Hasil Pencarian',
      noResult: 'Perkara tidak ditemukan',
      noResultDesc: 'Pastikan nomor perkara atau nama pihak yang Anda masukkan sudah benar.',
      advancedSearch: 'Pencarian Lanjutan',
      caseNumber: 'Nomor Perkara',
      caseType: 'Jenis Perkara',
      parties: 'Pihak',
      petitioner: 'Pemohon / Penggugat',
      respondent: 'Termohon / Tergugat',
      status: 'Status',
      hearing: 'Jadwal Sidang',
      room: 'Ruang Sidang',
      judge: 'Hakim',
    },

    // --- STATUS ---
    status: {
      registered: 'Terdaftar',
      ongoing: 'Berjalan',
      done: 'Selesai',
      postponed: 'Ditunda',
      cancelled: 'Dibatalkan',
      scheduled: 'Dijadwalkan',
      published: 'Dipublikasi',
      draft: 'Draft',
      active: 'Aktif',
      inactive: 'Tidak Aktif',
    },

    // --- NEWS ---
    news: {
      title: 'Berita Terkini',
      subtitle: 'Informasi terbaru dari Pengadilan Agama Penajam',
      readMore: 'Baca Selengkapnya',
      allNews: 'Semua Berita',
      publishedOn: 'Dipublikasikan pada',
      author: 'Penulis',
      category: 'Kategori',
      noNews: 'Belum ada berita',
      loading: 'Memuat berita...',
    },

    // --- ANNOUNCEMENTS ---
    announcements: {
      title: 'Pengumuman',
      subtitle: 'Pengumuman resmi dari Pengadilan Agama Penajam',
      allAnnouncements: 'Semua Pengumuman',
      noAnnouncements: 'Belum ada pengumuman',
    },

    // --- CONTACT ---
    contact: {
      title: 'Hubungi Kami',
      subtitle: 'Kami siap melayani Anda',
      address: 'Alamat',
      phone: 'Telepon',
      email: 'Email',
      website: 'Website',
      operationalHours: 'Jam Operasional',
      hours: 'Senin–Jumat: 08.00–16.00 WITA',
      mapLink: 'Lihat di Peta',
      sendMessage: 'Kirim Pesan',
    },

    // --- FOOTER ---
    footer: {
      description: 'Pengadilan Agama Penajam adalah badan peradilan di bawah Mahkamah Agung RI yang bertugas memeriksa dan memutus perkara di bidang hukum keluarga dan ekonomi syariah.',
      quickLinks: 'Tautan Cepat',
      information: 'Informasi',
      rights: 'Hak Cipta',
      allRights: 'Seluruh hak cipta dilindungi.',
      privacy: 'Kebijakan Privasi',
      accessibility: 'Aksesibilitas',
      sitemap: 'Peta Situs',
    },

    // --- AGENDA SIDANG ---
    agenda: {
      title: 'Agenda Sidang',
      subtitle: 'Jadwal persidangan Pengadilan Agama Penajam',
      date: 'Tanggal',
      time: 'Waktu',
      room: 'Ruang',
      judge: 'Hakim',
      clerk: 'Panitera',
      caseType: 'Jenis Perkara',
      noAgenda: 'Tidak ada jadwal sidang',
      filter: 'Filter',
      filterByDate: 'Filter tanggal',
      filterByStatus: 'Filter status',
      allStatus: 'Semua Status',
      tableView: 'Tampilan Tabel',
      calendarView: 'Tampilan Kalender',
    },

    // --- PUTUSAN ---
    decisions: {
      title: 'Putusan Pengadilan',
      subtitle: 'Dokumen putusan yang dapat diunduh',
      downloadPDF: 'Unduh PDF',
      noFile: 'Tidak ada file',
      decisionDate: 'Tanggal Putusan',
      judge: 'Hakim',
      summary: 'Ringkasan',
      noDecisions: 'Belum ada putusan tersedia',
      searchPlaceholder: 'Cari nomor atau jenis perkara...',
    },

    // --- COMMON ---
    common: {
      search: 'Cari',
      loading: 'Memuat...',
      back: 'Kembali',
      next: 'Selanjutnya',
      previous: 'Sebelumnya',
      page: 'Halaman',
      of: 'dari',
      close: 'Tutup',
      save: 'Simpan',
      cancel: 'Batal',
      delete: 'Hapus',
      edit: 'Edit',
      add: 'Tambah',
      view: 'Lihat',
      download: 'Unduh',
      upload: 'Unggah',
      yes: 'Ya',
      no: 'Tidak',
      confirm: 'Konfirmasi',
      error: 'Terjadi kesalahan',
      success: 'Berhasil',
      required: 'Wajib diisi',
      optional: 'Opsional',
      total: 'Total',
      date: 'Tanggal',
      action: 'Aksi',
      more: 'Selengkapnya',
      less: 'Lebih sedikit',
    },

    // --- ACCESSIBILITY ---
    accessibility: {
      title: 'Aksesibilitas',
      toolbar: 'Bilah Aksesibilitas',
      openToolbar: 'Buka pengaturan aksesibilitas',
      closeToolbar: 'Tutup pengaturan aksesibilitas',
      increaseFontSize: 'Perbesar Teks',
      decreaseFontSize: 'Perkecil Teks',
      resetFontSize: 'Reset Ukuran Teks',
      highContrast: 'Kontras Tinggi',
      darkMode: 'Mode Gelap',
      dyslexiaFont: 'Font Disleksia',
      highlightLinks: 'Sorot Tautan',
      readingGuide: 'Panduan Baca',
      simpleMode: 'Akses Sederhana',
      textToSpeech: 'Baca Halaman',
      stopSpeech: 'Hentikan Pembacaan',
      resetAll: 'Reset Semua',
      settingsSaved: 'Pengaturan disimpan',
      currentFontSize: 'Ukuran teks saat ini',
      fontNormal: 'Normal',
      fontLarge: 'Besar',
      fontXLarge: 'Sangat Besar',
      statement: 'Pernyataan Aksesibilitas',
    },

    // --- ADMIN ---
    admin: {
      dashboard: 'Dashboard',
      news: 'Berita',
      announcements: 'Pengumuman',
      services: 'Layanan',
      cases: 'Perkara',
      agenda: 'Agenda Sidang',
      decisions: 'Putusan',
      pages: 'Page Builder',
      users: 'Pengguna',
      settings: 'Pengaturan',
      logout: 'Keluar',
      login: 'Masuk',
      loginTitle: 'Masuk ke Dashboard',
      emailLabel: 'Email',
      passwordLabel: 'Kata Sandi',
      loginBtn: 'Masuk',
      loginError: 'Email atau password salah',
      indonesian: 'Bahasa Indonesia',
      english: 'English',
      languageTab: 'Tab Bahasa',
      altText: 'Teks Alternatif (Alt Text)',
      ariaLabel: 'Label Aria',
      translations: 'Terjemahan',
    },
  },

  en: {
    // --- SITE META ---
    siteName: 'Penajam Religious Court',
    siteSubtitle: 'Class I B',
    tagline: 'Delivering Justice that is Fast, Simple, and Affordable',
    underMA: 'Supreme Court of the Republic of Indonesia',

    // --- NAVIGATION ---
    nav: {
      home: 'Home',
      profile: 'Profile',
      services: 'Services',
      caseInfo: 'Case Information',
      news: 'News',
      announcements: 'Announcements',
      contact: 'Contact',
      digitalServices: 'Digital Services',
      courtSchedule: 'Court Schedule',
      decisions: 'Court Decisions',
      caseSearch: 'Case Search',
      admin: 'Admin',
      skipToContent: 'Skip to main content',
    },

    // --- HERO ---
    hero: {
      seeServices: 'See Services',
      contactUs: 'Contact Us',
      caseThisYear: 'Cases This Year',
      caseDone: 'Completed Cases',
      caseOngoing: 'Ongoing Cases',
    },

    // --- PROFILE ---
    profile: {
      title: 'Court Profile',
      subtitle: 'Learn more about Penajam Religious Court',
      vision: 'Vision',
      mission: 'Mission',
      history: 'History',
      location: 'Location',
      address: 'Address',
    },

    // --- SERVICES ---
    services: {
      title: 'Our Services',
      subtitle: 'Various services available to the public',
      moreInfo: 'Learn More',
    },

    // --- CASE SEARCH ---
    caseSearch: {
      title: 'Case Information',
      subtitle: 'Easily search for your case information',
      label: 'Case Number or Party Name',
      placeholder: 'Enter case number or party name (e.g. 0001/Pdt.G/2025)',
      yearLabel: 'Year',
      yearPlaceholder: 'e.g. 2025',
      searchBtn: 'Search Case',
      searching: 'Searching...',
      resultTitle: 'Search Results',
      noResult: 'Case not found',
      noResultDesc: 'Please make sure the case number or party name you entered is correct.',
      advancedSearch: 'Advanced Search',
      caseNumber: 'Case Number',
      caseType: 'Case Type',
      parties: 'Parties',
      petitioner: 'Petitioner / Plaintiff',
      respondent: 'Respondent / Defendant',
      status: 'Status',
      hearing: 'Hearing Schedule',
      room: 'Courtroom',
      judge: 'Judge',
    },

    // --- STATUS ---
    status: {
      registered: 'Registered',
      ongoing: 'Ongoing',
      done: 'Completed',
      postponed: 'Postponed',
      cancelled: 'Cancelled',
      scheduled: 'Scheduled',
      published: 'Published',
      draft: 'Draft',
      active: 'Active',
      inactive: 'Inactive',
    },

    // --- NEWS ---
    news: {
      title: 'Latest News',
      subtitle: 'Latest updates from Penajam Religious Court',
      readMore: 'Read More',
      allNews: 'All News',
      publishedOn: 'Published on',
      author: 'Author',
      category: 'Category',
      noNews: 'No news available',
      loading: 'Loading news...',
    },

    // --- ANNOUNCEMENTS ---
    announcements: {
      title: 'Announcements',
      subtitle: 'Official announcements from Penajam Religious Court',
      allAnnouncements: 'All Announcements',
      noAnnouncements: 'No announcements available',
    },

    // --- CONTACT ---
    contact: {
      title: 'Contact Us',
      subtitle: 'We are ready to serve you',
      address: 'Address',
      phone: 'Phone',
      email: 'Email',
      website: 'Website',
      operationalHours: 'Operational Hours',
      hours: 'Monday–Friday: 08:00–16:00 WITA',
      mapLink: 'View on Map',
      sendMessage: 'Send Message',
    },

    // --- FOOTER ---
    footer: {
      description: 'Penajam Religious Court is a judicial institution under the Supreme Court of Indonesia responsible for examining and deciding cases in Islamic family law and sharia economics.',
      quickLinks: 'Quick Links',
      information: 'Information',
      rights: 'Copyright',
      allRights: 'All rights reserved.',
      privacy: 'Privacy Policy',
      accessibility: 'Accessibility',
      sitemap: 'Sitemap',
    },

    // --- AGENDA SIDANG ---
    agenda: {
      title: 'Court Schedule',
      subtitle: 'Hearing schedule of Penajam Religious Court',
      date: 'Date',
      time: 'Time',
      room: 'Room',
      judge: 'Judge',
      clerk: 'Clerk',
      caseType: 'Case Type',
      noAgenda: 'No court schedule',
      filter: 'Filter',
      filterByDate: 'Filter by date',
      filterByStatus: 'Filter by status',
      allStatus: 'All Status',
      tableView: 'Table View',
      calendarView: 'Calendar View',
    },

    // --- PUTUSAN ---
    decisions: {
      title: 'Court Decisions',
      subtitle: 'Downloadable court decision documents',
      downloadPDF: 'Download PDF',
      noFile: 'No file',
      decisionDate: 'Decision Date',
      judge: 'Judge',
      summary: 'Summary',
      noDecisions: 'No decisions available',
      searchPlaceholder: 'Search case number or type...',
    },

    // --- COMMON ---
    common: {
      search: 'Search',
      loading: 'Loading...',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      page: 'Page',
      of: 'of',
      close: 'Close',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      view: 'View',
      download: 'Download',
      upload: 'Upload',
      yes: 'Yes',
      no: 'No',
      confirm: 'Confirm',
      error: 'An error occurred',
      success: 'Success',
      required: 'Required',
      optional: 'Optional',
      total: 'Total',
      date: 'Date',
      action: 'Action',
      more: 'More',
      less: 'Less',
    },

    // --- ACCESSIBILITY ---
    accessibility: {
      title: 'Accessibility',
      toolbar: 'Accessibility Toolbar',
      openToolbar: 'Open accessibility settings',
      closeToolbar: 'Close accessibility settings',
      increaseFontSize: 'Increase Text Size',
      decreaseFontSize: 'Decrease Text Size',
      resetFontSize: 'Reset Text Size',
      highContrast: 'High Contrast',
      darkMode: 'Dark Mode',
      dyslexiaFont: 'Dyslexia Font',
      highlightLinks: 'Highlight Links',
      readingGuide: 'Reading Guide',
      simpleMode: 'Simple View',
      textToSpeech: 'Read Page',
      stopSpeech: 'Stop Reading',
      resetAll: 'Reset All',
      settingsSaved: 'Settings saved',
      currentFontSize: 'Current text size',
      fontNormal: 'Normal',
      fontLarge: 'Large',
      fontXLarge: 'Extra Large',
      statement: 'Accessibility Statement',
    },

    // --- ADMIN ---
    admin: {
      dashboard: 'Dashboard',
      news: 'News',
      announcements: 'Announcements',
      services: 'Services',
      cases: 'Cases',
      agenda: 'Court Schedule',
      decisions: 'Decisions',
      pages: 'Page Builder',
      users: 'Users',
      settings: 'Settings',
      logout: 'Logout',
      login: 'Login',
      loginTitle: 'Login to Dashboard',
      emailLabel: 'Email',
      passwordLabel: 'Password',
      loginBtn: 'Login',
      loginError: 'Incorrect email or password',
      indonesian: 'Bahasa Indonesia',
      english: 'English',
      languageTab: 'Language Tab',
      altText: 'Alternative Text (Alt Text)',
      ariaLabel: 'Aria Label',
      translations: 'Translations',
    },
  },
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get translation by key path (e.g. 'nav.home', 'common.search')
 */
export function t(lang, keyPath, fallback = '') {
  const dict = translations[lang] || translations[DEFAULT_LANGUAGE];
  const keys = keyPath.split('.');
  let val = dict;
  for (const k of keys) {
    if (val && typeof val === 'object') val = val[k];
    else return fallback || keyPath;
  }
  return typeof val === 'string' ? val : (fallback || keyPath);
}

/**
 * Get saved language from localStorage (client-side only)
 */
export function getSavedLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) || DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/**
 * Save language preference
 */
export function saveLanguage(lang) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    document.cookie = `${LANGUAGE_COOKIE}=${lang};path=/;max-age=31536000`;
  } catch {}
}
