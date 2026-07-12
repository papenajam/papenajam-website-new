// Unit tests for app/api/handlers/servicesHandler.js (Task 8).
// Services is NOT paginated; list returns `{ items }` sorted by order asc.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPrisma = {
  service: {
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

const { handleServices } = await import('../../../app/api/handlers/servicesHandler.js');

function jsonRequest(body) {
  return { json: async () => body, headers: new Headers(), url: 'http://localhost/api/services' };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

const CREATED = new Date('2024-01-01T00:00:00.000Z');
function dbSvc(overrides = {}) {
  return {
    id: '40000000-0000-4000-8000-000000000001',
    title: 'First Service',
    description: 'First',
    icon: 'Calendar',
    order: 1,
    isActive: true,
    createdAt: CREATED,
    updatedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin' });
});

describe('GET /services (list)', () => {
  test('returns { items } sorted by order asc — no pagination keys', async () => {
    mockPrisma.service.findMany.mockResolvedValue([
      dbSvc({ order: 1, title: 'First' }),
      dbSvc({ id: '2', order: 2, title: 'Second' }),
    ]);
    const out = await read(await handleServices(jsonRequest({}), [], 'GET'));
    expect(out.status).toBe(200);
    expect(Object.keys(out.body).sort()).toEqual(['items']);
    expect(out.body.items.map((i) => i.title)).toEqual(['First', 'Second']);
    expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
      orderBy: { order: 'asc' },
    });
  });
});

describe('POST /services', () => {
  test('201 create with defaults order=0 isActive=true', async () => {
    mockPrisma.service.create.mockResolvedValue(dbSvc({ order: 0 }));
    const out = await read(
      await handleServices(jsonRequest({ title: 'New', description: 'D', icon: 'X' }), [], 'POST'),
    );
    expect(out.status).toBe(201);
    const data = mockPrisma.service.create.mock.calls[0][0].data;
    expect(data.order).toBe(0);
    expect(data.isActive).toBe(true);
    expect(typeof data.createdAt).toBe('string');
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleServices(jsonRequest({ title: 'T' }), [], 'POST'));
    expect(out.status).toBe(401);
  });
});

describe('GET /services/:id', () => {
  test('404 when missing', async () => {
    mockPrisma.service.findUnique.mockResolvedValue(null);
    const out = await read(await handleServices(jsonRequest({}), ['x'], 'GET'));
    expect(out).toEqual({ status: 404, body: { error: 'Tidak ditemukan' } });
  });
});

describe('PUT /services/:id', () => {
  test('missing -> 200 null', async () => {
    mockPrisma.service.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.service.findUnique.mockResolvedValue(null);
    const res = await handleServices(jsonRequest({ title: 'x' }), ['nope'], 'PUT');
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});

describe('DELETE /services/:id', () => {
  test('always success', async () => {
    mockPrisma.service.deleteMany.mockResolvedValue({ count: 0 });
    const out = await read(await handleServices(jsonRequest({}), ['nope'], 'DELETE'));
    expect(out).toEqual({ status: 200, body: { message: 'Berhasil dihapus' } });
  });
});
