// Unit tests for app/api/handlers/analyticsHandler.js (Task 12).
//
// Covers: track upsert with views increment (unique date_path), public
// total-only response vs authenticated detail (dailyData + topPages).

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPrisma = {
  analyticsDailyPath: {
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
};
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, getPrisma: () => mockPrisma }));

const mockAuth = { requireAuth: vi.fn() };
vi.mock('@/lib/auth', () => mockAuth);

vi.mock('@/lib/api/dates.js', async () => import('../../../lib/api/dates.js'));

const { handleAnalytics } = await import('../../../app/api/handlers/analyticsHandler.js');

function listRequest(qs = '') {
  return { url: `http://localhost/api/analytics${qs ? `?${qs}` : ''}` };
}
function jsonRequest(body) {
  return {
    json: async () => body,
    headers: new Headers(),
    url: 'http://localhost/api/analytics/track',
  };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin' });
});

describe('POST /analytics/track', () => {
  test('upserts by unique (date, path) with views increment:1 and create views:1', async () => {
    mockPrisma.analyticsDailyPath.upsert.mockResolvedValue({
      id: 'a0000000-0000-4000-8000-000000000001',
      date: new Date('2024-01-01T00:00:00.000Z'),
      path: '/faq',
      views: 1,
    });

    const out = await read(
      await handleAnalytics(jsonRequest({ path: '/faq' }), ['track'], 'POST'),
    );

    expect(out).toEqual({ status: 200, body: { ok: true } });
    expect(mockPrisma.analyticsDailyPath.upsert).toHaveBeenCalledTimes(1);

    const args = mockPrisma.analyticsDailyPath.upsert.mock.calls[0][0];
    expect(args.where).toHaveProperty('date_path');
    expect(args.where.date_path.path).toBe('/faq');
    expect(args.where.date_path.date).toBeInstanceOf(Date);
    expect(args.update).toEqual({ views: { increment: 1 } });
    expect(args.create.path).toBe('/faq');
    expect(args.create.views).toBe(1);
    expect(args.create.date).toBeInstanceOf(Date);
  });

  test('defaults path to "/" when body.path is missing', async () => {
    mockPrisma.analyticsDailyPath.upsert.mockResolvedValue({});
    await handleAnalytics(jsonRequest({}), ['track'], 'POST');
    const args = mockPrisma.analyticsDailyPath.upsert.mock.calls[0][0];
    expect(args.where.date_path.path).toBe('/');
    expect(args.create.path).toBe('/');
  });
});

describe('GET /analytics — anonymous (total only)', () => {
  test('returns { total, days } only; no dailyData/topPages', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    mockPrisma.analyticsDailyPath.findMany.mockResolvedValue([
      {
        id: '1',
        date: new Date('2024-01-01T00:00:00.000Z'),
        path: '/',
        views: 2,
      },
      {
        id: '2',
        date: new Date('2024-01-02T00:00:00.000Z'),
        path: '/faq',
        views: 3,
      },
    ]);

    const out = await read(await handleAnalytics(listRequest('days=5000'), [], 'GET'));

    expect(out.status).toBe(200);
    expect(Object.keys(out.body).sort()).toEqual(['days', 'total']);
    expect(out.body).toEqual({ total: 5, days: 5000 });
    expect(out.body).not.toHaveProperty('dailyData');
    expect(out.body).not.toHaveProperty('topPages');
  });
});

describe('GET /analytics — authenticated (detail)', () => {
  test('returns total + dailyData (sorted asc) + topPages (views desc, top 10)', async () => {
    mockAuth.requireAuth.mockReturnValue({ id: 'admin' });
    mockPrisma.analyticsDailyPath.findMany.mockResolvedValue([
      {
        id: '2',
        date: new Date('2024-01-02T00:00:00.000Z'),
        path: '/faq',
        views: 3,
      },
      {
        id: '1',
        date: new Date('2024-01-01T00:00:00.000Z'),
        path: '/',
        views: 2,
      },
    ]);

    const out = await read(await handleAnalytics(listRequest('days=5000'), [], 'GET'));

    expect(out.status).toBe(200);
    expect(Object.keys(out.body).sort()).toEqual([
      'dailyData',
      'days',
      'topPages',
      'total',
    ]);
    expect(out.body.total).toBe(5);
    expect(out.body.days).toBe(5000);
    expect(out.body.dailyData).toEqual([
      { date: '2024-01-01', views: 2 },
      { date: '2024-01-02', views: 3 },
    ]);
    expect(out.body.topPages).toEqual([
      { path: '/faq', views: 3 },
      { path: '/', views: 2 },
    ]);

    const findArgs = mockPrisma.analyticsDailyPath.findMany.mock.calls[0][0];
    expect(findArgs.where.date.gte).toBeInstanceOf(Date);
    expect(findArgs.orderBy).toEqual({ date: 'desc' });
  });

  test('aggregates multiple paths on the same date into one dailyData entry', async () => {
    mockAuth.requireAuth.mockReturnValue({ id: 'admin' });
    mockPrisma.analyticsDailyPath.findMany.mockResolvedValue([
      {
        id: '1',
        date: new Date('2024-01-01T00:00:00.000Z'),
        path: '/',
        views: 2,
      },
      {
        id: '2',
        date: new Date('2024-01-01T00:00:00.000Z'),
        path: '/faq',
        views: 5,
      },
    ]);

    const out = await read(await handleAnalytics(listRequest('days=30'), [], 'GET'));
    expect(out.body.dailyData).toEqual([{ date: '2024-01-01', views: 7 }]);
    expect(out.body.total).toBe(7);
  });

  test('defaults days to 30 when query param missing', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    mockPrisma.analyticsDailyPath.findMany.mockResolvedValue([]);
    const out = await read(await handleAnalytics(listRequest(), [], 'GET'));
    expect(out.body.days).toBe(30);
    expect(out.body.total).toBe(0);
  });
});

describe('unmatched route', () => {
  test('returns null for unknown sub/method', async () => {
    const res = await handleAnalytics(listRequest(), ['nope'], 'GET');
    expect(res).toBeNull();
  });
});
