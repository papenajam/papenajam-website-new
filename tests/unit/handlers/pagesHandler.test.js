// Unit tests for app/api/handlers/pagesHandler.js (Task 10).
//
// Covers:
//   - GET  /pages list (createdAt desc, { items })
//   - GET  /pages/:id 200 | 404
//   - GET  /pages/slug/:slug published gate (public vs authenticated)
//   - POST /pages 201 with nested bilingual blocks; defaults blocks=[] status=draft
//   - POST /pages rejects non-array blocks (400)
//   - POST /pages P2002 slug uniqueness -> 400 `{ error: 'Slug sudah digunakan' }`
//   - PUT  /pages/:id missing -> 200 null
//   - PUT  /pages/:id update with blocks round-trip
//   - DELETE /pages/:id always 200
//   - Auth 401 on mutating methods
//   - Special slug `_homepage` lookup works for both public (published) and auth
//   - Representative fixtures (homepage / page-builder / nested bilingual) round-trip

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPrisma = {
  page: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
};
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, getPrisma: () => mockPrisma }));

const mockAuth = { requireAuth: vi.fn() };
vi.mock('@/lib/auth', () => mockAuth);

vi.mock('@/lib/api/serialize.js', async () => import('../../../lib/api/serialize.js'));
vi.mock('@/lib/prisma-errors.js', async () => import('../../../lib/prisma-errors.js'));

const { handlePages } = await import('../../../app/api/handlers/pagesHandler.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../../fixtures/page-blocks');

function loadFixture(name) {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8'));
}

function listRequest() {
  return { url: 'http://localhost/api/pages', headers: new Headers() };
}
function slugRequest(slug, headers = {}) {
  return {
    url: `http://localhost/api/pages/slug/${slug}`,
    headers: new Headers(headers),
  };
}
function jsonRequest(body, headers = {}) {
  return {
    json: async () => body,
    headers: new Headers(headers),
    url: 'http://localhost/api/pages',
  };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

const CREATED = new Date('2024-02-01T00:00:00.000Z');
const UPDATED = new Date('2024-02-02T10:00:00.000Z');

function dbPage(overrides = {}) {
  return {
    id: 'a0000000-0000-4000-8000-000000000001',
    title: 'Published Contract Page',
    slug: 'contract-published',
    status: 'published',
    blocks: [],
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin' });
});

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
describe('GET /pages (list)', () => {
  test('returns { items } sorted createdAt desc with ISO timestamps', async () => {
    const newer = dbPage({
      id: 'a0000000-0000-4000-8000-000000000002',
      slug: 'newer',
      createdAt: UPDATED,
      updatedAt: UPDATED,
    });
    const older = dbPage();
    mockPrisma.page.findMany.mockResolvedValue([newer, older]);

    const out = await read(await handlePages(listRequest(), [], 'GET'));
    expect(out.status).toBe(200);
    expect(Object.keys(out.body).sort()).toEqual(['items']);
    expect(out.body.items).toHaveLength(2);
    expect(out.body.items[0].createdAt).toBe('2024-02-02T10:00:00.000Z');
    expect(out.body.items[1].createdAt).toBe('2024-02-01T00:00:00.000Z');
    expect(mockPrisma.page.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
  });
});

// ---------------------------------------------------------------------------
// Get by id
// ---------------------------------------------------------------------------
describe('GET /pages/:id', () => {
  test('returns serialized page', async () => {
    mockPrisma.page.findUnique.mockResolvedValue(dbPage());
    const out = await read(
      await handlePages(listRequest(), ['a0000000-0000-4000-8000-000000000001'], 'GET'),
    );
    expect(out.status).toBe(200);
    expect(out.body.id).toBe('a0000000-0000-4000-8000-000000000001');
    expect(out.body.slug).toBe('contract-published');
    expect(out.body.createdAt).toBe('2024-02-01T00:00:00.000Z');
  });

  test('missing id -> 404 { error: Tidak ditemukan }', async () => {
    mockPrisma.page.findUnique.mockResolvedValue(null);
    const out = await read(await handlePages(listRequest(), ['nope'], 'GET'));
    expect(out).toEqual({ status: 404, body: { error: 'Tidak ditemukan' } });
  });
});

// ---------------------------------------------------------------------------
// Get by slug — published gate
// ---------------------------------------------------------------------------
describe('GET /pages/slug/:slug', () => {
  test('public: published slug returns page', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    mockPrisma.page.findFirst.mockResolvedValue(dbPage());

    const out = await read(
      await handlePages(slugRequest('contract-published'), ['slug', 'contract-published'], 'GET'),
    );
    expect(out.status).toBe(200);
    expect(out.body.slug).toBe('contract-published');
    expect(mockPrisma.page.findFirst).toHaveBeenCalledWith({
      where: { slug: 'contract-published', status: 'published' },
    });
  });

  test('public: draft slug -> 404 Halaman tidak ditemukan', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    mockPrisma.page.findFirst.mockResolvedValue(null);

    const out = await read(
      await handlePages(slugRequest('contract-draft'), ['slug', 'contract-draft'], 'GET'),
    );
    expect(out).toEqual({
      status: 404,
      body: { error: 'Halaman tidak ditemukan' },
    });
    expect(mockPrisma.page.findFirst).toHaveBeenCalledWith({
      where: { slug: 'contract-draft', status: 'published' },
    });
  });

  test('authenticated: draft slug is visible (no status filter)', async () => {
    mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin' });
    const draft = dbPage({
      slug: 'contract-draft',
      status: 'draft',
      blocks: [{ id: 'hero-contract', type: 'hero', settings: { title: 'Draft' } }],
    });
    mockPrisma.page.findFirst.mockResolvedValue(draft);

    const out = await read(
      await handlePages(slugRequest('contract-draft'), ['slug', 'contract-draft'], 'GET'),
    );
    expect(out.status).toBe(200);
    expect(out.body.status).toBe('draft');
    expect(out.body.blocks).toEqual([
      { id: 'hero-contract', type: 'hero', settings: { title: 'Draft' } },
    ]);
    expect(mockPrisma.page.findFirst).toHaveBeenCalledWith({
      where: { slug: 'contract-draft' },
    });
  });

  test('special _homepage slug: public published lookup works', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const homepage = dbPage({
      title: 'Beranda',
      slug: '_homepage',
      status: 'published',
      blocks: loadFixture('homepage-default.json'),
    });
    mockPrisma.page.findFirst.mockResolvedValue(homepage);

    const out = await read(
      await handlePages(slugRequest('_homepage'), ['slug', '_homepage'], 'GET'),
    );
    expect(out.status).toBe(200);
    expect(out.body.slug).toBe('_homepage');
    expect(out.body.blocks).toHaveLength(5);
    expect(out.body.blocks[0].type).toBe('hero_home');
    expect(mockPrisma.page.findFirst).toHaveBeenCalledWith({
      where: { slug: '_homepage', status: 'published' },
    });
  });
});

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
describe('POST /pages', () => {
  test('201 with defaults blocks=[] status=draft', async () => {
    const created = dbPage({
      title: 'Created Page',
      slug: 'created-contract-page',
      status: 'draft',
      blocks: [],
    });
    mockPrisma.page.create.mockResolvedValue(created);

    const out = await read(
      await handlePages(
        jsonRequest({ title: 'Created Page', slug: 'created-contract-page' }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(201);
    expect(out.body.title).toBe('Created Page');
    expect(out.body.status).toBe('draft');
    expect(out.body.blocks).toEqual([]);

    const data = mockPrisma.page.create.mock.calls[0][0].data;
    expect(data.blocks).toEqual([]);
    expect(data.status).toBe('draft');
    expect(data.title).toBe('Created Page');
    expect(data.slug).toBe('created-contract-page');
    expect(data).not.toHaveProperty('id');
    expect(typeof data.createdAt).toBe('string');
    expect(typeof data.updatedAt).toBe('string');
  });

  test('201 with nested bilingual blocks (round-trip fixture)', async () => {
    const blocks = loadFixture('page-builder-profil.json');
    const created = dbPage({
      title: 'Profil',
      slug: 'profil-lembaga',
      status: 'published',
      blocks,
    });
    mockPrisma.page.create.mockResolvedValue(created);

    const out = await read(
      await handlePages(
        jsonRequest({
          title: 'Profil',
          slug: 'profil-lembaga',
          status: 'published',
          blocks,
        }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(201);
    // Whole JSONB preserved — nested items + bilingual *En fields intact.
    expect(out.body.blocks).toEqual(blocks);
    expect(out.body.blocks[2].settings.items[0].titleEn).toBe('Justice');
    expect(mockPrisma.page.create.mock.calls[0][0].data.blocks).toEqual(blocks);
  });

  test('201 stores homepage-default blocks including hero_home type', async () => {
    const blocks = loadFixture('homepage-default.json');
    mockPrisma.page.create.mockResolvedValue(
      dbPage({ title: 'Beranda', slug: '_homepage', status: 'published', blocks }),
    );

    const out = await read(
      await handlePages(
        jsonRequest({
          title: 'Beranda',
          slug: '_homepage',
          status: 'published',
          blocks,
        }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(201);
    expect(out.body.slug).toBe('_homepage');
    expect(out.body.blocks.map((b) => b.type)).toEqual([
      'hero_home',
      'services_grid',
      'news_ann',
      'case_search',
      'contact_info',
    ]);
  });

  test('201 stores nested accordion/tabs/gallery bilingual blocks', async () => {
    const blocks = loadFixture('nested-bilingual.json');
    mockPrisma.page.create.mockResolvedValue(
      dbPage({ title: 'Nested', slug: 'nested-blocks', blocks }),
    );

    const out = await read(
      await handlePages(
        jsonRequest({ title: 'Nested', slug: 'nested-blocks', blocks }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(201);
    expect(out.body.blocks).toEqual(blocks);
    expect(out.body.blocks[0].settings.items[0].titleEn).toBe(
      'How do I register a case?',
    );
    expect(out.body.blocks[1].settings.tabs[0].labelEn).toBe('Working Hours');
  });

  test('rejects non-array blocks with 400', async () => {
    const out = await read(
      await handlePages(
        jsonRequest({ title: 'Bad', slug: 'bad', blocks: { root: 'object' } }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(400);
    expect(out.body.error).toMatch(/array/i);
    expect(mockPrisma.page.create).not.toHaveBeenCalled();
  });

  test('P2002 slug uniqueness -> 400 { error: Slug sudah digunakan }', async () => {
    mockPrisma.page.create.mockRejectedValue({
      code: 'P2002',
      clientVersion: '7.8.0',
      meta: { target: ['slug'] },
    });

    const out = await read(
      await handlePages(
        jsonRequest({ title: 'Dup', slug: 'taken-slug' }),
        [],
        'POST',
      ),
    );
    expect(out).toEqual({
      status: 400,
      body: { error: 'Slug sudah digunakan' },
    });
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handlePages(jsonRequest({ title: 'X', slug: 'x' }), [], 'POST'),
    );
    expect(out.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
describe('PUT /pages/:id', () => {
  test('missing id -> 200 null', async () => {
    mockPrisma.page.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.page.findUnique.mockResolvedValue(null);

    const res = await handlePages(
      jsonRequest({ title: 'Updated' }),
      ['nope'],
      'PUT',
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  test('updates blocks and returns serialized row', async () => {
    const blocks = loadFixture('nested-bilingual.json');
    const updated = dbPage({
      title: 'Updated Page',
      blocks,
      updatedAt: UPDATED,
    });
    mockPrisma.page.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.page.findUnique.mockResolvedValue(updated);

    const out = await read(
      await handlePages(
        jsonRequest({ title: 'Updated Page', blocks }),
        ['a0000000-0000-4000-8000-000000000001'],
        'PUT',
      ),
    );
    expect(out.status).toBe(200);
    expect(out.body.title).toBe('Updated Page');
    expect(out.body.blocks).toEqual(blocks);
    expect(out.body.updatedAt).toBe('2024-02-02T10:00:00.000Z');

    const data = mockPrisma.page.updateMany.mock.calls[0][0].data;
    expect(data.blocks).toEqual(blocks);
    expect(data.title).toBe('Updated Page');
    expect(typeof data.updatedAt).toBe('string');
  });

  test('rejects non-array blocks on update', async () => {
    const out = await read(
      await handlePages(
        jsonRequest({ blocks: 'not-an-array' }),
        ['a0000000-0000-4000-8000-000000000001'],
        'PUT',
      ),
    );
    expect(out.status).toBe(400);
    expect(mockPrisma.page.updateMany).not.toHaveBeenCalled();
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handlePages(jsonRequest({ title: 'X' }), ['id'], 'PUT'),
    );
    expect(out.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
describe('DELETE /pages/:id', () => {
  test('always 200 even when id missing', async () => {
    mockPrisma.page.deleteMany.mockResolvedValue({ count: 0 });
    const out = await read(
      await handlePages(jsonRequest({}), ['nope'], 'DELETE'),
    );
    expect(out).toEqual({
      status: 200,
      body: { message: 'Berhasil dihapus' },
    });
    expect(mockPrisma.page.deleteMany).toHaveBeenCalledWith({
      where: { id: 'nope' },
    });
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handlePages(jsonRequest({}), ['id'], 'DELETE'),
    );
    expect(out.status).toBe(401);
  });
});
