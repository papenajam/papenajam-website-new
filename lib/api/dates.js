// Date helpers for PostgreSQL-backed API routes.
//
// These request/response boundary helpers validate date-only values before they
// reach Prisma and preserve the `YYYY-MM-DD` JSON representation for calendar
// columns. They are intentionally self-contained so the runtime has no
// dependency on historical data-migration tooling.
//
// Pure functions. No I/O, no database access.

function dateParseError(reason) {
  const error = new Error(reason);
  error.reason = reason;
  return error;
}

function parseStrictDateOnly(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  if (typeof value !== 'string') {
    throw dateParseError('date must be a YYYY-MM-DD string');
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw dateParseError('date must use YYYY-MM-DD format');

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw dateParseError('invalid calendar date');
  }
  return parsed;
}

function formatYyyyMmDdUtc(date) {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Error raised by `parseDateOnly` when the input is neither empty/null nor a
 * valid `YYYY-MM-DD` calendar date. Handlers should catch this and return a
 * 400 response; the `field` and `reason` properties are safe to surface to
 * the caller (they never contain secret values).
 */
export class DateInputError extends Error {
  constructor({ field = null, reason, raw } = {}) {
    const where = field ? `field "${field}"` : 'date field';
    super(`Invalid date for ${where}: ${reason}`);
    this.name = 'DateInputError';
    this.field = field;
    this.reason = reason;
    // `raw` is intentionally NOT exposed on the public surface; only `reason`
    // is safe to echo back to the API caller.
    Object.defineProperty(this, 'raw', { value: raw, enumerable: false });
  }
}

/**
 * Parse a date-only input from an API request body or query string.
 *
 * Accepts (returns `null`):
 *   - `undefined` / `null`
 *   - empty string or whitespace-only string  (optional field)
 *
 * Accepts (returns a UTC-midnight `Date`):
 *   - `YYYY-MM-DD` that is a real calendar date (component round-trip check
 *     rejects 2024-02-30, 2024-13-01, 0000-00-00, etc.)
 *
 * Rejects (throws `DateInputError`):
 *   - non-`YYYY-MM-DD` strings ("January 1st", "2024/01/01", "2024-1-1")
 *   - any non-string, non-null, non-undefined type (number, boolean, object)
 *
 * The returned `Date` is constructed with `Date.UTC(y, m-1, d)` so its UTC
 * components are identical regardless of host timezone. `formatDateOnly`
 * round-trips it back to the original string.
 *
 * @param {*} value
 * @param {string|null} [field=null] - field name for error attribution
 * @returns {Date|null}
 * @throws {DateInputError}
 */
export function parseDateOnly(value, field = null) {
  try {
    return parseStrictDateOnly(value);
  } catch (err) {
    throw new DateInputError({
      field,
      reason: err.reason || 'invalid date',
      raw: value,
    });
  }
}

/**
 * Format a date-only `Date` (or null) back to the legacy `YYYY-MM-DD` wire
 * shape, using UTC components so there is NO timezone shift regardless of the
 * host's local timezone (the test suite runs with TZ=Asia/Jakarta to assert
 * this). Returns `null` for null/undefined input so the JSON response emits
 * `null` rather than the string `"null"`.
 *
 * @param {Date|null|undefined} date
 * @returns {string|null}
 */
export function formatDateOnly(date) {
  if (date === null || date === undefined) return null;
  return formatYyyyMmDdUtc(date);
}

/**
 * True when `value` is a non-null, non-undefined, non-empty input that
 * `parseDateOnly` would attempt to parse. Handlers use this to decide whether
 * to call `parseDateOnly` (which throws on bad input) or skip the field.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function hasDateOnlyInput(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true; // any non-string, non-null value is "present" and will be rejected
}
