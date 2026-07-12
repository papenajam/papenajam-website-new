// Unit tests for app/api/handlers/announcementsHandler.js (Task 8).

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPrisma = {
  announcement: {
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

const { handleAnnouncements } = await import('../../../app/api/handlers/announcementsHandler.js');

function listRequest(qs = '') {
  return { url: `http://localhost/api/announcements${qs ? `?${qs}` : ''}` };
}
function jsonRequest(body) {
  return { json: async () => body, headers: new Headers(), url: 'http://localhost/api/announcements' };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

const CREATED = new Date('2024-02-01T09:00:00.000Z');
const PUBLISH = new Date('2024-02-01T00:00:00.000Z');

function dbAnn(overrides = {}) {
  return {
    id: '30000000-0000-4000-8000-000000000001',
    title: 'Contract Announcement Active',
    content: 'Body',
    publishDate: PUBLISH,
    isActive: true,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin' });
});

describe('GET /announcements (list)', () => {
  test('paginated envelope, sorted createdAt desc', async () => {
    mockPrisma.announcement.count.mockResolvedValue(1);
    mockPrisma.announcement.findMany.mockResolvedValue([dbAnn()]);
    const out = await read(await handleAnnouncements(listRequest('page=1&limit=10'), [], 'GET'));
    expect(out.status).toBe(200);
    expect(out.body.items[0].publishDate).toBe('2024-02-01');
    expect(mockPrisma.announcement.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 10,
    });
  });

  test('public=true filters isActive=true', async () => {
    mockPrisma.announcement.count.mockResolvedValue(0);
    mockPrisma.announcement.findMany.mockResolvedValue([]);
    await handleAnnouncements(listRequest('public=true'), [], 'GET');
    expect(mockPrisma.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  test('search uses title contains insensitive', async () => {
    mockPrisma.announcement.count.mockResolvedValue(0);
    mockPrisma.announcement.findMany.mockResolvedValue([]);
    await handleAnnouncements(listRequest('search=hello'), [], 'GET');
    expect(mockPrisma.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { title: { contains: 'hello', mode: 'insensitive' } },
      }),
    );
  });
});

describe('POST /announcements', () => {
  test('201 create with publishDate parsed', async () => {
    mockPrisma.announcement.create.mockResolvedValue(dbAnn());
    const out = await read(
      await handleAnnouncements(
        jsonRequest({ title: 'T', content: 'C', isActive: true, publishDate: '2024-02-01' }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(201);
    expect(out.body.publishDate).toBe('2024-02-01');
    expect(mockPrisma.announcement.create.mock.calls[0][0].data.publishDate).toBeInstanceOf(Date);
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleAnnouncements(jsonRequest({ title: 'T', content: 'C' }), [], 'POST'));
    expect(out.status).toBe(401);
  });
});

describe('GET /announcements/:id', () => {
  test('404 when missing', async () => {
    mockPrisma.announcement.findUnique.mockResolvedValue(null);
    const out = await read(await handleAnnouncements(listRequest(), ['x'], 'GET'));
    expect(out).toEqual({ status: 404, body: { error: 'Tidak ditemukan' } });
  });
});

describe('PUT /announcements/:id', () => {
  test('missing -> 200 null', async () => {
    mockPrisma.announcement.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.announcement.findUnique.mockResolvedValue(null);
    const res = await handleAnnouncements(jsonRequest({ title: 'x' }), ['nope'], 'PUT');
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  test('200 with updated row', async () => {
    mockPrisma.announcement.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.announcement.findUnique.mockResolvedValue(dbAnn({ title: 'Up' }));
    const out = await read(await handleAnnouncements(jsonRequest({ title: 'Up' }), ['id'], 'PUT'));
    expect(out.status).toBe(200);
    expect(out.body.title).toBe('Up');
  });
});

describe('DELETE /announcements/:id', () => {
  test('always success even when missing', async () => {
    mockPrisma.announcement.deleteMany.mockResolvedValue({ count: 0 });
    const out = await read(await handleAnnouncements(jsonRequest({}), ['nope'], 'DELETE'));
    expect(out).toEqual({ status: 200, body: { message: 'Berhasil dihapus' } });
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleAnnouncements(jsonRequest({}), ['id'], 'DELETE'));
    expect(out.status).toBe(401);
  });
});
