// Prisma v7 configuration for the MongoDB -> PostgreSQL migration.
//
// Prisma v7 manages the datasource URL here (in config), NOT in schema.prisma.
// We do NOT use the legacy v6 `directUrl` field: CI injects the direct URL
// as `DATABASE_URL` for `prisma migrate deploy` jobs (plan line 377).
//
// `dotenv/config` loads .env for local dev so `DATABASE_URL` resolves.
// In production the environment provides DATABASE_URL directly.
//
// IMPORTANT (Prisma v7 + CI): we do NOT use the `env('DATABASE_URL')` helper
// here. `env()` THROWS when the variable is unset, which breaks
// `prisma generate` in environments that legitimately do not have a database
// URL (CI type-check jobs, `yarn install` running the `postinstall` hook).
// Only `prisma migrate *` / `prisma db *` actually need the URL; per the
// official config reference we access the variable directly with a fallback.
// `lib/prisma.js` still enforces that the runtime URL is present before
// constructing the adapter, so a missing URL at request time fails loudly.

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.mjs',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
