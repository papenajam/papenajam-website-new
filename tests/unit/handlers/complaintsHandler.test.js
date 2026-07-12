// Unit tests for app/api/handlers/complaintsHandler.js (Task 9).
//
// Covers: public create (no auth), validation 400, admin list/detail/update/
// delete auth gates, status filter, PUT missing 200 null, DELETE always 200.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPrisma = {
  complaint: {
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

const { handleComplaints } = await import('../../../app/api/handlers/complaintsHandler.js');

function listRequest(qs = '') {
  return { url: `http://localhost/api/complaints${qs ? `?${qs}` : ''}` };
}
function jsonRequest(body) {
  return {
    json: async () => body,
    headers: new Headers(),
    url: 'http://localhost/api/complaints',
  };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

const CREATED = new Date('2024-01-01T00:00:00.000Z');

function dbComplaint(overrides = {}) {
  return {
    id: 'e0000000-0000-4000-8000-000000000001',
    name: 'Contract User',
    email: '',
    phone: null,
    category: null,
    subject: null,
    message: 'Existing complaint',
    status: 'baru',
    adminNotes: '',
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin' });
});

describe('GET /complaints (admin list)', () => {
  test('auth required; returns { items, total, totalPages } sorted createdAt desc', async () => {
    mockPrisma.complaint.count.mockResolvedValue(1);
    mockPrisma.complaint.findMany.mockResolvedValue([dbComplaint()]);

    const out = await read(await handleComplaints(listRequest('page=1&limit=20'), [], 'GET'));

    expect(out.status).toBe(200);
    expect(Object.keys(out.body).sort()).toEqual(['items', 'total', 'totalPages']);
    expect(out.body).not.toHaveProperty('page');
    expect(out.body.items).toHaveLength(1);
    expect(mockPrisma.complaint.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
  });

  test('status filter applied', async () => {
    mockPrisma.complaint.count.mockResolvedValue(0);
    mockPrisma.complaint.findMany.mockResolvedValue([]);

    await handleComplaints(listRequest('status=baru'), [], 'GET');

    expect(mockPrisma.complaint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'baru' } }),
    );
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleComplaints(listRequest(), [], 'GET'));
    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: 'Unauthorized' });
    expect(mockPrisma.complaint.findMany).not.toHaveBeenCalled();
  });
});

describe('POST /complaints (public create)', () => {
  test('201 without auth; returns { message, id }; defaults status/adminNotes', async () => {
    // Explicitly unauthenticated — create must still succeed.
    mockAuth.requireAuth.mockReturnValue(null);
    mockPrisma.complaint.create.mockResolvedValue(
      dbComplaint({ id: 'e0000000-0000-4000-8000-000000000099', name: 'CRUD Complaint', message: 'Created complaint' }),
    );

    const out = await read(
      await handleComplaints(
        jsonRequest({ name: 'CRUD Complaint', message: 'Created complaint' }),
        [],
        'POST',
      ),
    );

    expect(out.status).toBe(201);
    expect(out.body).toEqual({
      message: 'Pengaduan berhasil dikirim',
      id: 'e0000000-0000-4000-8000-000000000099',
    });
    // requireAuth must NOT be required for public create.
    expect(mockAuth.requireAuth).not.toHaveBeenCalled();

    const data = mockPrisma.complaint.create.mock.calls[0][0].data;
    expect(data.status).toBe('baru');
    expect(data.adminNotes).toBe('');
    expect(data.email).toBe('');
    expect(data.phone).toBeNull();
    expect(typeof data.createdAt).toBe('string');
  });

  test('missing name/message -> 400', async () => {
    const out = await read(
      await handleComplaints(jsonRequest({ name: '', message: '' }), [], 'POST'),
    );
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: 'Nama dan pesan wajib diisi' });
    expect(mockPrisma.complaint.create).not.toHaveBeenCalled();
  });
});

describe('GET /complaints/:id', () => {
  test('200 with serialized row when authed', async () => {
    mockPrisma.complaint.findUnique.mockResolvedValue(dbComplaint());
    const out = await read(
      await handleComplaints(listRequest(), ['e0000000-0000-4000-8000-000000000001'], 'GET'),
    );
    expect(out.status).toBe(200);
    expect(out.body.name).toBe('Contract User');
  });

  test('missing -> 404', async () => {
    mockPrisma.complaint.findUnique.mockResolvedValue(null);
    const out = await read(await handleComplaints(listRequest(), ['missing'], 'GET'));
    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: 'Tidak ditemukan' });
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleComplaints(listRequest(), ['id'], 'GET'));
    expect(out.status).toBe(401);
    expect(mockPrisma.complaint.findUnique).not.toHaveBeenCalled();
  });
});

describe('PUT /complaints/:id', () => {
  test('200 with post-update row', async () => {
    mockPrisma.complaint.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.complaint.findUnique.mockResolvedValue(
      dbComplaint({ status: 'selesai', adminNotes: 'Handled' }),
    );

    const out = await read(
      await handleComplaints(
        jsonRequest({ status: 'selesai', adminNotes: 'Handled' }),
        ['e0000000-0000-4000-8000-000000000001'],
        'PUT',
      ),
    );
    expect(out.status).toBe(200);
    expect(out.body.status).toBe('selesai');
    expect(out.body.adminNotes).toBe('Handled');
  });

  test('missing id -> 200 null', async () => {
    mockPrisma.complaint.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.complaint.findUnique.mockResolvedValue(null);
    const res = await handleComplaints(jsonRequest({ status: 'x' }), ['nope'], 'PUT');
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleComplaints(jsonRequest({ status: 'x' }), ['id'], 'PUT'));
    expect(out.status).toBe(401);
    expect(mockPrisma.complaint.updateMany).not.toHaveBeenCalled();
  });
});

describe('DELETE /complaints/:id', () => {
  test('always 200 even when missing', async () => {
    mockPrisma.complaint.deleteMany.mockResolvedValue({ count: 0 });
    const out = await read(await handleComplaints(jsonRequest({}), ['nope'], 'DELETE'));
    expect(out).toEqual({ status: 200, body: { message: 'Berhasil dihapus' } });
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleComplaints(jsonRequest({}), ['id'], 'DELETE'));
    expect(out.status).toBe(401);
    expect(mockPrisma.complaint.deleteMany).not.toHaveBeenCalled();
  });
});
