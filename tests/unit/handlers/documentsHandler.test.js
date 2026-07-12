// Unit tests for app/api/handlers/documentsHandler.js (Task 9).
//
// Covers: active list + distinct category, search/category filters, download
// atomic increment, missing download id preserves baseline body (no P2025),
// create defaults, PUT missing 200 null, DELETE always 200, 401 unauth.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPrisma = {
  document: {
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

const { handleDocuments } = await import('../../../app/api/handlers/documentsHandler.js');

function listRequest(qs = '') {
  return { url: `http://localhost/api/documents${qs ? `?${qs}` : ''}` };
}
function jsonRequest(body) {
  return {
    json: async () => body,
    headers: new Headers(),
    url: 'http://localhost/api/documents',
  };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

const CREATED = new Date('2024-02-02T00:00:00.000Z');

function dbDoc(overrides = {}) {
  return {
    id: 'a0000000-0000-4000-8000-000000000001',
    title: 'Contract Document Newest',
    titleEn: null,
    description: 'Contract searchable document',
    category: 'Laporan',
    fileUrl: '/documents/newest.pdf',
    fileType: null,
    isActive: true,
    order: 0,
    downloadCount: 0,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin' });
});

describe('GET /documents (list)', () => {
  test('returns { items, total, categories, totalPages } with isActive filter', async () => {
    mockPrisma.document.count.mockResolvedValue(2);
    mockPrisma.document.findMany
      .mockResolvedValueOnce([
        dbDoc(),
        dbDoc({
          id: 'a0000000-0000-4000-8000-000000000002',
          title: 'Older',
          downloadCount: 3,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        }),
      ])
      .mockResolvedValueOnce([{ category: 'Laporan' }]);

    const out = await read(await handleDocuments(listRequest('page=1&limit=2'), [], 'GET'));

    expect(out.status).toBe(200);
    expect(Object.keys(out.body).sort()).toEqual(['categories', 'items', 'total', 'totalPages']);
    expect(out.body.total).toBe(2);
    expect(out.body.totalPages).toBe(1);
    expect(out.body.categories).toEqual(['Laporan']);
    // No `page` key (legacy envelope).
    expect(out.body).not.toHaveProperty('page');

    expect(mockPrisma.document.findMany.mock.calls[0][0]).toEqual({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 2,
    });
    // distinct categories query
    expect(mockPrisma.document.findMany.mock.calls[1][0]).toEqual({
      where: { isActive: true },
      distinct: ['category'],
      select: { category: true },
    });
  });

  test('category and search filters applied', async () => {
    mockPrisma.document.count.mockResolvedValue(0);
    mockPrisma.document.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await handleDocuments(listRequest('category=Laporan&search=Contract'), [], 'GET');

    expect(mockPrisma.document.findMany.mock.calls[0][0].where).toEqual({
      isActive: true,
      category: 'Laporan',
      title: { contains: 'Contract', mode: 'insensitive' },
    });
  });
});

describe('GET /documents/download/:id', () => {
  test('atomic increment then returns fileUrl+title', async () => {
    mockPrisma.document.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.document.findUnique.mockResolvedValue(
      dbDoc({
        id: 'a0000000-0000-4000-8000-000000000002',
        title: 'Contract Document Older',
        fileUrl: '/documents/older.pdf',
        downloadCount: 4,
      }),
    );

    const out = await read(
      await handleDocuments(listRequest(), ['download', 'a0000000-0000-4000-8000-000000000002'], 'GET'),
    );

    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      fileUrl: '/documents/older.pdf',
      title: 'Contract Document Older',
    });
    expect(mockPrisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: 'a0000000-0000-4000-8000-000000000002' },
      data: { downloadCount: { increment: 1 } },
    });
    // Must use updateMany (not update) so missing id never throws P2025.
    expect(mockPrisma.document.updateMany).toHaveBeenCalled();
  });

  test('missing download id preserves baseline body (no throw)', async () => {
    mockPrisma.document.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.document.findUnique.mockResolvedValue(null);

    const res = await handleDocuments(listRequest(), ['download', 'missing-id'], 'GET');
    expect(res.status).toBe(200);
    // NextResponse.json({ fileUrl: undefined, title: undefined }) -> {}
    expect(await res.json()).toEqual({});
    expect(mockPrisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: 'missing-id' },
      data: { downloadCount: { increment: 1 } },
    });
  });
});

describe('POST /documents (create)', () => {
  test('201 with defaults isActive=true downloadCount=0 order=0', async () => {
    mockPrisma.document.create.mockResolvedValue(dbDoc({ order: 0, downloadCount: 0 }));

    const out = await read(
      await handleDocuments(
        jsonRequest({
          title: 'Created Document',
          description: '',
          category: 'Test',
          fileUrl: '/created.pdf',
        }),
        [],
        'POST',
      ),
    );

    expect(out.status).toBe(201);
    const data = mockPrisma.document.create.mock.calls[0][0].data;
    expect(data.isActive).toBe(true);
    expect(data.downloadCount).toBe(0);
    expect(data.order).toBe(0);
    expect(typeof data.createdAt).toBe('string');
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handleDocuments(jsonRequest({ title: 'T', fileUrl: '/x.pdf' }), [], 'POST'),
    );
    expect(out.status).toBe(401);
  });
});

describe('GET /documents/:id', () => {
  test('200 with serialized row', async () => {
    mockPrisma.document.findUnique.mockResolvedValue(dbDoc());
    const out = await read(
      await handleDocuments(listRequest(), ['a0000000-0000-4000-8000-000000000001'], 'GET'),
    );
    expect(out.status).toBe(200);
    expect(out.body.title).toBe('Contract Document Newest');
  });

  test('missing -> 404', async () => {
    mockPrisma.document.findUnique.mockResolvedValue(null);
    const out = await read(await handleDocuments(listRequest(), ['missing'], 'GET'));
    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: 'Tidak ditemukan' });
  });
});

describe('PUT /documents/:id', () => {
  test('missing -> 200 null', async () => {
    mockPrisma.document.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.document.findUnique.mockResolvedValue(null);
    const res = await handleDocuments(jsonRequest({ title: 'x' }), ['nope'], 'PUT');
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleDocuments(jsonRequest({ title: 'x' }), ['id'], 'PUT'));
    expect(out.status).toBe(401);
  });
});

describe('DELETE /documents/:id', () => {
  test('always 200 even when missing', async () => {
    mockPrisma.document.deleteMany.mockResolvedValue({ count: 0 });
    const out = await read(await handleDocuments(jsonRequest({}), ['nope'], 'DELETE'));
    expect(out).toEqual({ status: 200, body: { message: 'Berhasil dihapus' } });
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleDocuments(jsonRequest({}), ['id'], 'DELETE'));
    expect(out.status).toBe(401);
    expect(mockPrisma.document.deleteMany).not.toHaveBeenCalled();
  });
});
