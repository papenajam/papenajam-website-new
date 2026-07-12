// Unit tests for app/api/handlers/mediaHandler.js (Task 13).
//
// Covers:
//   - public list with pagination, search OR, type filter, allowlisted sort
//   - GET /media/:id auth + 404
//   - PUT metadata update (title/alt only) + missing -> 200 null
//   - DELETE: DB first then file; always 200; missing id still 200
//   - unauthorized on GET/PUT/DELETE by id
//
// Mocks: prisma, requireAuth, fs/promises. No real disk or DB.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPrisma = {
  media: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
};
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, getPrisma: () => mockPrisma }));

const mockAuth = { requireAuth: vi.fn() };
vi.mock('@/lib/auth', () => mockAuth);

const mockFs = {
  unlink: vi.fn(),
};
vi.mock('fs/promises', () => mockFs);

vi.mock('@/lib/api/serialize.js', async () => import('../../../lib/api/serialize.js'));
vi.mock('@/lib/api/query.js', async () => import('../../../lib/api/query.js'));

const { handleMedia, mediaAbsolutePath } = await import(
  '../../../app/api/handlers/mediaHandler.js'
);

function listRequest(qs = '') {
  return { url: `http://localhost/api/media${qs ? `?${qs}` : ''}` };
}
function jsonRequest(body) {
  return {
    json: async () => body,
    headers: new Headers(),
    url: 'http://localhost/api/media',
  };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

const CREATED = new Date('2024-02-02T00:00:00.000Z');

function dbMedia(overrides = {}) {
  return {
    id: '11000000-0000-4000-8000-000000000001',
    filename: 'newest.png',
    originalName: 'newest.png',
    url: '/uploads/images/newest.png',
    type: 'image',
    mimeType: 'image/png',
    size: 100,
    ext: 'png',
    title: 'Newest',
    alt: '',
    uploadedBy: 'Contract Admin',
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin', name: 'Admin' });
  mockFs.unlink.mockResolvedValue(undefined);
});

describe('GET /media (public list)', () => {
  test('returns paginated envelope with default sort createdAt desc', async () => {
    mockPrisma.media.count.mockResolvedValue(2);
    mockPrisma.media.findMany.mockResolvedValue([
      dbMedia(),
      dbMedia({
        id: '11000000-0000-4000-8000-000000000002',
        filename: 'older.pdf',
        originalName: 'older.pdf',
        url: '/uploads/pdfs/older.pdf',
        type: 'pdf',
        mimeType: 'application/pdf',
        size: 200,
        title: 'Older',
        alt: null,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      }),
    ]);

    const out = await read(await handleMedia(listRequest('page=1&limit=2'), [], 'GET'));

    expect(out.status).toBe(200);
    expect(Object.keys(out.body).sort()).toEqual(['items', 'page', 'total', 'totalPages']);
    expect(out.body.total).toBe(2);
    expect(out.body.page).toBe(1);
    expect(out.body.totalPages).toBe(1);
    expect(out.body.items).toHaveLength(2);
    // Timestamps serialised to ISO strings.
    expect(out.body.items[0].createdAt).toBe('2024-02-02T00:00:00.000Z');

    expect(mockPrisma.media.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 2,
    });
  });

  test('search applies insensitive contains on title OR originalName', async () => {
    mockPrisma.media.count.mockResolvedValue(0);
    mockPrisma.media.findMany.mockResolvedValue([]);

    await handleMedia(listRequest('search=Contract'), [], 'GET');

    expect(mockPrisma.media.findMany.mock.calls[0][0].where).toEqual({
      OR: [
        { title: { contains: 'Contract', mode: 'insensitive' } },
        { originalName: { contains: 'Contract', mode: 'insensitive' } },
      ],
    });
  });

  test('type filter applied when not "all"', async () => {
    mockPrisma.media.count.mockResolvedValue(0);
    mockPrisma.media.findMany.mockResolvedValue([]);

    await handleMedia(listRequest('type=image'), [], 'GET');
    expect(mockPrisma.media.findMany.mock.calls[0][0].where).toEqual({ type: 'image' });

    await handleMedia(listRequest('type=all'), [], 'GET');
    expect(mockPrisma.media.findMany.mock.calls[1][0].where).toEqual({});
  });

  test('allowlisted sortField=size&sortDir=asc reaches orderBy', async () => {
    mockPrisma.media.count.mockResolvedValue(0);
    mockPrisma.media.findMany.mockResolvedValue([]);

    await handleMedia(listRequest('sortField=size&sortDir=asc'), [], 'GET');

    expect(mockPrisma.media.findMany.mock.calls[0][0].orderBy).toEqual({ size: 'asc' });
  });

  test('arbitrary sortField is clamped to createdAt (security allowlist)', async () => {
    mockPrisma.media.count.mockResolvedValue(0);
    mockPrisma.media.findMany.mockResolvedValue([]);

    await handleMedia(listRequest('sortField=password&sortDir=asc'), [], 'GET');

    expect(mockPrisma.media.findMany.mock.calls[0][0].orderBy).toEqual({
      createdAt: 'asc',
    });
  });
});

describe('GET /media/:id', () => {
  test('200 with serialized row when authed', async () => {
    mockPrisma.media.findUnique.mockResolvedValue(dbMedia());
    const out = await read(
      await handleMedia(listRequest(), ['11000000-0000-4000-8000-000000000001'], 'GET'),
    );
    expect(out.status).toBe(200);
    expect(out.body.title).toBe('Newest');
    expect(out.body.createdAt).toBe('2024-02-02T00:00:00.000Z');
  });

  test('missing -> 404', async () => {
    mockPrisma.media.findUnique.mockResolvedValue(null);
    const out = await read(await handleMedia(listRequest(), ['missing'], 'GET'));
    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: 'Tidak ditemukan' });
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handleMedia(listRequest(), ['11000000-0000-4000-8000-000000000001'], 'GET'),
    );
    expect(out.status).toBe(401);
    expect(mockPrisma.media.findUnique).not.toHaveBeenCalled();
  });
});

describe('PUT /media/:id (metadata update)', () => {
  test('updates only title/alt and returns post-update row', async () => {
    mockPrisma.media.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.media.findUnique.mockResolvedValue(
      dbMedia({ title: 'Updated Media', alt: null }),
    );

    const out = await read(
      await handleMedia(
        jsonRequest({ title: 'Updated Media', alt: null, filename: 'hack.png' }),
        ['11000000-0000-4000-8000-000000000001'],
        'PUT',
      ),
    );

    expect(out.status).toBe(200);
    expect(out.body.title).toBe('Updated Media');
    expect(out.body.alt).toBeNull();

    const data = mockPrisma.media.updateMany.mock.calls[0][0].data;
    expect(data.title).toBe('Updated Media');
    expect(data.alt).toBeNull();
    expect(data).not.toHaveProperty('filename');
    expect(typeof data.updatedAt).toBe('string');
  });

  test('missing -> 200 null', async () => {
    mockPrisma.media.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.media.findUnique.mockResolvedValue(null);
    const res = await handleMedia(jsonRequest({ title: 'x' }), ['nope'], 'PUT');
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleMedia(jsonRequest({ title: 'x' }), ['id'], 'PUT'));
    expect(out.status).toBe(401);
    expect(mockPrisma.media.updateMany).not.toHaveBeenCalled();
  });
});

describe('DELETE /media/:id (DB first, then file)', () => {
  test('deletes DB row first then unlinks file; always 200', async () => {
    const row = dbMedia();
    mockPrisma.media.findUnique.mockResolvedValue(row);
    mockPrisma.media.deleteMany.mockResolvedValue({ count: 1 });

    const out = await read(
      await handleMedia(jsonRequest({}), [row.id], 'DELETE'),
    );

    expect(out).toEqual({ status: 200, body: { message: 'File berhasil dihapus' } });
    expect(mockPrisma.media.deleteMany).toHaveBeenCalledWith({ where: { id: row.id } });
    expect(mockFs.unlink).toHaveBeenCalledWith(mediaAbsolutePath(row.url));

    // Ordering: findUnique -> deleteMany -> unlink (DB first policy).
    const findOrder = mockPrisma.media.findUnique.mock.invocationCallOrder[0];
    const delOrder = mockPrisma.media.deleteMany.mock.invocationCallOrder[0];
    const unlinkOrder = mockFs.unlink.mock.invocationCallOrder[0];
    expect(findOrder).toBeLessThan(delOrder);
    expect(delOrder).toBeLessThan(unlinkOrder);
  });

  test('missing id still 200; no unlink', async () => {
    mockPrisma.media.findUnique.mockResolvedValue(null);
    const out = await read(await handleMedia(jsonRequest({}), ['nope'], 'DELETE'));
    expect(out).toEqual({ status: 200, body: { message: 'File berhasil dihapus' } });
    expect(mockPrisma.media.deleteMany).not.toHaveBeenCalled();
    expect(mockFs.unlink).not.toHaveBeenCalled();
  });

  test('unlink failure after DB delete still returns 200 (orphan logged)', async () => {
    const row = dbMedia();
    mockPrisma.media.findUnique.mockResolvedValue(row);
    mockPrisma.media.deleteMany.mockResolvedValue({ count: 1 });
    mockFs.unlink.mockRejectedValue(new Error('ENOENT'));

    const out = await read(
      await handleMedia(jsonRequest({}), [row.id], 'DELETE'),
    );

    expect(out).toEqual({ status: 200, body: { message: 'File berhasil dihapus' } });
    expect(mockPrisma.media.deleteMany).toHaveBeenCalled();
    expect(mockFs.unlink).toHaveBeenCalled();
  });

  test('unauthenticated -> 401; no DB or fs calls', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleMedia(jsonRequest({}), ['id'], 'DELETE'));
    expect(out.status).toBe(401);
    expect(mockPrisma.media.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.media.deleteMany).not.toHaveBeenCalled();
    expect(mockFs.unlink).not.toHaveBeenCalled();
  });
});
