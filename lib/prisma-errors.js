// Prisma error -> HTTP response mapper.
//
// The mapper keeps the API's established not-found, duplicate, conflict, and
// generic-error response shapes while preventing database details from being
// exposed to clients.

const DEFAULT_NOT_FOUND = Object.freeze({
  status: 404,
  body: { error: 'Tidak ditemukan' },
});
const PAGE_NOT_FOUND = Object.freeze({
  status: 404,
  body: { error: 'Halaman tidak ditemukan' },
});
const DELETE_OK = Object.freeze({
  status: 200,
  body: { message: 'Berhasil dihapus' },
});
const MEDIA_DELETE_OK = Object.freeze({
  status: 200,
  body: { message: 'File berhasil dihapus' },
});
const PUT_NOOP = Object.freeze({ status: 200, body: null });
const DEFAULT_DUPLICATE_BODY = Object.freeze({
  error: 'Email sudah terdaftar',
});
const INTERNAL_ERROR_BODY = Object.freeze({
  error: 'Terjadi kesalahan pada server',
});

/**
 * Behaviours that decide how P2025 (record not found) is rendered. Handlers
 * pass the one that matches their current previous datastore contract.
 */
const P2025_BEHAVIORS = {
  get: DEFAULT_NOT_FOUND,
  getPage: PAGE_NOT_FOUND,
  put: PUT_NOOP,
  delete: DELETE_OK,
  deleteMedia: MEDIA_DELETE_OK,
};

/**
 * Map a Prisma error (or any thrown value) to an HTTP `{ status, body }`
 * response shape that matches the established API contract contract.
 *
 * @param {Error|{code?: string, clientVersion?: string, meta?: object}} err
 * @param {object} [options]
 * @param {string} [options.behavior='get']  - one of 'get' | 'getPage' |
 *   'put' | 'delete' | 'deleteMedia'. Picks the P2025 baseline.
 * @param {object} [options.duplicateBody]   - override the P2002 body (default
 *   mirrors `usersHandler.js` duplicate-email response).
 * @returns {{status: number, body: object|null, kind: string, retry?: boolean}}
 *   `kind` is a short stable tag the handler can switch on if it needs to
 *   (e.g. 'duplicate', 'not-found', 'conflict', 'internal'). `retry: true`
 *   is present ONLY for `kind: 'conflict'`.
 */
export function mapError(err, options = {}) {
  const {
    behavior = 'get',
    duplicateBody = DEFAULT_DUPLICATE_BODY,
  } = options;

  // Normalise a PrismaClientKnownRequestError (which has `.code`) and the
  // plain-object shape used in tests to a single accessor.
  const code = err && typeof err === 'object' ? err.code : null;

  if (code === 'P2002') {
    // Unique constraint violation. Default body mirrors usersHandler line 22.
    return {
      status: 400,
      body: { ...duplicateBody },
      kind: 'duplicate',
    };
  }

  if (code === 'P2025') {
    // Record not found. Render per the endpoint's legacy baseline so the
    // contract does NOT silently turn every PUT/DELETE into a 404.
    const baseline = P2025_BEHAVIORS[behavior] || DEFAULT_NOT_FOUND;
    return {
      status: baseline.status,
      body: baseline.body === null ? null : { ...baseline.body },
      kind: 'not-found',
    };
  }

  if (code === 'P2034' || code === 'P2031') {
    // Transaction / write conflict. Signal retry; do NOT leak Prisma details.
    return {
      status: 409,
      body: { error: 'Konflik data, silakan coba lagi' },
      kind: 'conflict',
      retry: true,
    };
  }

  if (code === 'P2003') {
    // Foreign-key constraint violation. The only FK in the schema today is
    // menus.parentId; we surface a stable 400 so the handler does not need to
    // special-case it. (Plan: menu parent uses onDelete: Restrict.)
    return {
      status: 400,
      body: { error: 'Data terkait masih digunakan' },
      kind: 'foreign-key',
    };
  }

  // Unknown Prisma error or non-Prisma error. Stable 500; original error is
  // attached non-enumerably so logs keep the stack but the client body never
  // includes it.
  const result = {
    status: 500,
    body: { ...INTERNAL_ERROR_BODY },
    kind: 'internal',
  };
  if (err && typeof err === 'object') {
    Object.defineProperty(result, 'cause', {
      value: err,
      enumerable: false,
    });
  }
  return result;
}

/**
 * Convenience predicate: true if `err` looks like a Prisma known-request
 * error with the given code. Used by handlers that want to branch BEFORE
 * calling `mapError` (e.g. to log only unexpected errors).
 *
 * @param {*} err
 * @param {string} code
 * @returns {boolean}
 */
export function isPrismaErrorCode(err, code) {
  return Boolean(err && typeof err === 'object' && err.code === code);
}

export { P2025_BEHAVIORS, DEFAULT_DUPLICATE_BODY };
