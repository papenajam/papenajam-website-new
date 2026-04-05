import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function handleStats(request, _segments, method) {
  if (method !== 'GET') return null;

  const user = requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [news, announcements, services, cases, users, agenda, putusan, pages] = await Promise.all([
    getCollection('news'),
    getCollection('announcements'),
    getCollection('services'),
    getCollection('cases'),
    getCollection('users'),
    getCollection('agenda'),
    getCollection('putusan'),
    getCollection('pages'),
  ]);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const [
    totalNews, totalAnnouncements, totalServices, totalCases, totalUsers,
    totalAgenda, totalPutusan, totalPages
  ] = await Promise.all([
    news.countDocuments(), announcements.countDocuments(), services.countDocuments(),
    cases.countDocuments(), users.countDocuments(), agenda.countDocuments(),
    putusan.countDocuments(), pages.countDocuments(),
  ]);

  const [casesThisYear, casesThisMonth, casesDone, casesOngoing, todayAgenda] = await Promise.all([
    cases.countDocuments({ tahun: String(now.getFullYear()) }),
    cases.countDocuments({ createdAt: { $gte: startOfMonth.toISOString() } }),
    cases.countDocuments({ status: 'selesai' }),
    cases.countDocuments({ status: 'berjalan' }),
    agenda.countDocuments({
      tanggalSidang: { $gte: todayStart.toISOString().split('T')[0], $lte: todayEnd.toISOString().split('T')[0] }
    }),
  ]);

  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const dEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const count = await cases.countDocuments({ createdAt: { $gte: d.toISOString(), $lt: dEnd.toISOString() } });
    monthlyData.push({ month: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }), count });
  }

  const caseTypesRaw = await cases.aggregate([
    { $group: { _id: '$jenisPerkara', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 6 }
  ]).toArray();

  return NextResponse.json({
    totalNews, totalAnnouncements, totalServices, totalCases, totalUsers,
    totalAgenda, totalPutusan, totalPages,
    casesThisYear, casesThisMonth, casesDone, casesOngoing, todayAgenda,
    monthlyData, caseTypes: caseTypesRaw.map(c => ({ name: c._id || 'Lainnya', value: c.count }))
  });
}
