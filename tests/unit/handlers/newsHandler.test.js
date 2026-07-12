// Unit tests for app/api/handlers/newsHandler.js (Task 8).
//
// Covers: list filters (search + public), pagination envelope, create 201,
// get 404, update missing -> 200 null, delete always success, date-only
// publishDate parse/serialize, 401 unauth.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPrisma = {
  news: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
};
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, getPrisma: () => mockPrisma }));

const mockAuth = { requireAuth: vi.fn() };
vi.mock('@/lib/auth', () => mockAuth);

vi.mock('@/lib/api/serialize.js', async () => import('../../../lib/api/serialize.js'));
vi.mock('@/lib/api/query.js', async () => import('../../../lib/api/query.js'));
vi.mock('@/lib/api/dates.js', async () => import('../../../lib/api/dates.js'));

const { handleNews } = await import('../../../app/api/handlers/newsHandler.js');

function listRequest(qs = '') {
  return { url: `http://localhost/api/news${qs ? `?${qs}` : ''}` };
}
function jsonRequest(body, headers = {}) {
  return {
    json: async () => body,
    headers: new Headers(headers),
    url: 'http://localhost/api/news',
  };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

const CREATED = new Date('2024-02-02T10:00:00.000Z');
const PUBLISH = new Date('2024-02-02T00:00:00.000Z');

function dbNews(overrides = {}) {
  return {
    id: '20000000-0000-4000-8000-000000000001',
    title: 'Contract News Newest',
    titleEn: null,
    content: '<p>content</p>',
    contentEn: null,
    image: null,
    imageAlt: null,
    imageAltEn: null,
    author: 'Admin',
    category: 'Kegiatan',
    isPublished: true,
    publishDate: PUBLISH,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin' });
});

describe('GET /news (list)', () => {
  test('returns paginated envelope sorted by createdAt desc', async () => {
    mockPrisma.news.count.mockResolvedValue(2);
    mockPrisma.news.findMany.mockResolvedValue([
      dbNews(),
      dbNews({ id: '2', title: 'Older', isPublished: false, publishDate: null, createdAt: new Date('2024-01-01T10:00:00.000Z') }),
    ]);

    const out = await read(await handleNews(listRequest('page=1&limit=10'), [], 'GET'));

    expect(out.status).toBe(200);
    expect(Object.keys(out.body).sort()).toEqual(['items', 'page', 'total', 'totalPages']);
    expect(out.body.total).toBe(2);
    expect(out.body.page).toBe(1);
    expect(out.body.totalPages).toBe(1);
    expect(out.body.items).toHaveLength(2);
    expect(out.body.items[0].publishDate).toBe('2024-02-02');
    expect(out.body.items[0].createdAt).toBe('2024-02-02T10:00:00.000Z');
    expect(out.body.items[1].publishDate).toBeNull();

    expect(mockPrisma.news.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 10,
    });
    // count + findMany run in parallel (both called once).
    expect(mockPrisma.news.count).toHaveBeenCalledWith({ where: {} });
  });

  test('public=true filters isPublished=true', async () => {
    mockPrisma.news.count.mockResolvedValue(1);
    mockPrisma.news.findMany.mockResolvedValue([dbNews()]);

    await handleNews(listRequest('public=true&page=1&limit=2'), [], 'GET');

    expect(mockPrisma.news.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublished: true } }),
    );
  });

  test('search uses title contains + mode insensitive', async () => {
    mockPrisma.news.count.mockResolvedValue(0);
    mockPrisma.news.findMany.mockResolvedValue([]);

    await handleNews(listRequest('search=Alpha'), [], 'GET');

    expect(mockPrisma.news.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { title: { contains: 'Alpha', mode: 'insensitive' } },
      }),
    );
  });

  test('search + public combine into a single where', async () => {
    mockPrisma.news.count.mockResolvedValue(0);
    mockPrisma.news.findMany.mockResolvedValue([]);

    await handleNews(listRequest('search=x&public=true'), [], 'GET');

    expect(mockPrisma.news.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          title: { contains: 'x', mode: 'insensitive' },
          isPublished: true,
        },
      }),
    );
  });
});

describe('POST /news (create)', () => {
  test('201: creates with parsed publishDate and ISO timestamps', async () => {
    mockPrisma.news.create.mockResolvedValue(dbNews());

    const out = await read(
      await handleNews(
        jsonRequest({
          title: 'New',
          content: 'Body',
          isPublished: true,
          publishDate: '2024-02-02',
          titleEn: 'EN title',
        }),
        [],
        'POST',
      ),
    );

    expect(out.status).toBe(201);
    expect(out.body.publishDate).toBe('2024-02-02');
    expect(out.body.title).toBe('Contract News Newest');

    const call = mockPrisma.news.create.mock.calls[0][0];
    expect(call.data.publishDate).toBeInstanceOf(Date);
    expect(call.data.publishDate.toISOString()).toBe('2024-02-02T00:00:00.000Z');
    expect(call.data.titleEn).toBe('EN title');
    expect(typeof call.data.createdAt).toBe('string');
    expect(typeof call.data.updatedAt).toBe('string');
  });

  test('empty publishDate -> null on write', async () => {
    mockPrisma.news.create.mockResolvedValue(dbNews({ publishDate: null }));
    await handleNews(
      jsonRequest({ title: 'T', content: 'C', isPublished: false, publishDate: '' }),
      [],
      'POST',
    );
    expect(mockPrisma.news.create.mock.calls[0][0].data.publishDate).toBeNull();
  });

  test('invalid publishDate -> 400', async () => {
    const out = await read(
      await handleNews(
        jsonRequest({ title: 'T', content: 'C', publishDate: '2024-02-30' }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(400);
    expect(out.body.field).toBe('publishDate');
    expect(mockPrisma.news.create).not.toHaveBeenCalled();
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handleNews(jsonRequest({ title: 'T', content: 'C' }), [], 'POST'),
    );
    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: 'Unauthorized' });
  });
});

describe('GET /news/:id', () => {
  test('200 with serialized row', async () => {
    mockPrisma.news.findUnique.mockResolvedValue(dbNews());
    const out = await read(await handleNews(listRequest(), ['20000000-0000-4000-8000-000000000001'], 'GET'));
    expect(out.status).toBe(200);
    expect(out.body.publishDate).toBe('2024-02-02');
    expect(out.body.id).toBe('20000000-0000-4000-8000-000000000001');
  });

  test('missing -> 404 `{ error: "Tidak ditemukan" }`', async () => {
    mockPrisma.news.findUnique.mockResolvedValue(null);
    const out = await read(await handleNews(listRequest(), ['missing'], 'GET'));
    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: 'Tidak ditemukan' });
  });
});

describe('PUT /news/:id', () => {
  test('200 with post-update row', async () => {
    mockPrisma.news.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.news.findUnique.mockResolvedValue(dbNews({ title: 'Updated' }));

    const out = await read(
      await handleNews(
        jsonRequest({ title: 'Updated', publishDate: '2024-03-01' }),
        ['20000000-0000-4000-8000-000000000001'],
        'PUT',
      ),
    );
    expect(out.status).toBe(200);
    expect(out.body.title).toBe('Updated');
    const data = mockPrisma.news.updateMany.mock.calls[0][0].data;
    expect(data.publishDate).toBeInstanceOf(Date);
    expect(typeof data.updatedAt).toBe('string');
  });

  test('missing id -> 200 null (legacy no-op baseline)', async () => {
    mockPrisma.news.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.news.findUnique.mockResolvedValue(null);
    const res = await handleNews(jsonRequest({ title: 'x' }), ['nope'], 'PUT');
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleNews(jsonRequest({ title: 'x' }), ['id'], 'PUT'));
    expect(out.status).toBe(401);
    expect(mockPrisma.news.updateMany).not.toHaveBeenCalled();
  });
});

describe('DELETE /news/:id', () => {
  test('always 200 `{ message: "Berhasil dihapus" }` when row existed', async () => {
    mockPrisma.news.deleteMany.mockResolvedValue({ count: 1 });
    const out = await read(await handleNews(jsonRequest({}), ['id-1'], 'DELETE'));
    expect(out).toEqual({ status: 200, body: { message: 'Berhasil dihapus' } });
  });

  test('always 200 even when id is missing', async () => {
    mockPrisma.news.deleteMany.mockResolvedValue({ count: 0 });
    const out = await read(await handleNews(jsonRequest({}), ['nope'], 'DELETE'));
    expect(out).toEqual({ status: 200, body: { message: 'Berhasil dihapus' } });
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleNews(jsonRequest({}), ['id'], 'DELETE'));
    expect(out.status).toBe(401);
    expect(mockPrisma.news.deleteMany).not.toHaveBeenCalled();
  });
});
