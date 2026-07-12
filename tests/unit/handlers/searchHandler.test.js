// Unit tests for app/api/handlers/searchHandler.js (Task 17).
//
// Covers multi-domain search shape:
//   - q missing / short -> { results: [] }
//   - five parallel findMany with contains + mode insensitive
//   - result types / urls / excerpts / limits / total

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPrisma = {
  news: { findMany: vi.fn() },
  announcement: { findMany: vi.fn() },
  document: { findMany: vi.fn() },
  faq: { findMany: vi.fn() },
  page: { findMany: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
  getPrisma: () => mockPrisma,
}));

vi.mock('@/lib/prisma-errors.js', async () => import('../../../lib/prisma-errors.js'));

const { handleSearch, excerpt } = await import(
  '../../../app/api/handlers/searchHandler.js'
);

function searchRequest(q) {
  const qs = q === undefined ? '' : `?q=${encodeURIComponent(q)}`;
  return { url: `http://localhost/api/search${qs}` };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

const NEWS_ID = 'a0000000-0000-4000-8000-000000000001';
const ANN_ID = 'a0000000-0000-4000-8000-000000000002';
const DOC_ID = 'a0000000-0000-4000-8000-000000000003';
const FAQ_ID = 'a0000000-0000-4000-8000-000000000004';
const PAGE_ID = 'a0000000-0000-4000-8000-000000000005';

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.news.findMany.mockResolvedValue([]);
  mockPrisma.announcement.findMany.mockResolvedValue([]);
  mockPrisma.document.findMany.mockResolvedValue([]);
  mockPrisma.faq.findMany.mockResolvedValue([]);
  mockPrisma.page.findMany.mockResolvedValue([]);
});

describe('excerpt helper', () => {
  test('strips HTML and truncates to 100 chars', () => {
    expect(excerpt('<p>Hello <b>world</b></p>')).toBe('Hello world');
    const long = 'x'.repeat(150);
    expect(excerpt(long)).toHaveLength(100);
  });
});

describe('GET /search', () => {
  test('missing q -> { results: [] } without querying', async () => {
    const out = await read(await handleSearch(searchRequest(), [], 'GET'));
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ results: [] });
    expect(mockPrisma.news.findMany).not.toHaveBeenCalled();
  });

  test('q length < 2 -> { results: [] }', async () => {
    const out = await read(await handleSearch(searchRequest('a'), [], 'GET'));
    expect(out.body).toEqual({ results: [] });
    expect(mockPrisma.news.findMany).not.toHaveBeenCalled();
  });

  test('non-GET returns null', async () => {
    const res = await handleSearch(searchRequest('ab'), [], 'POST');
    expect(res).toBeNull();
  });

  test('fires five parallel findMany with contains + mode insensitive', async () => {
    await handleSearch(searchRequest('sidang'), [], 'GET');

    const contains = { contains: 'sidang', mode: 'insensitive' };

    expect(mockPrisma.news.findMany).toHaveBeenCalledWith({
      where: {
        isPublished: true,
        OR: [{ title: contains }, { content: contains }],
      },
      take: 5,
    });
    expect(mockPrisma.announcement.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: [{ title: contains }, { content: contains }],
      },
      take: 5,
    });
    expect(mockPrisma.document.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: [{ title: contains }, { description: contains }],
      },
      take: 5,
    });
    expect(mockPrisma.faq.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: [{ question: contains }, { answer: contains }],
      },
      take: 5,
    });
    expect(mockPrisma.page.findMany).toHaveBeenCalledWith({
      where: {
        status: 'published',
        slug: { not: '_homepage' },
        title: contains,
      },
      take: 3,
    });
  });

  test('maps multi-domain results with types/urls/excerpts/total', async () => {
    mockPrisma.news.findMany.mockResolvedValue([
      {
        id: NEWS_ID,
        title: 'Berita Sidang',
        content: '<p>Isi berita tentang sidang keliling yang panjang sekali</p>',
      },
    ]);
    mockPrisma.announcement.findMany.mockResolvedValue([
      {
        id: ANN_ID,
        title: 'Pengumuman Sidang',
        content: '<b>Jadwal</b> sidang tersedia',
      },
    ]);
    mockPrisma.document.findMany.mockResolvedValue([
      {
        id: DOC_ID,
        title: 'Dokumen Sidang',
        description: 'Deskripsi dokumen sidang',
      },
    ]);
    mockPrisma.faq.findMany.mockResolvedValue([
      {
        id: FAQ_ID,
        question: 'Apa itu sidang?',
        answer: '<p>Sidang adalah proses persidangan</p>',
      },
    ]);
    mockPrisma.page.findMany.mockResolvedValue([
      { id: PAGE_ID, title: 'Halaman Sidang', slug: 'sidang-info' },
    ]);

    const out = await read(await handleSearch(searchRequest('sidang'), [], 'GET'));
    expect(out.status).toBe(200);
    expect(out.body.total).toBe(5);
    expect(out.body.results).toHaveLength(5);

    expect(out.body.results[0]).toEqual({
      id: NEWS_ID,
      type: 'news',
      title: 'Berita Sidang',
      excerpt: 'Isi berita tentang sidang keliling yang panjang sekali',
      url: `/berita/${NEWS_ID}`,
    });
    expect(out.body.results[1]).toEqual({
      id: ANN_ID,
      type: 'announcement',
      title: 'Pengumuman Sidang',
      excerpt: 'Jadwal sidang tersedia',
      url: '/#pengumuman',
    });
    expect(out.body.results[2]).toEqual({
      id: DOC_ID,
      type: 'document',
      title: 'Dokumen Sidang',
      excerpt: 'Deskripsi dokumen sidang',
      url: '/dokumen',
    });
    expect(out.body.results[3]).toEqual({
      id: FAQ_ID,
      type: 'faq',
      title: 'Apa itu sidang?',
      excerpt: 'Sidang adalah proses persidangan',
      url: '/faq',
    });
    expect(out.body.results[4]).toEqual({
      id: PAGE_ID,
      type: 'page',
      title: 'Halaman Sidang',
      excerpt: '',
      url: '/p/sidang-info',
    });
  });

  test('respects domain take limits (5/5/5/5/3)', async () => {
    await handleSearch(searchRequest('xx'), [], 'GET');
    expect(mockPrisma.news.findMany.mock.calls[0][0].take).toBe(5);
    expect(mockPrisma.announcement.findMany.mock.calls[0][0].take).toBe(5);
    expect(mockPrisma.document.findMany.mock.calls[0][0].take).toBe(5);
    expect(mockPrisma.faq.findMany.mock.calls[0][0].take).toBe(5);
    expect(mockPrisma.page.findMany.mock.calls[0][0].take).toBe(3);
  });
});
