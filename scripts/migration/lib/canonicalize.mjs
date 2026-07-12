// Pure helpers for canonicalizing MongoDB/BSON values for the read-only profiler.
//
// Nothing in this module touches a live MongoDB connection. Every function is
// unit-testable from in-memory fixtures. Only `bsonTypeName` is sensitive to the
// `mongodb` driver types and it is fully defensive when they are absent (e.g.
// in unit tests that load plain JSON).

const SECRET_FIELDS = new Set([
  'password',
  'passwordHash',
  'passphrase',
  'secret',
  'token',
  'apiKey',
  'apikey',
  'authorization',
]);

const REDACTED = '<redacted>';

/**
 * Map a BSON/JS value to a stable, human-readable type name used in reports.
 *
 * The names mirror the official BSON type table so the PostgreSQL/Prisma plan
 * can map them deterministically:
 *   - "ObjectId", "Date", "Int32", "Long", "Double", "Decimal128",
 *     "Binary", "Boolean", "Null", "String", "RegExp", "Timestamp"
 *   - "Array" for arrays
 *   - "Object" / "Document" for plain objects
 *   - "BigInt" for native JS bigint (rare in Mongo, but possible)
 *
 * `objectIdCtor` and friends are looked up by name so unit tests that do not
 * import the `mongodb` driver still get useful results, and the live profiler
 * (which does import the driver) gets accurate BSON type names.
 */
export function bsonTypeName(value, knownCtors = {}) {
  if (value === null) return 'Null';
  if (Array.isArray(value)) return 'Array';
  const type = typeof value;

  switch (type) {
    case 'undefined':
      return 'Undefined';
    case 'string':
      return 'String';
    case 'boolean':
      return 'Boolean';
    case 'bigint':
      return 'BigInt';
    case 'number':
      return Number.isInteger(value) ? 'Int32' : 'Double';
    case 'function':
      return 'Function';
    case 'symbol':
      return 'Symbol';
    case 'object':
      break;
    default:
      return type;
  }

  // Objects: try BSON driver constructors first.
  const ctorName = value?.constructor?.name;
  if (ctorName) {
    const BSON_NAMES = new Set([
      'ObjectId',
      'Long',
      'Int32',
      'Double',
      'Decimal128',
      'Binary',
      'Buffer',
      'UUID',
      'Timestamp',
      'MaxKey',
      'MinKey',
      'Map',
      'RegExp',
    ]);
    if (BSON_NAMES.has(ctorName)) {
      if (ctorName === 'Buffer') return 'Binary';
      return ctorName;
    }
  }

  if (value instanceof RegExp) return 'RegExp';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return 'Date';

  // Fallbacks for unit-test environments.
  if (knownCtors.ObjectId && value instanceof knownCtors.ObjectId) return 'ObjectId';
  if (knownCtors.Long && value instanceof knownCtors.Long) return 'Long';
  if (knownCtors.Int32 && value instanceof knownCtors.Int32) return 'Int32';
  if (knownCtors.Double && value instanceof knownCtors.Double) return 'Double';
  if (knownCtors.Decimal128 && value instanceof knownCtors.Decimal128) return 'Decimal128';
  if (knownCtors.Binary && value instanceof knownCtors.Binary) return 'Binary';
  if (knownCtors.Timestamp && value instanceof knownCtors.Timestamp) return 'Timestamp';
  if (knownCtors.UUID && value instanceof knownCtors.UUID) return 'UUID';

  return 'Object';
}

/**
 * Determine if a value should be considered "empty" for missing/empty reporting.
 * Strings: empty or whitespace-only. Arrays/Objects: zero-length. Null/undefined: false.
 */
export function isEmptyValue(value) {
  if (value === null || value === undefined) return false; // null is its own dimension
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Coerce a string id to a canonical comparable form. We deliberately do NOT
 * lowercase the entire UUID (UUIDs are case-insensitive but we report the
 * stored value as-is); this helper just trims and returns.
 */
export function normalizeId(value) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Some Mongo apps store UUIDs without hyphens; we still want to flag a valid hex
// 32-char id as a "non-canonical UUID" so reviewers can spot it.
const UUID_V4_NO_HYPHEN = /^[0-9a-f]{32}$/i;
// Loose RFC-4122 UUID (any version). UUID v4 is what the app generates, but
// legacy data may contain v1/v5 UUIDs. The 3rd group is 4 hex chars with the
// leading nibble encoding the version; the 4th group's leading nibble encodes
// the RFC variant (8-b).
const UUID_ANY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function classifyUuid(value) {
  if (typeof value !== 'string') {
    return { kind: 'not-string', validUuidV4: false, validUuidAny: false };
  }
  const trimmed = value.trim();
  if (UUID_V4.test(trimmed)) {
    return { kind: 'uuid-v4', validUuidV4: true, validUuidAny: true };
  }
  if (UUID_ANY.test(trimmed)) {
    return { kind: 'uuid-non-v4', validUuidV4: false, validUuidAny: true };
  }
  if (UUID_V4_NO_HYPHEN.test(trimmed)) {
    return { kind: 'uuid-no-hyphens', validUuidV4: false, validUuidAny: false };
  }
  return { kind: 'not-uuid', validUuidV4: false, validUuidAny: false };
}

/**
 * Normalize an email for duplicate detection: trim + lowercase, mirroring the
 * application's `email.toLowerCase()` behavior in `usersHandler.js`.
 */
export function normalizeEmail(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

/**
 * Detect email casing anomalies: app stores emails lowercased, so any user
 * record whose email is non-empty and contains uppercase letters is anomalous.
 * We never print the email itself; we report count + sample of <redacted>.
 */
export function emailHasCasingAnomaly(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return trimmed !== trimmed.toLowerCase();
}

/**
 * Validate bcrypt hash format WITHOUT revealing the hash.
 * bcrypt hashes match: `$2[abxy]$<cost 2 digits>$<53 base64 chars>` (60 chars total).
 */
const BCRYPT_HASH = /^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export function isBcryptHashFormat(value) {
  return typeof value === 'string' && BCRYPT_HASH.test(value.trim());
}

/**
 * Redact a value's display form. We always replace the full value with the
 * constant `<redacted>` token to guarantee no password, hash, or credential
 * leaks into JSON/Markdown/log output.
 */
export function redactSecret(_value) {
  return REDACTED;
}

export function isSecretField(fieldName) {
  return SECRET_FIELDS.has(fieldName);
}

/**
 * Sanitize a record for output: replace secret-bearing fields with `<redacted>`.
 * We do not drop the key (so reviewers see the field is present) but we replace
 * the value unconditionally. Works recursively into nested objects/arrays so
 * e.g. `blocks[].settings.password` is also redacted.
 *
 * Returns a new object; does not mutate the input.
 */
export function sanitizeRecord(value, options = {}) {
  const { redactDepth = 0 } = options;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRecord(item, { redactDepth }));
  }
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (isSecretField(key)) {
      out[key] = REDACTED;
    } else {
      out[key] = sanitizeRecord(child, { redactDepth });
    }
  }
  return out;
}

/**
 * Estimate the serialized byte size of a value using UTF-8 JSON encoding.
 * Used to report "largest records" and "estimated total bytes" per collection.
 * We deliberately use the JSON form because (a) it is deterministic and
 * (b) it matches the wire shape reviewers will compare against PostgreSQL row
 * sizes after migration.
 */
export function estimateJsonBytes(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
  } catch {
    return 0;
  }
}

/**
 * Convert a possibly-Date value to an ISO string for timestamp anomaly analysis.
 * Returns `null` if the input is not a parseable date.
 */
export function toIsoTimestamp(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

/**
 * Detect "date-only" strings of the form YYYY-MM-DD (no time component).
 * The app stores these for `publishDate`, `jadwalSidang`, `tanggalSidang`,
 * `tanggalPutusan`, `startDate`, `endDate`, etc.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnlyString(value) {
  return typeof value === 'string' && DATE_ONLY.test(value.trim());
}

/**
 * Detect a full ISO timestamp string (the format the app writes for createdAt /
 * updatedAt via `new Date().toISOString()`).
 */
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

export function isIsoTimestampString(value) {
  return typeof value === 'string' && ISO_TIMESTAMP.test(value.trim());
}

/**
 * Detect an invalid timestamp/date string: any string assigned to a timestamp
 * field that is neither a valid ISO timestamp, a valid date-only, nor empty.
 *
 * Callers pass in the candidate string; we return true when the string is
 * non-empty AND does not parse as a valid date AND does not match date-only.
 */
export function isInvalidTimestamp(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (DATE_ONLY.test(trimmed)) return false;
  if (ISO_TIMESTAMP.test(trimmed)) return false;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime());
}

/**
 * Safe integer range for "integer overflow" detection on counters and sizes.
 * PostgreSQL `integer` is 32-bit signed (max 2147483647); `bigint` is 64-bit.
 * We treat anything that exceeds 32-bit signed as a candidate overflow so the
 * migration team can decide whether to use bigint in Prisma.
 */
export const INT32_MAX = 2147483647;
export const INT32_MIN = -2147483648;
export const SAFE_INTEGER_MAX = Number.MAX_SAFE_INTEGER;

export function isIntegerOverflow(value, { max = INT32_MAX, min = INT32_MIN } = {}) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value > max || value < min;
  }
  if (typeof value === 'bigint') {
    return value > BigInt(max) || value < BigInt(min);
  }
  if (value && typeof value === 'object' && typeof value.toNumber === 'function') {
    try {
      const n = value.toNumber();
      return Number.isFinite(n) && (n > max || n < min);
    } catch {
      return true; // unrepresentable Long values are overflow candidates
    }
  }
  return false;
}

/**
 * Sanitize a MongoDB connection URI for logging. Replaces the password portion
 * of `mongodb://user:password@host` / `mongodb+srv://...` with `<redacted>`,
 * and strips query-string auth tokens. Returns "<unset>" for falsy input.
 */
export function sanitizeConnectionUri(uri) {
  if (!uri || typeof uri !== 'string') return '<unset>';
  // Strip credentials from mongodb[+srv]://user:pass@host/... forms.
  const stripped = uri.replace(
    /^(mongodb(?:\+srv)?:\/\/)([^:@/]+)(:[^@/]+)?@/,
    (_m, scheme, user) => `${scheme}${user}:<redacted>@`,
  );
  // Strip `password=` / `authSource=` query params defensively.
  return stripped.replace(
    /([?&])(password|username|authsource)=([^&#]+)/gi,
    (_m, prefix, key) => `${prefix}${key}=<redacted>`,
  );
}
