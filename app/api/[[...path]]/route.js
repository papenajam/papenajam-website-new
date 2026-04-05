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

  // ==================== SIDEBAR WIDGETS ====================
  if (segment1 === 'sidebar-widgets') {
    const col = await getCollection('sidebar_widgets');
    if (!segment2) {
      if (method === 'GET') {
        const items = await col.find({ isActive: true }).sort({ order: 1 }).toArray();
        return NextResponse.json({ items });
      }
      if (method === 'POST') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const item = { id: uuidv4(), ...body, isActive: body.isActive !== false, order: body.order || 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await col.insertOne(item);
        return NextResponse.json(item, { status: 201 });
      }
    }
    if (segment2 === 'all' && method === 'GET') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const items = await col.find({}).sort({ order: 1 }).toArray();
      return NextResponse.json({ items });
    }
    if (segment2 === 'bulk' && method === 'PUT') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const { items } = body;
      if (!Array.isArray(items)) return NextResponse.json({ error: 'items harus array' }, { status: 400 });
      await col.deleteMany({});
      if (items.length > 0) {
        await col.insertMany(items.map(item => ({ ...item, id: item.id || uuidv4(), updatedAt: new Date().toISOString(), createdAt: item.createdAt || new Date().toISOString() })));
      }
      return NextResponse.json({ message: 'Sidebar widgets disimpan', count: items.length });
    }
    if (segment2) {
      if (method === 'PUT') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        await col.updateOne({ id: segment2 }, { $set: { ...body, updatedAt: new Date().toISOString() } });
        return NextResponse.json(await col.findOne({ id: segment2 }));
      }
      if (method === 'DELETE') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        await col.deleteOne({ id: segment2 });
        return NextResponse.json({ message: 'Berhasil dihapus' });
      }
    }
  }

  // ==================== GALLERY ====================
  if (segment1 === 'gallery') {
    const col = await getCollection('gallery');
    if (!segment2) {
      if (method === 'GET') {
        const url = new URL(request.url);
        const category = url.searchParams.get('category') || '';
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const query = { isActive: true };
        if (category) query.category = category;
        const items = await col.find(query).sort({ order: 1, createdAt: -1 }).limit(limit).toArray();
        const categories = await col.distinct('category', { isActive: true });
        return NextResponse.json({ items, categories });
      }
      if (method === 'POST') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const item = { id: uuidv4(), ...body, isActive: body.isActive !== false, order: body.order || 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await col.insertOne(item);
        return NextResponse.json(item, { status: 201 });
      }
    }
    if (segment2 === 'all' && method === 'GET') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const items = await col.find({}).sort({ order: 1, createdAt: -1 }).toArray();
      return NextResponse.json({ items });
    }
    if (segment2) {
      if (method === 'PUT') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        await col.updateOne({ id: segment2 }, { $set: { ...body, updatedAt: new Date().toISOString() } });
        return NextResponse.json(await col.findOne({ id: segment2 }));
      }
      if (method === 'DELETE') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        await col.deleteOne({ id: segment2 });
        return NextResponse.json({ message: 'Berhasil dihapus' });
      }
    }
  }

  // ==================== DOCUMENTS ====================
  if (segment1 === 'documents') {
    const col = await getCollection('documents');
    if (!segment2) {
      if (method === 'GET') {
        const url = new URL(request.url);
        const category = url.searchParams.get('category') || '';
        const search = url.searchParams.get('search') || '';
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const page = parseInt(url.searchParams.get('page') || '1');
        const query = { isActive: true };
        if (category) query.category = category;
        if (search) query.title = { $regex: search, $options: 'i' };
        const total = await col.countDocuments(query);
        const items = await col.find(query).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).toArray();
        const categories = await col.distinct('category', { isActive: true });
        return NextResponse.json({ items, total, categories, totalPages: Math.ceil(total/limit) });
      }
      if (method === 'POST') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const item = { id: uuidv4(), ...body, isActive: body.isActive !== false, downloadCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await col.insertOne(item);
        return NextResponse.json(item, { status: 201 });
      }
    }
    if (segment2 === 'download' && segment3) {
      await col.updateOne({ id: segment3 }, { $inc: { downloadCount: 1 } });
      const item = await col.findOne({ id: segment3 });
      return NextResponse.json({ fileUrl: item?.fileUrl, title: item?.title });
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
        return NextResponse.json(await col.findOne({ id: segment2 }));
      }
      if (method === 'DELETE') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        await col.deleteOne({ id: segment2 });
        return NextResponse.json({ message: 'Berhasil dihapus' });
      }
    }
  }

  // ==================== FAQ ====================
  if (segment1 === 'faq') {
    const col = await getCollection('faq');
    if (!segment2) {
      if (method === 'GET') {
        const url = new URL(request.url);
        const category = url.searchParams.get('category') || '';
        const query = { isActive: true };
        if (category) query.category = category;
        const items = await col.find(query).sort({ order: 1 }).toArray();
        const categories = await col.distinct('category', { isActive: true });
        return NextResponse.json({ items, categories });
      }
      if (method === 'POST') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const item = { id: uuidv4(), ...body, isActive: body.isActive !== false, order: body.order || 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await col.insertOne(item);
        return NextResponse.json(item, { status: 201 });
      }
    }
    if (segment2 === 'all' && method === 'GET') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const items = await col.find({}).sort({ order: 1 }).toArray();
      return NextResponse.json({ items });
    }
    if (segment2) {
      if (method === 'PUT') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        await col.updateOne({ id: segment2 }, { $set: { ...body, updatedAt: new Date().toISOString() } });
        return NextResponse.json(await col.findOne({ id: segment2 }));
      }
      if (method === 'DELETE') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        await col.deleteOne({ id: segment2 });
        return NextResponse.json({ message: 'Berhasil dihapus' });
      }
    }
  }

  // ==================== BANNERS ====================
  if (segment1 === 'banners') {
    const col = await getCollection('banners');
    if (!segment2) {
      if (method === 'GET') {
        const now = new Date().toISOString().split('T')[0];
        const items = await col.find({ isActive: true, $or: [{ endDate: null }, { endDate: '' }, { endDate: { $gte: now } }] }).sort({ order: 1 }).toArray();
        return NextResponse.json({ items });
      }
      if (method === 'POST') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const item = { id: uuidv4(), ...body, isActive: body.isActive !== false, order: body.order || 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await col.insertOne(item);
        return NextResponse.json(item, { status: 201 });
      }
    }
    if (segment2 === 'all' && method === 'GET') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const items = await col.find({}).sort({ order: 1 }).toArray();
      return NextResponse.json({ items });
    }
    if (segment2) {
      if (method === 'PUT') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        await col.updateOne({ id: segment2 }, { $set: { ...body, updatedAt: new Date().toISOString() } });
        return NextResponse.json(await col.findOne({ id: segment2 }));
      }
      if (method === 'DELETE') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        await col.deleteOne({ id: segment2 });
        return NextResponse.json({ message: 'Berhasil dihapus' });
      }
    }
  }

  // ==================== COMPLAINTS ====================
  if (segment1 === 'complaints') {
    const col = await getCollection('complaints');
    if (!segment2) {
      if (method === 'GET') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const status = url.searchParams.get('status') || '';
        const query = {};
        if (status) query.status = status;
        const total = await col.countDocuments(query);
        const items = await col.find(query).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).toArray();
        return NextResponse.json({ items, total, totalPages: Math.ceil(total/limit) });
      }
      if (method === 'POST') {
        const body = await request.json();
        if (!body.name || !body.message) return NextResponse.json({ error: 'Nama dan pesan wajib diisi' }, { status: 400 });
        const item = { id: uuidv4(), ...body, status: 'baru', adminNotes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await col.insertOne(item);
        return NextResponse.json({ message: 'Pengaduan berhasil dikirim', id: item.id }, { status: 201 });
      }
    }
    if (segment2) {
      if (method === 'GET') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const item = await col.findOne({ id: segment2 });
        if (!item) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
        return NextResponse.json(item);
      }
      if (method === 'PUT') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        await col.updateOne({ id: segment2 }, { $set: { ...body, updatedAt: new Date().toISOString() } });
        return NextResponse.json(await col.findOne({ id: segment2 }));
      }
      if (method === 'DELETE') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        await col.deleteOne({ id: segment2 });
        return NextResponse.json({ message: 'Berhasil dihapus' });
      }
    }
  }

  // ==================== ANALYTICS ====================
  if (segment1 === 'analytics') {
    const col = await getCollection('analytics');
    if (segment2 === 'track' && method === 'POST') {
      const body = await request.json();
      const date = new Date().toISOString().split('T')[0];
      const path = body.path || '/';
      await col.updateOne({ date, path }, { $inc: { views: 1 }, $set: { date, path } }, { upsert: true });
      return NextResponse.json({ ok: true });
    }
    if (!segment2 && method === 'GET') {
      const url = new URL(request.url);
      const days = parseInt(url.searchParams.get('days') || '30');
      // Public: hanya bisa lihat total, admin bisa lihat detail
      const authUser = requireAuth(request);
      const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
      const records = await col.find({ date: { $gte: since } }).sort({ date: -1 }).toArray();
      const byDate = {}, byPath = {};
      let total = 0;
      records.forEach(r => {
        byDate[r.date] = (byDate[r.date] || 0) + r.views;
        byPath[r.path] = (byPath[r.path] || 0) + r.views;
        total += r.views;
      });
      const dailyData = Object.entries(byDate).sort((a,b) => a[0].localeCompare(b[0])).map(([date, views]) => ({ date, views }));
      const topPages = Object.entries(byPath).sort((a,b) => b[1]-a[1]).slice(0,10).map(([path, views]) => ({ path, views }));
      // Non-admin hanya mendapat total dan dailyData ringkas
      if (!authUser) {
        return NextResponse.json({ total, days });
      }
      return NextResponse.json({ total, dailyData, topPages, days });
    }
  }

  // ==================== SURVEYS ====================
  if (segment1 === 'surveys') {
    if (segment2 === 'config') {
      const col = await getCollection('survey_config');
      if (method === 'GET') {
        const config = await col.findOne({ id: 'main' });
        return NextResponse.json(config || { id: 'main', isActive: true, title: 'Survei Kepuasan', subtitle: 'Bantu kami meningkatkan pelayanan' });
      }
      if (method === 'PUT') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        await col.updateOne({ id: 'main' }, { $set: { ...body, id: 'main', updatedAt: new Date().toISOString() } }, { upsert: true });
        return NextResponse.json({ message: 'Konfigurasi survei disimpan' });
      }
    }
    if (segment2 === 'submit' && method === 'POST') {
      const col = await getCollection('survey_responses');
      const body = await request.json();
      const item = { id: uuidv4(), ...body, createdAt: new Date().toISOString() };
      await col.insertOne(item);
      return NextResponse.json({ message: 'Terima kasih atas masukan Anda!' });
    }
    if (!segment2 && method === 'GET') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const col = await getCollection('survey_responses');
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const total = await col.countDocuments();
      const items = await col.find({}).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).toArray();
      const all = await col.find({}, { projection: { rating: 1 } }).toArray();
      const avg = all.length ? (all.reduce((s, r) => s + (r.rating || 0), 0) / all.length).toFixed(1) : 0;
      return NextResponse.json({ items, total, totalPages: Math.ceil(total/limit), averageRating: parseFloat(avg), totalResponses: all.length });
    }
  }

  // ==================== SEARCH ====================
  if (segment1 === 'search' && method === 'GET') {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || '';
    if (!q || q.length < 2) return NextResponse.json({ results: [] });
    const regex = { $regex: q, $options: 'i' };
    const [newsItems, annItems, docItems, faqItems, pageItems] = await Promise.all([
      getCollection('news').then(c => c.find({ $or: [{ title: regex }, { content: regex }], isPublished: true }).limit(5).toArray()),
      getCollection('announcements').then(c => c.find({ $or: [{ title: regex }, { content: regex }], isActive: true }).limit(5).toArray()),
      getCollection('documents').then(c => c.find({ $or: [{ title: regex }, { description: regex }], isActive: true }).limit(5).toArray()),
      getCollection('faq').then(c => c.find({ $or: [{ question: regex }, { answer: regex }], isActive: true }).limit(5).toArray()),
      getCollection('pages').then(c => c.find({ title: regex, status: 'published', slug: { $ne: '_homepage' } }).limit(3).toArray()),
    ]);
    const results = [
      ...newsItems.map(i => ({ id: i.id, type: 'news', title: i.title, excerpt: i.content?.replace(/<[^>]+>/g,'').substring(0,100), url: `/berita/${i.id}` })),
      ...annItems.map(i => ({ id: i.id, type: 'announcement', title: i.title, excerpt: i.content?.replace(/<[^>]+>/g,'').substring(0,100), url: `/#pengumuman` })),
      ...docItems.map(i => ({ id: i.id, type: 'document', title: i.title, excerpt: i.description?.substring(0,100), url: `/dokumen` })),
      ...faqItems.map(i => ({ id: i.id, type: 'faq', title: i.question, excerpt: i.answer?.replace(/<[^>]+>/g,'').substring(0,100), url: `/faq` })),
      ...pageItems.map(i => ({ id: i.id, type: 'page', title: i.title, excerpt: '', url: `/p/${i.slug}` })),
    ];
    return NextResponse.json({ results, total: results.length });
  }

  // ==================== MENUS ====================
  if (segment1 === 'menus') {
    const col = await getCollection('menus');
    if (!segment2) {
      if (method === 'GET') {
        // Public endpoint - kembalikan menu aktif yang sudah diurutkan
        const items = await col.find({ isActive: true }).sort({ order: 1 }).toArray();
        // Pisahkan item utama dan sub-items, lalu bangun tree
        const topLevel = items.filter(i => !i.parentId).map(item => ({
          ...item,
          children: items.filter(c => c.parentId === item.id).sort((a, b) => a.order - b.order)
        }));
        return NextResponse.json({ items: topLevel });
      }
      if (method === 'POST') {
        const auth = requireAuth(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const item = {
          id: uuidv4(), ...body,
          isActive: body.isActive !== false,
          order: body.order || 0,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        await col.insertOne(item);
        return NextResponse.json(item, { status: 201 });
      }
    }
    if (segment2 === 'bulk' && method === 'PUT') {
      // Bulk update untuk simpan seluruh struktur menu sekaligus
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const { items } = body;
      if (!Array.isArray(items)) return NextResponse.json({ error: 'items harus array' }, { status: 400 });
      // Hapus semua menu lama, ganti dengan yang baru
      await col.deleteMany({});
      if (items.length > 0) {
        const toInsert = items.map(item => ({
          ...item,
          id: item.id || uuidv4(),
          updatedAt: new Date().toISOString(),
          createdAt: item.createdAt || new Date().toISOString()
        }));
        await col.insertMany(toInsert);
      }
      return NextResponse.json({ message: 'Menu berhasil disimpan', count: items.length });
    }
    if (segment2 === 'all' && method === 'GET') {
      // Admin endpoint - kembalikan SEMUA menu (aktif & non-aktif) dalam flat list
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const items = await col.find({}).sort({ order: 1 }).toArray();
      return NextResponse.json({ items });
    }
    if (segment2) {
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
        // Hapus juga sub-menu milik item ini
        await col.deleteMany({ parentId: segment2 });
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

  // Seed Sidebar Widgets
  const sidebarWidgetsCol = await getCollection('sidebar_widgets');
  const swCount = await sidebarWidgetsCol.countDocuments();
  if (swCount === 0) {
    await sidebarWidgetsCol.insertMany([
      { id: uuidv4(), type: 'faq', label: 'FAQ', labelEn: 'FAQ', icon: '❓', color: '#1e3a5f', isActive: true, order: 0, settings: { limit: 4, title: 'Pertanyaan Umum', showAll: true }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uuidv4(), type: 'stats', label: 'Statistik', labelEn: 'Stats', icon: '📊', color: '#c9a84c', isActive: true, order: 1, settings: { title: 'Statistik', showCases: true, showVisitors: true, days: 30 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uuidv4(), type: 'contact', label: 'Kontak', labelEn: 'Contact', icon: '📞', color: '#2d5a8e', isActive: true, order: 2, settings: { title: 'Hubungi Kami', showPhone: true, showEmail: true, showHours: true }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);
  }

  // Seed sample page
  const pagesCol = await getCollection('pages');
  const pagesCount = await pagesCol.countDocuments({ slug: { $ne: '_homepage' } });
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

  // Seed default navigation menu
  const menusCol = await getCollection('menus');
  const menusCount = await menusCol.countDocuments();
  if (menusCount === 0) {
    const menuItems = [
      { id: uuidv4(), label: 'Beranda', labelEn: 'Home', url: '#beranda', type: 'section', icon: '🏠', order: 0, isActive: true, parentId: null, description: '', descriptionEn: '' },
      { id: uuidv4(), label: 'Profil', labelEn: 'Profile', url: '#profil', type: 'section', icon: '🏛️', order: 1, isActive: true, parentId: null, description: 'Informasi Pengadilan', descriptionEn: 'Court Information' },
      { id: uuidv4(), label: 'Layanan', labelEn: 'Services', url: '#layanan', type: 'section', icon: '⚖️', order: 2, isActive: true, parentId: null, description: 'Layanan Kepaniteraan', descriptionEn: 'Court Services' },
      { id: uuidv4(), label: 'Informasi Perkara', labelEn: 'Case Info', url: '#perkara', type: 'section', icon: '🔍', order: 3, isActive: true, parentId: null, description: '', descriptionEn: '' },
      { id: uuidv4(), label: 'Berita', labelEn: 'News', url: '#berita', type: 'section', icon: '📰', order: 4, isActive: true, parentId: null, description: '', descriptionEn: '' },
      { id: uuidv4(), label: 'Kontak', labelEn: 'Contact', url: '#kontak', type: 'section', icon: '📞', order: 5, isActive: true, parentId: null, description: '', descriptionEn: '' },
    ];
    // Sub-items untuk "Layanan"
    const layananId = menuItems[2].id;
    const subLayanan = [
      { id: uuidv4(), label: 'Pendaftaran Perkara', labelEn: 'Case Registration', url: '#layanan', type: 'section', icon: '📋', order: 0, isActive: true, parentId: layananId, description: 'Daftarkan perkara Anda', descriptionEn: 'Register your case' },
      { id: uuidv4(), label: 'Agenda Sidang', labelEn: 'Court Schedule', url: '/agenda-sidang', type: 'page', icon: '📅', order: 1, isActive: true, parentId: layananId, description: 'Jadwal sidang terkini', descriptionEn: 'Latest court schedule' },
      { id: uuidv4(), label: 'Informasi Biaya', labelEn: 'Fee Information', url: '#layanan', type: 'section', icon: '💰', order: 2, isActive: true, parentId: layananId, description: 'Biaya perkara transparan', descriptionEn: 'Transparent case fees' },
      { id: uuidv4(), label: 'Putusan', labelEn: 'Court Decisions', url: '/putusan', type: 'page', icon: '📄', order: 3, isActive: true, parentId: layananId, description: 'Salinan putusan pengadilan', descriptionEn: 'Court decision copies' },
      { id: uuidv4(), label: 'Pos Bantuan Hukum', labelEn: 'Legal Aid', url: '#layanan', type: 'section', icon: '🛡️', order: 4, isActive: true, parentId: layananId, description: 'Bantuan hukum gratis', descriptionEn: 'Free legal assistance' },
      { id: uuidv4(), label: 'e-Court', labelEn: 'e-Court', url: 'https://ecourt.mahkamahagung.go.id', type: 'external', icon: '💻', order: 5, isActive: true, parentId: layananId, description: 'Pendaftaran elektronik', descriptionEn: 'Electronic registration' },
    ];
    await menusCol.insertMany([...menuItems, ...subLayanan].map(m => ({ ...m, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })));
  }

  // Seed Gallery
  const galleryCol = await getCollection('gallery');
  const galleryCount = await galleryCol.countDocuments();
  if (galleryCount === 0) {
    await galleryCol.insertMany([
      { id: uuidv4(), title: 'Gedung Pengadilan Agama Penajam', titleEn: 'Penajam Religious Court Building', description: 'Tampak depan gedung pengadilan', category: 'Gedung', imageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80', isActive: true, order: 0, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Sidang Keliling 2024', titleEn: 'Mobile Court 2024', description: 'Pelaksanaan sidang keliling di kecamatan', category: 'Kegiatan', imageUrl: 'https://images.unsplash.com/photo-1575505586569-646b2ca898fc?w=800&q=80', isActive: true, order: 1, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Sosialisasi e-Court', titleEn: 'e-Court Socialization', description: 'Sosialisasi layanan elektronik kepada masyarakat', category: 'Kegiatan', imageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80', isActive: true, order: 2, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Pelayanan Terpadu', titleEn: 'Integrated Service', description: 'Layanan terpadu satu pintu', category: 'Layanan', imageUrl: 'https://images.unsplash.com/photo-1521791055366-0d553872952f?w=800&q=80', isActive: true, order: 3, createdAt: new Date().toISOString() },
    ]);
  }

  // Seed Documents
  const docsCol = await getCollection('documents');
  const docsCount = await docsCol.countDocuments();
  if (docsCount === 0) {
    await docsCol.insertMany([
      { id: uuidv4(), title: 'Maklumat Pelayanan Pengadilan Agama Penajam', titleEn: 'Service Declaration', description: 'Maklumat pelayanan publik tahun 2024', category: 'Maklumat', fileUrl: '', fileType: 'pdf', isActive: true, order: 0, downloadCount: 0, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Standar Pelayanan (SP) Kepaniteraan', titleEn: 'Service Standards', description: 'Standar operasional pelayanan kepaniteraan', category: 'Standar Pelayanan', fileUrl: '', fileType: 'pdf', isActive: true, order: 1, downloadCount: 0, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Persyaratan Pendaftaran Perkara Cerai Gugat', titleEn: 'Divorce Case Requirements', description: 'Dokumen yang diperlukan untuk pendaftaran perkara cerai gugat', category: 'Persyaratan', fileUrl: '', fileType: 'pdf', isActive: true, order: 2, downloadCount: 0, createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Biaya Perkara Estimasi 2024', titleEn: 'Case Fee Estimate 2024', description: 'Estimasi biaya panjar perkara tahun 2024', category: 'Biaya', fileUrl: '', fileType: 'pdf', isActive: true, order: 3, downloadCount: 0, createdAt: new Date().toISOString() },
    ]);
  }

  // Seed FAQ
  const faqCol = await getCollection('faq');
  const faqCount = await faqCol.countDocuments();
  if (faqCount === 0) {
    await faqCol.insertMany([
      { id: uuidv4(), question: 'Apa saja perkara yang ditangani Pengadilan Agama?', questionEn: 'What cases are handled by the Religious Court?', answer: 'Pengadilan Agama menangani perkara perkawinan (cerai gugat, cerai talak, itsbat nikah), kewarisan, wasiat, hibah, wakaf, zakat, infaq, shadaqah, dan ekonomi syariah bagi masyarakat Muslim.', answerEn: 'The Religious Court handles marriage cases (divorce, marriage confirmation), inheritance, wills, grants, endowments, and Islamic economic disputes for Muslims.', category: 'Umum', isActive: true, order: 0, createdAt: new Date().toISOString() },
      { id: uuidv4(), question: 'Berapa biaya pendaftaran perkara?', questionEn: 'How much does case registration cost?', answer: 'Biaya pendaftaran perkara bervariasi tergantung jenis perkara dan domisili para pihak. Estimasi biaya tersedia di loket informasi atau dapat diunduh di bagian Dokumen.', answerEn: 'Case registration fees vary depending on the type of case. Fee estimates are available at the information counter or can be downloaded in the Documents section.', category: 'Biaya', isActive: true, order: 1, createdAt: new Date().toISOString() },
      { id: uuidv4(), question: 'Jam pelayanan pengadilan?', questionEn: 'What are the court service hours?', answer: 'Pelayanan dibuka Senin-Kamis pukul 08:00-16:00 WITA dan Jumat pukul 08:00-11:00 WITA.', answerEn: 'Service hours are Monday-Thursday 08:00-16:00 WITA and Friday 08:00-11:00 WITA.', category: 'Umum', isActive: true, order: 2, createdAt: new Date().toISOString() },
      { id: uuidv4(), question: 'Bagaimana cara mendaftarkan perkara secara online (e-Court)?', questionEn: 'How to register a case online (e-Court)?', answer: 'Pendaftaran online dilakukan melalui portal e-Court Mahkamah Agung di ecourt.mahkamahagung.go.id. Anda perlu membuat akun terlebih dahulu dan mengikuti panduan yang tersedia.', answerEn: 'Online registration is done through the Supreme Court e-Court portal at ecourt.mahkamahagung.go.id.', category: 'e-Court', isActive: true, order: 3, createdAt: new Date().toISOString() },
      { id: uuidv4(), question: 'Berapa lama proses sidang?', questionEn: 'How long does the court process take?', answer: 'Durasi proses persidangan bervariasi tergantung kompleksitas perkara. Perkara sederhana bisa selesai dalam 1-3 bulan, sementara perkara yang lebih kompleks bisa memakan waktu lebih lama.', answerEn: 'Court process duration varies depending on case complexity, typically 1-3 months for simple cases.', category: 'Proses', isActive: true, order: 4, createdAt: new Date().toISOString() },
      { id: uuidv4(), question: 'Apa itu Pos Bantuan Hukum (Posbakum)?', questionEn: 'What is Legal Aid (Posbakum)?', answer: 'Pos Bantuan Hukum (Posbakum) adalah layanan konsultasi hukum gratis bagi masyarakat tidak mampu. Tersedia di lingkungan pengadilan pada jam kerja.', answerEn: 'Posbakum is a free legal consultation service for underprivileged people, available at the court during working hours.', category: 'Layanan', isActive: true, order: 5, createdAt: new Date().toISOString() },
    ]);
  }

  // Seed Banners
  const bannersCol = await getCollection('banners');
  const bannersCount = await bannersCol.countDocuments();
  if (bannersCount === 0) {
    await bannersCol.insertMany([
      { id: uuidv4(), title: 'Pengadilan Agama Penajam', subtitle: 'Memberikan Keadilan yang Cepat, Sederhana, dan Berbiaya Ringan', buttonText: 'Lihat Layanan', buttonUrl: '#layanan', imageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1400&q=80', bgColor: '#1e3a5f', textColor: '#ffffff', isActive: true, order: 0, startDate: '', endDate: '', createdAt: new Date().toISOString() },
      { id: uuidv4(), title: 'Layanan e-Court Tersedia', subtitle: 'Daftarkan perkara Anda secara online, kapan saja dan di mana saja', buttonText: 'Daftar e-Court', buttonUrl: 'https://ecourt.mahkamahagung.go.id', imageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1400&q=80', bgColor: '#c9a84c', textColor: '#ffffff', isActive: true, order: 1, startDate: '', endDate: '', createdAt: new Date().toISOString() },
    ]);
  }

  // Seed Settings tambahan (social media, SEO, WhatsApp)
  const settingsCol2 = await getCollection('settings');
  const socialExists = await settingsCol2.findOne({ key: 'whatsapp' });
  if (!socialExists) {
    const newSettings = [
      { key: 'whatsapp', value: '' },
      { key: 'facebook', value: '' },
      { key: 'instagram', value: '' },
      { key: 'twitter', value: '' },
      { key: 'youtube', value: '' },
      { key: 'seo_title', value: 'Pengadilan Agama Penajam - Memberikan Keadilan yang Berkeadilan' },
      { key: 'seo_description', value: 'Website resmi Pengadilan Agama Penajam, Kabupaten Penajam Paser Utara, Kalimantan Timur.' },
      { key: 'seo_keywords', value: 'pengadilan agama, penajam, perceraian, waris, nikah, hukum islam' },
      { key: 'footer_description', value: 'Pengadilan Agama Penajam adalah lembaga peradilan yang bertugas memberikan keadilan bagi masyarakat Muslim di Kabupaten Penajam Paser Utara.' },
      { key: 'footer_copyright', value: 'Pengadilan Agama Penajam. Hak Cipta Dilindungi.' },
      { key: 'analytics_enabled', value: 'true' },
      { key: 'survey_popup_enabled', value: 'false' },
    ];
    for (const s of newSettings) {
      await settingsCol2.updateOne({ key: s.key }, { $set: s }, { upsert: true });
    }
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
