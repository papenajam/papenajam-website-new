import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');

describe('PostgreSQL project configuration', () => {
  test('keeps a PostgreSQL-only environment template', () => {
    const env = read('.env.example');
    expect(env).toContain('DATABASE_URL=');
    expect(env).toContain('JWT_SECRET=');
    expect(env).not.toMatch(/legacy-database|previous-datastore_url|previous-datastore_db/i);
  });

  test('provides a local PostgreSQL 16 compose profile', () => {
    const compose = read('compose.db.yml');
    expect(compose).toMatch(/image:\s*postgres:16-alpine/);
    expect(compose).toContain('healthcheck:');
    expect(compose).toContain('127.0.0.1:5432:5432');
  });

  test('keeps only supported database scripts', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(Object.keys(pkg.scripts).filter((name) => name.startsWith('db:')).sort()).toEqual([
      'db:migrate:deploy',
      'db:migrate:dev',
      'db:migrate:status',
      'db:seed',
    ]);
  });
});
