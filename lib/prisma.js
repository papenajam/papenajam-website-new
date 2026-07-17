// Prisma Client singleton for the PostgreSQL application database.
//
// The client is created lazily so build-time module evaluation does not need a
// database connection, and is reused through `globalThis` during development.

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.ts';

// `__dbUrl` is exposed for tests so they can assert the adapter was wired
// with the runtime URL WITHOUT needing a live connection. The field is
// intentionally read-only and never logged.
const state = {
  /** Connection string the adapter was built with (for diagnostics/tests). */
  __dbUrl: undefined,
  /** Lazily-created PrismaClient instance. */
  client: undefined,
};

/**
 * Strip Prisma-engine-only query params (e.g. `schema=public`) that
 * node-postgres / `psql` reject, and return both the cleaned connection
 * string and the extracted schema name (default: `public`).
 */
export function parseDatabaseUrl(raw) {
  if (!raw || typeof raw !== 'string') {
    return { connectionString: raw, schema: 'public' };
  }
  try {
    // URL() requires an http(s) scheme; temporarily rewrite for parsing.
    const httpish = raw
      .replace(/^postgresql:/i, 'http:')
      .replace(/^postgres:/i, 'http:');
    const u = new URL(httpish);
    const schema = u.searchParams.get('schema') || 'public';
    u.searchParams.delete('schema');
    // Prefer regex strip of `schema=` so credentials stay exactly as the
    // operator encoded them (rebuilding via decodeURIComponent would break
    // passwords containing `@`, `:`, `/`, `#`, etc.).
    const connectionString = raw
      .replace(/([?&])schema=[^&]*/i, '$1')
      .replace(/[?&]$/, '')
      .replace(/\?&/, '?')
      .replace(/\?$/, '');
    return { connectionString, schema };
  } catch {
    // Fall back: strip schema via regex if URL parsing fails.
    const schemaMatch = raw.match(/[?&]schema=([^&]*)/i);
    const schema = schemaMatch ? decodeURIComponent(schemaMatch[1]) : 'public';
    const connectionString = raw
      .replace(/([?&])schema=[^&]*/i, '$1')
      .replace(/[?&]$/, '')
      .replace(/\?&/, '?')
      .replace(/\?$/, '');
    return { connectionString, schema };
  }
}

function createPrismaClient() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      'lib/prisma: DATABASE_URL is not set. The Prisma adapter requires a ' +
        'PostgreSQL connection string at runtime. Copy .env.example to .env ' +
        '(local dev) or provide DATABASE_URL in the deployment environment.'
    );
  }
  const { connectionString, schema } = parseDatabaseUrl(raw);
  state.__dbUrl = raw;

  // PrismaPg accepts the schema as a second constructor argument. Putting
  // `?schema=` on the connection string is rejected by node-postgres.
  // See: https://www.prisma.io/docs/orm/core-concepts/supported-databases/postgresql
  const adapter = new PrismaPg({ connectionString }, { schema });

  // Opt-in query logging only. Never default to logging because Prisma query
  // logs include arguments, which could leak PII / secrets in production.
  const log =
    process.env.PRISMA_LOG === '1'
      ? [{ emit: 'stdout', level: 'query' }]
      : undefined;

  return new PrismaClient({ adapter, log });
}

function getClient() {
  if (state.client) return state.client;
  const globalForPrisma = globalThis;
  if (globalForPrisma.__prismaClient) {
    state.client = globalForPrisma.__prismaClient;
    return state.client;
  }
  const client = createPrismaClient();
  state.client = client;
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.__prismaClient = client;
  }
  return client;
}

/**
 * Lazy PrismaClient proxy. Property access (e.g. `prisma.user.findUnique`)
 * triggers client construction on first use, so importing this module during
 * `next build` page-data collection does not require DATABASE_URL.
 */
export const prisma = new Proxy(
  {},
  {
    get(_target, prop) {
      // Support `prisma.then` / promise detection: return undefined so code
      // that does `await prisma` does not treat the proxy as a thenable.
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return undefined;
      }
      const client = getClient();
      const value = client[prop];
      return typeof value === 'function' ? value.bind(client) : value;
    },
  }
);

/**
 * Returns the connection string the adapter was built with. Used by tests
 * to assert the singleton wiring without making a network connection.
 * Returns undefined if `prisma` has not been constructed yet.
 */
export function getDbUrlForDiagnostics() {
  return state.__dbUrl;
}

/**
 * Returns the cached PrismaClient singleton. Prefer this over the proxy
 * when you need the real client instance (e.g. `$transaction`).
 */
export function getPrisma() {
  return getClient();
}

export default prisma;
