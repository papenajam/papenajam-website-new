// Unit tests for app/api/handlers/authHandler.js (Task 7).
//
// Covers the REQUIRED cases from the task brief + plan lines 561-568:
//   - login success for admin / staff / editor roles (JWT + user shape)
//   - login bad password -> 401 `{ error: 'Email atau password salah' }`
//   - login unknown user -> same 401 body (no user enumeration)
//   - login lower-cases the email before lookup (email normalisation)
//   - verify with a valid Authorization header -> 200 `{ user }`
//   - verify without/invalid Authorization header -> 401 `{ error: 'Unauthorized' }`
//
// The prisma singleton is mocked via vi.mock so NO database connection is
// made. lib/auth (bcrypt + JWT) is mocked too so the test asserts the handler's
// orchestration, not bcrypt's timing. Real bcrypt/JWT are exercised in the
// contract test (Task 1) and in lib/auth itself; here we control the inputs
// deterministically.

import { beforeEach, describe, expect, test, vi } from 'vitest';

// --- Mocks (must be set before importing the handler) -----------------------

// The prisma singleton mock. Each test customises `prisma.user.findUnique`
// (and any other method it needs) via `mockPrisma.user.findUnique.mockResolvedValue(...)`.
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
};
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, getPrisma: () => mockPrisma }));

// lib/auth mock. `generateToken`, `comparePassword`, `requireAuth` are the
// only functions the handler calls. We mock them so the test is deterministic
// and does not depend on bcrypt's CPU cost or a real JWT secret.
const mockAuth = {
  generateToken: vi.fn(),
  comparePassword: vi.fn(),
  requireAuth: vi.fn(),
};
vi.mock('@/lib/auth', () => mockAuth);

// --- Import the handler AFTER mocks are registered --------------------------
const { handleAuth } = await import('../../../app/api/handlers/authHandler.js');

// --- Helpers ---------------------------------------------------------------
// Build a fake Next.js Request with a JSON body and optional headers.
function jsonRequest(body, headers = {}) {
  return {
    json: async () => body,
    headers: new Headers(headers),
  };
}
// Build a fake Next.js Request with no body (for GET verify).
function getRequest(headers = {}) {
  return { headers: new Headers(headers) };
}
// Read the JSON body and status out of a NextResponse.json result.
async function read(res) {
  return {
    status: res.status,
    body: await res.json(),
  };
}

// A canonical user row as Prisma would return it (password included; the
// handler must NEVER put it on the wire).
const DB_USER = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Admin One',
  email: 'admin@example.test',
  password: '$2a$12$hashedpasswordbytes',
  role: 'admin',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /auth/login', () => {
  test('success: returns token + user (admin role)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(DB_USER);
    mockAuth.comparePassword.mockResolvedValue(true);
    mockAuth.generateToken.mockReturnValue('jwt.token.here');

    const res = await handleAuth(
      jsonRequest({ email: 'ADMIN@EXAMPLE.TEST', password: 'secret' }),
      ['login'],
      'POST',
    );

    // Email is lower-cased before the lookup.
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@example.test' },
    });
    // bcrypt compare is called with the plaintext + the stored hash.
    expect(mockAuth.comparePassword).toHaveBeenCalledWith('secret', DB_USER.password);
    // JWT payload matches the legacy shape exactly.
    expect(mockAuth.generateToken).toHaveBeenCalledWith({
      id: DB_USER.id,
      email: DB_USER.email,
      name: DB_USER.name,
      role: 'admin',
    });

    const out = await read(res);
    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      token: 'jwt.token.here',
      user: {
        id: DB_USER.id,
        name: DB_USER.name,
        email: DB_USER.email,
        role: 'admin',
      },
    });
    // Defence-in-depth: password never appears on the wire.
    expect(JSON.stringify(out.body)).not.toContain('password');
  });

  test('success: staff role passes through', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...DB_USER, role: 'staff' });
    mockAuth.comparePassword.mockResolvedValue(true);
    mockAuth.generateToken.mockReturnValue('tok');

    const res = await handleAuth(
      jsonRequest({ email: 'staff@example.test', password: 'x' }),
      ['login'],
      'POST',
    );
    const out = await read(res);
    expect(out.status).toBe(200);
    expect(out.body.user.role).toBe('staff');
    expect(mockAuth.generateToken).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'staff' }),
    );
  });

  test('success: editor role passes through', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...DB_USER, role: 'editor' });
    mockAuth.comparePassword.mockResolvedValue(true);
    mockAuth.generateToken.mockReturnValue('tok');

    const out = await read(
      await handleAuth(
        jsonRequest({ email: 'editor@example.test', password: 'x' }),
        ['login'],
        'POST',
      ),
    );
    expect(out.status).toBe(200);
    expect(out.body.user.role).toBe('editor');
  });

  test('missing role on the row defaults to "admin" (legacy fallback)', async () => {
    // Some legacy rows may have no role field; the handler falls back to
    // 'admin' in BOTH the JWT payload and the response, matching the previous datastore
    // handler's `user.role || 'admin'`.
    mockPrisma.user.findUnique.mockResolvedValue({ ...DB_USER, role: null });
    mockAuth.comparePassword.mockResolvedValue(true);
    mockAuth.generateToken.mockReturnValue('tok');

    const out = await read(
      await handleAuth(
        jsonRequest({ email: 'a@b.test', password: 'x' }),
        ['login'],
        'POST',
      ),
    );
    expect(out.body.user.role).toBe('admin');
    expect(mockAuth.generateToken).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'admin' }),
    );
  });

  test('bad password -> 401 with the legacy body; no token issued', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(DB_USER);
    mockAuth.comparePassword.mockResolvedValue(false);

    const out = await read(
      await handleAuth(
        jsonRequest({ email: 'admin@example.test', password: 'wrong' }),
        ['login'],
        'POST',
      ),
    );
    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: 'Email atau password salah' });
    expect(mockAuth.generateToken).not.toHaveBeenCalled();
  });

  test('unknown user -> same 401 body (no user enumeration)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const out = await read(
      await handleAuth(
        jsonRequest({ email: 'nobody@example.test', password: 'x' }),
        ['login'],
        'POST',
      ),
    );
    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: 'Email atau password salah' });
    // comparePassword must NOT be called when the user does not exist.
    expect(mockAuth.comparePassword).not.toHaveBeenCalled();
    expect(mockAuth.generateToken).not.toHaveBeenCalled();
  });

  test('email is lower-cased before lookup even if already lower', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(DB_USER);
    mockAuth.comparePassword.mockResolvedValue(true);
    mockAuth.generateToken.mockReturnValue('tok');

    await handleAuth(
      jsonRequest({ email: 'admin@example.test', password: 'x' }),
      ['login'],
      'POST',
    );
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@example.test' },
    });
  });

  test('returns null (route fallthrough) for unknown sub-resource', async () => {
    const res = await handleAuth(jsonRequest({}), ['logout'], 'POST');
    expect(res).toBeNull();
  });

  test('returns null for login with wrong method (e.g. GET)', async () => {
    const res = await handleAuth(getRequest(), ['login'], 'GET');
    expect(res).toBeNull();
  });
});

describe('GET /auth/verify', () => {
  test('valid token -> 200 `{ user }` from requireAuth', async () => {
    const decoded = {
      id: DB_USER.id,
      email: DB_USER.email,
      name: DB_USER.name,
      role: 'admin',
      iat: 1700000000,
      exp: 1700086400,
    };
    mockAuth.requireAuth.mockReturnValue(decoded);

    const out = await read(
      await handleAuth(getRequest({ Authorization: 'Bearer jwt.token.here' }), ['verify'], 'GET'),
    );
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ user: decoded });
  });

  test('missing/invalid Authorization -> 401 Unauthorized body', async () => {
    mockAuth.requireAuth.mockReturnValue(null);

    const out = await read(await handleAuth(getRequest(), ['verify'], 'GET'));
    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: 'Unauthorized' });
  });

  test('returns null (route fallthrough) for verify with wrong method', async () => {
    const res = await handleAuth(jsonRequest({}), ['verify'], 'POST');
    expect(res).toBeNull();
  });
});
