// Unit tests for app/api/handlers/faqHandler.js (Task 8).

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPrisma = {
  faq: {
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

const { handleFaq } = await import('../../../app/api/handlers/faqHandler.js');

function listRequest(qs = '') {
  return { url: `http://localhost/api/faq${qs ? `?${qs}` : ''}` };
}
function jsonRequest(body) {
  return { json: async () => body, headers: new Headers(), url: 'http://localhost/api/faq' };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

const CREATED = new Date('2024-01-01T00:00:00.000Z');
function dbFaq(overrides = {}) {
  return {
    id: 'c0000000-0000-4000-8000-000000000001',
    question: 'Contract searchable question?',
    questionEn: null,
    answer: '<p>Contract answer</p>',
    answerEn: null,
    category: 'Umum',
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

describe('GET /faq (public list)', () => {
  test('returns { items, categories } with isActive filter and order sort', async () => {
    mockPrisma.faq.findMany
      .mockResolvedValueOnce([dbFaq()])
      .mockResolvedValueOnce([{ category: 'Umum' }]);

    const out = await read(await handleFaq(listRequest(), [], 'GET'));
    expect(out.status).toBe(200);
    expect(Object.keys(out.body).sort()).toEqual(['categories', 'items']);
    expect(out.body.categories).toEqual(['Umum']);
    expect(mockPrisma.faq.findMany.mock.calls[0][0]).toEqual({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  });

  test('category filter applied', async () => {
    mockPrisma.faq.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await handleFaq(listRequest('category=Umum'), [], 'GET');
    expect(mockPrisma.faq.findMany.mock.calls[0][0].where).toEqual({
      isActive: true,
      category: 'Umum',
    });
  });
});

describe('GET /faq/all', () => {
  test('auth required; all items', async () => {
    mockPrisma.faq.findMany.mockResolvedValue([dbFaq()]);
    const out = await read(await handleFaq(listRequest(), ['all'], 'GET'));
    expect(out.status).toBe(200);
    expect(Object.keys(out.body).sort()).toEqual(['items']);
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleFaq(listRequest(), ['all'], 'GET'));
    expect(out.status).toBe(401);
  });
});

describe('POST /faq', () => {
  test('201 with defaults; preserves questionEn/answerEn', async () => {
    mockPrisma.faq.create.mockResolvedValue(dbFaq({ order: 0, questionEn: 'EN?' }));
    const out = await read(
      await handleFaq(
        jsonRequest({
          question: 'Q?',
          answer: 'A',
          category: 'Test',
          questionEn: 'EN?',
          answerEn: 'EN A',
        }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(201);
    const data = mockPrisma.faq.create.mock.calls[0][0].data;
    expect(data.isActive).toBe(true);
    expect(data.order).toBe(0);
    expect(data.questionEn).toBe('EN?');
    expect(data.answerEn).toBe('EN A');
  });
});

describe('PUT /faq/:id', () => {
  test('missing -> 200 null', async () => {
    mockPrisma.faq.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.faq.findUnique.mockResolvedValue(null);
    const res = await handleFaq(jsonRequest({ answer: 'x' }), ['nope'], 'PUT');
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});

describe('DELETE /faq/:id', () => {
  test('always success', async () => {
    mockPrisma.faq.deleteMany.mockResolvedValue({ count: 0 });
    const out = await read(await handleFaq(jsonRequest({}), ['nope'], 'DELETE'));
    expect(out).toEqual({ status: 200, body: { message: 'Berhasil dihapus' } });
  });
});
