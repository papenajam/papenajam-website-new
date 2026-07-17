// Media handler (Task 13: PostgreSQL/Prisma implementation).
//
// Behaviour matches the established API contract wire contract:
//   - GET    /media?page&limit&search&type&sortField&sortDir
//     -> 200 `{ items, total, page, totalPages }` (public, no auth)
//     search -> title OR originalName contains + mode:'insensitive'
//     type   -> equality when present and not 'all'
//     sort   -> allowlisted via mediaOrderByFromQuery (createdAt|originalName|size)
//   - GET    /media/:id   -> 200 row (auth) | 401 | 404
//   - PUT    /media/:id   -> 200 post-update row | 200 null when missing (auth)
//     only title/alt are writable (legacy allowlist)
//   - DELETE /media/:id   -> 200 `{ message: 'File berhasil dihapus' }` ALWAYS
//     (auth). Failure policy (DB first, then file):
//       1. Look up the row.
//       2. If missing -> success (legacy deleteOne no-op).
//       3. Delete the DB row first so the media library never shows a broken
//          entry after a partial failure.
//       4. Unlink the file; if unlink fails, log an orphan-file warning
//          (filesystem cannot join a DB transaction). Orphan files waste disk
//          but do not break the UI; a later cleanup pass can reclaim them.
//
// Prisma model is `Media` (@@map("media")).

import { NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { serializeRecord, serializeList } from '@/lib/api/serialize.js';
import {
  parsePagination,
  paginationEnvelope,
  mediaOrderByFromQuery,
} from '@/lib/api/query.js';

/**
 * Resolve the on-disk path for a media `url` field (`/uploads/...`).
 * Strips a leading slash so `path.join` does not treat the url as absolute
 * (Node's path.join discards prior segments when it sees an absolute one).
 * Exported for unit tests.
 */
export function mediaAbsolutePath(url) {
  const relative = String(url || '').replace(/^\/+/, '');
  return path.join(process.cwd(), 'public', relative);
}

export async function handleMedia(request, segments, method) {
  const [id] = segments;

  if (!id) {
    if (method !== 'GET') return null;
    const url = new URL(request.url);
    const { page, limit, skip, take } = parsePagination(url, 'media');
    const search = url.searchParams.get('search') || '';
    const type = url.searchParams.get('type') || '';
    const { field, direction } = mediaOrderByFromQuery(url);

    const where = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { originalName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (type && type !== 'all') {
      where.type = type;
    }

    const [total, rows] = await Promise.all([
      prisma.media.count({ where }),
      prisma.media.findMany({
        where,
        orderBy: { [field]: direction },
        skip,
        take,
      }),
    ]);

    return NextResponse.json(
      paginationEnvelope(serializeList('Media', rows), total, page, limit),
    );
  }

  if (method === 'GET') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const row = await prisma.media.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
    return NextResponse.json(serializeRecord('Media', row));
  }

  if (method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    // Only title/alt are writable — matches the legacy allowlist exactly.
    const data = { updatedAt: new Date().toISOString() };
    for (const k of ['title', 'alt']) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    // updateMany + findUnique preserves the established API "PUT missing id ->
    // 200 null" baseline (updateMany is a no-op; findUnique returns null;
    // serializeRecord(null) is null).
    await prisma.media.updateMany({ where: { id }, data });
    const row = await prisma.media.findUnique({ where: { id } });
    return NextResponse.json(serializeRecord('Media', row));
  }

  if (method === 'DELETE') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Failure policy: DB first, then file (with logging). See file header.
    const item = await prisma.media.findUnique({ where: { id } });
    if (item) {
      // deleteMany so a race-deleted row never throws P2025 after the lookup.
      await prisma.media.deleteMany({ where: { id } });
      try {
        await unlink(mediaAbsolutePath(item.url));
      } catch (err) {
        // Orphan file on disk after successful DB delete. Log for ops cleanup;
        // still return success so the admin UI reflects the library state.
        console.error(
          '[media] orphan file after DB delete (unlink failed):',
          item.url,
          err?.message || err,
        );
      }
    }
    return NextResponse.json({ message: 'File berhasil dihapus' });
  }

  return null;
}
