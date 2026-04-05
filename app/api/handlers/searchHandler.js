import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';

export async function handleSearch(request, _segments, method) {
  if (method !== 'GET') return null;

  const url = new URL(request.url);
  const q   = url.searchParams.get('q') || '';
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const regex = { $regex: q, $options: 'i' };
  const [newsItems, annItems, docItems, faqItems, pageItems] = await Promise.all([
    getCollection('news').then(c         => c.find({ $or: [{ title: regex }, { content: regex }], isPublished: true }).limit(5).toArray()),
    getCollection('announcements').then(c => c.find({ $or: [{ title: regex }, { content: regex }], isActive: true }).limit(5).toArray()),
    getCollection('documents').then(c    => c.find({ $or: [{ title: regex }, { description: regex }], isActive: true }).limit(5).toArray()),
    getCollection('faq').then(c          => c.find({ $or: [{ question: regex }, { answer: regex }], isActive: true }).limit(5).toArray()),
    getCollection('pages').then(c        => c.find({ title: regex, status: 'published', slug: { $ne: '_homepage' } }).limit(3).toArray()),
  ]);

  const results = [
    ...newsItems.map(i  => ({ id: i.id, type: 'news',         title: i.title,    excerpt: i.content?.replace(/<[^>]+>/g,'').substring(0,100), url: `/berita/${i.id}` })),
    ...annItems.map(i   => ({ id: i.id, type: 'announcement', title: i.title,    excerpt: i.content?.replace(/<[^>]+>/g,'').substring(0,100), url: `/#pengumuman` })),
    ...docItems.map(i   => ({ id: i.id, type: 'document',     title: i.title,    excerpt: i.description?.substring(0,100),                   url: `/dokumen` })),
    ...faqItems.map(i   => ({ id: i.id, type: 'faq',          title: i.question, excerpt: i.answer?.replace(/<[^>]+>/g,'').substring(0,100), url: `/faq` })),
    ...pageItems.map(i  => ({ id: i.id, type: 'page',         title: i.title,    excerpt: '',                                                 url: `/p/${i.slug}` })),
  ];
  return NextResponse.json({ results, total: results.length });
}
