// Unit tests for app/api/handlers/agendaHandler.js (Task 9).
//
// Covers: dateFrom/dateTo parse, sort tanggal+waktu asc, public status not
// dibatalkan, search, create 201, get 404, PUT missing 200 null, DELETE always
// 200, 401 unauth.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPrisma = {
  agenda: {
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

const { handleAgenda } = await import('../../../app/api/handlers/agendaHandler.js');

function listRequest(qs = '') {
  return { url: `http://localhost/api/agenda${qs ? `?${qs}` : ''}` };
}
function jsonRequest(body) {
  return {
    json: async () => body,
    headers: new Headers(),
    url: 'http://localhost/api/agenda',
  };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

const CREATED = new Date('2024-01-01T00:00:00.000Z');
const TANGGAL = new Date('2024-03-01T00:00:00.000Z');

function dbAgenda(overrides = {}) {
  return {
    id: '70000000-0000-4000-8000-000000000001',
    nomorPerkara: '0001/Pdt.G/2024/PA.Pnj',
    jenisPerkara: 'Itsbat Nikah',
    tanggalSidang: TANGGAL,
    waktuSidang: '08:30',
    ruangSidang: 'Ruang I',
    hakim: 'Hakim A',
    panitera: 'Panitera',
    status: 'selesai',
    keterangan: '',
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin' });
});

describe('GET /agenda (list)', () => {
  test('returns paginated envelope sorted by tanggalSidang+waktuSidang asc', async () => {
    mockPrisma.agenda.count.mockResolvedValue(2);
    mockPrisma.agenda.findMany.mockResolvedValue([
      dbAgenda(),
      dbAgenda({
        id: '70000000-0000-4000-8000-000000000002',
        tanggalSidang: new Date('2024-03-02T00:00:00.000Z'),
        waktuSidang: '09:00',
        status: 'dijadwalkan',
      }),
    ]);

    const out = await read(await handleAgenda(listRequest('page=1&limit=20'), [], 'GET'));

    expect(out.status).toBe(200);
    expect(Object.keys(out.body).sort()).toEqual(['items', 'page', 'total', 'totalPages']);
    expect(out.body.items[0].tanggalSidang).toBe('2024-03-01');
    expect(mockPrisma.agenda.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ tanggalSidang: 'asc' }, { waktuSidang: 'asc' }],
      skip: 0,
      take: 20,
    });
  });

  test('public=true filters status not dibatalkan', async () => {
    mockPrisma.agenda.count.mockResolvedValue(2);
    mockPrisma.agenda.findMany.mockResolvedValue([dbAgenda()]);

    await handleAgenda(listRequest('public=true'), [], 'GET');

    expect(mockPrisma.agenda.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { not: 'dibatalkan' } },
      }),
    );
  });

  test('dateFrom/dateTo parse to Date range on tanggalSidang', async () => {
    mockPrisma.agenda.count.mockResolvedValue(0);
    mockPrisma.agenda.findMany.mockResolvedValue([]);

    await handleAgenda(listRequest('dateFrom=2024-03-02&dateTo=2024-03-03'), [], 'GET');

    const where = mockPrisma.agenda.findMany.mock.calls[0][0].where;
    expect(where.tanggalSidang.gte).toBeInstanceOf(Date);
    expect(where.tanggalSidang.gte.toISOString()).toBe('2024-03-02T00:00:00.000Z');
    expect(where.tanggalSidang.lte).toBeInstanceOf(Date);
    expect(where.tanggalSidang.lte.toISOString()).toBe('2024-03-03T00:00:00.000Z');
  });

  test('invalid dateFrom -> 400', async () => {
    const out = await read(await handleAgenda(listRequest('dateFrom=2024-13-01'), [], 'GET'));
    expect(out.status).toBe(400);
    expect(out.body.field).toBe('dateFrom');
    expect(mockPrisma.agenda.findMany).not.toHaveBeenCalled();
  });

  test('search uses nomorPerkara contains + mode insensitive', async () => {
    mockPrisma.agenda.count.mockResolvedValue(0);
    mockPrisma.agenda.findMany.mockResolvedValue([]);

    await handleAgenda(listRequest('search=0001'), [], 'GET');

    expect(mockPrisma.agenda.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nomorPerkara: { contains: '0001', mode: 'insensitive' } },
      }),
    );
  });

  test('status equality; public overwrites status filter', async () => {
    mockPrisma.agenda.count.mockResolvedValue(0);
    mockPrisma.agenda.findMany.mockResolvedValue([]);

    await handleAgenda(listRequest('status=selesai&public=true'), [], 'GET');

    expect(mockPrisma.agenda.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { not: 'dibatalkan' } },
      }),
    );
  });
});

describe('POST /agenda (create)', () => {
  test('201: creates with parsed tanggalSidang', async () => {
    mockPrisma.agenda.create.mockResolvedValue(dbAgenda());

    const out = await read(
      await handleAgenda(
        jsonRequest({
          nomorPerkara: '0001/Pdt.G/2024/PA.Pnj',
          jenisPerkara: 'Itsbat Nikah',
          tanggalSidang: '2024-03-01',
          waktuSidang: '08:30',
          status: 'dijadwalkan',
        }),
        [],
        'POST',
      ),
    );

    expect(out.status).toBe(201);
    expect(out.body.tanggalSidang).toBe('2024-03-01');
    const data = mockPrisma.agenda.create.mock.calls[0][0].data;
    expect(data.tanggalSidang).toBeInstanceOf(Date);
    expect(typeof data.createdAt).toBe('string');
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handleAgenda(jsonRequest({ nomorPerkara: 'x', tanggalSidang: '2024-04-01' }), [], 'POST'),
    );
    expect(out.status).toBe(401);
  });
});

describe('GET /agenda/:id', () => {
  test('200 with serialized row', async () => {
    mockPrisma.agenda.findUnique.mockResolvedValue(dbAgenda());
    const out = await read(
      await handleAgenda(listRequest(), ['70000000-0000-4000-8000-000000000001'], 'GET'),
    );
    expect(out.status).toBe(200);
    expect(out.body.tanggalSidang).toBe('2024-03-01');
  });

  test('missing -> 404', async () => {
    mockPrisma.agenda.findUnique.mockResolvedValue(null);
    const out = await read(await handleAgenda(listRequest(), ['missing'], 'GET'));
    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: 'Tidak ditemukan' });
  });
});

describe('PUT /agenda/:id', () => {
  test('missing id -> 200 null', async () => {
    mockPrisma.agenda.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.agenda.findUnique.mockResolvedValue(null);
    const res = await handleAgenda(jsonRequest({ status: 'selesai' }), ['nope'], 'PUT');
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleAgenda(jsonRequest({ status: 'x' }), ['id'], 'PUT'));
    expect(out.status).toBe(401);
  });
});

describe('DELETE /agenda/:id', () => {
  test('always 200 even when missing', async () => {
    mockPrisma.agenda.deleteMany.mockResolvedValue({ count: 0 });
    const out = await read(await handleAgenda(jsonRequest({}), ['nope'], 'DELETE'));
    expect(out).toEqual({ status: 200, body: { message: 'Berhasil dihapus' } });
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleAgenda(jsonRequest({}), ['id'], 'DELETE'));
    expect(out.status).toBe(401);
    expect(mockPrisma.agenda.deleteMany).not.toHaveBeenCalled();
  });
});
