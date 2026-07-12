// Date helpers for the MongoDB -> PostgreSQL/Prisma migration (plan section 6).
//
// These are the REQUEST-SIDE helpers used by API handlers (Tasks 7-13) to
// validate date-only input BEFORE it reaches Prisma, and to format date-only
// columns back to the legacy `YYYY-MM-DD` wire shape on the RESPONSE side.
//
// CONTRACT (plan lines 277-278):
//   - `parseDateOnly(value, field)`: accepts `YYYY-MM-DD`, empty/null when the
//     field is optional, and REJECTS invalid dates including calendar-rollover
//     (e.g. 2024-02-30, 2024-13-01). Never guesses.
//   - `formatDateOnly(date)`: always emits `YYYY-MM-DD` using UTC components so
//     there is no timezone shift regardless of host TZ.
//
// REUSE NOTE: Task 3 already shipped `parseDateOnly` / `formatDateOnly` in
// `scripts/migration/transform-rules.mjs` with calendar-strict validation and
// UTC-stable formatting. We re-import those implementations rather than
// duplicating the logic, then adapt the ERROR contract to the API boundary:
//
//   - Task 3 raises `TransformRejectedError` (importer quarantine semantics).
//   - The API boundary wants a uniform `DateInputError` so handlers can catch
//     it once and map it to a 400 response. We therefore wrap the Task 3
//     function and re-throw `DateInputError` carrying the original field name
//     and reason. This keeps the validation rule SINGLE-SOURCE while giving
//     handlers a clean catch surface.
//
// Pure functions. No I/O, no Prisma, no Mongo. Fully unit-testable.

import {
  formatDateOnly as formatYyyyMmDdUtc,
  parseDateOnly as parseStrict,
} from '../../scripts/migration/transform-rules.mjs';

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
    return parseStrict(value, field, null);
  } catch (err) {
    // Task 3 raises TransformRejectedError; normalize to the API error shape.
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
