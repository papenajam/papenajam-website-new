// Unit tests for app/api/handlers/statsHandler.js (Task 12).
//
// Covers: auth gate, parallel counts, monthlyData field name/shape (6 buckets),
// caseTypes:[{name,value}] from groupBy, no Mongo usage.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPrisma = {
  news: { count: vi.fn() },
  announcement: { count: vi.fn() },
  service: { count: vi.fn() },
  caseRecord: { count: vi.fn(), groupBy: vi.fn() },
  user: { count: vi.fn() },
  agenda: { count: vi.fn() },
  decision: { count: vi.fn() },
  page: { count: vi.fn() },
};
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, getPrisma: () => mockPrisma }));

const mockAuth = { requireAuth: vi.fn() };
vi.mock('@/lib/auth', () => mockAuth);

vi.mock('@/lib/api/dates.js', async () => import('../../../lib/api/dates.js'));

const { handleStats } = await import('../../../app/api/handlers/statsHandler.js');

function listRequest() {
  return { url: 'http://localhost/api/stats', headers: new Headers() };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

/** Resolve every count() call with the given sequence of numbers. */
function stubCounts(values) {
  let i = 0;
  const next = () => {
    const v = values[i++];
    return Promise.resolve(v === undefined ? 0 : v);
  };
  mockPrisma.news.count.mockImplementation(next);
  mockPrisma.announcement.count.mockImplementation(next);
  mockPrisma.service.count.mockImplementation(next);
  mockPrisma.caseRecord.count.mockImplementation(next);
  mockPrisma.user.count.mockImplementation(next);
  mockPrisma.agenda.count.mockImplementation(next);
  mockPrisma.decision.count.mockImplementation(next);
  mockPrisma.page.count.mockImplementation(next);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin' });
  // Default: all counts 0; monthly buckets (6) also via caseRecord.count
  mockPrisma.news.count.mockResolvedValue(0);
  mockPrisma.announcement.count.mockResolvedValue(0);
  mockPrisma.service.count.mockResolvedValue(0);
  mockPrisma.caseRecord.count.mockResolvedValue(0);
  mockPrisma.user.count.mockResolvedValue(0);
  mockPrisma.agenda.count.mockResolvedValue(0);
  mockPrisma.decision.count.mockResolvedValue(0);
  mockPrisma.page.count.mockResolvedValue(0);
  mockPrisma.caseRecord.groupBy.mockResolvedValue([]);
});

describe('GET /stats auth', () => {
  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleStats(listRequest(), [], 'GET'));
    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: 'Unauthorized' });
    expect(mockPrisma.news.count).not.toHaveBeenCalled();
  });

  test('non-GET returns null', async () => {
    const res = await handleStats(listRequest(), [], 'POST');
    expect(res).toBeNull();
  });
});

describe('GET /stats response shape', () => {
  test('exposes frozen field names including monthlyData and caseTypes', async () => {
    // 13 base counts (8 totals + 5 case/agenda extras) then 6 monthly
    const base = [
      2, // totalNews
      2, // totalAnnouncements
      2, // totalServices
      2, // totalCases
      1, // totalUsers
      3, // totalAgenda
      2, // totalPutusan
      2, // totalPages
      0, // casesThisYear
      0, // casesThisMonth
      1, // casesDone
      1, // casesOngoing
      0, // todayAgenda
    ];
    const monthly = [0, 0, 0, 0, 0, 0];
    // caseRecord.count is called for: totalCases, casesThisYear, casesThisMonth,
    // casesDone, casesOngoing, then 6 monthly = 11 times. Other models once each.
    // Use sequential mockImplementation on each model instead of shared counter.
    mockPrisma.news.count.mockResolvedValue(2);
    mockPrisma.announcement.count.mockResolvedValue(2);
    mockPrisma.service.count.mockResolvedValue(2);
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.agenda.count
      .mockResolvedValueOnce(3) // totalAgenda
      .mockResolvedValueOnce(0); // todayAgenda
    mockPrisma.decision.count.mockResolvedValue(2);
    mockPrisma.page.count.mockResolvedValue(2);

    // caseRecord.count order: totalCases, casesThisYear, casesThisMonth,
    // casesDone, casesOngoing, then 6 months
    const caseCountSeq = [2, 0, 0, 1, 1, ...monthly];
    let ci = 0;
    mockPrisma.caseRecord.count.mockImplementation(() =>
      Promise.resolve(caseCountSeq[ci++] ?? 0),
    );

    mockPrisma.caseRecord.groupBy.mockResolvedValue([
      { jenisPerkara: 'Cerai Gugat', _count: { _all: 1 } },
      { jenisPerkara: 'Itsbat Nikah', _count: { _all: 1 } },
    ]);

    const out = await read(await handleStats(listRequest(), [], 'GET'));
    expect(out.status).toBe(200);

    const keys = Object.keys(out.body).sort();
    expect(keys).toEqual(
      [
        'caseTypes',
        'casesDone',
        'casesOngoing',
        'casesThisMonth',
        'casesThisYear',
        'monthlyData',
        'todayAgenda',
        'totalAgenda',
        'totalAnnouncements',
        'totalCases',
        'totalNews',
        'totalPages',
        'totalPutusan',
        'totalServices',
        'totalUsers',
      ].sort(),
    );

    expect(out.body.totalNews).toBe(2);
    expect(out.body.totalAnnouncements).toBe(2);
    expect(out.body.totalServices).toBe(2);
    expect(out.body.totalCases).toBe(2);
    expect(out.body.totalUsers).toBe(1);
    expect(out.body.totalAgenda).toBe(3);
    expect(out.body.totalPutusan).toBe(2);
    expect(out.body.totalPages).toBe(2);
    expect(out.body.casesThisYear).toBe(0);
    expect(out.body.casesThisMonth).toBe(0);
    expect(out.body.casesDone).toBe(1);
    expect(out.body.casesOngoing).toBe(1);
    expect(out.body.todayAgenda).toBe(0);

    // monthlyData: exactly 6 entries with {month, count}
    expect(out.body.monthlyData).toHaveLength(6);
    for (const item of out.body.monthlyData) {
      expect(Object.keys(item).sort()).toEqual(['count', 'month']);
      expect(typeof item.month).toBe('string');
      expect(typeof item.count).toBe('number');
    }
    expect(out.body.monthlyData.every((item) => item.count === 0)).toBe(true);

    // caseTypes: [{name, value}] — NOT { _id, count }
    expect(out.body.caseTypes).toEqual([
      { name: 'Cerai Gugat', value: 1 },
      { name: 'Itsbat Nikah', value: 1 },
    ]);
  });

  test('caseTypes maps null jenisPerkara to "Lainnya"', async () => {
    mockPrisma.caseRecord.groupBy.mockResolvedValue([
      { jenisPerkara: null, _count: { _all: 4 } },
    ]);

    const out = await read(await handleStats(listRequest(), [], 'GET'));
    expect(out.body.caseTypes).toEqual([{ name: 'Lainnya', value: 4 }]);
  });

  test('groupBy called with by jenisPerkara, orderBy count desc, take 6', async () => {
    await handleStats(listRequest(), [], 'GET');
    expect(mockPrisma.caseRecord.groupBy).toHaveBeenCalledWith({
      by: ['jenisPerkara'],
      _count: { _all: true },
      orderBy: { _count: { jenisPerkara: 'desc' } },
      take: 6,
    });
  });

  test('casesThisYear filters by String(current year)', async () => {
    await handleStats(listRequest(), [], 'GET');
    const yearCalls = mockPrisma.caseRecord.count.mock.calls.filter(
      (c) => c[0]?.where?.tahun !== undefined,
    );
    expect(yearCalls).toHaveLength(1);
    expect(yearCalls[0][0].where).toEqual({
      tahun: String(new Date().getFullYear()),
    });
  });

  test('status filters for casesDone / casesOngoing', async () => {
    await handleStats(listRequest(), [], 'GET');
    const statuses = mockPrisma.caseRecord.count.mock.calls
      .map((c) => c[0]?.where?.status)
      .filter(Boolean);
    expect(statuses).toEqual(expect.arrayContaining(['selesai', 'berjalan']));
  });

  test('six monthly caseRecord.count calls with createdAt range', async () => {
    await handleStats(listRequest(), [], 'GET');
    const monthCalls = mockPrisma.caseRecord.count.mock.calls.filter(
      (c) => c[0]?.where?.createdAt?.gte && c[0]?.where?.createdAt?.lt,
    );
    // 1 casesThisMonth (gte only) + 6 monthly (gte+lt) — filter monthly specifically
    const monthlyOnly = mockPrisma.caseRecord.count.mock.calls.filter(
      (c) =>
        c[0]?.where?.createdAt?.gte instanceof Date &&
        c[0]?.where?.createdAt?.lt instanceof Date,
    );
    expect(monthlyOnly).toHaveLength(6);
  });
});
