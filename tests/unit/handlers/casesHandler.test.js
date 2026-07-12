// Unit tests for app/api/handlers/casesHandler.js (Task 9).
//
// Covers: list filters (search, tahun, jenis, namaPihak OR, status),
// pagination envelope, create 201, get 404, update missing -> 200 null,
// delete always success, date-only jadwalSidang, 401 unauth.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPrisma = {
  caseRecord: {
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

const { handleCases } = await import('../../../app/api/handlers/casesHandler.js');

function listRequest(qs = '') {
  return { url: `http://localhost/api/cases${qs ? `?${qs}` : ''}` };
}
function jsonRequest(body) {
  return {
    json: async () => body,
    headers: new Headers(),
    url: 'http://localhost/api/cases',
  };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

const CREATED = new Date('2024-02-02T00:00:00.000Z');
const JADWAL = new Date('2024-03-01T00:00:00.000Z');

function dbCase(overrides = {}) {
  return {
    id: '60000000-0000-4000-8000-000000000001',
    nomorPerkara: '0002/Pdt.G/2024/PA.Pnj',
    tahun: '2024',
    jenisPerkara: 'Cerai Gugat',
    pemohon: 'Siti Contract',
    termohon: 'Budi Contract',
    status: 'berjalan',
    jadwalSidang: JADWAL,
    ruangSidang: 'Ruang I',
    hakim: 'Hakim A',
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin' });
});

describe('GET /cases (list)', () => {
  test('returns paginated envelope sorted by createdAt desc', async () => {
    mockPrisma.caseRecord.count.mockResolvedValue(2);
    mockPrisma.caseRecord.findMany.mockResolvedValue([
      dbCase(),
      dbCase({
        id: '60000000-0000-4000-8000-000000000002',
        nomorPerkara: '0001/Pdt.G/2024/PA.Pnj',
        jadwalSidang: null,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      }),
    ]);

    const out = await read(await handleCases(listRequest('page=1&limit=10'), [], 'GET'));

    expect(out.status).toBe(200);
    expect(Object.keys(out.body).sort()).toEqual(['items', 'page', 'total', 'totalPages']);
    expect(out.body.total).toBe(2);
    expect(out.body.page).toBe(1);
    expect(out.body.items).toHaveLength(2);
    expect(out.body.items[0].jadwalSidang).toBe('2024-03-01');
    expect(out.body.items[1].jadwalSidang).toBeNull();

    expect(mockPrisma.caseRecord.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 10,
    });
  });

  test('search uses nomorPerkara contains + mode insensitive', async () => {
    mockPrisma.caseRecord.count.mockResolvedValue(0);
    mockPrisma.caseRecord.findMany.mockResolvedValue([]);

    await handleCases(listRequest('search=0002'), [], 'GET');

    expect(mockPrisma.caseRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nomorPerkara: { contains: '0002', mode: 'insensitive' } },
      }),
    );
  });

  test('tahun and status use equality', async () => {
    mockPrisma.caseRecord.count.mockResolvedValue(0);
    mockPrisma.caseRecord.findMany.mockResolvedValue([]);

    await handleCases(listRequest('tahun=2024&status=berjalan'), [], 'GET');

    expect(mockPrisma.caseRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tahun: '2024', status: 'berjalan' },
      }),
    );
  });

  test('jenis uses jenisPerkara contains + mode insensitive', async () => {
    mockPrisma.caseRecord.count.mockResolvedValue(0);
    mockPrisma.caseRecord.findMany.mockResolvedValue([]);

    await handleCases(listRequest('jenis=Cerai'), [], 'GET');

    expect(mockPrisma.caseRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jenisPerkara: { contains: 'Cerai', mode: 'insensitive' } },
      }),
    );
  });

  test('namaPihak builds OR on pemohon/termohon contains insensitive', async () => {
    mockPrisma.caseRecord.count.mockResolvedValue(1);
    mockPrisma.caseRecord.findMany.mockResolvedValue([dbCase()]);

    await handleCases(listRequest('namaPihak=siti'), [], 'GET');

    expect(mockPrisma.caseRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { pemohon: { contains: 'siti', mode: 'insensitive' } },
            { termohon: { contains: 'siti', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });
});

describe('POST /cases (create)', () => {
  test('201: creates with parsed jadwalSidang and ISO timestamps', async () => {
    mockPrisma.caseRecord.create.mockResolvedValue(dbCase());

    const out = await read(
      await handleCases(
        jsonRequest({
          nomorPerkara: '0002/Pdt.G/2024/PA.Pnj',
          tahun: '2024',
          jenisPerkara: 'Cerai Gugat',
          pemohon: 'Siti Contract',
          termohon: 'Budi Contract',
          status: 'berjalan',
          jadwalSidang: '2024-03-01',
        }),
        [],
        'POST',
      ),
    );

    expect(out.status).toBe(201);
    expect(out.body.jadwalSidang).toBe('2024-03-01');
    const call = mockPrisma.caseRecord.create.mock.calls[0][0];
    expect(call.data.jadwalSidang).toBeInstanceOf(Date);
    expect(call.data.jadwalSidang.toISOString()).toBe('2024-03-01T00:00:00.000Z');
    expect(typeof call.data.createdAt).toBe('string');
    expect(typeof call.data.updatedAt).toBe('string');
  });

  test('empty jadwalSidang -> null on write', async () => {
    mockPrisma.caseRecord.create.mockResolvedValue(dbCase({ jadwalSidang: null }));
    await handleCases(
      jsonRequest({
        nomorPerkara: 'x',
        tahun: '2024',
        jenisPerkara: 'Test',
        jadwalSidang: '',
      }),
      [],
      'POST',
    );
    expect(mockPrisma.caseRecord.create.mock.calls[0][0].data.jadwalSidang).toBeNull();
  });

  test('invalid jadwalSidang -> 400', async () => {
    const out = await read(
      await handleCases(
        jsonRequest({ nomorPerkara: 'x', tahun: '2024', jenisPerkara: 'T', jadwalSidang: '2024-02-30' }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(400);
    expect(out.body.field).toBe('jadwalSidang');
    expect(mockPrisma.caseRecord.create).not.toHaveBeenCalled();
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handleCases(jsonRequest({ nomorPerkara: 'x', tahun: '2024', jenisPerkara: 'T' }), [], 'POST'),
    );
    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: 'Unauthorized' });
  });
});

describe('GET /cases/:id', () => {
  test('200 with serialized row', async () => {
    mockPrisma.caseRecord.findUnique.mockResolvedValue(dbCase());
    const out = await read(
      await handleCases(listRequest(), ['60000000-0000-4000-8000-000000000001'], 'GET'),
    );
    expect(out.status).toBe(200);
    expect(out.body.jadwalSidang).toBe('2024-03-01');
  });

  test('missing -> 404', async () => {
    mockPrisma.caseRecord.findUnique.mockResolvedValue(null);
    const out = await read(await handleCases(listRequest(), ['missing'], 'GET'));
    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: 'Tidak ditemukan' });
  });
});

describe('PUT /cases/:id', () => {
  test('200 with post-update row', async () => {
    mockPrisma.caseRecord.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.caseRecord.findUnique.mockResolvedValue(dbCase({ status: 'selesai' }));

    const out = await read(
      await handleCases(
        jsonRequest({ status: 'selesai' }),
        ['60000000-0000-4000-8000-000000000001'],
        'PUT',
      ),
    );
    expect(out.status).toBe(200);
    expect(out.body.status).toBe('selesai');
    expect(typeof mockPrisma.caseRecord.updateMany.mock.calls[0][0].data.updatedAt).toBe('string');
  });

  test('missing id -> 200 null (legacy no-op baseline)', async () => {
    mockPrisma.caseRecord.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.caseRecord.findUnique.mockResolvedValue(null);
    const res = await handleCases(jsonRequest({ status: 'x' }), ['nope'], 'PUT');
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleCases(jsonRequest({ status: 'x' }), ['id'], 'PUT'));
    expect(out.status).toBe(401);
    expect(mockPrisma.caseRecord.updateMany).not.toHaveBeenCalled();
  });
});

describe('DELETE /cases/:id', () => {
  test('always 200 when row existed', async () => {
    mockPrisma.caseRecord.deleteMany.mockResolvedValue({ count: 1 });
    const out = await read(await handleCases(jsonRequest({}), ['id-1'], 'DELETE'));
    expect(out).toEqual({ status: 200, body: { message: 'Berhasil dihapus' } });
  });

  test('always 200 even when id is missing', async () => {
    mockPrisma.caseRecord.deleteMany.mockResolvedValue({ count: 0 });
    const out = await read(await handleCases(jsonRequest({}), ['nope'], 'DELETE'));
    expect(out).toEqual({ status: 200, body: { message: 'Berhasil dihapus' } });
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleCases(jsonRequest({}), ['id'], 'DELETE'));
    expect(out.status).toBe(401);
    expect(mockPrisma.caseRecord.deleteMany).not.toHaveBeenCalled();
  });
});
