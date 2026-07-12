// Unit tests for app/api/handlers/putusanHandler.js (Task 8).
// Prisma model is Decision (@@map("putusan")).

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPrisma = {
  decision: {
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

const { handlePutusan } = await import('../../../app/api/handlers/putusanHandler.js');

function listRequest(qs = '') {
  return { url: `http://localhost/api/putusan${qs ? `?${qs}` : ''}` };
}
function jsonRequest(body) {
  return { json: async () => body, headers: new Headers(), url: 'http://localhost/api/putusan' };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

const CREATED = new Date('2024-02-02T00:00:00.000Z');
const TGL = new Date('2024-02-02T00:00:00.000Z');

function dbDec(overrides = {}) {
  return {
    id: '80000000-0000-4000-8000-000000000001',
    nomorPerkara: '0002/Pdt.G/2024/PA.Pnj',
    jenisPerkara: 'Cerai Gugat',
    tanggalPutusan: TGL,
    ringkasanPutusan: 'Published',
    filePutusan: '/uploads/pdfs/published.pdf',
    hakim: 'Hakim A',
    statusPublish: true,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin' });
});

describe('GET /putusan (list)', () => {
  test('paginated envelope, sorted createdAt desc', async () => {
    mockPrisma.decision.count.mockResolvedValue(1);
    mockPrisma.decision.findMany.mockResolvedValue([dbDec()]);
    const out = await read(await handlePutusan(listRequest('page=1&limit=10'), [], 'GET'));
    expect(out.status).toBe(200);
    expect(out.body.items[0].tanggalPutusan).toBe('2024-02-02');
    expect(mockPrisma.decision.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 10,
    });
  });

  test('public=true filters statusPublish=true', async () => {
    mockPrisma.decision.count.mockResolvedValue(0);
    mockPrisma.decision.findMany.mockResolvedValue([]);
    await handlePutusan(listRequest('public=true'), [], 'GET');
    expect(mockPrisma.decision.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { statusPublish: true } }),
    );
  });

  test('search uses OR of nomorPerkara / jenisPerkara contains insensitive', async () => {
    mockPrisma.decision.count.mockResolvedValue(0);
    mockPrisma.decision.findMany.mockResolvedValue([]);
    await handlePutusan(listRequest('search=Cerai'), [], 'GET');
    expect(mockPrisma.decision.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { nomorPerkara: { contains: 'Cerai', mode: 'insensitive' } },
            { jenisPerkara: { contains: 'Cerai', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });
});

describe('POST /putusan', () => {
  test('201 create with tanggalPutusan parsed', async () => {
    mockPrisma.decision.create.mockResolvedValue(dbDec());
    const out = await read(
      await handlePutusan(
        jsonRequest({
          nomorPerkara: '0001/Pdt.G/2024/PA.Pnj',
          jenisPerkara: 'Waris',
          tanggalPutusan: '2024-02-02',
          statusPublish: true,
        }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(201);
    expect(out.body.tanggalPutusan).toBe('2024-02-02');
    expect(mockPrisma.decision.create.mock.calls[0][0].data.tanggalPutusan).toBeInstanceOf(Date);
  });

  test('empty tanggalPutusan -> null', async () => {
    mockPrisma.decision.create.mockResolvedValue(dbDec({ tanggalPutusan: null }));
    await handlePutusan(
      jsonRequest({ nomorPerkara: 'x', tanggalPutusan: '', statusPublish: false }),
      [],
      'POST',
    );
    expect(mockPrisma.decision.create.mock.calls[0][0].data.tanggalPutusan).toBeNull();
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handlePutusan(jsonRequest({ nomorPerkara: 'x' }), [], 'POST'));
    expect(out.status).toBe(401);
  });
});

describe('GET /putusan/:id', () => {
  test('404 when missing', async () => {
    mockPrisma.decision.findUnique.mockResolvedValue(null);
    const out = await read(await handlePutusan(listRequest(), ['x'], 'GET'));
    expect(out).toEqual({ status: 404, body: { error: 'Tidak ditemukan' } });
  });
});

describe('PUT /putusan/:id', () => {
  test('missing -> 200 null', async () => {
    mockPrisma.decision.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.decision.findUnique.mockResolvedValue(null);
    const res = await handlePutusan(jsonRequest({ nomorPerkara: 'x' }), ['nope'], 'PUT');
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});

describe('DELETE /putusan/:id', () => {
  test('always success', async () => {
    mockPrisma.decision.deleteMany.mockResolvedValue({ count: 0 });
    const out = await read(await handlePutusan(jsonRequest({}), ['nope'], 'DELETE'));
    expect(out).toEqual({ status: 200, body: { message: 'Berhasil dihapus' } });
  });
});
