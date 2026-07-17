// Stats / dashboard aggregates handler (Task 12: full PostgreSQL -> Prisma).
//
// Behaviour is byte-identical to the established API contract:
//   - GET /stats (auth required)
//   - Parallel entity counts (news, announcements, services, cases, users,
//     agenda, putusan/Decision, pages)
//   - casesThisYear / casesThisMonth / casesDone / casesOngoing / todayAgenda
//   - monthlyData: last 6 months of case creates [{ month, count }]
//   - caseTypes: top 6 jenisPerkara [{ name, value }]
//
// Output field names `monthlyData` and `caseTypes` are frozen by the contract
// suite and the admin dashboard charts — do not rename.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { parseDateOnly } from '@/lib/api/dates.js';

export async function handleStats(request, _segments, method) {
  if (method !== 'GET') return null;

  const user = requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  // Date-only bound for Agenda.tanggalSidang (@db.Date). Uses the same
  // toISOString().split('T')[0] derivation as the established API contract so the
  // day window matches under any host TZ. Equality (not lte:tomorrow) so we
  // count TODAY only — `lte: tomorrow` would incorrectly include tomorrow.
  const todayDate = parseDateOnly(todayStart.toISOString().split('T')[0], 'tanggalSidang');

  const [
    totalNews,
    totalAnnouncements,
    totalServices,
    totalCases,
    totalUsers,
    totalAgenda,
    totalPutusan,
    totalPages,
    casesThisYear,
    casesThisMonth,
    casesDone,
    casesOngoing,
    todayAgenda,
  ] = await Promise.all([
    prisma.news.count(),
    prisma.announcement.count(),
    prisma.service.count(),
    prisma.caseRecord.count(),
    prisma.user.count(),
    prisma.agenda.count(),
    prisma.decision.count(),
    prisma.page.count(),
    prisma.caseRecord.count({ where: { tahun: String(now.getFullYear()) } }),
    prisma.caseRecord.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.caseRecord.count({ where: { status: 'selesai' } }),
    prisma.caseRecord.count({ where: { status: 'berjalan' } }),
    prisma.agenda.count({
      where: {
        tanggalSidang: todayDate,
      },
    }),
  ]);

  // Six monthly buckets in parallel (same window as legacy sequential loop).
  const monthSpecs = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const dEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    monthSpecs.push({ d, dEnd });
  }

  const monthCounts = await Promise.all(
    monthSpecs.map(({ d, dEnd }) =>
      prisma.caseRecord.count({
        where: { createdAt: { gte: d, lt: dEnd } },
      }),
    ),
  );

  const monthlyData = monthSpecs.map(({ d }, idx) => ({
    month: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
    count: monthCounts[idx],
  }));

  const caseTypesRaw = await prisma.caseRecord.groupBy({
    by: ['jenisPerkara'],
    _count: { _all: true },
    orderBy: { _count: { jenisPerkara: 'desc' } },
    take: 6,
  });

  const caseTypes = caseTypesRaw.map((c) => ({
    name: c.jenisPerkara || 'Lainnya',
    value: c._count._all,
  }));

  return NextResponse.json({
    totalNews,
    totalAnnouncements,
    totalServices,
    totalCases,
    totalUsers,
    totalAgenda,
    totalPutusan,
    totalPages,
    casesThisYear,
    casesThisMonth,
    casesDone,
    casesOngoing,
    todayAgenda,
    monthlyData,
    caseTypes,
  });
}
