// Unit tests for app/api/handlers/bannersHandler.js (Task 8).
// Special: active list uses (endDate IS NULL OR endDate >= today);
// empty string dates -> null on write.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPrisma = {
  banner: {
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
vi.mock('@/lib/api/dates.js', async () => import('../../../lib/api/dates.js'));

const { handleBanners } = await import('../../../app/api/handlers/bannersHandler.js');

function listRequest() {
  return { url: 'http://localhost/api/banners' };
}
function jsonRequest(body) {
  return { json: async () => body, headers: new Headers(), url: 'http://localhost/api/banners' };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

const CREATED = new Date('2024-01-01T00:00:00.000Z');
const START = new Date('2024-01-01T00:00:00.000Z');

function dbBanner(overrides = {}) {
  return {
    id: 'd0000000-0000-4000-8000-000000000001',
    title: 'Null End Date',
    subtitle: null,
    buttonText: null,
    buttonUrl: null,
    imageUrl: '/banner-null.jpg',
    bgColor: null,
    textColor: null,
    isActive: true,
    order: 1,
    startDate: START,
    endDate: null,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin' });
});

describe('GET /banners (public active list)', () => {
  test('filters isActive=true AND (endDate null OR endDate >= today), sort order asc', async () => {
    mockPrisma.banner.findMany.mockResolvedValue([
      dbBanner(),
      dbBanner({
        id: 'd0000000-0000-4000-8000-000000000002',
        title: 'Empty End Date',
        order: 2,
        endDate: null, // empty string was normalised to null at write time
      }),
    ]);

    const out = await read(await handleBanners(listRequest(), [], 'GET'));
    expect(out.status).toBe(200);
    expect(Object.keys(out.body).sort()).toEqual(['items']);
    expect(out.body.items).toHaveLength(2);
    expect(out.body.items[0].startDate).toBe('2024-01-01');
    expect(out.body.items[0].endDate).toBeNull();

    const call = mockPrisma.banner.findMany.mock.calls[0][0];
    expect(call.where.isActive).toBe(true);
    expect(call.where.OR).toHaveLength(2);
    expect(call.where.OR[0]).toEqual({ endDate: null });
    expect(call.where.OR[1].endDate.gte).toBeInstanceOf(Date);
    // The gte value is today at UTC midnight.
    const today = new Date().toISOString().split('T')[0];
    expect(call.where.OR[1].endDate.gte.toISOString()).toBe(`${today}T00:00:00.000Z`);
    expect(call.orderBy).toEqual({ order: 'asc' });
  });
});

describe('GET /banners/all', () => {
  test('auth required; returns all sorted by order', async () => {
    mockPrisma.banner.findMany.mockResolvedValue([dbBanner()]);
    const out = await read(await handleBanners(listRequest(), ['all'], 'GET'));
    expect(out.status).toBe(200);
    expect(mockPrisma.banner.findMany).toHaveBeenCalledWith({
      orderBy: { order: 'asc' },
    });
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleBanners(listRequest(), ['all'], 'GET'));
    expect(out.status).toBe(401);
  });
});

describe('POST /banners', () => {
  test('201: empty string dates become null; defaults isActive/order', async () => {
    mockPrisma.banner.create.mockResolvedValue(dbBanner({ order: 0, startDate: null, endDate: null }));
    const out = await read(
      await handleBanners(
        jsonRequest({
          title: 'Created Banner',
          imageUrl: '/created-banner.jpg',
          startDate: '',
          endDate: '',
        }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(201);
    const data = mockPrisma.banner.create.mock.calls[0][0].data;
    expect(data.startDate).toBeNull();
    expect(data.endDate).toBeNull();
    expect(data.isActive).toBe(true);
    expect(data.order).toBe(0);
  });

  test('valid startDate/endDate parsed to UTC midnight Date', async () => {
    mockPrisma.banner.create.mockResolvedValue(
      dbBanner({
        startDate: new Date('2024-01-01T00:00:00.000Z'),
        endDate: new Date('2025-12-31T00:00:00.000Z'),
      }),
    );
    const out = await read(
      await handleBanners(
        jsonRequest({
          title: 'B',
          startDate: '2024-01-01',
          endDate: '2025-12-31',
        }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(201);
    const data = mockPrisma.banner.create.mock.calls[0][0].data;
    expect(data.startDate.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(data.endDate.toISOString()).toBe('2025-12-31T00:00:00.000Z');
    // Response serialises date-only as YYYY-MM-DD.
    expect(out.body.startDate).toBe('2024-01-01');
    expect(out.body.endDate).toBe('2025-12-31');
  });

  test('invalid endDate -> 400', async () => {
    const out = await read(
      await handleBanners(
        jsonRequest({ title: 'B', endDate: 'not-a-date' }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(400);
    expect(out.body.field).toBe('endDate');
    expect(mockPrisma.banner.create).not.toHaveBeenCalled();
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleBanners(jsonRequest({ title: 'B' }), [], 'POST'));
    expect(out.status).toBe(401);
  });
});

describe('PUT /banners/:id', () => {
  test('empty string endDate -> null on write; missing id -> 200 null', async () => {
    mockPrisma.banner.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.banner.findUnique.mockResolvedValue(null);
    const res = await handleBanners(
      jsonRequest({ title: 'x', endDate: '' }),
      ['nope'],
      'PUT',
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
    expect(mockPrisma.banner.updateMany.mock.calls[0][0].data.endDate).toBeNull();
  });

  test('200 with updated row', async () => {
    mockPrisma.banner.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.banner.findUnique.mockResolvedValue(dbBanner({ title: 'Updated Banner' }));
    const out = await read(
      await handleBanners(jsonRequest({ title: 'Updated Banner' }), ['id'], 'PUT'),
    );
    expect(out.status).toBe(200);
    expect(out.body.title).toBe('Updated Banner');
  });
});

describe('DELETE /banners/:id', () => {
  test('always success', async () => {
    mockPrisma.banner.deleteMany.mockResolvedValue({ count: 0 });
    const out = await read(await handleBanners(jsonRequest({}), ['nope'], 'DELETE'));
    expect(out).toEqual({ status: 200, body: { message: 'Berhasil dihapus' } });
  });
});
