// Unit tests for app/api/handlers/usersHandler.js (Task 7).
//
// Covers the REQUIRED cases from the task brief + plan lines 561-568:
//   - GET /users (authed): `{ items: [...] }` with no pagination keys, sorted
//     by createdAt desc, password NEVER leaked, createdAt serialised to ISO.
//   - GET /users (unauth) -> 401.
//   - POST /users (authed): 201 `{id,name,email,role,createdAt}` (NO updatedAt),
//     email lower-cased on write, password hashed (not returned).
//   - POST /users duplicate email -> P2002 mapped to 400
//     `{ error: 'Email sudah terdaftar' }`.
//   - POST /users (unauth) -> 401.
//   - PUT /users/:id (authed): 200 with the post-update row INCLUDING updatedAt;
//     email lower-cased; optional password re-hash.
//   - PUT /users/:id missing -> 200 `null` (legacy Mongo updateOne no-op +
//     findOne null baseline; preserved via updateMany + findUnique).
//   - PUT /users (unauth) -> 401.
//   - DELETE /users/:id (authed): ALWAYS 200 `{ message: 'Berhasil dihapus' }`,
//     even when the id does not exist (deleteMany no-op preserves this).
//   - DELETE /users (unauth) -> 401.
//
// The prisma singleton is mocked via vi.mock so NO database connection is
// made. lib/auth (requireAuth + hashPassword) is mocked too.

import { beforeEach, describe, expect, test, vi } from 'vitest';

// --- Mocks (must be set before importing the handler) -----------------------

const mockPrisma = {
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
};
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, getPrisma: () => mockPrisma }));

const mockAuth = {
  requireAuth: vi.fn(),
  hashPassword: vi.fn(),
};
vi.mock('@/lib/auth', () => mockAuth);

// The handler also imports the Task 6 helpers via the `@/` alias, which vitest
// does not resolve by default. We mock those alias specifiers and delegate to
// the REAL implementations (imported via relative path) so the test exercises
// the actual serializer + error mapper end-to-end.
vi.mock('@/lib/api/serialize.js', async () => {
  return await import('../../../lib/api/serialize.js');
});
vi.mock('@/lib/prisma-errors.js', async () => {
  return await import('../../../lib/prisma-errors.js');
});

// --- Import the handler AFTER mocks are registered --------------------------
const { handleUsers } = await import('../../../app/api/handlers/usersHandler.js');

// --- Helpers ---------------------------------------------------------------
function jsonRequest(body, headers = {}) {
  return {
    json: async () => body,
    headers: new Headers(headers),
  };
}
async function read(res) {
  return { status: res.status, body: await res.json() };
}

// A canonical DB user row (Prisma shape). createdAt as a Date so the test also
// exercises the serializer's Date -> ISO coercion.
const CREATED_DATE = new Date('2024-01-01T00:00:00.000Z');
const UPDATED_DATE = new Date('2024-02-02T10:00:00.000Z');

function dbUser(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Admin One',
    email: 'admin@example.test',
    password: '$2a$12$hashedpasswordbytes',
    role: 'admin',
    createdAt: CREATED_DATE,
    updatedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: authenticated as someone. Individual tests override.
  mockAuth.requireAuth.mockReturnValue({ id: 'authuser', role: 'admin' });
  mockAuth.hashPassword.mockResolvedValue('$2a$12$hashednewpassword');
});

describe("GET /users (list)", () => {
  test('returns { items: [...] } with no pagination keys, sorted desc, no password', async () => {
    // Two rows out of insertion order; the handler must ask Prisma to sort by
    // createdAt desc (we assert the orderBy argument below). The mock returns
    // the exact shape USER_SELECT_ON_CREATE would (no updatedAt key), so the
    // test also asserts the select contract end-to-end.
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'a', name: 'A', email: 'a@e.test', role: 'admin', createdAt: CREATED_DATE, password: 'hash-a' },
      { id: 'b', name: 'B', email: 'b@e.test', role: 'staff', createdAt: UPDATED_DATE, password: 'hash-b' },
    ]);

    const out = await read(await handleUsers(jsonRequest({}), [], 'GET'));

    // The handler asked for the legacy sort.
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      select: expect.objectContaining({
        id: true, name: true, email: true, role: true, createdAt: true,
      }),
      orderBy: { createdAt: 'desc' },
    });
    // Shape: exactly `{ items: [...] }`. No total/page/totalPages.
    expect(Object.keys(out.body).sort()).toEqual(['items']);
    expect(out.status).toBe(200);

    // Each item has exactly the legacy keys; no password; createdAt is ISO.
    for (const item of out.body.items) {
      expect(Object.keys(item).sort()).toEqual(['createdAt', 'email', 'id', 'name', 'role']);
      expect(item).not.toHaveProperty('password');
      expect(item).not.toHaveProperty('updatedAt');
      expect(typeof item.createdAt).toBe('string');
      expect(item.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    }
    // No password leak anywhere in the serialised payload.
    expect(JSON.stringify(out.body)).not.toContain('hash-a');
    expect(JSON.stringify(out.body)).not.toContain('hash-b');
    expect(JSON.stringify(out.body)).not.toContain('password');
  });

  test('returns { items: [] } when there are no users', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    const out = await read(await handleUsers(jsonRequest({}), [], 'GET'));
    expect(out).toEqual({ status: 200, body: { items: [] } });
  });

  test('unauthenticated -> 401 `{ error: "Unauthorized" }`', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleUsers(jsonRequest({}), [], 'GET'));
    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: 'Unauthorized' });
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe('POST /users (create)', () => {
  test('201: creates user, lowercases email, returns exact shape (no updatedAt)', async () => {
    // The created row: Prisma returns createdAt as a Date (serialiser -> ISO).
    mockPrisma.user.create.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Created User',
      email: 'created@example.test',
      role: 'admin',
      createdAt: CREATED_DATE,
    });

    const out = await read(
      await handleUsers(
        jsonRequest({
          name: 'Created User',
          email: 'CREATED@EXAMPLE.TEST', // upper-case on input
          password: 'Secret!123',
          role: 'admin',
        }),
        [],
        'POST',
      ),
    );

    expect(out.status).toBe(201);
    // Exactly the legacy keys (no updatedAt, no password).
    expect(Object.keys(out.body).sort()).toEqual(['createdAt', 'email', 'id', 'name', 'role']);
    expect(out.body.email).toBe('created@example.test'); // lower-cased
    expect(out.body.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(out.body).not.toHaveProperty('password');

    // create() was called with lower-cased email + hashed password + ISO createdAt.
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    const call = mockPrisma.user.create.mock.calls[0][0];
    expect(call.data.email).toBe('created@example.test');
    expect(call.data.password).toBe('$2a$12$hashednewpassword'); // hashed
    expect(call.data.role).toBe('admin');
    expect(typeof call.data.createdAt).toBe('string'); // ISO string set by handler
    // The select omits updatedAt so Prisma cannot return it.
    expect(call.select).not.toHaveProperty('updatedAt');
    // password is hashed via lib/auth.hashPassword.
    expect(mockAuth.hashPassword).toHaveBeenCalledWith('Secret!123');
  });

  test('role defaults to "admin" when not provided (legacy fallback)', async () => {
    mockPrisma.user.create.mockResolvedValue({
      id: 'x', name: 'N', email: 'n@e.test', role: 'admin', createdAt: CREATED_DATE,
    });
    await handleUsers(jsonRequest({ name: 'N', email: 'n@e.test', password: 'p' }), [], 'POST');
    expect(mockPrisma.user.create.mock.calls[0][0].data.role).toBe('admin');
  });

  test('duplicate email -> P2002 mapped to 400 `{ error: "Email sudah terdaftar" }`', async () => {
    // Simulate Prisma's unique-constraint error. The handler should catch it
    // via mapError and emit the legacy duplicate-email body.
    const p2002 = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      clientVersion: '7.8.0',
      meta: { target: ['email'] },
    });
    mockPrisma.user.create.mockRejectedValue(p2002);

    const out = await read(
      await handleUsers(
        jsonRequest({ name: 'Dup', email: 'dup@example.test', password: 'p', role: 'admin' }),
        [],
        'POST',
      ),
    );
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: 'Email sudah terdaftar' });
  });

  test('create still hashes the password before hitting prisma (even on dup)', async () => {
    mockPrisma.user.create.mockRejectedValue(
      Object.assign(new Error('dup'), { code: 'P2002', clientVersion: '7.8.0', meta: {} }),
    );
    await handleUsers(
      jsonRequest({ name: 'Dup', email: 'DUP@e.test', password: 'plaintext', role: 'admin' }),
      [],
      'POST',
    );
    expect(mockAuth.hashPassword).toHaveBeenCalledWith('plaintext');
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handleUsers(jsonRequest({ name: 'x', email: 'x@y.test', password: 'p' }), [], 'POST'),
    );
    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: 'Unauthorized' });
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });
});

describe('PUT /users/:id (update)', () => {
  test('200: updates and returns the row with updatedAt; email lower-cased', async () => {
    // updateMany reports count=1 (row existed). findUnique returns the updated row.
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Updated User',
      email: 'updated@example.test',
      role: 'editor',
      createdAt: CREATED_DATE,
      updatedAt: UPDATED_DATE,
    });

    const out = await read(
      await handleUsers(
        jsonRequest({
          name: 'Updated User',
          email: 'UPDATED@EXAMPLE.TEST', // upper-case on input
          role: 'editor',
        }),
        ['11111111-1111-4111-8111-111111111111'],
        'PUT',
      ),
    );

    expect(out.status).toBe(200);
    // PUT response INCLUDES updatedAt (legacy contract).
    expect(Object.keys(out.body).sort()).toEqual([
      'createdAt', 'email', 'id', 'name', 'role', 'updatedAt',
    ]);
    expect(out.body.email).toBe('updated@example.test');
    expect(out.body.updatedAt).toBe('2024-02-02T10:00:00.000Z');
    expect(out.body).not.toHaveProperty('password');

    // updateMany received the lower-cased email + an ISO updatedAt.
    const updateArg = mockPrisma.user.updateMany.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: '11111111-1111-4111-8111-111111111111' });
    expect(updateArg.data.email).toBe('updated@example.test');
    expect(updateArg.data.name).toBe('Updated User');
    expect(updateArg.data.role).toBe('editor');
    expect(typeof updateArg.data.updatedAt).toBe('string'); // ISO string
    expect(updateArg.data).not.toHaveProperty('password'); // no password in this payload
  });

  test('with password field: re-hashes the password', async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'x', name: 'n', email: 'n@e.test', role: 'admin',
      createdAt: CREATED_DATE, updatedAt: UPDATED_DATE,
    });

    await handleUsers(
      jsonRequest({ name: 'n', email: 'N@E.TEST', role: 'admin', password: 'newsecret' }),
      ['x'],
      'PUT',
    );

    expect(mockAuth.hashPassword).toHaveBeenCalledWith('newsecret');
    const data = mockPrisma.user.updateMany.mock.calls[0][0].data;
    expect(data.password).toBe('$2a$12$hashednewpassword');
  });

  test('without password field: does NOT hash and does NOT overwrite password', async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'x', name: 'n', email: 'n@e.test', role: 'admin',
      createdAt: CREATED_DATE, updatedAt: UPDATED_DATE,
    });

    await handleUsers(
      jsonRequest({ name: 'n', email: 'n@e.test', role: 'admin' }),
      ['x'],
      'PUT',
    );

    expect(mockAuth.hashPassword).not.toHaveBeenCalled();
    expect(mockPrisma.user.updateMany.mock.calls[0][0].data).not.toHaveProperty('password');
  });

  test('missing id -> 200 `null` (legacy no-op baseline)', async () => {
    // updateMany reports count=0 (nothing matched); findUnique returns null.
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await handleUsers(
      jsonRequest({ name: 'n', email: 'missing@e.test', role: 'admin' }),
      ['nonexistent-id'],
      'PUT',
    );
    // NextResponse.json(null) -> body is null.
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  test('role defaults to "admin" when not provided', async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'x', name: 'n', email: 'n@e.test', role: 'admin',
      createdAt: CREATED_DATE, updatedAt: UPDATED_DATE,
    });
    await handleUsers(jsonRequest({ name: 'n', email: 'n@e.test' }), ['x'], 'PUT');
    expect(mockPrisma.user.updateMany.mock.calls[0][0].data.role).toBe('admin');
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(
      await handleUsers(jsonRequest({ name: 'n', email: 'n@e.test' }), ['x'], 'PUT'),
    );
    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: 'Unauthorized' });
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });
});

describe('DELETE /users/:id', () => {
  test('returns 200 `{ message: "Berhasil dihapus" }` when the row existed', async () => {
    mockPrisma.user.deleteMany.mockResolvedValue({ count: 1 });
    const out = await read(
      await handleUsers(jsonRequest({}), ['11111111-1111-4111-8111-111111111111'], 'DELETE'),
    );
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ message: 'Berhasil dihapus' });
    expect(mockPrisma.user.deleteMany).toHaveBeenCalledWith({
      where: { id: '11111111-1111-4111-8111-111111111111' },
    });
  });

  test('returns 200 `{ message: "Berhasil dihapus" }` even when the id is missing', async () => {
    // deleteMany is a no-op when nothing matches; we do NOT auto-404.
    mockPrisma.user.deleteMany.mockResolvedValue({ count: 0 });
    const out = await read(
      await handleUsers(jsonRequest({}), ['nonexistent-id'], 'DELETE'),
    );
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ message: 'Berhasil dihapus' });
  });

  test('unauthenticated -> 401', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const out = await read(await handleUsers(jsonRequest({}), ['x'], 'DELETE'));
    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: 'Unauthorized' });
    expect(mockPrisma.user.deleteMany).not.toHaveBeenCalled();
  });
});

describe('route fallthrough', () => {
  test('unknown method on /users returns null (no response)', async () => {
    const res = await handleUsers(jsonRequest({}), [], 'PATCH');
    expect(res).toBeNull();
  });
});
