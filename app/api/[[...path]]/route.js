import { NextResponse } from 'next/server';
import { connectDB, getCollection } from '@/lib/db';
import { generateToken, hashPassword, comparePassword, requireAuth } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

async function handleRequest(request, pathSegments, method) {
  await connectDB();
  const [segment1, segment2, segment3] = pathSegments;

  // ==================== AUTH ====================
  if (segment1 === 'auth') {
    if (segment2 === 'login' && method === 'POST') {
      const { email, password } = await request.json();
      const users = await getCollection('users');
      const user = await users.findOne({ email: email.toLowerCase() });
      if (!user) return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
      const valid = await comparePassword(password, user.password);
      if (!valid) return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
      const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role });
      return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    }
    if (segment2 === 'verify' && method === 'GET') {
      const user = requireAuth(request);
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return NextResponse.json({ user });
    }
  }

  // ==================== SEED ====================
  if (segment1 === 'seed' && method === 'POST') {
    await seedDatabase();
    return NextResponse.json({ message: 'Database berhasil di-seed' });
  }

  // ==================== STATS ====================
  if (segment1 === 'stats' && method === 'GET') {
    const user = requireAuth(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const news = await getCollection('news');
    const announcements = await getCollection('announcements');
    const services = await getCollection('services');
    const cases = await getCollection('cases');
    const users = await getCollection('users');
    const [totalNews, totalAnnouncements, totalServices, totalCases, totalUsers] = await Promise.all([
      news.countDocuments(),
      announcements.countDocuments(),
      services.countDocuments(),
      cases.countDocuments(),
      users.countDocuments(),
    ]);
    const casesThisYear = await cases.countDocuments({ tahun: String(new Date().getFullYear()) });
    const casesDone = await cases.countDocuments({ status: 'selesai' });
    const casesOngoing = await cases.countDocuments({ status: 'berjalan' });
    return NextResponse.json({ totalNews, totalAnnouncements, totalServices, totalCases, totalUsers, casesThisYear, casesDone, casesOngoing });
  }

  // ==================== NEWS ====================
  if (segment1 === 'news') {
    const col = await getCollection('news');
    if (!segment2) {
      if (method === 'GET') {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const search = url.searchParams.get('search') || '';
        const publicOnly = url.searchParams.get('public') === 'true';
        const query = {};
        if (search) query.title = { $regex: search, $options: 'i' };
        if (publicOnly) query.isPublished = true;
        const total = await col.countDocuments(query);
        const items = await col.find(query).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).toArray();
        return NextResponse.json({ items, total, page, totalPages: Math.ceil(total/limit) });
      }
      if (method === 'POST') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const item = { id: uuidv4(), ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await col.insertOne(item);
        return NextResponse.json(item, { status: 201 });
      }
    }
    if (segment2) {
      const item = await col.findOne({ id: segment2 });
      if (method === 'GET') {
        if (!item) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
        return NextResponse.json(item);
      }
      if (method === 'PUT') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        await col.updateOne({ id: segment2 }, { $set: { ...body, updatedAt: new Date().toISOString() } });
        return NextResponse.json({ ...item, ...body });
      }
      if (method === 'DELETE') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        await col.deleteOne({ id: segment2 });
        return NextResponse.json({ message: 'Berhasil dihapus' });
      }
    }
  }

  // ==================== ANNOUNCEMENTS ====================
  if (segment1 === 'announcements') {
    const col = await getCollection('announcements');
    if (!segment2) {
      if (method === 'GET') {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const search = url.searchParams.get('search') || '';
        const publicOnly = url.searchParams.get('public') === 'true';
        const query = {};
        if (search) query.title = { $regex: search, $options: 'i' };
        if (publicOnly) query.isActive = true;
        const total = await col.countDocuments(query);
        const items = await col.find(query).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).toArray();
        return NextResponse.json({ items, total, page, totalPages: Math.ceil(total/limit) });
      }
      if (method === 'POST') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const item = { id: uuidv4(), ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await col.insertOne(item);
        return NextResponse.json(item, { status: 201 });
      }
    }
    if (segment2) {
      if (method === 'GET') {
        const item = await col.findOne({ id: segment2 });
        if (!item) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
        return NextResponse.json(item);
      }
      if (method === 'PUT') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        await col.updateOne({ id: segment2 }, { $set: { ...body, updatedAt: new Date().toISOString() } });
        const item = await col.findOne({ id: segment2 });
        return NextResponse.json(item);
      }
      if (method === 'DELETE') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        await col.deleteOne({ id: segment2 });
        return NextResponse.json({ message: 'Berhasil dihapus' });
      }
    }
  }

  // ==================== SERVICES ====================
  if (segment1 === 'services') {
    const col = await getCollection('services');
    if (!segment2) {
      if (method === 'GET') {
        const items = await col.find({}).sort({ order: 1 }).toArray();
        return NextResponse.json({ items });
      }
      if (method === 'POST') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const item = { id: uuidv4(), ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await col.insertOne(item);
        return NextResponse.json(item, { status: 201 });
      }
    }
    if (segment2) {
      if (method === 'GET') {
        const item = await col.findOne({ id: segment2 });
        if (!item) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
        return NextResponse.json(item);
      }
      if (method === 'PUT') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        await col.updateOne({ id: segment2 }, { $set: { ...body, updatedAt: new Date().toISOString() } });
        const item = await col.findOne({ id: segment2 });
        return NextResponse.json(item);
      }
      if (method === 'DELETE') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        await col.deleteOne({ id: segment2 });
        return NextResponse.json({ message: 'Berhasil dihapus' });
      }
    }
  }

  // ==================== CASES ====================
  if (segment1 === 'cases') {
    const col = await getCollection('cases');
    if (!segment2) {
      if (method === 'GET') {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const search = url.searchParams.get('search') || '';
        const tahun = url.searchParams.get('tahun') || '';
        const query = {};
        if (search) query.nomorPerkara = { $regex: search, $options: 'i' };
        if (tahun) query.tahun = tahun;
        const total = await col.countDocuments(query);
        const items = await col.find(query).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).toArray();
        return NextResponse.json({ items, total, page, totalPages: Math.ceil(total/limit) });
      }
      if (method === 'POST') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const item = { id: uuidv4(), ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await col.insertOne(item);
        return NextResponse.json(item, { status: 201 });
      }
    }
    if (segment2) {
      if (method === 'GET') {
        const item = await col.findOne({ id: segment2 });
        if (!item) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
        return NextResponse.json(item);
      }
      if (method === 'PUT') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        await col.updateOne({ id: segment2 }, { $set: { ...body, updatedAt: new Date().toISOString() } });
        const item = await col.findOne({ id: segment2 });
        return NextResponse.json(item);
      }
      if (method === 'DELETE') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        await col.deleteOne({ id: segment2 });
        return NextResponse.json({ message: 'Berhasil dihapus' });
      }
    }
  }

  // ==================== USERS ====================
  if (segment1 === 'users') {
    const col = await getCollection('users');
    if (!segment2) {
      if (method === 'GET') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const items = await col.find({}, { projection: { password: 0 } }).sort({ createdAt: -1 }).toArray();
        return NextResponse.json({ items });
      }
      if (method === 'POST') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const exists = await col.findOne({ email: body.email.toLowerCase() });
        if (exists) return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 });
        const hashedPwd = await hashPassword(body.password);
        const item = { id: uuidv4(), name: body.name, email: body.email.toLowerCase(), password: hashedPwd, role: body.role || 'admin', createdAt: new Date().toISOString() };
        await col.insertOne(item);
        const { password: _, ...safeUser } = item;
        return NextResponse.json(safeUser, { status: 201 });
      }
    }
    if (segment2) {
      if (method === 'PUT') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const update = { name: body.name, email: body.email, role: body.role, updatedAt: new Date().toISOString() };
        if (body.password) update.password = await hashPassword(body.password);
        await col.updateOne({ id: segment2 }, { $set: update });
        const item = await col.findOne({ id: segment2 }, { projection: { password: 0 } });
        return NextResponse.json(item);
      }
      if (method === 'DELETE') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        await col.deleteOne({ id: segment2 });
        return NextResponse.json({ message: 'Berhasil dihapus' });
      }
    }
  }

  // ==================== SETTINGS ====================
  if (segment1 === 'settings') {
    const col = await getCollection('settings');
    if (method === 'GET') {
      const settings = await col.find({}).toArray();
      const result = {};
      settings.forEach(s => { result[s.key] = s.value; });
      return NextResponse.json(result);
    }
    if (method === 'PUT') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      for (const [key, value] of Object.entries(body)) {
        await col.updateOne({ key }, { $set: { key, value } }, { upsert: true });
      }
      return NextResponse.json({ message: 'Pengaturan berhasil disimpan' });
    }
  }

  return NextResponse.json({ error: 'Route tidak ditemukan' }, { status: 404 });
}

// Seed function
async function seedDatabase() {
  const { hashPassword: hp } = await import('@/lib/auth');

  const usersCol = await getCollection('users');
  const existing = await usersCol.findOne({ email: 'admin@pa-penajam.go.id' });
  if (!existing) {
    await usersCol.insertOne({
      id: uuidv4(),
      name: 'Administrator',
      email: 'admin@pa-penajam.go.id',
      password: await hp('Admin@1234'),
      role: 'superadmin',
      createdAt: new Date().toISOString(),
    });
  }

  const newsCol = await getCollection('news');
  const newsCount = await newsCol.countDocuments();
  if (newsCount === 0) {
    const newsData = [
      {
        id: uuidv4(),
        title: 'Pengadilan Agama Penajam Raih Predikat WBK dari Kemenpan RB',
        content: 'Pengadilan Agama Penajam berhasil meraih predikat Wilayah Bebas dari Korupsi (WBK) dari Kementerian Pendayagunaan Aparatur Negara dan Reformasi Birokrasi. Penghargaan ini merupakan bukti komitmen seluruh jajaran pengadilan dalam memberikan pelayanan yang bersih, transparan, dan akuntabel kepada masyarakat.',
        image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80',
        author: 'Humas PA Penajam',
        category: 'Prestasi',
        isPublished: true,
        publishDate: '2025-05-15',
        createdAt: new Date('2025-05-15').toISOString(),
        updatedAt: new Date('2025-05-15').toISOString(),
      },
      {
        id: uuidv4(),
        title: 'Pelaksanaan Sidang Keliling di Kecamatan Penajam',
        content: 'Dalam rangka meningkatkan akses keadilan bagi masyarakat, Pengadilan Agama Penajam melaksanakan kegiatan sidang keliling di Kecamatan Penajam. Kegiatan ini dihadiri oleh ratusan masyarakat yang membutuhkan layanan hukum di bidang perkawinan, waris, dan sengketa keluarga.',
        image: 'https://images.unsplash.com/photo-1575505586569-646b2ca898fc?w=800&q=80',
        author: 'Humas PA Penajam',
        category: 'Kegiatan',
        isPublished: true,
        publishDate: '2025-04-20',
        createdAt: new Date('2025-04-20').toISOString(),
        updatedAt: new Date('2025-04-20').toISOString(),
      },
      {
        id: uuidv4(),
        title: 'Sosialisasi Layanan e-Court kepada Masyarakat Penajam Paser Utara',
        content: 'Pengadilan Agama Penajam menyelenggarakan sosialisasi layanan e-Court kepada masyarakat Kabupaten Penajam Paser Utara. Melalui layanan ini, masyarakat dapat mendaftarkan perkara secara online, membayar panjar biaya perkara, serta mengikuti persidangan secara elektronik dari mana saja.',
        image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80',
        author: 'Humas PA Penajam',
        category: 'Sosialisasi',
        isPublished: true,
        publishDate: '2025-03-10',
        createdAt: new Date('2025-03-10').toISOString(),
        updatedAt: new Date('2025-03-10').toISOString(),
      },
      {
        id: uuidv4(),
        title: 'Kunjungan Kerja Ketua Pengadilan Tinggi Agama Samarinda',
        content: 'Ketua Pengadilan Tinggi Agama Samarinda melakukan kunjungan kerja ke Pengadilan Agama Penajam dalam rangka monitoring dan evaluasi kinerja. Dalam kunjungan tersebut, ketua PTA memberikan arahan mengenai peningkatan kualitas pelayanan dan penyelesaian perkara secara cepat, sederhana, dan berbiaya ringan.',
        image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&q=80',
        author: 'Humas PA Penajam',
        category: 'Kunjungan',
        isPublished: true,
        publishDate: '2025-02-28',
        createdAt: new Date('2025-02-28').toISOString(),
        updatedAt: new Date('2025-02-28').toISOString(),
      },
      {
        id: uuidv4(),
        title: 'Program Bantuan Hukum Gratis bagi Masyarakat Kurang Mampu',
        content: 'Pengadilan Agama Penajam membuka program Pos Bantuan Hukum (Posbakum) untuk memberikan bantuan hukum gratis bagi masyarakat kurang mampu. Program ini bertujuan untuk memastikan semua lapisan masyarakat mendapatkan akses keadilan yang setara tanpa hambatan biaya.',
        image: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80',
        author: 'Humas PA Penajam',
        category: 'Layanan',
        isPublished: true,
        publishDate: '2025-01-15',
        createdAt: new Date('2025-01-15').toISOString(),
        updatedAt: new Date('2025-01-15').toISOString(),
      },
    ];
    await newsCol.insertMany(newsData);
  }

  const announcementsCol = await getCollection('announcements');
  const annCount = await announcementsCol.countDocuments();
  if (annCount === 0) {
    const annData = [
      {
        id: uuidv4(),
        title: 'Jadwal Sidang Bulan Juni 2025',
        content: 'Jadwal sidang Pengadilan Agama Penajam untuk bulan Juni 2025 telah tersedia. Pihak-pihak yang terlibat dalam perkara dapat mengecek jadwal sidang melalui aplikasi SIPP atau datang langsung ke kantor pengadilan.',
        isActive: true,
        publishDate: '2025-06-01',
        createdAt: new Date('2025-06-01').toISOString(),
        updatedAt: new Date('2025-06-01').toISOString(),
      },
      {
        id: uuidv4(),
        title: 'Perubahan Jam Operasional Pelayanan',
        content: 'Mulai tanggal 1 Juni 2025, jam operasional pelayanan Pengadilan Agama Penajam mengalami perubahan. Pelayanan dibuka setiap hari Senin - Jumat pukul 08.00 - 16.00 WITA. Hari Jumat pelayanan ditutup pukul 11.30 untuk shalat Jumat dan dibuka kembali pukul 13.30.',
        isActive: true,
        publishDate: '2025-05-28',
        createdAt: new Date('2025-05-28').toISOString(),
        updatedAt: new Date('2025-05-28').toISOString(),
      },
      {
        id: uuidv4(),
        title: 'Pengumuman Rekrutmen Tenaga Honorer',
        content: 'Pengadilan Agama Penajam membuka pendaftaran tenaga honorer untuk posisi staf administrasi dan petugas keamanan. Pendaftaran dibuka mulai tanggal 10-25 Juni 2025. Informasi lengkap dapat dilihat di papan pengumuman kantor.',
        isActive: true,
        publishDate: '2025-05-20',
        createdAt: new Date('2025-05-20').toISOString(),
        updatedAt: new Date('2025-05-20').toISOString(),
      },
      {
        id: uuidv4(),
        title: 'Libur Hari Raya Idul Adha 1446 H',
        content: 'Dalam rangka menyambut Hari Raya Idul Adha 1446 H, Pengadilan Agama Penajam akan libur pada tanggal 7-9 Juni 2025. Pelayanan akan kembali normal pada tanggal 10 Juni 2025.',
        isActive: true,
        publishDate: '2025-05-15',
        createdAt: new Date('2025-05-15').toISOString(),
        updatedAt: new Date('2025-05-15').toISOString(),
      },
    ];
    await announcementsCol.insertMany(annData);
  }

  const servicesCol = await getCollection('services');
  const svcCount = await servicesCol.countDocuments();
  if (svcCount === 0) {
    const svcData = [
      { id: uuidv4(), title: 'Pendaftaran Perkara', description: 'Layanan pendaftaran perkara perceraian, waris, hibah, wakaf, dan perkara lainnya secara online maupun offline.', icon: 'FileText', order: 1, isActive: true, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Informasi Jadwal Sidang', description: 'Cek jadwal sidang perkara Anda secara online melalui aplikasi SIPP Mahkamah Agung.', icon: 'Calendar', order: 2, isActive: true, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Informasi Biaya Perkara', description: 'Informasi transparansi biaya perkara sesuai SK Ketua Pengadilan yang berlaku.', icon: 'DollarSign', order: 3, isActive: true, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Pengambilan Produk Pengadilan', description: 'Layanan pengambilan salinan putusan, akta cerai, dan dokumen produk pengadilan lainnya.', icon: 'Package', order: 4, isActive: true, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Pos Bantuan Hukum', description: 'Layanan konsultasi dan bantuan hukum gratis bagi masyarakat tidak mampu dalam perkara perdata agama.', icon: 'Shield', order: 5, isActive: true, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Layanan e-Court', description: 'Pendaftaran perkara secara elektronik, pembayaran panjar biaya perkara, dan persidangan online.', icon: 'Monitor', order: 6, isActive: true, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Mediasi', description: 'Layanan mediasi untuk penyelesaian sengketa perdata agama secara damai melalui mediator bersertifikat.', icon: 'Users', order: 7, isActive: true, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Legalisir Dokumen', description: 'Layanan legalisir salinan putusan, akta cerai, dan dokumen pengadilan lainnya.', icon: 'Stamp', order: 8, isActive: true, createdAt: new Date().toISOString() },
    ];
    await servicesCol.insertMany(svcData);
  }

  const casesCol = await getCollection('cases');
  const casesCount = await casesCol.countDocuments();
  if (casesCount === 0) {
    const casesData = [
      { id: uuidv4(), nomorPerkara: `0001/Pdt.G/${new Date().getFullYear()}/PA.Pnj`, tahun: String(new Date().getFullYear()), jenisPerkara: 'Cerai Gugat', pemohon: 'Siti Aminah binti Ahmad', termohon: 'Budi Santoso bin Hasan', status: 'selesai', jadwalSidang: `${new Date().getFullYear()}-03-15`, ruangSidang: 'Ruang Sidang I', hakim: 'Dr. H. Ahmad Fauzi, S.H., M.H.', createdAt: new Date().toISOString() },
      { id: uuidv4(), nomorPerkara: `0002/Pdt.G/${new Date().getFullYear()}/PA.Pnj`, tahun: String(new Date().getFullYear()), jenisPerkara: 'Cerai Talak', pemohon: 'Muhammad Ridwan bin Saleh', termohon: 'Dewi Rahayu binti Suparto', status: 'selesai', jadwalSidang: `${new Date().getFullYear()}-03-20`, ruangSidang: 'Ruang Sidang II', hakim: 'Hj. Siti Maryam, S.H.I., M.H.', createdAt: new Date().toISOString() },
      { id: uuidv4(), nomorPerkara: `0003/Pdt.G/${new Date().getFullYear()}/PA.Pnj`, tahun: String(new Date().getFullYear()), jenisPerkara: 'Penetapan Ahli Waris', pemohon: 'Keluarga Almarhum Haji Sulaiman', termohon: '-', status: 'berjalan', jadwalSidang: `${new Date().getFullYear()}-06-15`, ruangSidang: 'Ruang Sidang I', hakim: 'Dr. H. Ahmad Fauzi, S.H., M.H.', createdAt: new Date().toISOString() },
      { id: uuidv4(), nomorPerkara: `0004/Pdt.G/${new Date().getFullYear()}/PA.Pnj`, tahun: String(new Date().getFullYear()), jenisPerkara: 'Itsbat Nikah', pemohon: 'Joko Purnomo bin Widodo', termohon: 'Rina Sari binti Kartono', status: 'berjalan', jadwalSidang: `${new Date().getFullYear()}-06-20`, ruangSidang: 'Ruang Sidang II', hakim: 'Hj. Siti Maryam, S.H.I., M.H.', createdAt: new Date().toISOString() },
      { id: uuidv4(), nomorPerkara: `0005/Pdt.G/${new Date().getFullYear()}/PA.Pnj`, tahun: String(new Date().getFullYear()), jenisPerkara: 'Hak Asuh Anak', pemohon: 'Wahyu Hidayat bin Suharto', termohon: 'Lestari Wulandari binti Bambang', status: 'berjalan', jadwalSidang: `${new Date().getFullYear()}-07-01`, ruangSidang: 'Ruang Sidang I', hakim: 'Dr. H. Ahmad Fauzi, S.H., M.H.', createdAt: new Date().toISOString() },
      { id: uuidv4(), nomorPerkara: `0006/Pdt.P/${new Date().getFullYear()}/PA.Pnj`, tahun: String(new Date().getFullYear()), jenisPerkara: 'Dispensasi Kawin', pemohon: 'Ahmad Faisal bin Ruslan', termohon: '-', status: 'selesai', jadwalSidang: `${new Date().getFullYear()}-04-05`, ruangSidang: 'Ruang Sidang II', hakim: 'Hj. Siti Maryam, S.H.I., M.H.', createdAt: new Date().toISOString() },
      { id: uuidv4(), nomorPerkara: `0007/Pdt.G/${new Date().getFullYear()}/PA.Pnj`, tahun: String(new Date().getFullYear()), jenisPerkara: 'Cerai Gugat', pemohon: 'Yuni Astuti binti Sudarmo', termohon: 'Eko Prasetyo bin Haryono', status: 'terdaftar', jadwalSidang: `${new Date().getFullYear()}-07-10`, ruangSidang: '-', hakim: '-', createdAt: new Date().toISOString() },
      { id: uuidv4(), nomorPerkara: `0008/Pdt.G/${new Date().getFullYear()}/PA.Pnj`, tahun: String(new Date().getFullYear()), jenisPerkara: 'Pembagian Harta Gono Gini', pemohon: 'Hendri Kurniawan bin Sutrisno', termohon: 'Fitriani binti Mursid', status: 'terdaftar', jadwalSidang: `${new Date().getFullYear()}-07-15`, ruangSidang: '-', hakim: '-', createdAt: new Date().toISOString() },
    ];
    await casesCol.insertMany(casesData);
  }

  const settingsCol = await getCollection('settings');
  const settingsCount = await settingsCol.countDocuments();
  if (settingsCount === 0) {
    const settingsData = [
      { key: 'court_name', value: 'Pengadilan Agama Penajam' },
      { key: 'court_subtitle', value: 'Kelas I B' },
      { key: 'hero_title', value: 'Pengadilan Agama Penajam' },
      { key: 'hero_subtitle', value: 'Memberikan Keadilan yang Cepat, Sederhana, dan Berbiaya Ringan untuk Masyarakat Kabupaten Penajam Paser Utara' },
      { key: 'address', value: 'Jl. Propinsi Km. 9 Kel. Nipah-Nipah, Kec. Penajam, Kab. Penajam Paser Utara, Kalimantan Timur 76141' },
      { key: 'phone', value: '(0542) 7211234' },
      { key: 'email', value: 'pa.penajam@gmail.com' },
      { key: 'website', value: 'pa-penajam.go.id' },
      { key: 'vision', value: 'Terwujudnya Pengadilan Agama Penajam yang Agung' },
      { key: 'mission', value: '1. Menjaga kemandirian badan peradilan\n2. Memberikan pelayanan hukum yang berkeadilan kepada pencari keadilan\n3. Meningkatkan kualitas kepemimpinan badan peradilan\n4. Meningkatkan kredibilitas dan transparansi badan peradilan' },
      { key: 'history', value: 'Pengadilan Agama Penajam didirikan berdasarkan Keputusan Presiden Republik Indonesia sebagai bagian dari sistem peradilan agama di Indonesia. Berlokasi di Kabupaten Penajam Paser Utara, Kalimantan Timur, pengadilan ini bertugas memeriksa, memutus, dan menyelesaikan perkara di tingkat pertama antara orang-orang yang beragama Islam di bidang perkawinan, kewarisan, wasiat, hibah, wakaf, zakat, infaq, shadaqah, dan ekonomi syari\'ah.' },
    ];
    for (const s of settingsData) {
      await settingsCol.updateOne({ key: s.key }, { $set: s }, { upsert: true });
    }
  }
}

export async function GET(request, { params }) {
  const path = params.path || [];
  try {
    return await handleRequest(request, path, 'GET');
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({ error: 'Internal Server Error', detail: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const path = params.path || [];
  try {
    return await handleRequest(request, path, 'POST');
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({ error: 'Internal Server Error', detail: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const path = params.path || [];
  try {
    return await handleRequest(request, path, 'PUT');
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({ error: 'Internal Server Error', detail: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const path = params.path || [];
  try {
    return await handleRequest(request, path, 'DELETE');
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({ error: 'Internal Server Error', detail: err.message }, { status: 500 });
  }
}
