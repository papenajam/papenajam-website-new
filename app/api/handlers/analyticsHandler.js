// Analytics handler (Task 12: MongoDB -> PostgreSQL/Prisma migration).
//
// Behaviour is byte-identical to the legacy Mongo handler:
//   - POST /analytics/track  -> upsert by unique (date, path), views += 1
//   - GET  /analytics?days=N
//       anonymous       -> { total, days }
//       authenticated   -> { total, dailyData, topPages, days }
//
// Prisma model is `AnalyticsDailyPath` (@@map("analytics")).
// Unique: @@unique([date, path]) → where: { date_path: { date, path } }.
// `date` is DateTime @db.Date (wire: YYYY-MM-DD).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { parseDateOnly, formatDateOnly } from '@/lib/api/dates.js';

export async function handleAnalytics(request, segments, method) {
  const [sub] = segments;

  if (sub === 'track' && method === 'POST') {
    const body = await request.json();
    const dateStr = new Date().toISOString().split('T')[0];
    const date = parseDateOnly(dateStr, 'date');
    const path = body.path || '/';

    await prisma.analyticsDailyPath.upsert({
      where: { date_path: { date, path } },
      update: { views: { increment: 1 } },
      create: { date, path, views: 1 },
    });
    return NextResponse.json({ ok: true });
  }

  if (!sub && method === 'GET') {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30', 10);
    const authUser = requireAuth(request);
    const sinceStr = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const since = parseDateOnly(sinceStr, 'date');

    const records = await prisma.analyticsDailyPath.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'desc' },
    });

    const byDate = {};
    const byPath = {};
    let total = 0;
    for (const r of records) {
      const dateKey = formatDateOnly(r.date) || r.date;
      byDate[dateKey] = (byDate[dateKey] || 0) + r.views;
      byPath[r.path] = (byPath[r.path] || 0) + r.views;
      total += r.views;
    }

    if (!authUser) {
      return NextResponse.json({ total, days });
    }

    const dailyData = Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, views]) => ({ date, views }));
    const topPages = Object.entries(byPath)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, views]) => ({ path, views }));

    return NextResponse.json({ total, dailyData, topPages, days });
  }

  return null;
}
