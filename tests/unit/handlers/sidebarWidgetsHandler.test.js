// Unit tests for app/api/handlers/sidebarWidgetsHandler.js (Task 11).
//
// Covers:
//   - GET  /sidebar-widgets public active list (order asc)
//   - GET  /sidebar-widgets/all flat admin list (auth)
//   - POST /sidebar-widgets 201 with defaults; settings={} default
//   - PUT  /sidebar-widgets/bulk empty wipe, invalid payload, duplicate id,
//          Serializable TX, settings JSONB round-trip for all widget types
//          (faq/stats/contact/quicklinks/complaint/social/hours) including
//          nested links + schedule arrays
//   - PUT  /sidebar-widgets/:id missing -> 200 null; settings partial leave
//   - DELETE /sidebar-widgets/:id always 200
//   - Auth 401 on mutating / protected routes

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockSidebarWidget = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
};

const mockPrisma = {
  sidebarWidget: mockSidebarWidget,
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

const { handleSidebarWidgets } = await import(
  '../../../app/api/handlers/sidebarWidgetsHandler.js'
);

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../../fixtures/sidebar-settings');

function loadFixture(name) {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8'));
}

function listRequest() {
  return { url: 'http://localhost/api/sidebar-widgets', headers: new Headers() };
}
function jsonRequest(body) {
  return {
    json: async () => body,
    headers: new Headers(),
    url: 'http://localhost/api/sidebar-widgets',
  };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

const CREATED = new Date('2024-01-01T00:00:00.000Z');
const WIDGET_ID = 'b1000000-0000-4000-8000-000000000001';

function dbWidget(overrides = {}) {
  return {
    id: WIDGET_ID,
    type: 'faq',
    label: 'FAQ',
    labelEn: 'FAQ',
    icon: '❓',
    color: '#1b5e20',
    isActive: true,
    order: 0,
    settings: { title: 'Pertanyaan Umum', limit: 4, showAll: true },
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

function wireInteractiveTx() {
  mockPrisma.$transaction.mockImplementation(async (fn) => {
    if (typeof fn === 'function') {
      return fn({ sidebarWidget: mockSidebarWidget });
    }
    return Promise.all(fn);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks does not drop mockRejectedValue implementations — reset
  // the model mocks so a prior test's reject does not leak into the next.
  mockSidebarWidget.findMany.mockReset();
  mockSidebarWidget.findUnique.mockReset();
  mockSidebarWidget.create.mockReset();
  mockSidebarWidget.createMany.mockReset();
  mockSidebarWidget.updateMany.mockReset();
  mockSidebarWidget.deleteMany.mockReset();
  mockPrisma.$transaction.mockReset();
  mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin' });
  wireInteractiveTx();
});

// ---------------------------------------------------------------------------
// Public active list
// ---------------------------------------------------------------------------
describe('GET /sidebar-widgets (public active list)', () => {
  test('filters isActive=true, sort order asc, settings preserved', async () => {
    const settings = {
      title: 'Tautan Cepat',
      links: [
        {
          id: 'c1000000-0000-4000-8000-000000000001',
          label: 'Agenda',
          url: '/agenda-sidang',
          external: false,
        },
      ],
    };
    mockSidebarWidget.findMany.mockResolvedValue([
      dbWidget({ type: 'quicklinks', label: 'Links', settings, order: 1 }),
    ]);

    const out = await read(await handleSidebarWidgets(listRequest(), [], 'GET'));
    expect(out.status).toBe(200);
    expect(Object.keys(out.body).sort()).toEqual(['items']);
    expect(out.body.items).toHaveLength(1);
    // Deep-equal settings round-trip (nested links intact).
    expect(out.body.items[0].settings).toEqual(settings);
    expect(out.body.items[0].settings).not.toBe(settings);
    expect(out.body.items[0].createdAt).toBe('2024-01-01T00:00:00.000Z');

    expect(mockSidebarWidget.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  });
});

// ---------------------------------------------------------------------------
// Admin all
// ---------------------------------------------------------------------------
describe('GET /sidebar-widgets/all', () => {
  test('auth required; returns all sorted by order', async () => {
    mockSidebarWidget.findMany.mockResolvedValue([dbWidget()]);
    const out = await read(
      await handleSidebarWidgets(listRequest(), ['all'], 'GET'),
    );
    expect(out.status).toBe(200);
    expect(out.body.items).toHaveLength(1);
    expect(mockSidebarWidget.findMany).toHaveBeenCalledWith({
      orderBy: { order: 'asc' },
    });
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handleSidebarWidgets(listRequest(), ['all'], 'GET'),
    );
    expect(out.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST create
// ---------------------------------------------------------------------------
describe('POST /sidebar-widgets', () => {
  test('201: defaults isActive/order; settings defaults to {}', async () => {
    mockSidebarWidget.create.mockResolvedValue(
      dbWidget({ order: 0, settings: {} }),
    );
    const out = await read(
      await handleSidebarWidgets(
        jsonRequest({ type: 'social', label: 'Social' }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(201);
    const data = mockSidebarWidget.create.mock.calls[0][0].data;
    expect(data.isActive).toBe(true);
    expect(data.order).toBe(0);
    expect(data.settings).toEqual({});
    expect(data.type).toBe('social');
  });

  test('settings non-object -> 400', async () => {
    const out = await read(
      await handleSidebarWidgets(
        jsonRequest({ type: 'faq', label: 'FAQ', settings: ['nope'] }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: 'settings harus object' });
    expect(mockSidebarWidget.create).not.toHaveBeenCalled();
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handleSidebarWidgets(
        jsonRequest({ type: 'faq', label: 'FAQ' }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Bulk replace
// ---------------------------------------------------------------------------
describe('PUT /sidebar-widgets/bulk', () => {
  test('empty bulk wipes table and returns count 0', async () => {
    const out = await read(
      await handleSidebarWidgets(jsonRequest({ items: [] }), ['bulk'], 'PUT'),
    );
    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      message: 'Sidebar widgets disimpan',
      count: 0,
    });
    expect(mockSidebarWidget.deleteMany).toHaveBeenCalledWith({});
    expect(mockSidebarWidget.createMany).not.toHaveBeenCalled();

    const txOpts = mockPrisma.$transaction.mock.calls[0][1];
    expect(txOpts.isolationLevel).toBe('Serializable');
  });

  test('invalid payload: items not array -> 400', async () => {
    const out = await read(
      await handleSidebarWidgets(
        jsonRequest({ items: 'not-an-array' }),
        ['bulk'],
        'PUT',
      ),
    );
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: 'items harus array' });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test('invalid payload: missing type -> 400', async () => {
    const out = await read(
      await handleSidebarWidgets(
        jsonRequest({ items: [{ label: 'X' }] }),
        ['bulk'],
        'PUT',
      ),
    );
    expect(out.status).toBe(400);
    expect(out.body.error).toMatch(/type/);
  });

  test('invalid payload: missing label -> 400', async () => {
    const out = await read(
      await handleSidebarWidgets(
        jsonRequest({ items: [{ type: 'faq' }] }),
        ['bulk'],
        'PUT',
      ),
    );
    expect(out.status).toBe(400);
    expect(out.body.error).toMatch(/label/);
  });

  test('invalid payload: settings array -> 400', async () => {
    const out = await read(
      await handleSidebarWidgets(
        jsonRequest({
          items: [{ type: 'faq', label: 'FAQ', settings: [] }],
        }),
        ['bulk'],
        'PUT',
      ),
    );
    expect(out.status).toBe(400);
    expect(out.body.error).toMatch(/settings/);
  });

  test('duplicate id in payload -> 400, no TX', async () => {
    const out = await read(
      await handleSidebarWidgets(
        jsonRequest({
          items: [
            { id: WIDGET_ID, type: 'faq', label: 'A' },
            { id: WIDGET_ID, type: 'stats', label: 'B' },
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

  test('all widget types + nested links/schedule round-trip via createMany', async () => {
    const fixture = loadFixture('all-widget-types.json');
    const out = await read(
      await handleSidebarWidgets(
        jsonRequest({ items: fixture.widgets }),
        ['bulk'],
        'PUT',
      ),
    );
    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      message: 'Sidebar widgets disimpan',
      count: 7,
    });

    expect(mockSidebarWidget.deleteMany).toHaveBeenCalledWith({});
    expect(mockSidebarWidget.createMany).toHaveBeenCalledTimes(1);
    const data = mockSidebarWidget.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(7);

    // Type coverage.
    const types = data.map((r) => r.type).sort();
    expect(types).toEqual([
      'complaint',
      'contact',
      'faq',
      'hours',
      'quicklinks',
      'social',
      'stats',
    ]);

    // Nested links deep-equal.
    const quicklinks = data.find((r) => r.type === 'quicklinks');
    expect(quicklinks.settings.links).toHaveLength(3);
    expect(quicklinks.settings.links[0]).toEqual({
      id: 'c1000000-0000-4000-8000-000000000001',
      label: 'Agenda Sidang',
      labelEn: 'Court Schedule',
      url: '/agenda-sidang',
      icon: '📅',
      external: false,
    });
    expect(quicklinks.settings.links[2].external).toBe(true);

    // Nested schedule deep-equal.
    const hours = data.find((r) => r.type === 'hours');
    expect(hours.settings.schedule).toEqual([
      { days: 'Senin - Kamis', hours: '08:00 - 16:00 WITA' },
      { days: 'Jumat', hours: '08:00 - 11:00 WITA' },
      { days: 'Sabtu - Minggu', hours: 'Tutup' },
    ]);

    // FAQ settings shape.
    const faq = data.find((r) => r.type === 'faq');
    expect(faq.settings).toEqual({
      title: 'Pertanyaan Umum',
      titleEn: 'Common Questions',
      limit: 4,
      showAll: true,
    });
  });

  test('rollback on insert fail: TX error propagates', async () => {
    mockSidebarWidget.createMany.mockRejectedValue(
      new Error('simulated insert failure'),
    );
    await expect(
      handleSidebarWidgets(
        jsonRequest({
          items: [{ id: WIDGET_ID, type: 'faq', label: 'FAQ' }],
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
      if (attempts < 2) {
        const err = new Error('write conflict');
        err.code = 'P2034';
        throw err;
      }
      return fn({ sidebarWidget: mockSidebarWidget });
    });

    const out = await read(
      await handleSidebarWidgets(
        jsonRequest({
          items: [{ id: WIDGET_ID, type: 'faq', label: 'FAQ' }],
        }),
        ['bulk'],
        'PUT',
      ),
    );
    expect(out.status).toBe(200);
    expect(attempts).toBe(2);
  });

  test('P2034 exhausted -> 409', async () => {
    mockPrisma.$transaction.mockImplementation(async () => {
      const err = new Error('write conflict');
      err.code = 'P2034';
      throw err;
    });
    const out = await read(
      await handleSidebarWidgets(
        jsonRequest({
          items: [{ id: WIDGET_ID, type: 'faq', label: 'FAQ' }],
        }),
        ['bulk'],
        'PUT',
      ),
    );
    expect(out.status).toBe(409);
    expect(out.body).toEqual({ error: 'Konflik data, silakan coba lagi' });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(3);
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handleSidebarWidgets(jsonRequest({ items: [] }), ['bulk'], 'PUT'),
    );
    expect(out.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /sidebar-widgets/:id
// ---------------------------------------------------------------------------
describe('PUT /sidebar-widgets/:id', () => {
  test('missing id -> 200 null', async () => {
    mockSidebarWidget.updateMany.mockResolvedValue({ count: 0 });
    mockSidebarWidget.findUnique.mockResolvedValue(null);
    const out = await read(
      await handleSidebarWidgets(
        jsonRequest({ label: 'Nope' }),
        ['00000000-0000-4000-8000-000000000000'],
        'PUT',
      ),
    );
    expect(out.status).toBe(200);
    expect(out.body).toBeNull();
  });

  test('settings partial leave: omit settings -> not in update data', async () => {
    mockSidebarWidget.updateMany.mockResolvedValue({ count: 1 });
    mockSidebarWidget.findUnique.mockResolvedValue(
      dbWidget({ label: 'Updated' }),
    );
    const out = await read(
      await handleSidebarWidgets(
        jsonRequest({ label: 'Updated' }),
        [WIDGET_ID],
        'PUT',
      ),
    );
    expect(out.status).toBe(200);
    const data = mockSidebarWidget.updateMany.mock.calls[0][0].data;
    expect(data.label).toBe('Updated');
    expect(data).not.toHaveProperty('settings');
  });

  test('settings update round-trips nested schedule', async () => {
    const schedule = [
      { days: 'Senin', hours: '08:00 - 16:00' },
      { days: 'Jumat', hours: '08:00 - 11:00' },
    ];
    mockSidebarWidget.updateMany.mockResolvedValue({ count: 1 });
    mockSidebarWidget.findUnique.mockResolvedValue(
      dbWidget({
        type: 'hours',
        settings: { title: 'Jam', schedule },
      }),
    );
    const out = await read(
      await handleSidebarWidgets(
        jsonRequest({ settings: { title: 'Jam', schedule } }),
        [WIDGET_ID],
        'PUT',
      ),
    );
    expect(out.status).toBe(200);
    expect(out.body.settings.schedule).toEqual(schedule);
    const data = mockSidebarWidget.updateMany.mock.calls[0][0].data;
    expect(data.settings.schedule).toEqual(schedule);
  });

  test('settings non-object -> 400', async () => {
    const out = await read(
      await handleSidebarWidgets(
        jsonRequest({ settings: 'nope' }),
        [WIDGET_ID],
        'PUT',
      ),
    );
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: 'settings harus object' });
  });
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
describe('DELETE /sidebar-widgets/:id', () => {
  test('always 200 success message', async () => {
    mockSidebarWidget.deleteMany.mockResolvedValue({ count: 1 });
    const out = await read(
      await handleSidebarWidgets(listRequest(), [WIDGET_ID], 'DELETE'),
    );
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ message: 'Berhasil dihapus' });
    expect(mockSidebarWidget.deleteMany).toHaveBeenCalledWith({
      where: { id: WIDGET_ID },
    });
  });

  test('missing id still 200', async () => {
    mockSidebarWidget.deleteMany.mockResolvedValue({ count: 0 });
    const out = await read(
      await handleSidebarWidgets(
        listRequest(),
        ['00000000-0000-4000-8000-000000000000'],
        'DELETE',
      ),
    );
    expect(out.status).toBe(200);
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handleSidebarWidgets(listRequest(), [WIDGET_ID], 'DELETE'),
    );
    expect(out.status).toBe(401);
  });
});
