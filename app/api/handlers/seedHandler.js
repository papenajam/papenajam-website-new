// Seed HTTP endpoint — DISABLED (Task 15).
//
// The public POST /api/seed endpoint has been removed from the route map in
// `app/api/[[...path]]/route.js`. Requests to `/api/seed` now fall through to
// the dispatcher 404 (`{ error: 'Route tidak ditemukan' }`).
//
// Idempotent seeding lives in `prisma/seed.mjs` and is invoked only via:
//   corepack yarn db:seed
//   npx prisma db seed
//
// This module is kept only so historical imports/docs that mention
// `seedHandler` resolve cleanly; it is NOT registered in ROUTE_MAP.
// Do NOT re-enable a public seed endpoint.

import { NextResponse } from 'next/server';

/**
 * Always returns null so even if re-registered, the dispatcher would 404.
 * Prefer leaving the route unmapped.
 */
export async function handleSeed(_request, _segments, _method) {
  return NextResponse.json(
    {
      error: 'Seed endpoint disabled. Use `prisma db seed` / `yarn db:seed`.',
    },
    { status: 404 },
  );
}
