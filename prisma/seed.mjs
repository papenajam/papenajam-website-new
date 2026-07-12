// Idempotent Prisma seed (Task 15).
//
// Invoked ONLY via `prisma db seed` / `corepack yarn db:seed`
// (wired in prisma.config.mjs → migrations.seed).
//
// Security:
//   - Public POST /api/seed is DISABLED (route map entry removed).
//   - Seed passwords come from env (SEED_ADMIN_PASSWORD, SEED_STAFF_PASSWORD,
//     SEED_EDITOR_PASSWORD). When an env var is missing, a cryptographically
//     random password is generated and printed ONCE to stdout so the operator
//     can capture it. NEVER hard-code production credentials here.
//   - All writes are upserts / count-gated inserts so re-running is safe.
//
// Models use Prisma client names (user, news, announcement, …). Dates that
// are calendar-only are stored as Date at UTC midnight; timestamps as Date.

import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma/client.ts';

// ---------------------------------------------------------------------------
// Client bootstrap (mirrors lib/prisma.js parseDatabaseUrl so seed works with
// the same ?schema= stripping rules as the app runtime).
// ---------------------------------------------------------------------------

function parseDatabaseUrl(raw) {
  if (!raw || typeof raw !== 'string') {
    return { connectionString: raw, schema: 'public' };
  }
  try {
    const httpish = raw
      .replace(/^postgresql:/i, 'http:')
      .replace(/^postgres:/i, 'http:');
    const u = new URL(httpish);
    const schema = u.searchParams.get('schema') || 'public';
    // Prefer regex strip of `schema=` so credentials stay exactly as the
    // operator encoded them (rebuilding via decodeURIComponent would break
    // passwords containing `@`, `:`, `/`, `#`, etc.).
    const connectionString = raw
      .replace(/([?&])schema=[^&]*/i, '$1')
      .replace(/[?&]$/, '')
      .replace(/\?&/, '?')
      .replace(/\?$/, '');
    return { connectionString, schema };
  } catch {
    const schemaMatch = raw.match(/[?&]schema=([^&]*)/i);
    const schema = schemaMatch ? decodeURIComponent(schemaMatch[1]) : 'public';
    const connectionString = raw
      .replace(/([?&])schema=[^&]*/i, '$1')
      .replace(/[?&]$/, '')
      .replace(/\?&/, '?')
      .replace(/\?$/, '');
    return { connectionString, schema };
  }
}

function createPrisma() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      'prisma/seed.mjs: DATABASE_URL is not set. Provide a local/test ' +
        'PostgreSQL connection string before running `prisma db seed`.',
    );
  }
  const { connectionString, schema } = parseDatabaseUrl(raw);
  const adapter = new PrismaPg({ connectionString }, { schema });
  return new PrismaClient({ adapter });
}

// ---------------------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a seed password from env, or generate a random one and print it once.
 *
 * @param {string} envName
 * @param {string} accountLabel
 * @returns {string}
 */
function resolvePassword(envName, accountLabel) {
  const fromEnv = process.env[envName];
  if (fromEnv && String(fromEnv).length > 0) {
    return String(fromEnv);
  }
  const generated = randomBytes(18).toString('base64url');
  // Print once to stdout (secure channel for local CLI; not committed).
  console.log(
    `[seed] Generated password for ${accountLabel} (env ${envName} unset): ${generated}`,
  );
  console.log(
    `[seed] Store this password securely. It will not be printed again on re-run ` +
      `(set ${envName} to reuse a known value).`,
  );
  return generated;
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

function todayDateOnly() {
  // UTC midnight Date for @db.Date columns.
  const iso = new Date().toISOString().split('T')[0];
  return new Date(`${iso}T00:00:00.000Z`);
}

function dateOnlyFromOffset(dayOffset) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  const iso = d.toISOString().split('T')[0];
  return new Date(`${iso}T00:00:00.000Z`);
}

// ---------------------------------------------------------------------------
// Seed steps (each is idempotent)
// ---------------------------------------------------------------------------

async function seedUsers(prisma) {
  const accounts = [
    {
      email: 'admin@pa-penajam.go.id',
      name: 'Administrator',
      role: 'superadmin',
      env: 'SEED_ADMIN_PASSWORD',
      label: 'admin@pa-penajam.go.id',
    },
    {
      email: 'staff@pa-penajam.go.id',
      name: 'Staff Kepaniteraan',
      role: 'staff',
      env: 'SEED_STAFF_PASSWORD',
      label: 'staff@pa-penajam.go.id',
    },
    {
      email: 'editor@pa-penajam.go.id',
      name: 'Editor Humas',
      role: 'editor',
      env: 'SEED_EDITOR_PASSWORD',
      label: 'editor@pa-penajam.go.id',
    },
  ];

  for (const acct of accounts) {
    const existing = await prisma.user.findUnique({ where: { email: acct.email } });
    if (existing) {
      console.log(`[seed] user ${acct.email}: already exists (skip)`);
      continue;
    }
    const plain = resolvePassword(acct.env, acct.label);
    const password = await hashPassword(plain);
    await prisma.user.create({
      data: {
        id: randomUUID(),
        name: acct.name,
        email: acct.email,
        password,
        role: acct.role,
        createdAt: new Date(),
        updatedAt: null,
      },
    });
    console.log(`[seed] user ${acct.email}: created`);
  }
}

async function seedNews(prisma) {
  const count = await prisma.news.count();
  if (count > 0) {
    console.log(`[seed] news: ${count} row(s) exist (skip)`);
    return;
  }
  const now = new Date();
  const publishDate = todayDateOnly();
  await prisma.news.createMany({
    data: [
      {
        id: randomUUID(),
        title: 'Pengadilan Agama Penajam Raih Predikat WBK dari Kemenpan RB',
        content:
          'Pengadilan Agama Penajam berhasil meraih predikat Wilayah Bebas dari Korupsi (WBK) dari Kementerian Pendayagunaan Aparatur Negara dan Reformasi Birokrasi. Penghargaan ini merupakan bukti komitmen seluruh jajaran pengadilan dalam memberikan pelayanan yang bersih, transparan, dan akuntabel kepada masyarakat.',
        image:
          'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80',
        author: 'Humas PA Penajam',
        category: 'Prestasi',
        isPublished: true,
        publishDate,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        title: 'Pelaksanaan Sidang Keliling di Kecamatan Penajam',
        content:
          'Dalam rangka meningkatkan akses keadilan bagi masyarakat, Pengadilan Agama Penajam melaksanakan kegiatan sidang keliling di Kecamatan Penajam.',
        image:
          'https://images.unsplash.com/photo-1575505586569-646b2ca898fc?w=800&q=80',
        author: 'Humas PA Penajam',
        category: 'Kegiatan',
        isPublished: true,
        publishDate,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        title: 'Sosialisasi Layanan e-Court kepada Masyarakat',
        content:
          'Pengadilan Agama Penajam menyelenggarakan sosialisasi layanan e-Court kepada masyarakat Kabupaten Penajam Paser Utara.',
        image:
          'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80',
        author: 'Humas PA Penajam',
        category: 'Sosialisasi',
        isPublished: true,
        publishDate,
        createdAt: now,
        updatedAt: now,
      },
    ],
  });
  console.log('[seed] news: inserted 3 rows');
}

async function seedAnnouncements(prisma) {
  const count = await prisma.announcement.count();
  if (count > 0) {
    console.log(`[seed] announcements: ${count} row(s) exist (skip)`);
    return;
  }
  const now = new Date();
  const publishDate = todayDateOnly();
  await prisma.announcement.createMany({
    data: [
      {
        id: randomUUID(),
        title: 'Jadwal Sidang Bulan Ini',
        content: 'Jadwal sidang tersedia. Silakan cek melalui aplikasi SIPP.',
        isActive: true,
        publishDate,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        title: 'Perubahan Jam Operasional Pelayanan',
        content: 'Pelayanan dibuka Senin-Jumat pukul 08.00-16.00 WITA.',
        isActive: true,
        publishDate,
        createdAt: now,
        updatedAt: now,
      },
    ],
  });
  console.log('[seed] announcements: inserted 2 rows');
}

async function seedServices(prisma) {
  const count = await prisma.service.count();
  if (count > 0) {
    console.log(`[seed] services: ${count} row(s) exist (skip)`);
    return;
  }
  const now = new Date();
  const services = [
    {
      title: 'Pendaftaran Perkara',
      description:
        'Layanan pendaftaran perkara perceraian, waris, hibah, wakaf, dan perkara lainnya.',
      icon: 'FileText',
      order: 1,
    },
    {
      title: 'Informasi Jadwal Sidang',
      description: 'Cek jadwal sidang perkara Anda secara online.',
      icon: 'Calendar',
      order: 2,
    },
    {
      title: 'Informasi Biaya Perkara',
      description: 'Transparansi biaya perkara sesuai ketentuan.',
      icon: 'DollarSign',
      order: 3,
    },
    {
      title: 'Pengambilan Produk Pengadilan',
      description: 'Pengambilan salinan putusan dan akta cerai.',
      icon: 'Package',
      order: 4,
    },
    {
      title: 'Pos Bantuan Hukum',
      description: 'Bantuan hukum gratis bagi masyarakat tidak mampu.',
      icon: 'Shield',
      order: 5,
    },
    {
      title: 'Layanan e-Court',
      description: 'Pendaftaran dan persidangan secara elektronik.',
      icon: 'Monitor',
      order: 6,
    },
  ];
  await prisma.service.createMany({
    data: services.map((s) => ({
      id: randomUUID(),
      ...s,
      isActive: true,
      createdAt: now,
      updatedAt: null,
    })),
  });
  console.log('[seed] services: inserted 6 rows');
}

async function seedCases(prisma) {
  const count = await prisma.caseRecord.count();
  if (count > 0) {
    console.log(`[seed] cases: ${count} row(s) exist (skip)`);
    return;
  }
  const yr = String(new Date().getFullYear());
  const caseTypes = [
    'Cerai Gugat',
    'Cerai Talak',
    'Penetapan Ahli Waris',
    'Itsbat Nikah',
    'Hak Asuh Anak',
    'Dispensasi Kawin',
    'Pembagian Harta Gono Gini',
  ];
  const statuses = ['selesai', 'selesai', 'berjalan', 'berjalan', 'terdaftar'];
  const hakims = [
    'Dr. H. Ahmad Fauzi, S.H., M.H.',
    'Hj. Siti Maryam, S.H.I., M.H.',
  ];
  const cases = Array.from({ length: 8 }, (_, i) => ({
    id: randomUUID(),
    nomorPerkara: `${String(i + 1).padStart(4, '0')}/Pdt.G/${yr}/PA.Pnj`,
    tahun: yr,
    jenisPerkara: caseTypes[i % caseTypes.length],
    pemohon: `Pemohon ${i + 1} bin/binti Orang`,
    termohon: i % 3 === 0 ? '-' : `Termohon ${i + 1} bin/binti Orang`,
    status: statuses[i % statuses.length],
    jadwalSidang: dateOnlyFromOffset((i - 3) * 7),
    ruangSidang: i % 2 === 0 ? 'Ruang Sidang I' : 'Ruang Sidang II',
    hakim: hakims[i % 2],
    createdAt: new Date(Date.now() - i * 7 * 86400000),
    updatedAt: null,
  }));
  await prisma.caseRecord.createMany({ data: cases });
  console.log('[seed] cases: inserted 8 rows');
}

async function seedAgenda(prisma) {
  const count = await prisma.agenda.count();
  if (count > 0) {
    console.log(`[seed] agenda: ${count} row(s) exist (skip)`);
    return;
  }
  const yr = String(new Date().getFullYear());
  const now = new Date();
  const agendaData = Array.from({ length: 6 }, (_, i) => ({
    id: randomUUID(),
    nomorPerkara: `${String(i + 1).padStart(4, '0')}/Pdt.G/${yr}/PA.Pnj`,
    jenisPerkara: ['Cerai Gugat', 'Cerai Talak', 'Itsbat Nikah', 'Waris'][i % 4],
    tanggalSidang: dateOnlyFromOffset((i - 1) * 3),
    waktuSidang: ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00'][i],
    ruangSidang: i % 2 === 0 ? 'Ruang Sidang I' : 'Ruang Sidang II',
    hakim:
      i % 2 === 0
        ? 'Dr. H. Ahmad Fauzi, S.H., M.H.'
        : 'Hj. Siti Maryam, S.H.I., M.H.',
    panitera: 'Drs. Muhammad Nasir',
    status: i < 2 ? 'selesai' : i < 4 ? 'dijadwalkan' : 'ditunda',
    keterangan: i === 4 ? 'Ditunda karena salah satu pihak tidak hadir' : '',
    createdAt: now,
    updatedAt: now,
  }));
  await prisma.agenda.createMany({ data: agendaData });
  console.log('[seed] agenda: inserted 6 rows');
}

async function seedPutusan(prisma) {
  const count = await prisma.decision.count();
  if (count > 0) {
    console.log(`[seed] putusan: ${count} row(s) exist (skip)`);
    return;
  }
  const yr = String(new Date().getFullYear());
  const now = new Date();
  const tanggal = todayDateOnly();
  await prisma.decision.createMany({
    data: [
      {
        id: randomUUID(),
        nomorPerkara: `0001/Pdt.G/${yr}/PA.Pnj`,
        jenisPerkara: 'Cerai Gugat',
        tanggalPutusan: tanggal,
        ringkasanPutusan:
          "Mengabulkan gugatan penggugat. Menjatuhkan talak satu raj'i tergugat kepada penggugat.",
        filePutusan: null,
        hakim: 'Dr. H. Ahmad Fauzi, S.H., M.H.',
        statusPublish: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        nomorPerkara: `0002/Pdt.G/${yr}/PA.Pnj`,
        jenisPerkara: 'Cerai Talak',
        tanggalPutusan: tanggal,
        ringkasanPutusan:
          "Mengabulkan permohonan pemohon. Memberi izin kepada pemohon untuk menjatuhkan talak satu raj'i kepada termohon.",
        filePutusan: null,
        hakim: 'Hj. Siti Maryam, S.H.I., M.H.',
        statusPublish: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  });
  console.log('[seed] putusan: inserted 2 rows');
}

const CORE_SETTINGS = [
  { key: 'court_name', value: 'Pengadilan Agama Penajam' },
  { key: 'court_subtitle', value: 'Kelas I B' },
  { key: 'hero_title', value: 'Pengadilan Agama Penajam' },
  {
    key: 'hero_subtitle',
    value:
      'Memberikan Keadilan yang Cepat, Sederhana, dan Berbiaya Ringan untuk Masyarakat Kabupaten Penajam Paser Utara',
  },
  {
    key: 'address',
    value:
      'Jl. Propinsi Km. 9 Kel. Nipah-Nipah, Kec. Penajam, Kab. Penajam Paser Utara, Kalimantan Timur 76141',
  },
  { key: 'phone', value: '(0542) 7211234' },
  { key: 'email', value: 'pa.penajam@gmail.com' },
  { key: 'website', value: 'pa-penajam.go.id' },
  { key: 'vision', value: 'Terwujudnya Pengadilan Agama Penajam yang Agung' },
  {
    key: 'mission',
    value:
      '1. Menjaga kemandirian badan peradilan\n2. Memberikan pelayanan hukum yang berkeadilan kepada pencari keadilan\n3. Meningkatkan kualitas kepemimpinan badan peradilan\n4. Meningkatkan kredibilitas dan transparansi badan peradilan',
  },
  {
    key: 'history',
    value:
      'Pengadilan Agama Penajam didirikan berdasarkan Keputusan Presiden Republik Indonesia sebagai bagian dari sistem peradilan agama di Indonesia.',
  },
];

const EXTENDED_SETTINGS = [
  { key: 'whatsapp', value: '' },
  { key: 'facebook', value: '' },
  { key: 'instagram', value: '' },
  { key: 'twitter', value: '' },
  { key: 'youtube', value: '' },
  {
    key: 'seo_title',
    value: 'Pengadilan Agama Penajam - Memberikan Keadilan yang Berkeadilan',
  },
  {
    key: 'seo_description',
    value:
      'Website resmi Pengadilan Agama Penajam, Kabupaten Penajam Paser Utara, Kalimantan Timur.',
  },
  {
    key: 'seo_keywords',
    value: 'pengadilan agama, penajam, perceraian, waris, nikah, hukum islam',
  },
  {
    key: 'footer_description',
    value:
      'Pengadilan Agama Penajam adalah lembaga peradilan yang bertugas memberikan keadilan bagi masyarakat Muslim di Kabupaten Penajam Paser Utara.',
  },
  {
    key: 'footer_copyright',
    value: 'Pengadilan Agama Penajam. Hak Cipta Dilindungi.',
  },
  { key: 'analytics_enabled', value: 'true' },
  { key: 'survey_popup_enabled', value: 'false' },
  {
    key: 'footer_hours',
    value: 'Sen–Kam: 08.00–16.00 WITA\nJum: 08.00–11.00 WITA',
  },
  { key: 'footer_links_title', value: 'Tautan Cepat' },
  { key: 'footer_links_title_en', value: 'Quick Links' },
  { key: 'footer_contact_title', value: 'Kontak Kami' },
  { key: 'footer_contact_title_en', value: 'Contact Us' },
  {
    key: 'footer_links',
    // Stays a JSON *string* (Setting.value is Text, not JsonB).
    value: JSON.stringify([
      { label: 'Beranda', labelEn: 'Home', href: '/' },
      { label: 'Agenda Sidang', labelEn: 'Court Schedule', href: '/agenda-sidang' },
      { label: 'Putusan', labelEn: 'Court Decisions', href: '/putusan' },
      {
        label: 'Pencarian Perkara',
        labelEn: 'Case Search',
        href: '/pencarian-perkara',
      },
      { label: 'Galeri Foto', labelEn: 'Photo Gallery', href: '/galeri' },
      { label: 'Dokumen Publik', labelEn: 'Public Documents', href: '/dokumen' },
      { label: 'FAQ', labelEn: 'FAQ', href: '/faq' },
      { label: 'Pengaduan', labelEn: 'Complaints', href: '/pengaduan' },
      { label: 'Aksesibilitas', labelEn: 'Accessibility', href: '/accessibility' },
    ]),
  },
];

async function upsertSettings(prisma, rows) {
  for (const s of rows) {
    await prisma.setting.upsert({
      where: { key: s.key },
      create: { key: s.key, value: s.value },
      update: { value: s.value },
    });
  }
}

async function seedSettings(prisma) {
  // Core settings: only seed when the table is empty (first-run).
  const count = await prisma.setting.count();
  if (count === 0) {
    await upsertSettings(prisma, CORE_SETTINGS);
    console.log(`[seed] settings: inserted ${CORE_SETTINGS.length} core keys`);
  } else {
    console.log(`[seed] settings: ${count} row(s) exist (core skip)`);
  }

  // Extended settings: upsert only keys that are missing (legacy socialExists gate).
  const whatsapp = await prisma.setting.findUnique({ where: { key: 'whatsapp' } });
  if (!whatsapp) {
    await upsertSettings(prisma, EXTENDED_SETTINGS);
    console.log(
      `[seed] settings: inserted ${EXTENDED_SETTINGS.length} extended keys`,
    );
  } else {
    console.log('[seed] settings: extended keys already present (skip)');
  }
}

async function seedSidebarWidgets(prisma) {
  const count = await prisma.sidebarWidget.count();
  if (count > 0) {
    console.log(`[seed] sidebar_widgets: ${count} row(s) exist (skip)`);
    return;
  }
  const now = new Date();
  await prisma.sidebarWidget.createMany({
    data: [
      {
        id: randomUUID(),
        type: 'faq',
        label: 'FAQ',
        labelEn: 'FAQ',
        icon: '❓',
        color: '#1b5e20',
        isActive: true,
        order: 0,
        settings: { limit: 4, title: 'Pertanyaan Umum', showAll: true },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        type: 'stats',
        label: 'Statistik',
        labelEn: 'Stats',
        icon: '📊',
        color: '#d4a017',
        isActive: true,
        order: 1,
        settings: {
          title: 'Statistik',
          showCases: true,
          showVisitors: true,
          days: 30,
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        type: 'contact',
        label: 'Kontak',
        labelEn: 'Contact',
        icon: '📞',
        color: '#2e7d32',
        isActive: true,
        order: 2,
        settings: {
          title: 'Hubungi Kami',
          showPhone: true,
          showEmail: true,
          showHours: true,
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
  });
  console.log('[seed] sidebar_widgets: inserted 3 rows');
}

async function seedPages(prisma) {
  // Count non-homepage pages (legacy: slug ≠ _homepage).
  const count = await prisma.page.count({
    where: { slug: { not: '_homepage' } },
  });
  if (count > 0) {
    console.log(`[seed] pages: ${count} non-homepage row(s) exist (skip)`);
    return;
  }
  const now = new Date();
  await prisma.page.create({
    data: {
      id: randomUUID(),
      title: 'Tentang Pengadilan',
      slug: 'tentang',
      status: 'published',
      blocks: [
        {
          id: randomUUID(),
          type: 'hero',
          settings: {
            title: 'Pengadilan Agama Penajam',
            subtitle:
              'Memberikan keadilan yang cepat, sederhana, dan berbiaya ringan',
            backgroundImage:
              'https://images.unsplash.com/photo-1667849921481-9e13c239ee3d?w=1400&q=80',
            buttonText: 'Lihat Layanan',
            buttonLink: '#layanan',
          },
        },
        {
          id: randomUUID(),
          type: 'text',
          settings: {
            content:
              '<h2>Tentang Kami</h2><p>Pengadilan Agama Penajam adalah pengadilan tingkat pertama yang bertugas memeriksa, memutus, dan menyelesaikan perkara di bidang perkawinan, kewarisan, wasiat, hibah, wakaf, zakat, infaq, shadaqah, dan ekonomi syariah untuk masyarakat Muslim di Kabupaten Penajam Paser Utara.</p>',
          },
        },
        {
          id: randomUUID(),
          type: 'stats',
          settings: {
            items: [
              { number: '500+', label: 'Perkara Diselesaikan' },
              { number: '8', label: 'Hakim Profesional' },
              { number: '20+', label: 'Tahun Pengalaman' },
              { number: '15.000+', label: 'Masyarakat Dilayani' },
            ],
          },
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  });
  console.log('[seed] pages: inserted tentang page');
}

async function seedMenus(prisma) {
  const count = await prisma.menuItem.count();
  if (count > 0) {
    console.log(`[seed] menus: ${count} row(s) exist (skip)`);
    return;
  }
  const now = new Date();
  const menuItems = [
    {
      id: randomUUID(),
      label: 'Beranda',
      labelEn: 'Home',
      url: '#beranda',
      type: 'section',
      icon: '🏠',
      order: 0,
      isActive: true,
      parentId: null,
      description: '',
      descriptionEn: '',
    },
    {
      id: randomUUID(),
      label: 'Profil',
      labelEn: 'Profile',
      url: '#profil',
      type: 'section',
      icon: '🏛️',
      order: 1,
      isActive: true,
      parentId: null,
      description: 'Informasi Pengadilan',
      descriptionEn: 'Court Information',
    },
    {
      id: randomUUID(),
      label: 'Layanan',
      labelEn: 'Services',
      url: '#layanan',
      type: 'section',
      icon: '⚖️',
      order: 2,
      isActive: true,
      parentId: null,
      description: 'Layanan Kepaniteraan',
      descriptionEn: 'Court Services',
    },
    {
      id: randomUUID(),
      label: 'Informasi Perkara',
      labelEn: 'Case Info',
      url: '#perkara',
      type: 'section',
      icon: '🔍',
      order: 3,
      isActive: true,
      parentId: null,
      description: '',
      descriptionEn: '',
    },
    {
      id: randomUUID(),
      label: 'Berita',
      labelEn: 'News',
      url: '#berita',
      type: 'section',
      icon: '📰',
      order: 4,
      isActive: true,
      parentId: null,
      description: '',
      descriptionEn: '',
    },
    {
      id: randomUUID(),
      label: 'Kontak',
      labelEn: 'Contact',
      url: '#kontak',
      type: 'section',
      icon: '📞',
      order: 5,
      isActive: true,
      parentId: null,
      description: '',
      descriptionEn: '',
    },
  ];
  const layananId = menuItems[2].id;
  const subLayanan = [
    {
      id: randomUUID(),
      label: 'Pendaftaran Perkara',
      labelEn: 'Case Registration',
      url: '#layanan',
      type: 'section',
      icon: '📋',
      order: 0,
      isActive: true,
      parentId: layananId,
      description: 'Daftarkan perkara Anda',
      descriptionEn: 'Register your case',
    },
    {
      id: randomUUID(),
      label: 'Agenda Sidang',
      labelEn: 'Court Schedule',
      url: '/agenda-sidang',
      type: 'page',
      icon: '📅',
      order: 1,
      isActive: true,
      parentId: layananId,
      description: 'Jadwal sidang terkini',
      descriptionEn: 'Latest court schedule',
    },
    {
      id: randomUUID(),
      label: 'Informasi Biaya',
      labelEn: 'Fee Information',
      url: '#layanan',
      type: 'section',
      icon: '💰',
      order: 2,
      isActive: true,
      parentId: layananId,
      description: 'Biaya perkara transparan',
      descriptionEn: 'Transparent case fees',
    },
    {
      id: randomUUID(),
      label: 'Putusan',
      labelEn: 'Court Decisions',
      url: '/putusan',
      type: 'page',
      icon: '📄',
      order: 3,
      isActive: true,
      parentId: layananId,
      description: 'Salinan putusan pengadilan',
      descriptionEn: 'Court decision copies',
    },
    {
      id: randomUUID(),
      label: 'Pos Bantuan Hukum',
      labelEn: 'Legal Aid',
      url: '#layanan',
      type: 'section',
      icon: '🛡️',
      order: 4,
      isActive: true,
      parentId: layananId,
      description: 'Bantuan hukum gratis',
      descriptionEn: 'Free legal assistance',
    },
    {
      id: randomUUID(),
      label: 'e-Court',
      labelEn: 'e-Court',
      url: 'https://ecourt.mahkamahagung.go.id',
      type: 'external',
      icon: '💻',
      order: 5,
      isActive: true,
      parentId: layananId,
      description: 'Pendaftaran elektronik',
      descriptionEn: 'Electronic registration',
    },
  ];
  // Parents first (FK Restrict), then children.
  await prisma.menuItem.createMany({
    data: menuItems.map((m) => ({
      ...m,
      description: m.description || null,
      descriptionEn: m.descriptionEn || null,
      createdAt: now,
      updatedAt: now,
    })),
  });
  await prisma.menuItem.createMany({
    data: subLayanan.map((m) => ({
      ...m,
      description: m.description || null,
      descriptionEn: m.descriptionEn || null,
      createdAt: now,
      updatedAt: now,
    })),
  });
  console.log('[seed] menus: inserted top-level + sub-layanan');
}

async function seedGallery(prisma) {
  const count = await prisma.galleryItem.count();
  if (count > 0) {
    console.log(`[seed] gallery: ${count} row(s) exist (skip)`);
    return;
  }
  const now = new Date();
  await prisma.galleryItem.createMany({
    data: [
      {
        id: randomUUID(),
        title: 'Gedung Pengadilan Agama Penajam',
        titleEn: 'Penajam Religious Court Building',
        description: 'Tampak depan gedung pengadilan',
        category: 'Gedung',
        imageUrl:
          'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80',
        isActive: true,
        order: 0,
        createdAt: now,
        updatedAt: null,
      },
      {
        id: randomUUID(),
        title: 'Sidang Keliling 2024',
        titleEn: 'Mobile Court 2024',
        description: 'Pelaksanaan sidang keliling',
        category: 'Kegiatan',
        imageUrl:
          'https://images.unsplash.com/photo-1575505586569-646b2ca898fc?w=800&q=80',
        isActive: true,
        order: 1,
        createdAt: now,
        updatedAt: null,
      },
      {
        id: randomUUID(),
        title: 'Sosialisasi e-Court',
        titleEn: 'e-Court Socialization',
        description: 'Sosialisasi layanan elektronik',
        category: 'Kegiatan',
        imageUrl:
          'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80',
        isActive: true,
        order: 2,
        createdAt: now,
        updatedAt: null,
      },
      {
        id: randomUUID(),
        title: 'Pelayanan Terpadu',
        titleEn: 'Integrated Service',
        description: 'Layanan terpadu satu pintu',
        category: 'Layanan',
        imageUrl:
          'https://images.unsplash.com/photo-1521791055366-0d553872952f?w=800&q=80',
        isActive: true,
        order: 3,
        createdAt: now,
        updatedAt: null,
      },
    ],
  });
  console.log('[seed] gallery: inserted 4 rows');
}

async function seedDocuments(prisma) {
  const count = await prisma.document.count();
  if (count > 0) {
    console.log(`[seed] documents: ${count} row(s) exist (skip)`);
    return;
  }
  const now = new Date();
  await prisma.document.createMany({
    data: [
      {
        id: randomUUID(),
        title: 'Maklumat Pelayanan Pengadilan Agama Penajam',
        titleEn: 'Service Declaration',
        description: 'Maklumat pelayanan publik tahun 2024',
        category: 'Maklumat',
        fileUrl: '',
        fileType: 'pdf',
        isActive: true,
        order: 0,
        downloadCount: 0,
        createdAt: now,
        updatedAt: null,
      },
      {
        id: randomUUID(),
        title: 'Standar Pelayanan (SP) Kepaniteraan',
        titleEn: 'Service Standards',
        description: 'Standar operasional pelayanan kepaniteraan',
        category: 'Standar Pelayanan',
        fileUrl: '',
        fileType: 'pdf',
        isActive: true,
        order: 1,
        downloadCount: 0,
        createdAt: now,
        updatedAt: null,
      },
      {
        id: randomUUID(),
        title: 'Persyaratan Pendaftaran Perkara Cerai Gugat',
        titleEn: 'Divorce Requirements',
        description:
          'Dokumen yang diperlukan untuk pendaftaran perkara cerai gugat',
        category: 'Persyaratan',
        fileUrl: '',
        fileType: 'pdf',
        isActive: true,
        order: 2,
        downloadCount: 0,
        createdAt: now,
        updatedAt: null,
      },
      {
        id: randomUUID(),
        title: 'Biaya Perkara Estimasi 2024',
        titleEn: 'Case Fee Estimate',
        description: 'Estimasi biaya panjar perkara tahun 2024',
        category: 'Biaya',
        fileUrl: '',
        fileType: 'pdf',
        isActive: true,
        order: 3,
        downloadCount: 0,
        createdAt: now,
        updatedAt: null,
      },
    ],
  });
  console.log('[seed] documents: inserted 4 rows');
}

async function seedFaq(prisma) {
  const count = await prisma.faq.count();
  if (count > 0) {
    console.log(`[seed] faq: ${count} row(s) exist (skip)`);
    return;
  }
  const now = new Date();
  await prisma.faq.createMany({
    data: [
      {
        id: randomUUID(),
        question: 'Apa saja perkara yang ditangani Pengadilan Agama?',
        questionEn: 'What cases are handled?',
        answer:
          'Pengadilan Agama menangani perkara perkawinan (cerai gugat, cerai talak, itsbat nikah), kewarisan, wasiat, hibah, wakaf, zakat, infaq, shadaqah, dan ekonomi syariah bagi masyarakat Muslim.',
        answerEn:
          'The Religious Court handles marriage cases, inheritance, and Islamic economic disputes for Muslims.',
        category: 'Umum',
        isActive: true,
        order: 0,
        createdAt: now,
        updatedAt: null,
      },
      {
        id: randomUUID(),
        question: 'Berapa biaya pendaftaran perkara?',
        questionEn: 'How much is case registration?',
        answer:
          'Biaya pendaftaran perkara bervariasi tergantung jenis perkara. Estimasi biaya tersedia di loket informasi atau dapat diunduh di bagian Dokumen.',
        answerEn:
          'Case registration fees vary by type. Fee estimates are available at the information counter.',
        category: 'Biaya',
        isActive: true,
        order: 1,
        createdAt: now,
        updatedAt: null,
      },
      {
        id: randomUUID(),
        question: 'Jam pelayanan pengadilan?',
        questionEn: 'Court service hours?',
        answer:
          'Pelayanan dibuka Senin-Kamis pukul 08:00-16:00 WITA dan Jumat pukul 08:00-11:00 WITA.',
        answerEn:
          'Service hours are Mon-Thu 08:00-16:00 and Fri 08:00-11:00 WITA.',
        category: 'Umum',
        isActive: true,
        order: 2,
        createdAt: now,
        updatedAt: null,
      },
      {
        id: randomUUID(),
        question: 'Bagaimana cara mendaftarkan perkara secara online?',
        questionEn: 'How to register a case online?',
        answer:
          'Pendaftaran online dilakukan melalui portal e-Court Mahkamah Agung di ecourt.mahkamahagung.go.id.',
        answerEn:
          'Online registration is done through the Supreme Court e-Court portal.',
        category: 'e-Court',
        isActive: true,
        order: 3,
        createdAt: now,
        updatedAt: null,
      },
      {
        id: randomUUID(),
        question: 'Berapa lama proses sidang?',
        questionEn: 'How long does the court process take?',
        answer:
          'Durasi proses persidangan bervariasi. Perkara sederhana bisa selesai dalam 1-3 bulan.',
        answerEn:
          'Court process duration varies, typically 1-3 months for simple cases.',
        category: 'Proses',
        isActive: true,
        order: 4,
        createdAt: now,
        updatedAt: null,
      },
      {
        id: randomUUID(),
        question: 'Apa itu Pos Bantuan Hukum (Posbakum)?',
        questionEn: 'What is Legal Aid (Posbakum)?',
        answer:
          'Pos Bantuan Hukum (Posbakum) adalah layanan konsultasi hukum gratis bagi masyarakat tidak mampu, tersedia di lingkungan pengadilan pada jam kerja.',
        answerEn:
          'Posbakum is a free legal consultation service for underprivileged people.',
        category: 'Layanan',
        isActive: true,
        order: 5,
        createdAt: now,
        updatedAt: null,
      },
    ],
  });
  console.log('[seed] faq: inserted 6 rows');
}

async function seedBanners(prisma) {
  const count = await prisma.banner.count();
  if (count > 0) {
    console.log(`[seed] banners: ${count} row(s) exist (skip)`);
    return;
  }
  const now = new Date();
  await prisma.banner.createMany({
    data: [
      {
        id: randomUUID(),
        title: 'Pengadilan Agama Penajam',
        subtitle:
          'Memberikan Keadilan yang Cepat, Sederhana, dan Berbiaya Ringan',
        buttonText: 'Lihat Layanan',
        buttonUrl: '#layanan',
        imageUrl:
          'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1400&q=80',
        bgColor: '#1b5e20',
        textColor: '#ffffff',
        isActive: true,
        order: 0,
        startDate: null,
        endDate: null,
        createdAt: now,
        updatedAt: null,
      },
      {
        id: randomUUID(),
        title: 'Layanan e-Court Tersedia',
        subtitle:
          'Daftarkan perkara Anda secara online, kapan saja dan di mana saja',
        buttonText: 'Daftar e-Court',
        buttonUrl: 'https://ecourt.mahkamahagung.go.id',
        imageUrl:
          'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1400&q=80',
        bgColor: '#d4a017',
        textColor: '#ffffff',
        isActive: true,
        order: 1,
        startDate: null,
        endDate: null,
        createdAt: now,
        updatedAt: null,
      },
    ],
  });
  console.log('[seed] banners: inserted 2 rows');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('[seed] Starting idempotent Prisma seed…');
  const prisma = createPrisma();
  try {
    await seedUsers(prisma);
    await seedNews(prisma);
    await seedAnnouncements(prisma);
    await seedServices(prisma);
    await seedCases(prisma);
    await seedAgenda(prisma);
    await seedPutusan(prisma);
    await seedSettings(prisma);
    await seedSidebarWidgets(prisma);
    await seedPages(prisma);
    await seedMenus(prisma);
    await seedGallery(prisma);
    await seedDocuments(prisma);
    await seedFaq(prisma);
    await seedBanners(prisma);
    console.log('[seed] Done.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed] FAILED:', err?.message || err);
  process.exit(1);
});
