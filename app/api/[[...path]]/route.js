import { NextResponse } from 'next/server';
import { connectDB, getCollection } from '@/lib/db';
import { generateToken, hashPassword, comparePassword, requireAuth } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

// Role permission map
const PERMISSIONS = {
  superadmin: ['*'],
  admin: ['*'],
  staff: ['agenda', 'cases', 'putusan', 'dashboard', 'stats'],
  editor: ['pages', 'news', 'announcements', 'dashboard'],
};

function checkPermission(user, resource) {
  if (!user) return false;
  const perms = PERMISSIONS[user.role] || [];
  return perms.includes('*') || perms.includes(resource);
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
      const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role || 'admin' });
      return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role || 'admin' } });
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
    const agenda = await getCollection('agenda');
    const putusan = await getCollection('putusan');
    const pages = await getCollection('pages');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const [totalNews, totalAnnouncements, totalServices, totalCases, totalUsers,
      totalAgenda, totalPutusan, totalPages] = await Promise.all([
      news.countDocuments(),
      announcements.countDocuments(),
      services.countDocuments(),
      cases.countDocuments(),
      users.countDocuments(),
      agenda.countDocuments(),
      putusan.countDocuments(),
      pages.countDocuments(),
    ]);
    const casesThisYear = await cases.countDocuments({ tahun: String(new Date().getFullYear()) });
    const casesThisMonth = await cases.countDocuments({ createdAt: { $gte: startOfMonth.toISOString() } });
    const casesDone = await cases.countDocuments({ status: 'selesai' });
    const casesOngoing = await cases.countDocuments({ status: 'berjalan' });

    const todayAgenda = await agenda.countDocuments({
      tanggalSidang: { $gte: todayStart.toISOString().split('T')[0], $lte: todayEnd.toISOString().split('T')[0] }
    });

    // Monthly cases for chart (last 6 months)
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const dEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const count = await cases.countDocuments({
        createdAt: { $gte: d.toISOString(), $lt: dEnd.toISOString() }
      });
      monthlyData.push({
        month: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
        count
      });
    }

    // Cases by type
    const caseTypes = await cases.aggregate([
      { $group: { _id: '$jenisPerkara', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 }
    ]).toArray();

    return NextResponse.json({
      totalNews, totalAnnouncements, totalServices, totalCases, totalUsers,
      totalAgenda, totalPutusan, totalPages,
      casesThisYear, casesThisMonth, casesDone, casesOngoing, todayAgenda,
      monthlyData, caseTypes: caseTypes.map(c => ({ name: c._id || 'Lainnya', value: c.count }))
    });
  }

  // ==================== UPLOAD ====================
  if (segment1 === 'upload' && method === 'POST') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = file.name.split('.').pop().toLowerCase();
      const type = ['pdf'].includes(ext) ? 'pdfs' : 'images';
      const fileName = `${uuidv4()}.${ext}`;
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', type);

      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, fileName), buffer);

      return NextResponse.json({ url: `/uploads/${type}/${fileName}`, fileName, type });
    } catch (err) {
      return NextResponse.json({ error: 'Upload failed: ' + err.message }, { status: 500 });
    }
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
        const jenis = url.searchParams.get('jenis') || '';
        const namaPihak = url.searchParams.get('namaPihak') || '';
        const query = {};
        if (search) query.nomorPerkara = { $regex: search, $options: 'i' };
        if (tahun) query.tahun = tahun;
        if (jenis) query.jenisPerkara = { $regex: jenis, $options: 'i' };
        if (namaPihak) query.$or = [
          { pemohon: { $regex: namaPihak, $options: 'i' } },
          { termohon: { $regex: namaPihak, $options: 'i' } }
        ];
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
        const item = {
          id: uuidv4(), name: body.name, email: body.email.toLowerCase(),
          password: hashedPwd, role: body.role || 'admin', createdAt: new Date().toISOString()
        };
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
        const update = { name: body.name, email: body.email, role: body.role || 'admin', updatedAt: new Date().toISOString() };
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

  // ==================== PAGES (Page Builder) ====================
  if (segment1 === 'pages') {
    const col = await getCollection('pages');
    if (!segment2) {
      if (method === 'GET') {
        const items = await col.find({}).sort({ createdAt: -1 }).toArray();
        return NextResponse.json({ items });
      }
      if (method === 'POST') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const item = {
          id: uuidv4(), ...body, blocks: body.blocks || [],
          status: body.status || 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        await col.insertOne(item);
        return NextResponse.json(item, { status: 201 });
      }
    }
    if (segment2) {
      if (segment2 === 'slug' && segment3 && method === 'GET') {
        // For _homepage slug, also allow authenticated admins to fetch any status
        const authUser = requireAuth(request);
        const query = authUser
          ? { slug: segment3 }
          : { slug: segment3, status: 'published' };
        const item = await col.findOne(query);
        if (!item) return NextResponse.json({ error: 'Halaman tidak ditemukan' }, { status: 404 });
        return NextResponse.json(item);
      }
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

  // ==================== AGENDA SIDANG ====================
  if (segment1 === 'agenda') {
    const col = await getCollection('agenda');
    if (!segment2) {
      if (method === 'GET') {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const search = url.searchParams.get('search') || '';
        const dateFrom = url.searchParams.get('dateFrom') || '';
        const dateTo = url.searchParams.get('dateTo') || '';
        const status = url.searchParams.get('status') || '';
        const publicOnly = url.searchParams.get('public') === 'true';
        const query = {};
        if (search) query.nomorPerkara = { $regex: search, $options: 'i' };
        if (status) query.status = status;
        if (dateFrom || dateTo) {
          query.tanggalSidang = {};
          if (dateFrom) query.tanggalSidang.$gte = dateFrom;
          if (dateTo) query.tanggalSidang.$lte = dateTo;
        }
        if (publicOnly) query.status = { $ne: 'dibatalkan' };
        const total = await col.countDocuments(query);
        const items = await col.find(query).sort({ tanggalSidang: 1, waktuSidang: 1 }).skip((page-1)*limit).limit(limit).toArray();
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

  // ==================== PUTUSAN ====================
  if (segment1 === 'putusan') {
    const col = await getCollection('putusan');
    if (!segment2) {
      if (method === 'GET') {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const search = url.searchParams.get('search') || '';
        const publicOnly = url.searchParams.get('public') === 'true';
        const query = {};
        if (search) query.$or = [
          { nomorPerkara: { $regex: search, $options: 'i' } },
          { jenisPerkara: { $regex: search, $options: 'i' } },
        ];
        if (publicOnly) query.statusPublish = true;
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

  return NextResponse.json({ error: 'Route tidak ditemukan' }, { status: 404 });
}

// ==================== SEED ====================
async function seedDatabase() {
  const { hashPassword: hp } = await import('@/lib/auth');

  const usersCol = await getCollection('users');
  const existing = await usersCol.findOne({ email: 'admin@pa-penajam.go.id' });
  if (!existing) {
    await usersCol.insertOne({
      id: uuidv4(), name: 'Administrator', email: 'admin@pa-penajam.go.id',
      password: await hp('Admin@1234'), role: 'superadmin', createdAt: new Date().toISOString(),
    });
  }
  // Add staff and editor demo users
  const staffExists = await usersCol.findOne({ email: 'staff@pa-penajam.go.id' });
  if (!staffExists) {
    await usersCol.insertOne({
      id: uuidv4(), name: 'Staff Kepaniteraan', email: 'staff@pa-penajam.go.id',
      password: await hp('Staff@1234'), role: 'staff', createdAt: new Date().toISOString(),
    });
  }
  const editorExists = await usersCol.findOne({ email: 'editor@pa-penajam.go.id' });
  if (!editorExists) {
    await usersCol.insertOne({
      id: uuidv4(), name: 'Editor Humas', email: 'editor@pa-penajam.go.id',
      password: await hp('Editor@1234'), role: 'editor', createdAt: new Date().toISOString(),
    });
  }

  const newsCol = await getCollection('news');
  const newsCount = await newsCol.countDocuments();
  if (newsCount === 0) {
    const newsData = [
      { id: uuidv4(), title: 'Pengadilan Agama Penajam Raih Predikat WBK dari Kemenpan RB', content: 'Pengadilan Agama Penajam berhasil meraih predikat Wilayah Bebas dari Korupsi (WBK) dari Kementerian Pendayagunaan Aparatur Negara dan Reformasi Birokrasi. Penghargaan ini merupakan bukti komitmen seluruh jajaran pengadilan dalam memberikan pelayanan yang bersih, transparan, dan akuntabel kepada masyarakat.', image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80', author: 'Humas PA Penajam', category: 'Prestasi', isPublished: true, publishDate: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Pelaksanaan Sidang Keliling di Kecamatan Penajam', content: 'Dalam rangka meningkatkan akses keadilan bagi masyarakat, Pengadilan Agama Penajam melaksanakan kegiatan sidang keliling di Kecamatan Penajam.', image: 'https://images.unsplash.com/photo-1575505586569-646b2ca898fc?w=800&q=80', author: 'Humas PA Penajam', category: 'Kegiatan', isPublished: true, publishDate: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Sosialisasi Layanan e-Court kepada Masyarakat', content: 'Pengadilan Agama Penajam menyelenggarakan sosialisasi layanan e-Court kepada masyarakat Kabupaten Penajam Paser Utara.', image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80', author: 'Humas PA Penajam', category: 'Sosialisasi', isPublished: true, publishDate: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];
    await newsCol.insertMany(newsData);
  }

  const announcementsCol = await getCollection('announcements');
  const annCount = await announcementsCol.countDocuments();
  if (annCount === 0) {
    await announcementsCol.insertMany([
      { id: uuidv4(), title: 'Jadwal Sidang Bulan Ini', content: 'Jadwal sidang tersedia. Silakan cek melalui aplikasi SIPP.', isActive: true, publishDate: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Perubahan Jam Operasional Pelayanan', content: 'Pelayanan dibuka Senin-Jumat pukul 08.00-16.00 WITA.', isActive: true, publishDate: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);
  }

  const servicesCol = await getCollection('services');
  const svcCount = await servicesCol.countDocuments();
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

  const yr = String(new Date().getFullYear());
  const casesCol = await getCollection('cases');
  const casesCount = await casesCol.countDocuments();
  if (casesCount === 0) {
    const caseTypes = ['Cerai Gugat','Cerai Talak','Penetapan Ahli Waris','Itsbat Nikah','Hak Asuh Anak','Dispensasi Kawin','Pembagian Harta Gono Gini'];
    const statuses = ['selesai','selesai','berjalan','berjalan','terdaftar'];
    const hakims = ['Dr. H. Ahmad Fauzi, S.H., M.H.','Hj. Siti Maryam, S.H.I., M.H.'];
    const cases = Array.from({length: 8}, (_, i) => ({
      id: uuidv4(), nomorPerkara: `${String(i+1).padStart(4,'0')}/Pdt.G/${yr}/PA.Pnj`, tahun: yr,
      jenisPerkara: caseTypes[i % caseTypes.length], pemohon: `Pemohon ${i+1} bin/binti Orang`, termohon: i % 3 === 0 ? '-' : `Termohon ${i+1} bin/binti Orang`,
      status: statuses[i % statuses.length], jadwalSidang: new Date(Date.now() + (i-3)*7*86400000).toISOString().split('T')[0],
      ruangSidang: i % 2 === 0 ? 'Ruang Sidang I' : 'Ruang Sidang II', hakim: hakims[i % 2],
      createdAt: new Date(Date.now() - i * 7 * 86400000).toISOString()
    }));
    await casesCol.insertMany(cases);
  }

  // Seed Agenda Sidang
  const agendaCol = await getCollection('agenda');
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

  // Seed Putusan
  const putusanCol = await getCollection('putusan');
  const putusanCount = await putusanCol.countDocuments();
  if (putusanCount === 0) {
    await putusanCol.insertMany([
      { id: uuidv4(), nomorPerkara: `0001/Pdt.G/${yr}/PA.Pnj`, jenisPerkara: 'Cerai Gugat', tanggalPutusan: new Date().toISOString().split('T')[0], ringkasanPutusan: 'Mengabulkan gugatan penggugat. Menjatuhkan talak satu raj\'i tergugat kepada penggugat.', filePutusan: null, hakim: 'Dr. H. Ahmad Fauzi, S.H., M.H.', statusPublish: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uuidv4(), nomorPerkara: `0002/Pdt.G/${yr}/PA.Pnj`, jenisPerkara: 'Cerai Talak', tanggalPutusan: new Date().toISOString().split('T')[0], ringkasanPutusan: 'Mengabulkan permohonan pemohon. Memberi izin kepada pemohon untuk menjatuhkan talak satu raj\'i kepada termohon.', filePutusan: null, hakim: 'Hj. Siti Maryam, S.H.I., M.H.', statusPublish: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);
  }

  // Seed Settings
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
      { key: 'history', value: 'Pengadilan Agama Penajam didirikan berdasarkan Keputusan Presiden Republik Indonesia sebagai bagian dari sistem peradilan agama di Indonesia.' },
    ];
    for (const s of settingsData) {
      await settingsCol.updateOne({ key: s.key }, { $set: s }, { upsert: true });
    }
  }

  // Seed sample page
  const pagesCol = await getCollection('pages');
  const pagesCount = await pagesCol.countDocuments();
  if (pagesCount === 0) {
    await pagesCol.insertOne({
      id: uuidv4(), title: 'Tentang Pengadilan', slug: 'tentang',
      status: 'published',
      blocks: [
        { id: uuidv4(), type: 'hero', settings: { title: 'Pengadilan Agama Penajam', subtitle: 'Memberikan keadilan yang cepat, sederhana, dan berbiaya ringan', backgroundImage: 'https://images.unsplash.com/photo-1667849921481-9e13c239ee3d?w=1400&q=80', buttonText: 'Lihat Layanan', buttonLink: '#layanan' } },
        { id: uuidv4(), type: 'text', settings: { content: '<h2>Tentang Kami</h2><p>Pengadilan Agama Penajam adalah pengadilan tingkat pertama yang bertugas memeriksa, memutus, dan menyelesaikan perkara di bidang perkawinan, kewarisan, wasiat, hibah, wakaf, zakat, infaq, shadaqah, dan ekonomi syariah untuk masyarakat Muslim di Kabupaten Penajam Paser Utara.</p>' } },
        { id: uuidv4(), type: 'stats', settings: { items: [{ number: '500+', label: 'Perkara Diselesaikan' },{ number: '8', label: 'Hakim Profesional' },{ number: '20+', label: 'Tahun Pengalaman' },{ number: '15.000+', label: 'Masyarakat Dilayani' }] } },
      ],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
  }
}

export async function GET(request, { params }) {
  const path = params.path || [];
  try { return await handleRequest(request, path, 'GET'); }
  catch (err) { console.error('API Error:', err); return NextResponse.json({ error: 'Internal Server Error', detail: err.message }, { status: 500 }); }
}
export async function POST(request, { params }) {
  const path = params.path || [];
  try { return await handleRequest(request, path, 'POST'); }
  catch (err) { console.error('API Error:', err); return NextResponse.json({ error: 'Internal Server Error', detail: err.message }, { status: 500 }); }
}
export async function PUT(request, { params }) {
  const path = params.path || [];
  try { return await handleRequest(request, path, 'PUT'); }
  catch (err) { console.error('API Error:', err); return NextResponse.json({ error: 'Internal Server Error', detail: err.message }, { status: 500 }); }
}
export async function DELETE(request, { params }) {
  const path = params.path || [];
  try { return await handleRequest(request, path, 'DELETE'); }
  catch (err) { console.error('API Error:', err); return NextResponse.json({ error: 'Internal Server Error', detail: err.message }, { status: 500 }); }
}
