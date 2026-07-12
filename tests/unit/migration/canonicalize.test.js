import { describe, expect, test } from 'vitest';
import {
  bsonTypeName,
  classifyUuid,
  emailHasCasingAnomaly,
  estimateJsonBytes,
  isBcryptHashFormat,
  isDateOnlyString,
  isEmptyValue,
  isIntegerOverflow,
  isInvalidTimestamp,
  isIsoTimestampString,
  isSecretField,
  normalizeEmail,
  sanitizeConnectionUri,
  sanitizeRecord,
} from '../../../scripts/migration/lib/canonicalize.mjs';

describe('canonicalize: bsonTypeName', () => {
  test('classifies primitive JS values', () => {
    expect(bsonTypeName(null)).toBe('Null');
    expect(bsonTypeName('x')).toBe('String');
    expect(bsonTypeName(true)).toBe('Boolean');
    expect(bsonTypeName(42)).toBe('Int32');
    expect(bsonTypeName(3.14)).toBe('Double');
    expect(bsonTypeName([1, 2])).toBe('Array');
    expect(bsonTypeName({ a: 1 })).toBe('Object');
    expect(bsonTypeName(new Date('2024-01-01T00:00:00.000Z'))).toBe('Date');
    expect(bsonTypeName(/re/)).toBe('RegExp');
  });

  test('classifies driver-like constructors by name', () => {
    class ObjectId { constructor() { } }
    class Long { constructor() { } }
    class Int32 { constructor() { } }
    class Decimal128 { constructor() { } }
    class Binary { constructor() { } }
    class Timestamp { constructor() { } }
    class Double { constructor() { } }
    class UUID { constructor() { } }

    expect(bsonTypeName(new ObjectId())).toBe('ObjectId');
    expect(bsonTypeName(new Long())).toBe('Long');
    expect(bsonTypeName(new Int32())).toBe('Int32');
    expect(bsonTypeName(new Double())).toBe('Double');
    expect(bsonTypeName(new Decimal128())).toBe('Decimal128');
    expect(bsonTypeName(new Binary())).toBe('Binary');
    expect(bsonTypeName(new Timestamp())).toBe('Timestamp');
    expect(bsonTypeName(new UUID())).toBe('UUID');
  });

  test('classifies native bigint', () => {
    expect(bsonTypeName(42n)).toBe('BigInt');
  });

  test('handles undefined and unusual inputs without throwing', () => {
    expect(bsonTypeName(undefined)).toBe('Undefined');
    expect(bsonTypeName(Symbol('x'))).toBe('Symbol');
  });
});

describe('canonicalize: empty / missing detection', () => {
  test('isEmptyValue detects empty strings, arrays, objects', () => {
    expect(isEmptyValue('')).toBe(true);
    expect(isEmptyValue('   ')).toBe(true);
    expect(isEmptyValue([])).toBe(true);
    expect(isEmptyValue({})).toBe(true);
    expect(isEmptyValue('x')).toBe(false);
    expect(isEmptyValue([1])).toBe(false);
    expect(isEmptyValue(null)).toBe(false);
    expect(isEmptyValue(undefined)).toBe(false);
    expect(isEmptyValue(0)).toBe(false);
  });
});

describe('canonicalize: UUID classification', () => {
  test('flags v4 / non-v4 / non-uuid correctly', () => {
    expect(classifyUuid('10000000-0000-4000-8000-000000000001')).toMatchObject({ kind: 'uuid-v4', validUuidV4: true, validUuidAny: true });
    expect(classifyUuid('10000000-0000-1000-8000-000000000001')).toMatchObject({ kind: 'uuid-non-v4', validUuidV4: false, validUuidAny: true });
    expect(classifyUuid('legacy-id')).toMatchObject({ kind: 'not-uuid', validUuidV4: false, validUuidAny: false });
    expect(classifyUuid(42)).toMatchObject({ kind: 'not-string' });
    // 32-hex no hyphens
    expect(classifyUuid('1000000000004000800000000000000a')).toMatchObject({ kind: 'uuid-no-hyphens' });
  });
});

describe('canonicalize: email helpers', () => {
  test('normalizeEmail trims and lowercases', () => {
    expect(normalizeEmail('  ADMIN@Example.TEST  ')).toBe('admin@example.test');
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(42)).toBe('');
  });

  test('emailHasCasingAnomaly flags uppercase letters', () => {
    expect(emailHasCasingAnomaly('Admin@example.test')).toBe(true);
    expect(emailHasCasingAnomaly('admin@example.test')).toBe(false);
    expect(emailHasCasingAnomaly('')).toBe(false);
    expect(emailHasCasingAnomaly(null)).toBe(false);
  });
});

describe('canonicalize: bcrypt format', () => {
  test('validates real bcrypt format without leaking hash', () => {
    expect(isBcryptHashFormat('$2a$10$.FMTahov29ELSZgnu18DKRYfmt07CJQXelsz6BIPWdkry5AHOVcjq')).toBe(true);
    expect(isBcryptHashFormat('$2b$04$.FMTahov29ELSZgnu18DKRYfmt07CJQXelsz6BIPWdkry5AHOVcjq')).toBe(true);
    expect(isBcryptHashFormat('$2y$12$.FMTahov29ELSZgnu18DKRYfmt07CJQXelsz6BIPWdkry5AHOVcjq')).toBe(true);
    expect(isBcryptHashFormat('$2x$12$.FMTahov29ELSZgnu18DKRYfmt07CJQXelsz6BIPWdkry5AHOVcjq')).toBe(true);
    expect(isBcryptHashFormat('plaintext')).toBe(false);
    expect(isBcryptHashFormat('$2a$10$short')).toBe(false);
    expect(isBcryptHashFormat(null)).toBe(false);
  });
});

describe('canonicalize: timestamps and date-only', () => {
  test('isIsoTimestampString accepts ISO strings with/without ms', () => {
    expect(isIsoTimestampString('2024-01-01T00:00:00.000Z')).toBe(true);
    expect(isIsoTimestampString('2024-01-01T00:00:00Z')).toBe(true);
    expect(isIsoTimestampString('2024-01-01')).toBe(false);
    expect(isIsoTimestampString('yesterday')).toBe(false);
  });

  test('isDateOnlyString only accepts YYYY-MM-DD', () => {
    expect(isDateOnlyString('2024-01-01')).toBe(true);
    expect(isDateOnlyString('2024-1-1')).toBe(false);
    expect(isDateOnlyString('2024-01-01T00:00:00.000Z')).toBe(false);
  });

  test('isInvalidTimestamp flags non-ISO non-date-only non-empty strings', () => {
    expect(isInvalidTimestamp('January 1st 2024')).toBe(true);
    expect(isInvalidTimestamp('2024-01-01')).toBe(false);
    expect(isInvalidTimestamp('2024-01-01T00:00:00.000Z')).toBe(false);
    expect(isInvalidTimestamp('')).toBe(false);
    expect(isInvalidTimestamp(null)).toBe(false);
    expect(isInvalidTimestamp(42)).toBe(false);
  });
});

describe('canonicalize: integer overflow', () => {
  test('detects int32 boundary violations', () => {
    expect(isIntegerOverflow(2147483647)).toBe(false);
    expect(isIntegerOverflow(2147483648)).toBe(true);
    expect(isIntegerOverflow(-2147483648)).toBe(false);
    expect(isIntegerOverflow(-2147483649)).toBe(true);
    expect(isIntegerOverflow(42n)).toBe(false);
    expect(isIntegerOverflow(5000000000n)).toBe(true);
    expect(isIntegerOverflow('not-a-number')).toBe(false);
  });

  test('honors custom bounds', () => {
    expect(isIntegerOverflow(50, { max: 100, min: 0 })).toBe(false);
    expect(isIntegerOverflow(150, { max: 100, min: 0 })).toBe(true);
    expect(isIntegerOverflow(-1, { max: 100, min: 0 })).toBe(true);
  });
});

describe('canonicalize: byte estimator', () => {
  test('estimateJsonBytes counts UTF-8 bytes including multibyte', () => {
    expect(estimateJsonBytes('hello')).toBe(7); // JSON.stringify('hello') -> "hello" = 7
    expect(estimateJsonBytes({ a: 1 })).toBe(7);
    expect(estimateJsonBytes('é')).toBe(4); // "é" with 2-byte UTF-8 char
    expect(estimateJsonBytes(null)).toBe(4); // "null"
  });
});

describe('canonicalize: secret redaction', () => {
  test('isSecretField recognizes known secret fields', () => {
    expect(isSecretField('password')).toBe(true);
    expect(isSecretField('token')).toBe(true);
    expect(isSecretField('apiKey')).toBe(true);
    expect(isSecretField('title')).toBe(false);
  });

  test('sanitizeRecord replaces secret fields with redacted token at every depth', () => {
    const input = {
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Admin',
      password: '$2a$10$supersecrethashsupersecrethashsupersecrethashsupersecret12345',
      blocks: [{ settings: { password: 'nested-secret' } }],
    };
    const out = sanitizeRecord(input);
    expect(out.password).toBe('<redacted>');
    expect(out.blocks[0].settings.password).toBe('<redacted>');
    expect(out.id).toBe(input.id);
    expect(out.name).toBe('Admin');
    // input is not mutated
    expect(input.password).toMatch(/^\$2a\$10\$/);
  });

  test('sanitizeRecord handles arrays and nulls', () => {
    expect(sanitizeRecord(null)).toBe(null);
    expect(sanitizeRecord([1, { password: 'x' }])).toEqual([1, { password: '<redacted>' }]);
  });
});

describe('canonicalize: connection URI sanitizer', () => {
  test('redacts passwords and query-string auth', () => {
    expect(sanitizeConnectionUri('mongodb://user:secret@host:27017/db')).toBe('mongodb://user:<redacted>@host:27017/db');
    expect(sanitizeConnectionUri('mongodb+srv://user:p%40ss@cluster.example/db?authSource=admin&password=hunter2')).toBe('mongodb+srv://user:<redacted>@cluster.example/db?authSource=<redacted>&password=<redacted>');
  });

  test('reports unset safely', () => {
    expect(sanitizeConnectionUri('')).toBe('<unset>');
    expect(sanitizeConnectionUri(null)).toBe('<unset>');
  });

  test('handles URIs without credentials', () => {
    expect(sanitizeConnectionUri('mongodb://host:27017')).toBe('mongodb://host:27017');
  });
});
