// Unit tests for app/api/handlers/menusHandler.js (Task 11).
//
// Covers:
//   - GET  /menus public tree (top-level + children, order preserved)
//   - GET  /menus/all flat admin list (auth)
//   - POST /menus 201 with defaults; parentId FK P2003 -> 400
//   - PUT  /menus/bulk empty wipe, invalid payload, duplicate id, orphan,
//          parent-then-child insert order, Serializable TX options,
//          P2034 bounded retry, rollback on insert fail
//   - PUT  /menus/:id missing -> 200 null
//   - DELETE /menus/:id one-level child wipe then parent
//   - Auth 401 on mutating / protected routes

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockMenuItem = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
};

const mockPrisma = {
  menuItem: mockMenuItem,
  $transaction: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
  getPrisma: () => mockPrisma,
}));

const mockAuth = { requireAuth: vi.fn() };
vi.mock('@/lib/auth', () => mockAuth);

vi.mock('@/lib/api/serialize.js', async () => import('../../../lib/api/serialize.js'));
vi.mock('@/lib/prisma-errors.js', async () => import('../../../lib/prisma-errors.js'));

const { handleMenus } = await import('../../../app/api/handlers/menusHandler.js');

function listRequest() {
  return { url: 'http://localhost/api/menus', headers: new Headers() };
}
function jsonRequest(body) {
  return {
    json: async () => body,
    headers: new Headers(),
    url: 'http://localhost/api/menus',
  };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

const CREATED = new Date('2024-01-01T00:00:00.000Z');
const PARENT_ID = 'f0000000-0000-4000-8000-000000000001';
const CHILD_ID = 'f0000000-0000-4000-8000-000000000002';
const SIBLING_ID = 'f0000000-0000-4000-8000-000000000003';

function dbMenu(overrides = {}) {
  return {
    id: PARENT_ID,
    label: 'Contract Menu',
    labelEn: null,
    url: '/',
    type: 'section',
    icon: '🏠',
    order: 1,
    isActive: true,
    parentId: null,
    description: null,
    descriptionEn: null,
    target: null,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

/**
 * Wire $transaction so the interactive callback receives a tx client that
 * shares the same menuItem mocks (unit tests never hit a real DB).
 */
function wireInteractiveTx(impl) {
  mockPrisma.$transaction.mockImplementation(async (fn, options) => {
    // Capture options for assertion by attaching to the mock call args.
    if (typeof fn === 'function') {
      const tx = { menuItem: mockMenuItem };
      return impl ? impl(fn, options, tx) : fn(tx);
    }
    // Array form not used by the handler, but keep a path open.
    return Promise.all(fn);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks does not drop mockRejectedValue implementations — reset
  // the model mocks so a prior test's reject does not leak into the next.
  mockMenuItem.findMany.mockReset();
  mockMenuItem.findUnique.mockReset();
  mockMenuItem.create.mockReset();
  mockMenuItem.createMany.mockReset();
  mockMenuItem.updateMany.mockReset();
  mockMenuItem.deleteMany.mockReset();
  mockPrisma.$transaction.mockReset();
  mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin' });
  wireInteractiveTx();
});

// ---------------------------------------------------------------------------
// Public tree
// ---------------------------------------------------------------------------
describe('GET /menus (public tree)', () => {
  test('returns top-level + children array with order preserved', async () => {
    // Flat active list already ordered by order asc from Prisma.
    mockMenuItem.findMany.mockResolvedValue([
      dbMenu({ id: PARENT_ID, label: 'Parent A', order: 1 }),
      dbMenu({ id: SIBLING_ID, label: 'Parent B', order: 2 }),
      dbMenu({
        id: CHILD_ID,
        label: 'Child of A',
        url: '/child',
        order: 1,
        parentId: PARENT_ID,
      }),
      dbMenu({
        id: 'f0000000-0000-4000-8000-000000000004',
        label: 'Child of A later',
        url: '/child-2',
        order: 2,
        parentId: PARENT_ID,
      }),
    ]);

    const out = await read(await handleMenus(listRequest(), [], 'GET'));
    expect(out.status).toBe(200);
    expect(Object.keys(out.body).sort()).toEqual(['items']);
    expect(out.body.items).toHaveLength(2);

    // Top-level order preserved (order 1 then 2).
    expect(out.body.items[0].id).toBe(PARENT_ID);
    expect(out.body.items[0].label).toBe('Parent A');
    expect(out.body.items[0].children).toHaveLength(2);
    expect(out.body.items[0].children[0].label).toBe('Child of A');
    expect(out.body.items[0].children[1].label).toBe('Child of A later');
    expect(out.body.items[0].children[0].parentId).toBe(PARENT_ID);

    // Sibling has empty children (no grandchildren nesting).
    expect(out.body.items[1].id).toBe(SIBLING_ID);
    expect(out.body.items[1].children).toEqual([]);

    // Timestamps serialised to ISO.
    expect(out.body.items[0].createdAt).toBe('2024-01-01T00:00:00.000Z');

    expect(mockMenuItem.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  });

  test('empty active list -> { items: [] }', async () => {
    mockMenuItem.findMany.mockResolvedValue([]);
    const out = await read(await handleMenus(listRequest(), [], 'GET'));
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ items: [] });
  });
});

// ---------------------------------------------------------------------------
// Admin all
// ---------------------------------------------------------------------------
describe('GET /menus/all', () => {
  test('auth required; returns flat list sorted by order', async () => {
    mockMenuItem.findMany.mockResolvedValue([
      dbMenu(),
      dbMenu({ id: CHILD_ID, parentId: PARENT_ID, order: 2 }),
    ]);
    const out = await read(await handleMenus(listRequest(), ['all'], 'GET'));
    expect(out.status).toBe(200);
    expect(out.body.items).toHaveLength(2);
    // Flat — no children property synthesised.
    expect(out.body.items[0].children).toBeUndefined();
    expect(mockMenuItem.findMany).toHaveBeenCalledWith({
      orderBy: { order: 'asc' },
    });
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleMenus(listRequest(), ['all'], 'GET'));
    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: 'Unauthorized' });
  });
});

// ---------------------------------------------------------------------------
// POST create
// ---------------------------------------------------------------------------
describe('POST /menus', () => {
  test('201: defaults isActive/order/parentId; timestamps owned by handler', async () => {
    mockMenuItem.create.mockResolvedValue(dbMenu({ order: 0 }));
    const out = await read(
      await handleMenus(
        jsonRequest({ label: 'Created Menu', url: '/created' }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(201);
    const data = mockMenuItem.create.mock.calls[0][0].data;
    expect(data.isActive).toBe(true);
    expect(data.order).toBe(0);
    expect(data.parentId).toBeNull();
    expect(data.label).toBe('Created Menu');
    expect(typeof data.createdAt).toBe('string');
    expect(typeof data.updatedAt).toBe('string');
  });

  test('P2003 parentId FK -> 400 stable body', async () => {
    mockMenuItem.create.mockRejectedValue({
      code: 'P2003',
      clientVersion: 'test',
      meta: { field_name: 'menus_parentId_fkey' },
    });
    const out = await read(
      await handleMenus(
        jsonRequest({
          label: 'Orphan Child',
          url: '/orphan',
          parentId: '00000000-0000-4000-8000-000000000099',
        }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: 'Data terkait masih digunakan' });
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handleMenus(jsonRequest({ label: 'X', url: '/' }), [], 'POST'),
    );
    expect(out.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Bulk replace
// ---------------------------------------------------------------------------
describe('PUT /menus/bulk', () => {
  test('empty bulk wipes table and returns count 0', async () => {
    const out = await read(
      await handleMenus(jsonRequest({ items: [] }), ['bulk'], 'PUT'),
    );
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ message: 'Menu berhasil disimpan', count: 0 });

    // Two deleteMany calls (children then parents); no createMany.
    expect(mockMenuItem.deleteMany).toHaveBeenCalledTimes(2);
    expect(mockMenuItem.deleteMany.mock.calls[0][0]).toEqual({
      where: { parentId: { not: null } },
    });
    expect(mockMenuItem.deleteMany.mock.calls[1][0]).toEqual({
      where: { parentId: null },
    });
    expect(mockMenuItem.createMany).not.toHaveBeenCalled();

    // Serializable isolation option present.
    const txOpts = mockPrisma.$transaction.mock.calls[0][1];
    expect(txOpts.isolationLevel).toBe('Serializable');
  });

  test('invalid payload: items not array -> 400', async () => {
    const out = await read(
      await handleMenus(jsonRequest({ items: 'not-an-array' }), ['bulk'], 'PUT'),
    );
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: 'items harus array' });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test('invalid payload: missing label -> 400', async () => {
    const out = await read(
      await handleMenus(
        jsonRequest({ items: [{ url: '/x' }] }),
        ['bulk'],
        'PUT',
      ),
    );
    expect(out.status).toBe(400);
    expect(out.body.error).toMatch(/label/);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test('invalid payload: missing url -> 400', async () => {
    const out = await read(
      await handleMenus(
        jsonRequest({ items: [{ label: 'X' }] }),
        ['bulk'],
        'PUT',
      ),
    );
    expect(out.status).toBe(400);
    expect(out.body.error).toMatch(/url/);
  });

  test('duplicate id in payload -> 400, no TX', async () => {
    const out = await read(
      await handleMenus(
        jsonRequest({
          items: [
            { id: PARENT_ID, label: 'A', url: '/' },
            { id: PARENT_ID, label: 'B', url: '/b' },
          ],
        }),
        ['bulk'],
        'PUT',
      ),
    );
    expect(out.status).toBe(400);
    expect(out.body.error).toMatch(/duplikat/);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test('orphan parentId -> 400, no TX', async () => {
    const out = await read(
      await handleMenus(
        jsonRequest({
          items: [
            {
              id: CHILD_ID,
              label: 'Orphan',
              url: '/orphan',
              parentId: '00000000-0000-4000-8000-000000000099',
            },
          ],
        }),
        ['bulk'],
        'PUT',
      ),
    );
    expect(out.status).toBe(400);
    expect(out.body.error).toMatch(/orphan|parentId/i);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test('self-parent -> 400, no TX', async () => {
    const out = await read(
      await handleMenus(
        jsonRequest({
          items: [
            {
              id: PARENT_ID,
              label: 'Self',
              url: '/',
              parentId: PARENT_ID,
            },
          ],
        }),
        ['bulk'],
        'PUT',
      ),
    );
    expect(out.status).toBe(400);
    expect(out.body.error).toMatch(/orphan|self/i);
  });

  test('parents inserted before children; count matches payload', async () => {
    const out = await read(
      await handleMenus(
        jsonRequest({
          items: [
            {
              id: CHILD_ID,
              label: 'Child',
              url: '/child',
              parentId: PARENT_ID,
              order: 1,
            },
            {
              id: PARENT_ID,
              label: 'Parent',
              url: '/',
              parentId: null,
              order: 0,
            },
          ],
        }),
        ['bulk'],
        'PUT',
      ),
    );
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ message: 'Menu berhasil disimpan', count: 2 });

    // createMany called twice: parents then children (order of payload does
    // not matter — handler reorders).
    expect(mockMenuItem.createMany).toHaveBeenCalledTimes(2);
    const firstBatch = mockMenuItem.createMany.mock.calls[0][0].data;
    const secondBatch = mockMenuItem.createMany.mock.calls[1][0].data;
    expect(firstBatch).toHaveLength(1);
    expect(firstBatch[0].id).toBe(PARENT_ID);
    expect(firstBatch[0].parentId).toBeNull();
    expect(secondBatch).toHaveLength(1);
    expect(secondBatch[0].id).toBe(CHILD_ID);
    expect(secondBatch[0].parentId).toBe(PARENT_ID);
  });

  test('rollback on insert fail: TX error propagates; no partial success body', async () => {
    mockMenuItem.createMany.mockRejectedValue(
      new Error('simulated insert failure'),
    );
    await expect(
      handleMenus(
        jsonRequest({
          items: [{ id: PARENT_ID, label: 'A', url: '/' }],
        }),
        ['bulk'],
        'PUT',
      ),
    ).rejects.toThrow(/simulated insert failure/);
  });

  test('P2034 retries then succeeds', async () => {
    let attempts = 0;
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      attempts += 1;
      if (attempts < 3) {
        const err = new Error('write conflict');
        err.code = 'P2034';
        throw err;
      }
      return fn({ menuItem: mockMenuItem });
    });

    const out = await read(
      await handleMenus(
        jsonRequest({
          items: [{ id: PARENT_ID, label: 'A', url: '/' }],
        }),
        ['bulk'],
        'PUT',
      ),
    );
    expect(out.status).toBe(200);
    expect(out.body.count).toBe(1);
    expect(attempts).toBe(3);
  });

  test('P2034 exhausted -> 409 conflict body', async () => {
    mockPrisma.$transaction.mockImplementation(async () => {
      const err = new Error('write conflict');
      err.code = 'P2034';
      throw err;
    });

    const out = await read(
      await handleMenus(
        jsonRequest({
          items: [{ id: PARENT_ID, label: 'A', url: '/' }],
        }),
        ['bulk'],
        'PUT',
      ),
    );
    expect(out.status).toBe(409);
    expect(out.body).toEqual({ error: 'Konflik data, silakan coba lagi' });
    // Bounded: 3 attempts.
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(3);
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handleMenus(jsonRequest({ items: [] }), ['bulk'], 'PUT'),
    );
    expect(out.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /menus/:id
// ---------------------------------------------------------------------------
describe('PUT /menus/:id', () => {
  test('missing id -> 200 null (updateMany no-op)', async () => {
    mockMenuItem.updateMany.mockResolvedValue({ count: 0 });
    mockMenuItem.findUnique.mockResolvedValue(null);
    const out = await read(
      await handleMenus(
        jsonRequest({ label: 'Nope' }),
        ['00000000-0000-4000-8000-000000000000'],
        'PUT',
      ),
    );
    expect(out.status).toBe(200);
    expect(out.body).toBeNull();
  });

  test('updates and returns serialised row', async () => {
    mockMenuItem.updateMany.mockResolvedValue({ count: 1 });
    mockMenuItem.findUnique.mockResolvedValue(
      dbMenu({ label: 'Updated Menu' }),
    );
    const out = await read(
      await handleMenus(
        jsonRequest({ label: 'Updated Menu' }),
        [PARENT_ID],
        'PUT',
      ),
    );
    expect(out.status).toBe(200);
    expect(out.body.label).toBe('Updated Menu');
    expect(out.body.createdAt).toBe('2024-01-01T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// DELETE /menus/:id — one-level semantics
// ---------------------------------------------------------------------------
describe('DELETE /menus/:id', () => {
  test('deletes direct children then parent; always 200', async () => {
    mockMenuItem.deleteMany.mockResolvedValue({ count: 1 });
    const out = await read(
      await handleMenus(listRequest(), [PARENT_ID], 'DELETE'),
    );
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ message: 'Berhasil dihapus' });

    expect(mockMenuItem.deleteMany).toHaveBeenCalledTimes(2);
    // Children first (one-level), then the parent itself.
    expect(mockMenuItem.deleteMany.mock.calls[0][0]).toEqual({
      where: { parentId: PARENT_ID },
    });
    expect(mockMenuItem.deleteMany.mock.calls[1][0]).toEqual({
      where: { id: PARENT_ID },
    });
  });

  test('missing id still 200 (deleteMany no-op)', async () => {
    mockMenuItem.deleteMany.mockResolvedValue({ count: 0 });
    const out = await read(
      await handleMenus(
        listRequest(),
        ['00000000-0000-4000-8000-000000000000'],
        'DELETE',
      ),
    );
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ message: 'Berhasil dihapus' });
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handleMenus(listRequest(), [PARENT_ID], 'DELETE'),
    );
    expect(out.status).toBe(401);
  });
});
