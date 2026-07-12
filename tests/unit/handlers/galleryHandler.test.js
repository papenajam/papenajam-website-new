// Unit tests for app/api/handlers/galleryHandler.js (Task 8).
// Public list is NOT paginated; returns `{ items, categories }`.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPrisma = {
  galleryItem: {
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

const { handleGallery } = await import('../../../app/api/handlers/galleryHandler.js');

function listRequest(qs = '') {
  return { url: `http://localhost/api/gallery${qs ? `?${qs}` : ''}` };
}
function jsonRequest(body) {
  return { json: async () => body, headers: new Headers(), url: 'http://localhost/api/gallery' };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

const CREATED = new Date('2024-01-01T00:00:00.000Z');
function dbGal(overrides = {}) {
  return {
    id: 'a0000000-0000-4000-8000-000000000001',
    title: 'Gallery Contract',
    titleEn: null,
    description: null,
    category: 'Kegiatan',
    imageUrl: '/gallery.jpg',
    isActive: true,
    order: 1,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin' });
});

describe('GET /gallery (public list)', () => {
  test('returns { items, categories } with isActive=true filter and order sort', async () => {
    // findMany is called twice: once for items, once for distinct categories.
    mockPrisma.galleryItem.findMany
      .mockResolvedValueOnce([dbGal()])
      .mockResolvedValueOnce([{ category: 'Kegiatan' }]);

    const out = await read(await handleGallery(listRequest(), [], 'GET'));
    expect(out.status).toBe(200);
    expect(Object.keys(out.body).sort()).toEqual(['categories', 'items']);
    expect(out.body.items).toHaveLength(1);
    expect(out.body.categories).toEqual(['Kegiatan']);

    // First call is the items query.
    expect(mockPrisma.galleryItem.findMany.mock.calls[0][0]).toEqual({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    });
    // Second call is distinct categories.
    expect(mockPrisma.galleryItem.findMany.mock.calls[1][0]).toEqual({
      where: { isActive: true },
      distinct: ['category'],
      select: { category: true },
    });
  });

  test('category filter is applied', async () => {
    mockPrisma.galleryItem.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await handleGallery(listRequest('category=Kegiatan&limit=10'), [], 'GET');
    expect(mockPrisma.galleryItem.findMany.mock.calls[0][0]).toEqual({
      where: { isActive: true, category: 'Kegiatan' },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      take: 10,
    });
  });
});

describe('GET /gallery/all', () => {
  test('auth required; returns all items sorted', async () => {
    mockPrisma.galleryItem.findMany.mockResolvedValue([dbGal()]);
    const out = await read(await handleGallery(listRequest(), ['all'], 'GET'));
    expect(out.status).toBe(200);
    expect(Object.keys(out.body).sort()).toEqual(['items']);
    expect(mockPrisma.galleryItem.findMany).toHaveBeenCalledWith({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleGallery(listRequest(), ['all'], 'GET'));
    expect(out.status).toBe(401);
  });
});

describe('POST /gallery', () => {
  test('201 with defaults isActive=true order=0; preserves titleEn', async () => {
    mockPrisma.galleryItem.create.mockResolvedValue(dbGal({ order: 0, titleEn: 'EN' }));
    const out = await read(
      await handleGallery(
        jsonRequest({ title: 'New', imageUrl: '/x.jpg', category: 'A', titleEn: 'EN' }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(201);
    const data = mockPrisma.galleryItem.create.mock.calls[0][0].data;
    expect(data.isActive).toBe(true);
    expect(data.order).toBe(0);
    expect(data.titleEn).toBe('EN');
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleGallery(jsonRequest({ title: 'T' }), [], 'POST'));
    expect(out.status).toBe(401);
  });
});

describe('PUT /gallery/:id', () => {
  test('missing -> 200 null', async () => {
    mockPrisma.galleryItem.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.galleryItem.findUnique.mockResolvedValue(null);
    const res = await handleGallery(jsonRequest({ title: 'x' }), ['nope'], 'PUT');
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});

describe('DELETE /gallery/:id', () => {
  test('always success', async () => {
    mockPrisma.galleryItem.deleteMany.mockResolvedValue({ count: 0 });
    const out = await read(await handleGallery(jsonRequest({}), ['nope'], 'DELETE'));
    expect(out).toEqual({ status: 200, body: { message: 'Berhasil dihapus' } });
  });
});
