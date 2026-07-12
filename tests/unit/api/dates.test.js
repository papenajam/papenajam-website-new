// Unit tests for lib/api/dates.js (Task 6).
//
// Covers the REQUIRED test cases from plan lines 540-548:
//   - leap day (2024-02-29) accepted, non-leap (2023-02-29) rejected
//   - timezone boundary: formatDateOnly uses UTC components even when the
//     host TZ is Asia/Jakarta (UTC+7); a date that falls on a UTC-midnight
//     boundary in a +7 host must NOT shift forward/back a day
//   - invalid date rejected (calendar-rollover 2024-02-30, garbage strings)
//   - empty optional date -> null
//   - round-trip: formatDateOnly(parseDateOnly(s)) === s for every accepted s
//
// All tests run with TZ=Asia/Jakarta (forced at the top of the file) so that
// any local-time bug in formatDateOnly would surface. Vitest runs each file
// in its own process so this does not leak to other test files.

// Force a non-UTC timezone. Set BEFORE importing the module under test so the
// Date implementation picks it up. UTC+7 is the production host TZ.
process.env.TZ = 'Asia/Jakarta';

import { describe, expect, test } from 'vitest';
import {
  DateInputError,
  formatDateOnly,
  hasDateOnlyInput,
  parseDateOnly,
} from '../../../lib/api/dates.js';

describe('parseDateOnly: empty / optional -> null', () => {
  test('undefined / null / "" / whitespace -> null', () => {
    expect(parseDateOnly(undefined)).toBeNull();
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly('')).toBeNull();
    expect(parseDateOnly('   ')).toBeNull();
    expect(parseDateOnly('\t')).toBeNull();
  });

  test('null is accepted regardless of field name', () => {
    expect(parseDateOnly(null, 'endDate')).toBeNull();
    expect(parseDateOnly(null, 'tanggalSidang')).toBeNull();
  });
});

describe('parseDateOnly: valid YYYY-MM-DD', () => {
  test('builds a UTC-midnight Date for an ordinary date', () => {
    const d = parseDateOnly('2024-03-15', 'publishDate');
    expect(d).toBeInstanceOf(Date);
    // UTC components are exactly what the user sent, regardless of host TZ.
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(2); // March (0-indexed)
    expect(d.getUTCDate()).toBe(15);
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
  });

  test('leap day 2024-02-29 is accepted (2024 IS a leap year)', () => {
    const d = parseDateOnly('2024-02-29', 'tanggalSidang');
    expect(d).toBeInstanceOf(Date);
    expect(d.getUTCMonth()).toBe(1);
    expect(d.getUTCDate()).toBe(29);
  });

  test('round-trips through formatDateOnly without timezone shift', () => {
    // Even though the host TZ is UTC+7, formatDateOnly must use UTC components
    // so the YYYY-MM-DD output equals the YYYY-MM-DD input. This is the
    // critical timezone-boundary assertion (plan line 540).
    for (const s of [
      '2024-01-01',
      '2024-02-29',
      '2024-12-31',
      '2024-07-12',
      '2025-03-01',
      '1999-06-15',
    ]) {
      expect(formatDateOnly(parseDateOnly(s))).toBe(s);
    }
  });
});

describe('parseDateOnly: invalid input is REJECTED', () => {
  // Calendar-rollover is the silent-failure case: Date.UTC would happily turn
  // 2024-02-30 into 2024-03-01. We must reject it instead. The leap-day
  // 2024-02-29 is VALID (2024 is a leap year) and is asserted separately
  // above; here we only test the negatives.
  test.each([
    ['2024-02-30', 'Feb 30 rolls to March'],
    ['2024-13-01', 'month 13 rolls to next year'],
    ['2024-00-00', 'zero month/day'],
    ['2024-04-31', 'April has 30 days, not 31'],
    ['2023-02-29', '2023 is NOT a leap year'],
    ['0000-00-00', 'all-zero'],
  ])('rejects %s (%s)', (input) => {
    expect(() => parseDateOnly(input, 'publishDate')).toThrow(DateInputError);
  });

  test('rejects garbage strings', () => {
    expect(() => parseDateOnly('January 1st 2024', 'publishDate')).toThrow(DateInputError);
    expect(() => parseDateOnly('2024/01/01', 'publishDate')).toThrow(DateInputError);
    expect(() => parseDateOnly('2024-1-1', 'publishDate')).toThrow(DateInputError);
    expect(() => parseDateOnly('not-a-date', 'publishDate')).toThrow(DateInputError);
    expect(() => parseDateOnly('2024.03.15', 'publishDate')).toThrow(DateInputError);
  });

  test('rejects non-string, non-null types', () => {
    expect(() => parseDateOnly(20240315, 'publishDate')).toThrow(DateInputError);
    expect(() => parseDateOnly(true, 'publishDate')).toThrow(DateInputError);
    expect(() => parseDateOnly({}, 'publishDate')).toThrow(DateInputError);
    expect(() => parseDateOnly([], 'publishDate')).toThrow(DateInputError);
  });

  test('DateInputError carries the field name for attribution', () => {
    let caught = null;
    try {
      parseDateOnly('2024-02-30', 'jadwalSidang');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DateInputError);
    expect(caught.field).toBe('jadwalSidang');
    expect(caught.message).toContain('jadwalSidang');
    expect(caught.reason).toBeTruthy();
  });

  test('DateInputError does NOT expose the raw value on a public property', () => {
    // The `raw` property is defined non-enumerable so JSON.stringify of the
    // error never leaks the offending value back to the API caller. It can
    // still be read explicitly via `.raw` for logging.
    let caught = null;
    try {
      parseDateOnly('SECRET-LIKE-VALUE', 'publishDate');
    } catch (err) {
      caught = err;
    }
    expect(JSON.stringify(caught)).not.toContain('SECRET-LIKE-VALUE');
    // But the raw value is still available for server-side logging:
    expect(caught.raw).toBe('SECRET-LIKE-VALUE');
  });
});

describe('formatDateOnly', () => {
  test('null / undefined -> null', () => {
    expect(formatDateOnly(null)).toBeNull();
    expect(formatDateOnly(undefined)).toBeNull();
  });

  test('always emits YYYY-MM-DD using UTC components (TZ=Asia/Jakarta)', () => {
    // Construct a date at UTC midnight on 2024-07-12. In a UTC+7 host this
    // instant displays as 2024-07-12 07:00 LOCAL, so any code path that
    // formats using LOCAL components would wrongly emit 2024-07-12 (here it
    // happens to coincide) — but a date constructed at 2024-07-12T18:00Z
    // (which is 2024-07-13 01:00 in Jakarta) MUST still emit 2024-07-12
    // because the UTC day is the 12th.
    const d1 = new Date(Date.UTC(2024, 6, 12)); // 2024-07-12T00:00:00Z
    expect(formatDateOnly(d1)).toBe('2024-07-12');

    const d2 = new Date(Date.UTC(2024, 6, 12, 18, 0, 0)); // 2024-07-12T18:00Z
    // This Date is at 2024-07-13 01:00 in Jakarta. A buggy local-component
    // formatter would emit 2024-07-13; the UTC formatter emits 2024-07-12.
    expect(formatDateOnly(d2)).toBe('2024-07-12');
  });

  test('zero-pads month and day', () => {
    expect(formatDateOnly(new Date(Date.UTC(2024, 0, 1)))).toBe('2024-01-01');
    expect(formatDateOnly(new Date(Date.UTC(2024, 10, 5)))).toBe('2024-11-05');
  });
});

describe('hasDateOnlyInput', () => {
  test('false for absent values', () => {
    expect(hasDateOnlyInput(undefined)).toBe(false);
    expect(hasDateOnlyInput(null)).toBe(false);
    expect(hasDateOnlyInput('')).toBe(false);
    expect(hasDateOnlyInput('   ')).toBe(false);
  });

  test('true for any present value (even ones that will reject)', () => {
    expect(hasDateOnlyInput('2024-01-01')).toBe(true);
    expect(hasDateOnlyInput('garbage')).toBe(true);
    expect(hasDateOnlyInput(123)).toBe(true);
  });
});

describe('parseDateOnly + formatDateOnly: full round-trip table', () => {
  // The migration-critical contract: every YYYY-MM-DD the API accepts must
  // survive a parse-then-format round-trip unchanged. This is what the
  // importer relies on for date-only columns.
  test.each([
    '2024-01-01',
    '2024-02-29', // leap day
    '2024-03-15',
    '2024-12-31',
    '2023-02-28', // non-leap year, last day of Feb
    '2024-06-15',
    '2024-07-12', // today (per env)
  ])('round-trips %s', (s) => {
    expect(formatDateOnly(parseDateOnly(s))).toBe(s);
  });
});
