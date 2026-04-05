import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function handleAnalytics(request, segments, method) {
  const [sub] = segments;
  const col = await getCollection('analytics');

  if (sub === 'track' && method === 'POST') {
    const body = await request.json();
    const date = new Date().toISOString().split('T')[0];
    const p    = body.path || '/';
    await col.updateOne({ date, path: p }, { $inc: { views: 1 }, $set: { date, path: p } }, { upsert: true });
    return NextResponse.json({ ok: true });
  }

  if (!sub && method === 'GET') {
    const url      = new URL(request.url);
    const days     = parseInt(url.searchParams.get('days') || '30');
    const authUser = requireAuth(request);
    const since    = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const records  = await col.find({ date: { $gte: since } }).sort({ date: -1 }).toArray();
    const byDate = {}, byPath = {};
    let total = 0;
    records.forEach(r => {
      byDate[r.date] = (byDate[r.date] || 0) + r.views;
      byPath[r.path] = (byPath[r.path] || 0) + r.views;
      total += r.views;
    });
    const dailyData = Object.entries(byDate).sort((a,b) => a[0].localeCompare(b[0])).map(([date, views]) => ({ date, views }));
    const topPages  = Object.entries(byPath).sort((a,b) => b[1]-a[1]).slice(0,10).map(([path, views]) => ({ path, views }));
    if (!authUser) return NextResponse.json({ total, days });
    return NextResponse.json({ total, dailyData, topPages, days });
  }
  return null;
}
