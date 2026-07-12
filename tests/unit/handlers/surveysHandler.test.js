// Unit tests for app/api/handlers/surveysHandler.js (Task 12).
//
// Covers: config GET defaults / found, config PUT upsert id `main` (auth),
// submit insert, list pagination + averageRating one-decimal rounding.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPrisma = {
  surveyConfig: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  surveyResponse: {
    create: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
  },
};
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, getPrisma: () => mockPrisma }));

const mockAuth = { requireAuth: vi.fn() };
vi.mock('@/lib/auth', () => mockAuth);

vi.mock('@/lib/api/serialize.js', async () => import('../../../lib/api/serialize.js'));
vi.mock('@/lib/api/query.js', async () => import('../../../lib/api/query.js'));

const { handleSurveys } = await import('../../../app/api/handlers/surveysHandler.js');

function listRequest(qs = '') {
  return { url: `http://localhost/api/surveys${qs ? `?${qs}` : ''}` };
}
function jsonRequest(body, path = '/api/surveys') {
  return {
    json: async () => body,
    headers: new Headers(),
    url: `http://localhost${path}`,
  };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

const CREATED = new Date('2024-01-01T00:00:00.000Z');

function dbResponse(overrides = {}) {
  return {
    id: 'd0000000-0000-4000-8000-000000000001',
    rating: 4,
    comment: '',
    page: null,
    createdAt: CREATED,
    ...overrides,
  };
}

function dbConfig(overrides = {}) {
  return {
    id: 'main',
    isActive: true,
    title: 'Contract Survey',
    subtitle: '',
    thankYouMessage: null,
    updatedAt: CREATED,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin' });
});

describe('GET /surveys/config', () => {
  test('returns defaults when no row exists', async () => {
    mockPrisma.surveyConfig.findUnique.mockResolvedValue(null);
    const out = await read(await handleSurveys(listRequest(), ['config'], 'GET'));
    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      id: 'main',
      isActive: true,
      title: 'Survei Kepuasan',
      subtitle: 'Bantu kami meningkatkan pelayanan',
    });
    expect(mockPrisma.surveyConfig.findUnique).toHaveBeenCalledWith({
      where: { id: 'main' },
    });
  });

  test('returns stored config when present', async () => {
    mockPrisma.surveyConfig.findUnique.mockResolvedValue(dbConfig());
    const out = await read(await handleSurveys(listRequest(), ['config'], 'GET'));
    expect(out.status).toBe(200);
    expect(out.body.id).toBe('main');
    expect(out.body.title).toBe('Contract Survey');
    expect(out.body.isActive).toBe(true);
    expect(out.body.updatedAt).toBe('2024-01-01T00:00:00.000Z');
  });
});

describe('PUT /surveys/config', () => {
  test('upserts id main and returns success message', async () => {
    mockPrisma.surveyConfig.upsert.mockResolvedValue(dbConfig({ isActive: false }));
    const out = await read(
      await handleSurveys(
        jsonRequest({ isActive: false, title: 'Updated Survey', subtitle: null }),
        ['config'],
        'PUT',
      ),
    );
    expect(out).toEqual({
      status: 200,
      body: { message: 'Konfigurasi survei disimpan' },
    });

    const args = mockPrisma.surveyConfig.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'main' });
    expect(args.create.id).toBe('main');
    expect(args.create.isActive).toBe(false);
    expect(args.create.title).toBe('Updated Survey');
    expect(args.create.subtitle).toBeNull();
    expect(args.update.isActive).toBe(false);
    expect(args.update.title).toBe('Updated Survey');
    expect(args.update.updatedAt).toBeInstanceOf(Date);
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handleSurveys(jsonRequest({ title: 'x' }), ['config'], 'PUT'),
    );
    expect(out.status).toBe(401);
    expect(mockPrisma.surveyConfig.upsert).not.toHaveBeenCalled();
  });
});

describe('POST /surveys/submit', () => {
  test('inserts SurveyResponse and returns thank-you message', async () => {
    mockPrisma.surveyResponse.create.mockResolvedValue(dbResponse({ rating: 5 }));
    const out = await read(
      await handleSurveys(
        jsonRequest({ rating: 5, comment: '' }, '/api/surveys/submit'),
        ['submit'],
        'POST',
      ),
    );
    expect(out).toEqual({
      status: 200,
      body: { message: 'Terima kasih atas masukan Anda!' },
    });

    const data = mockPrisma.surveyResponse.create.mock.calls[0][0].data;
    expect(data.rating).toBe(5);
    expect(data.comment).toBe('');
    expect(data.createdAt).toBeInstanceOf(Date);
  });
});

describe('GET /surveys (admin list)', () => {
  test('returns paginated items + averageRating rounded to 1 decimal', async () => {
    mockPrisma.surveyResponse.count.mockResolvedValue(3);
    mockPrisma.surveyResponse.findMany.mockResolvedValue([
      dbResponse({ rating: 5 }),
      dbResponse({
        id: 'd0000000-0000-4000-8000-000000000002',
        rating: 4,
      }),
      dbResponse({
        id: 'd0000000-0000-4000-8000-000000000003',
        rating: 3,
      }),
    ]);
    // (5+4+3)/3 = 4.0 exactly, but use a non-terminating avg to prove rounding
    mockPrisma.surveyResponse.aggregate.mockResolvedValue({
      _avg: { rating: 4.3333333333 },
      _count: { _all: 3 },
    });

    const out = await read(
      await handleSurveys(listRequest('page=1&limit=20'), [], 'GET'),
    );

    expect(out.status).toBe(200);
    expect(Object.keys(out.body).sort()).toEqual([
      'averageRating',
      'items',
      'total',
      'totalPages',
      'totalResponses',
    ]);
    expect(out.body.total).toBe(3);
    expect(out.body.totalPages).toBe(1);
    expect(out.body.totalResponses).toBe(3);
    // Legacy: parseFloat(avg.toFixed(1)) → 4.3
    expect(out.body.averageRating).toBe(4.3);
    expect(out.body.items).toHaveLength(3);
    expect(out.body.items[0].createdAt).toBe('2024-01-01T00:00:00.000Z');
    // no `page` key (legacy shape)
    expect(out.body).not.toHaveProperty('page');

    expect(mockPrisma.surveyResponse.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
  });

  test('averageRating is 0 (number) when no responses', async () => {
    mockPrisma.surveyResponse.count.mockResolvedValue(0);
    mockPrisma.surveyResponse.findMany.mockResolvedValue([]);
    mockPrisma.surveyResponse.aggregate.mockResolvedValue({
      _avg: { rating: null },
      _count: { _all: 0 },
    });

    const out = await read(await handleSurveys(listRequest(), [], 'GET'));
    expect(out.body.averageRating).toBe(0);
    expect(out.body.totalResponses).toBe(0);
    expect(out.body.items).toEqual([]);
  });

  test('integer average stays as number without trailing .0 (parseFloat)', async () => {
    mockPrisma.surveyResponse.count.mockResolvedValue(1);
    mockPrisma.surveyResponse.findMany.mockResolvedValue([dbResponse()]);
    mockPrisma.surveyResponse.aggregate.mockResolvedValue({
      _avg: { rating: 4 },
      _count: { _all: 1 },
    });

    const out = await read(await handleSurveys(listRequest(), [], 'GET'));
    // parseFloat("4.0") === 4
    expect(out.body.averageRating).toBe(4);
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleSurveys(listRequest(), [], 'GET'));
    expect(out.status).toBe(401);
    expect(mockPrisma.surveyResponse.count).not.toHaveBeenCalled();
  });

  test('pagination skip/take from page+limit', async () => {
    mockPrisma.surveyResponse.count.mockResolvedValue(50);
    mockPrisma.surveyResponse.findMany.mockResolvedValue([]);
    mockPrisma.surveyResponse.aggregate.mockResolvedValue({
      _avg: { rating: null },
      _count: { _all: 50 },
    });

    const out = await read(
      await handleSurveys(listRequest('page=2&limit=10'), [], 'GET'),
    );
    expect(out.body.totalPages).toBe(5);
    expect(mockPrisma.surveyResponse.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      skip: 10,
      take: 10,
    });
  });
});
