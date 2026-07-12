// Unit tests for app/api/handlers/settingsHandler.js (settings task).
//
// Covers:
//   - GET folds Setting rows into flat {[key]: value} map
//   - PUT requires auth (401)
//   - PUT batch upserts entire submitted body inside $transaction
//   - footer_links / object values stringify to Text (JSON string)
//   - non-GET/PUT returns null

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockSetting = {
  findMany: vi.fn(),
  upsert: vi.fn(),
};

const mockPrisma = {
  setting: mockSetting,
  $transaction: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
  getPrisma: () => mockPrisma,
}));

const mockAuth = { requireAuth: vi.fn() };
vi.mock('@/lib/auth', () => mockAuth);

vi.mock('@/lib/prisma-errors.js', async () => import('../../../lib/prisma-errors.js'));

const {
  handleSettings,
  foldSettings,
  toSettingValue,
} = await import('../../../app/api/handlers/settingsHandler.js');

function getRequest() {
  return { url: 'http://localhost/api/settings', headers: new Headers() };
}
function jsonRequest(body) {
  return {
    json: async () => body,
    headers: new Headers(),
    url: 'http://localhost/api/settings',
  };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

function wireTx() {
  mockPrisma.$transaction.mockImplementation(async (fn) => {
    if (typeof fn === 'function') {
      return fn({ setting: mockSetting });
    }
    return Promise.all(fn);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSetting.findMany.mockReset();
  mockSetting.upsert.mockReset();
  mockPrisma.$transaction.mockReset();
  mockAuth.requireAuth.mockReturnValue({ id: 'auth', role: 'admin' });
  wireTx();
});

describe('foldSettings / toSettingValue helpers', () => {
  test('foldSettings builds flat key/value map', () => {
    expect(
      foldSettings([
        { key: 'court_name', value: 'PA Penajam' },
        { key: 'phone', value: '123' },
      ]),
    ).toEqual({ court_name: 'PA Penajam', phone: '123' });
  });

  test('toSettingValue stringifies objects (footer_links stays JSON string)', () => {
    const links = [{ label: 'Home', href: '/' }];
    expect(toSettingValue(links)).toBe(JSON.stringify(links));
    expect(toSettingValue('plain')).toBe('plain');
    expect(toSettingValue(42)).toBe('42');
    expect(toSettingValue(null)).toBe('');
  });
});

describe('GET /settings', () => {
  test('returns folded {[key]: value} map', async () => {
    mockSetting.findMany.mockResolvedValue([
      { key: 'court_name', value: 'Pengadilan Agama Penajam' },
      {
        key: 'footer_links',
        value: JSON.stringify([{ label: 'Home', href: '/' }]),
      },
    ]);

    const out = await read(await handleSettings(getRequest(), [], 'GET'));
    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      court_name: 'Pengadilan Agama Penajam',
      footer_links: JSON.stringify([{ label: 'Home', href: '/' }]),
    });
    // footer_links remains a JSON *string*, not a parsed array.
    expect(typeof out.body.footer_links).toBe('string');
    expect(mockSetting.findMany).toHaveBeenCalledOnce();
  });

  test('empty table -> empty object', async () => {
    mockSetting.findMany.mockResolvedValue([]);
    const out = await read(await handleSettings(getRequest(), [], 'GET'));
    expect(out.status).toBe(200);
    expect(out.body).toEqual({});
  });
});

describe('PUT /settings', () => {
  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handleSettings(jsonRequest({ court_name: 'X' }), [], 'PUT'),
    );
    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: 'Unauthorized' });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test('batch upsert of entire submitted body is transactional', async () => {
    mockSetting.upsert.mockResolvedValue({});
    const body = {
      court_name: 'PA Penajam',
      phone: '(0542) 7211234',
      footer_links: [
        { label: 'Beranda', href: '/' },
        { label: 'FAQ', href: '/faq' },
      ],
    };

    const out = await read(await handleSettings(jsonRequest(body), [], 'PUT'));
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ message: 'Pengaturan berhasil disimpan' });

    // One interactive transaction wraps the whole batch.
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(typeof mockPrisma.$transaction.mock.calls[0][0]).toBe('function');

    // One upsert per key, including JSON-stringified footer_links.
    expect(mockSetting.upsert).toHaveBeenCalledTimes(3);
    expect(mockSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'court_name' },
      create: { key: 'court_name', value: 'PA Penajam' },
      update: { value: 'PA Penajam' },
    });
    expect(mockSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'phone' },
      create: { key: 'phone', value: '(0542) 7211234' },
      update: { value: '(0542) 7211234' },
    });
    expect(mockSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'footer_links' },
      create: {
        key: 'footer_links',
        value: JSON.stringify(body.footer_links),
      },
      update: { value: JSON.stringify(body.footer_links) },
    });
  });

  test('mid-batch failure aborts transaction (no partial success response)', async () => {
    mockSetting.upsert
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('db boom'));

    const out = await read(
      await handleSettings(
        jsonRequest({ a: '1', b: '2' }),
        [],
        'PUT',
      ),
    );
    // mapError maps unknown errors to generic 500 — no SQL/PII leak.
    expect(out.status).toBe(500);
    expect(out.body).toEqual({ error: 'Terjadi kesalahan pada server' });
    expect(JSON.stringify(out.body)).not.toMatch(/db boom|SQL|password/i);
  });
});

describe('unsupported methods', () => {
  test('POST returns null (dispatcher 404)', async () => {
    const res = await handleSettings(getRequest(), [], 'POST');
    expect(res).toBeNull();
  });
});
