// Site search handler (Task 17: PostgreSQL/Prisma implementation).
//
// Behaviour is byte-identical to the established API contract:
//   - GET /search?q=... -> 200 `{ results, total }`
//   - q missing or length < 2 -> `{ results: [] }` (no total key — legacy shape)
//   - Five parallel domain queries with `contains` + `mode: 'insensitive'`:
//       news (isPublished, take 5)         -> type 'news', url /berita/:id
//       announcements (isActive, take 5)   -> type 'announcement', url /#pengumuman
//       documents (isActive, take 5)       -> type 'document', url /dokumen
//       faq (isActive, take 5)             -> type 'faq', url /faq
//       pages (published, slug≠_homepage, take 3) -> type 'page', url /p/:slug
//   - Excerpts strip HTML tags and truncate to 100 chars (pages: empty string).
//
// Index / pg_trgm optimisation is deferred until live EXPLAIN (Task 17 step 4-5);
// this pass only ports the query shape.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mapError } from '@/lib/prisma-errors.js';

/**
 * Strip HTML tags and truncate to `max` characters for search excerpts.
 *
 * @param {string|null|undefined} text
 * @param {number} [max=100]
 * @returns {string|undefined}
 */
export function excerpt(text, max = 100) {
  if (text == null) return text === null || text === undefined ? text : '';
  const stripped = String(text).replace(/<[^>]+>/g, '');
  return stripped.substring(0, max);
}

export async function handleSearch(request, _segments, method) {
  if (method !== 'GET') return null;

  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const contains = { contains: q, mode: 'insensitive' };

  try {
    const [newsItems, annItems, docItems, faqItems, pageItems] = await Promise.all([
      prisma.news.findMany({
        where: {
          isPublished: true,
          OR: [{ title: contains }, { content: contains }],
        },
        take: 5,
      }),
      prisma.announcement.findMany({
        where: {
          isActive: true,
          OR: [{ title: contains }, { content: contains }],
        },
        take: 5,
      }),
      prisma.document.findMany({
        where: {
          isActive: true,
          OR: [{ title: contains }, { description: contains }],
        },
        take: 5,
      }),
      prisma.faq.findMany({
        where: {
          isActive: true,
          OR: [{ question: contains }, { answer: contains }],
        },
        take: 5,
      }),
      prisma.page.findMany({
        where: {
          status: 'published',
          slug: { not: '_homepage' },
          title: contains,
        },
        take: 3,
      }),
    ]);

    const results = [
      ...newsItems.map((i) => ({
        id: i.id,
        type: 'news',
        title: i.title,
        excerpt: excerpt(i.content),
        url: `/berita/${i.id}`,
      })),
      ...annItems.map((i) => ({
        id: i.id,
        type: 'announcement',
        title: i.title,
        excerpt: excerpt(i.content),
        url: `/#pengumuman`,
      })),
      ...docItems.map((i) => ({
        id: i.id,
        type: 'document',
        title: i.title,
        excerpt: i.description != null ? String(i.description).substring(0, 100) : i.description,
        url: `/dokumen`,
      })),
      ...faqItems.map((i) => ({
        id: i.id,
        type: 'faq',
        title: i.question,
        excerpt: excerpt(i.answer),
        url: `/faq`,
      })),
      ...pageItems.map((i) => ({
        id: i.id,
        type: 'page',
        title: i.title,
        excerpt: '',
        url: `/p/${i.slug}`,
      })),
    ];

    return NextResponse.json({ results, total: results.length });
  } catch (err) {
    const mapped = mapError(err, { behavior: 'get' });
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
