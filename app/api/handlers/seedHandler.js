import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function handleSeed(request, _segments, method) {
  if (method !== 'POST') return null;
  await seedDatabase();
  return NextResponse.json({ message: 'Database berhasil di-seed' });
}

async function seedDatabase() {
  const usersCol = await getCollection('users');
  const existing = await usersCol.findOne({ email: 'admin@pa-penajam.go.id' });
  if (!existing) {
    await usersCol.insertOne({
      id: uuidv4(), name: 'Administrator', email: 'admin@pa-penajam.go.id',
      password: await hashPassword('Admin@1234'), role: 'superadmin', createdAt: new Date().toISOString(),
    });
  }
  const staffExists = await usersCol.findOne({ email: 'staff@pa-penajam.go.id' });
  if (!staffExists) {
    await usersCol.insertOne({
      id: uuidv4(), name: 'Staff Kepaniteraan', email: 'staff@pa-penajam.go.id',
      password: await hashPassword('Staff@1234'), role: 'staff', createdAt: new Date().toISOString(),
    });
  }
  const editorExists = await usersCol.findOne({ email: 'editor@pa-penajam.go.id' });
  if (!editorExists) {
    await usersCol.insertOne({
      id: uuidv4(), name: 'Editor Humas', email: 'editor@pa-penajam.go.id',
      password: await hashPassword('Editor@1234'), role: 'editor', createdAt: new Date().toISOString(),
    });
  }

  const newsCol   = await getCollection('news');
  const newsCount = await newsCol.countDocuments();
  if (newsCount === 0) {
    await newsCol.insertMany([
      { id: uuidv4(), title: 'Pengadilan Agama Penajam Raih Predikat WBK dari Kemenpan RB', content: 'Pengadilan Agama Penajam berhasil meraih predikat Wilayah Bebas dari Korupsi (WBK) dari Kementerian Pendayagunaan Aparatur Negara dan Reformasi Birokrasi. Penghargaan ini merupakan bukti komitmen seluruh jajaran pengadilan dalam memberikan pelayanan yang bersih, transparan, dan akuntabel kepada masyarakat.', image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80', author: 'Humas PA Penajam', category: 'Prestasi', isPublished: true, publishDate: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Pelaksanaan Sidang Keliling di Kecamatan Penajam', content: 'Dalam rangka meningkatkan akses keadilan bagi masyarakat, Pengadilan Agama Penajam melaksanakan kegiatan sidang keliling di Kecamatan Penajam.', image: 'https://images.unsplash.com/photo-1575505586569-646b2ca898fc?w=800&q=80', author: 'Humas PA Penajam', category: 'Kegiatan', isPublished: true, publishDate: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Sosialisasi Layanan e-Court kepada Masyarakat', content: 'Pengadilan Agama Penajam menyelenggarakan sosialisasi layanan e-Court kepada masyarakat Kabupaten Penajam Paser Utara.', image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80', author: 'Humas PA Penajam', category: 'Sosialisasi', isPublished: true, publishDate: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);
  }

  const announcementsCol = await getCollection('announcements');
  const annCount         = await announcementsCol.countDocuments();
  if (annCount === 0) {
    await announcementsCol.insertMany([
      { id: uuidv4(), title: 'Jadwal Sidang Bulan Ini', content: 'Jadwal sidang tersedia. Silakan cek melalui aplikasi SIPP.', isActive: true, publishDate: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Perubahan Jam Operasional Pelayanan', content: 'Pelayanan dibuka Senin-Jumat pukul 08.00-16.00 WITA.', isActive: true, publishDate: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);
  }

  const servicesCol = await getCollection('services');
  const svcCount    = await servicesCol.countDocuments();
  if (svcCount === 0) {
    await servicesCol.insertMany([
      { id: uuidv4(), title: 'Pendaftaran Perkara', description: 'Layanan pendaftaran perkara perceraian, waris, hibah, wakaf, dan perkara lainnya.', icon: 'FileText', order: 1, isActive: true, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Informasi Jadwal Sidang', description: 'Cek jadwal sidang perkara Anda secara online.', icon: 'Calendar', order: 2, isActive: true, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Informasi Biaya Perkara', description: 'Transparansi biaya perkara sesuai ketentuan.', icon: 'DollarSign', order: 3, isActive: true, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Pengambilan Produk Pengadilan', description: 'Pengambilan salinan putusan dan akta cerai.', icon: 'Package', order: 4, isActive: true, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Pos Bantuan Hukum', description: 'Bantuan hukum gratis bagi masyarakat tidak mampu.', icon: 'Shield', order: 5, isActive: true, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Layanan e-Court', description: 'Pendaftaran dan persidangan secara elektronik.', icon: 'Monitor', order: 6, isActive: true, createdAt: new Date().toISOString() },
    ]);
  }

  const yr        = String(new Date().getFullYear());
  const casesCol  = await getCollection('cases');
  const casesCount = await casesCol.countDocuments();
  if (casesCount === 0) {
    const caseTypes = ['Cerai Gugat','Cerai Talak','Penetapan Ahli Waris','Itsbat Nikah','Hak Asuh Anak','Dispensasi Kawin','Pembagian Harta Gono Gini'];
    const statuses  = ['selesai','selesai','berjalan','berjalan','terdaftar'];
    const hakims    = ['Dr. H. Ahmad Fauzi, S.H., M.H.','Hj. Siti Maryam, S.H.I., M.H.'];
    const cases     = Array.from({length: 8}, (_, i) => ({
      id: uuidv4(), nomorPerkara: `${String(i+1).padStart(4,'0')}/Pdt.G/${yr}/PA.Pnj`, tahun: yr,
      jenisPerkara: caseTypes[i % caseTypes.length], pemohon: `Pemohon ${i+1} bin/binti Orang`, termohon: i % 3 === 0 ? '-' : `Termohon ${i+1} bin/binti Orang`,
      status: statuses[i % statuses.length], jadwalSidang: new Date(Date.now() + (i-3)*7*86400000).toISOString().split('T')[0],
      ruangSidang: i % 2 === 0 ? 'Ruang Sidang I' : 'Ruang Sidang II', hakim: hakims[i % 2],
      createdAt: new Date(Date.now() - i * 7 * 86400000).toISOString()
    }));
    await casesCol.insertMany(cases);
  }

  const agendaCol   = await getCollection('agenda');
  const agendaCount = await agendaCol.countDocuments();
  if (agendaCount === 0) {
    const agendaData = Array.from({length: 6}, (_, i) => ({
      id: uuidv4(), nomorPerkara: `${String(i+1).padStart(4,'0')}/Pdt.G/${yr}/PA.Pnj`,
      jenisPerkara: ['Cerai Gugat','Cerai Talak','Itsbat Nikah','Waris'][i % 4],
      tanggalSidang: new Date(Date.now() + (i-1)*3*86400000).toISOString().split('T')[0],
      waktuSidang: ['08:30','09:00','09:30','10:00','10:30','11:00'][i],
      ruangSidang: i % 2 === 0 ? 'Ruang Sidang I' : 'Ruang Sidang II',
      hakim: i % 2 === 0 ? 'Dr. H. Ahmad Fauzi, S.H., M.H.' : 'Hj. Siti Maryam, S.H.I., M.H.',
      panitera: 'Drs. Muhammad Nasir', status: i < 2 ? 'selesai' : i < 4 ? 'dijadwalkan' : 'ditunda',
      keterangan: i === 4 ? 'Ditunda karena salah satu pihak tidak hadir' : '',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    }));
    await agendaCol.insertMany(agendaData);
  }

  const putusanCol   = await getCollection('putusan');
  const putusanCount = await putusanCol.countDocuments();
  if (putusanCount === 0) {
    await putusanCol.insertMany([
      { id: uuidv4(), nomorPerkara: `0001/Pdt.G/${yr}/PA.Pnj`, jenisPerkara: 'Cerai Gugat', tanggalPutusan: new Date().toISOString().split('T')[0], ringkasanPutusan: "Mengabulkan gugatan penggugat. Menjatuhkan talak satu raj'i tergugat kepada penggugat.", filePutusan: null, hakim: 'Dr. H. Ahmad Fauzi, S.H., M.H.', statusPublish: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uuidv4(), nomorPerkara: `0002/Pdt.G/${yr}/PA.Pnj`, jenisPerkara: 'Cerai Talak', tanggalPutusan: new Date().toISOString().split('T')[0], ringkasanPutusan: "Mengabulkan permohonan pemohon. Memberi izin kepada pemohon untuk menjatuhkan talak satu raj'i kepada termohon.", filePutusan: null, hakim: 'Hj. Siti Maryam, S.H.I., M.H.', statusPublish: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);
  }

  const settingsCol   = await getCollection('settings');
  const settingsCount = await settingsCol.countDocuments();
  if (settingsCount === 0) {
    const settingsData = [
      { key: 'court_name',    value: 'Pengadilan Agama Penajam' },
      { key: 'court_subtitle', value: 'Kelas I B' },
      { key: 'hero_title',    value: 'Pengadilan Agama Penajam' },
      { key: 'hero_subtitle', value: 'Memberikan Keadilan yang Cepat, Sederhana, dan Berbiaya Ringan untuk Masyarakat Kabupaten Penajam Paser Utara' },
      { key: 'address',       value: 'Jl. Propinsi Km. 9 Kel. Nipah-Nipah, Kec. Penajam, Kab. Penajam Paser Utara, Kalimantan Timur 76141' },
      { key: 'phone',         value: '(0542) 7211234' },
      { key: 'email',         value: 'pa.penajam@gmail.com' },
      { key: 'website',       value: 'pa-penajam.go.id' },
      { key: 'vision',        value: 'Terwujudnya Pengadilan Agama Penajam yang Agung' },
      { key: 'mission',       value: '1. Menjaga kemandirian badan peradilan\n2. Memberikan pelayanan hukum yang berkeadilan kepada pencari keadilan\n3. Meningkatkan kualitas kepemimpinan badan peradilan\n4. Meningkatkan kredibilitas dan transparansi badan peradilan' },
      { key: 'history',       value: 'Pengadilan Agama Penajam didirikan berdasarkan Keputusan Presiden Republik Indonesia sebagai bagian dari sistem peradilan agama di Indonesia.' },
    ];
    for (const s of settingsData) {
      await settingsCol.updateOne({ key: s.key }, { $set: s }, { upsert: true });
    }
  }

  const sidebarWidgetsCol = await getCollection('sidebar_widgets');
  const swCount           = await sidebarWidgetsCol.countDocuments();
  if (swCount === 0) {
    await sidebarWidgetsCol.insertMany([
      { id: uuidv4(), type: 'faq',     label: 'FAQ',       labelEn: 'FAQ',     icon: '❓', color: '#1b5e20', isActive: true, order: 0, settings: { limit: 4, title: 'Pertanyaan Umum', showAll: true }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uuidv4(), type: 'stats',   label: 'Statistik', labelEn: 'Stats',   icon: '📊', color: '#d4a017', isActive: true, order: 1, settings: { title: 'Statistik', showCases: true, showVisitors: true, days: 30 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uuidv4(), type: 'contact', label: 'Kontak',    labelEn: 'Contact', icon: '📞', color: '#2e7d32', isActive: true, order: 2, settings: { title: 'Hubungi Kami', showPhone: true, showEmail: true, showHours: true }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);
  }

  const pagesCol   = await getCollection('pages');
  const pagesCount = await pagesCol.countDocuments({ slug: { $ne: '_homepage' } });
  if (pagesCount === 0) {
    await pagesCol.insertOne({
      id: uuidv4(), title: 'Tentang Pengadilan', slug: 'tentang', status: 'published',
      blocks: [
        { id: uuidv4(), type: 'hero',  settings: { title: 'Pengadilan Agama Penajam', subtitle: 'Memberikan keadilan yang cepat, sederhana, dan berbiaya ringan', backgroundImage: 'https://images.unsplash.com/photo-1667849921481-9e13c239ee3d?w=1400&q=80', buttonText: 'Lihat Layanan', buttonLink: '#layanan' } },
        { id: uuidv4(), type: 'text',  settings: { content: '<h2>Tentang Kami</h2><p>Pengadilan Agama Penajam adalah pengadilan tingkat pertama yang bertugas memeriksa, memutus, dan menyelesaikan perkara di bidang perkawinan, kewarisan, wasiat, hibah, wakaf, zakat, infaq, shadaqah, dan ekonomi syariah untuk masyarakat Muslim di Kabupaten Penajam Paser Utara.</p>' } },
        { id: uuidv4(), type: 'stats', settings: { items: [{ number: '500+', label: 'Perkara Diselesaikan' },{ number: '8', label: 'Hakim Profesional' },{ number: '20+', label: 'Tahun Pengalaman' },{ number: '15.000+', label: 'Masyarakat Dilayani' }] } },
      ],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
  }

  const menusCol   = await getCollection('menus');
  const menusCount = await menusCol.countDocuments();
  if (menusCount === 0) {
    const menuItems = [
      { id: uuidv4(), label: 'Beranda',          labelEn: 'Home',      url: '#beranda', type: 'section', icon: '🏠',  order: 0, isActive: true, parentId: null, description: '',                    descriptionEn: '' },
      { id: uuidv4(), label: 'Profil',            labelEn: 'Profile',   url: '#profil',  type: 'section', icon: '🏛️',  order: 1, isActive: true, parentId: null, description: 'Informasi Pengadilan', descriptionEn: 'Court Information' },
      { id: uuidv4(), label: 'Layanan',           labelEn: 'Services',  url: '#layanan', type: 'section', icon: '⚖️',  order: 2, isActive: true, parentId: null, description: 'Layanan Kepaniteraan', descriptionEn: 'Court Services' },
      { id: uuidv4(), label: 'Informasi Perkara', labelEn: 'Case Info', url: '#perkara', type: 'section', icon: '🔍',  order: 3, isActive: true, parentId: null, description: '',                    descriptionEn: '' },
      { id: uuidv4(), label: 'Berita',            labelEn: 'News',      url: '#berita',  type: 'section', icon: '📰',  order: 4, isActive: true, parentId: null, description: '',                    descriptionEn: '' },
      { id: uuidv4(), label: 'Kontak',            labelEn: 'Contact',   url: '#kontak',  type: 'section', icon: '📞',  order: 5, isActive: true, parentId: null, description: '',                    descriptionEn: '' },
    ];
    const layananId  = menuItems[2].id;
    const subLayanan = [
      { id: uuidv4(), label: 'Pendaftaran Perkara', labelEn: 'Case Registration', url: '#layanan',                                type: 'section',  icon: '📋', order: 0, isActive: true, parentId: layananId, description: 'Daftarkan perkara Anda',    descriptionEn: 'Register your case' },
      { id: uuidv4(), label: 'Agenda Sidang',       labelEn: 'Court Schedule',    url: '/agenda-sidang',                          type: 'page',     icon: '📅', order: 1, isActive: true, parentId: layananId, description: 'Jadwal sidang terkini',     descriptionEn: 'Latest court schedule' },
      { id: uuidv4(), label: 'Informasi Biaya',     labelEn: 'Fee Information',   url: '#layanan',                                type: 'section',  icon: '💰', order: 2, isActive: true, parentId: layananId, description: 'Biaya perkara transparan',  descriptionEn: 'Transparent case fees' },
      { id: uuidv4(), label: 'Putusan',             labelEn: 'Court Decisions',   url: '/putusan',                                type: 'page',     icon: '📄', order: 3, isActive: true, parentId: layananId, description: 'Salinan putusan pengadilan',descriptionEn: 'Court decision copies' },
      { id: uuidv4(), label: 'Pos Bantuan Hukum',   labelEn: 'Legal Aid',         url: '#layanan',                                type: 'section',  icon: '🛡️', order: 4, isActive: true, parentId: layananId, description: 'Bantuan hukum gratis',      descriptionEn: 'Free legal assistance' },
      { id: uuidv4(), label: 'e-Court',             labelEn: 'e-Court',           url: 'https://ecourt.mahkamahagung.go.id',       type: 'external', icon: '💻', order: 5, isActive: true, parentId: layananId, description: 'Pendaftaran elektronik',    descriptionEn: 'Electronic registration' },
    ];
    await menusCol.insertMany([...menuItems, ...subLayanan].map(m => ({ ...m, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })));
  }

  const galleryCol   = await getCollection('gallery');
  const galleryCount = await galleryCol.countDocuments();
  if (galleryCount === 0) {
    await galleryCol.insertMany([
      { id: uuidv4(), title: 'Gedung Pengadilan Agama Penajam', titleEn: 'Penajam Religious Court Building', description: 'Tampak depan gedung pengadilan',     category: 'Gedung',   imageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80', isActive: true, order: 0, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Sidang Keliling 2024',            titleEn: 'Mobile Court 2024',               description: 'Pelaksanaan sidang keliling',         category: 'Kegiatan', imageUrl: 'https://images.unsplash.com/photo-1575505586569-646b2ca898fc?w=800&q=80', isActive: true, order: 1, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Sosialisasi e-Court',             titleEn: 'e-Court Socialization',           description: 'Sosialisasi layanan elektronik',      category: 'Kegiatan', imageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80', isActive: true, order: 2, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Pelayanan Terpadu',               titleEn: 'Integrated Service',              description: 'Layanan terpadu satu pintu',          category: 'Layanan',  imageUrl: 'https://images.unsplash.com/photo-1521791055366-0d553872952f?w=800&q=80', isActive: true, order: 3, createdAt: new Date().toISOString() },
    ]);
  }

  const docsCol   = await getCollection('documents');
  const docsCount = await docsCol.countDocuments();
  if (docsCount === 0) {
    await docsCol.insertMany([
      { id: uuidv4(), title: 'Maklumat Pelayanan Pengadilan Agama Penajam', titleEn: 'Service Declaration',  description: 'Maklumat pelayanan publik tahun 2024',                        category: 'Maklumat',         fileUrl: '', fileType: 'pdf', isActive: true, order: 0, downloadCount: 0, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Standar Pelayanan (SP) Kepaniteraan',         titleEn: 'Service Standards',    description: 'Standar operasional pelayanan kepaniteraan',                 category: 'Standar Pelayanan', fileUrl: '', fileType: 'pdf', isActive: true, order: 1, downloadCount: 0, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Persyaratan Pendaftaran Perkara Cerai Gugat', titleEn: 'Divorce Requirements', description: 'Dokumen yang diperlukan untuk pendaftaran perkara cerai gugat',category: 'Persyaratan',      fileUrl: '', fileType: 'pdf', isActive: true, order: 2, downloadCount: 0, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Biaya Perkara Estimasi 2024',                 titleEn: 'Case Fee Estimate',    description: 'Estimasi biaya panjar perkara tahun 2024',                   category: 'Biaya',            fileUrl: '', fileType: 'pdf', isActive: true, order: 3, downloadCount: 0, createdAt: new Date().toISOString() },
    ]);
  }

  const faqCol   = await getCollection('faq');
  const faqCount = await faqCol.countDocuments();
  if (faqCount === 0) {
    await faqCol.insertMany([
      { id: uuidv4(), question: 'Apa saja perkara yang ditangani Pengadilan Agama?',       questionEn: 'What cases are handled?',           answer: 'Pengadilan Agama menangani perkara perkawinan (cerai gugat, cerai talak, itsbat nikah), kewarisan, wasiat, hibah, wakaf, zakat, infaq, shadaqah, dan ekonomi syariah bagi masyarakat Muslim.',                                                 answerEn: 'The Religious Court handles marriage cases, inheritance, and Islamic economic disputes for Muslims.', category: 'Umum',    isActive: true, order: 0, createdAt: new Date().toISOString() },
      { id: uuidv4(), question: 'Berapa biaya pendaftaran perkara?',                        questionEn: 'How much is case registration?',     answer: 'Biaya pendaftaran perkara bervariasi tergantung jenis perkara. Estimasi biaya tersedia di loket informasi atau dapat diunduh di bagian Dokumen.',                                                                                              answerEn: 'Case registration fees vary by type. Fee estimates are available at the information counter.',       category: 'Biaya',   isActive: true, order: 1, createdAt: new Date().toISOString() },
      { id: uuidv4(), question: 'Jam pelayanan pengadilan?',                                questionEn: 'Court service hours?',               answer: 'Pelayanan dibuka Senin-Kamis pukul 08:00-16:00 WITA dan Jumat pukul 08:00-11:00 WITA.',                                                                                                                                                      answerEn: 'Service hours are Mon-Thu 08:00-16:00 and Fri 08:00-11:00 WITA.',                                   category: 'Umum',    isActive: true, order: 2, createdAt: new Date().toISOString() },
      { id: uuidv4(), question: 'Bagaimana cara mendaftarkan perkara secara online?',       questionEn: 'How to register a case online?',     answer: 'Pendaftaran online dilakukan melalui portal e-Court Mahkamah Agung di ecourt.mahkamahagung.go.id.',                                                                                                                                          answerEn: 'Online registration is done through the Supreme Court e-Court portal.',                             category: 'e-Court', isActive: true, order: 3, createdAt: new Date().toISOString() },
      { id: uuidv4(), question: 'Berapa lama proses sidang?',                               questionEn: 'How long does the court process take?', answer: 'Durasi proses persidangan bervariasi. Perkara sederhana bisa selesai dalam 1-3 bulan.',                                                                                                                                                    answerEn: 'Court process duration varies, typically 1-3 months for simple cases.',                             category: 'Proses',  isActive: true, order: 4, createdAt: new Date().toISOString() },
      { id: uuidv4(), question: 'Apa itu Pos Bantuan Hukum (Posbakum)?',                   questionEn: 'What is Legal Aid (Posbakum)?',      answer: 'Pos Bantuan Hukum (Posbakum) adalah layanan konsultasi hukum gratis bagi masyarakat tidak mampu, tersedia di lingkungan pengadilan pada jam kerja.',                                                                                       answerEn: 'Posbakum is a free legal consultation service for underprivileged people.',                         category: 'Layanan', isActive: true, order: 5, createdAt: new Date().toISOString() },
    ]);
  }

  const bannersCol   = await getCollection('banners');
  const bannersCount = await bannersCol.countDocuments();
  if (bannersCount === 0) {
    await bannersCol.insertMany([
      { id: uuidv4(), title: 'Pengadilan Agama Penajam',  subtitle: 'Memberikan Keadilan yang Cepat, Sederhana, dan Berbiaya Ringan', buttonText: 'Lihat Layanan', buttonUrl: '#layanan',                           imageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1400&q=80', bgColor: '#1b5e20', textColor: '#ffffff', isActive: true, order: 0, startDate: '', endDate: '', createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Layanan e-Court Tersedia',  subtitle: 'Daftarkan perkara Anda secara online, kapan saja dan di mana saja', buttonText: 'Daftar e-Court', buttonUrl: 'https://ecourt.mahkamahagung.go.id', imageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1400&q=80', bgColor: '#d4a017', textColor: '#ffffff', isActive: true, order: 1, startDate: '', endDate: '', createdAt: new Date().toISOString() },
    ]);
  }

  const settingsCol2   = await getCollection('settings');
  const socialExists   = await settingsCol2.findOne({ key: 'whatsapp' });
  if (!socialExists) {
    const newSettings = [
      { key: 'whatsapp', value: '' }, { key: 'facebook', value: '' }, { key: 'instagram', value: '' },
      { key: 'twitter',  value: '' }, { key: 'youtube',  value: '' },
      { key: 'seo_title',       value: 'Pengadilan Agama Penajam - Memberikan Keadilan yang Berkeadilan' },
      { key: 'seo_description', value: 'Website resmi Pengadilan Agama Penajam, Kabupaten Penajam Paser Utara, Kalimantan Timur.' },
      { key: 'seo_keywords',    value: 'pengadilan agama, penajam, perceraian, waris, nikah, hukum islam' },
      { key: 'footer_description', value: 'Pengadilan Agama Penajam adalah lembaga peradilan yang bertugas memberikan keadilan bagi masyarakat Muslim di Kabupaten Penajam Paser Utara.' },
      { key: 'footer_copyright',   value: 'Pengadilan Agama Penajam. Hak Cipta Dilindungi.' },
      { key: 'analytics_enabled',  value: 'true' },
      { key: 'survey_popup_enabled', value: 'false' },
      { key: 'footer_hours',          value: 'Sen–Kam: 08.00–16.00 WITA\nJum: 08.00–11.00 WITA' },
      { key: 'footer_links_title',    value: 'Tautan Cepat' },
      { key: 'footer_links_title_en', value: 'Quick Links' },
      { key: 'footer_contact_title',    value: 'Kontak Kami' },
      { key: 'footer_contact_title_en', value: 'Contact Us' },
      { key: 'footer_links', value: JSON.stringify([
        { label: 'Beranda',           labelEn: 'Home',             href: '/' },
        { label: 'Agenda Sidang',     labelEn: 'Court Schedule',   href: '/agenda-sidang' },
        { label: 'Putusan',           labelEn: 'Court Decisions',  href: '/putusan' },
        { label: 'Pencarian Perkara', labelEn: 'Case Search',      href: '/pencarian-perkara' },
        { label: 'Galeri Foto',       labelEn: 'Photo Gallery',    href: '/galeri' },
        { label: 'Dokumen Publik',    labelEn: 'Public Documents', href: '/dokumen' },
        { label: 'FAQ',               labelEn: 'FAQ',              href: '/faq' },
        { label: 'Pengaduan',         labelEn: 'Complaints',       href: '/pengaduan' },
        { label: 'Aksesibilitas',     labelEn: 'Accessibility',    href: '/accessibility' },
      ]) },
    ];
    for (const s of newSettings) {
      await settingsCol2.updateOne({ key: s.key }, { $set: s }, { upsert: true });
    }
  }
}
