// Prisma v7 configuration for PostgreSQL.
//
// The datasource URL is loaded from `DATABASE_URL`; Prisma generation remains
// safe in environments that only need build-time type generation.

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
