// Menus handler (Task 11: PostgreSQL/Prisma implementation).
//
// Behaviour is byte-identical to the established API contract:
//   - GET    /menus           -> 200 `{ items }` public tree
//     isActive=true, sort order asc; top-level rows (parentId null/absent) each
//     carry a `children` array of their direct children (also order asc).
//     Only one nesting level is assembled (legacy in-memory tree).
//   - POST   /menus           -> 201 created row (auth)
//     defaults: isActive=true, order=0, parentId=null
//   - GET    /menus/all       -> 200 `{ items }` flat list (auth), order asc
//   - PUT    /menus/bulk      -> 200 `{ message, count }` replace-all (auth)
//     Serializable $transaction; children deleted then parents (Restrict FK);
//     parents inserted before children. Bounded retry on P2034.
//   - PUT    /menus/:id       -> 200 post-update row | 200 null when missing
//   - DELETE /menus/:id       -> 200 `{ message: 'Berhasil dihapus' }` ALWAYS
//     explicit one-level child deletion then parent (matches Restrict FK +
//     legacy `deleteMany({parentId})` + `deleteOne({id})`; does NOT cascade
//     deeper than one level).
//
// parentId is a self-relation with onDelete: Restrict (schema decision).

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma, getPrisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { serializeRecord, serializeList } from '@/lib/api/serialize.js';
import { mapError, isPrismaErrorCode } from '@/lib/prisma-errors.js';

/** Max attempts for Serializable bulk replace when P2034 write-conflict fires. */
const BULK_TX_MAX_ATTEMPTS = 3;

const BULK_TX_OPTIONS = Object.freeze({
  isolationLevel: 'Serializable',
  maxWait: 5_000,
  timeout: 15_000,
});

/**
 * Normalise a bulk menu item into a Prisma createMany row.
 * Keeps client-supplied id when present (admin bulk save re-sends ids);
 * otherwise generates a UUID. `parentId` empty string -> null.
 *
 * @param {object} raw
 * @param {string} now ISO timestamp
 * @returns {object}
 */
function prepareMenuRow(raw, now) {
  const {
    id,
    label,
    labelEn = null,
    url,
    type = null,
    icon = null,
    order = 0,
    isActive = true,
    parentId = null,
    description = null,
    descriptionEn = null,
    target = null,
    createdAt,
  } = raw;

  return {
    id: id || randomUUID(),
    label,
    labelEn: labelEn ?? null,
    url,
    type: type ?? null,
    icon: icon ?? null,
    order: typeof order === 'number' ? order : Number(order) || 0,
    isActive: isActive !== false,
    parentId: parentId || null,
    description: description ?? null,
    descriptionEn: descriptionEn ?? null,
    target: target ?? null,
    createdAt: createdAt ? new Date(createdAt) : new Date(now),
    updatedAt: new Date(now),
  };
}

/**
 * Validate bulk payload BEFORE the transaction so we never open a write TX
 * for structurally invalid input. Returns either prepared rows or a 400
 * NextResponse.
 *
 * Checks:
 *   - each item is an object with non-empty label + url (schema NOT NULL)
 *   - no duplicate ids within the payload
 *   - no orphan parentId (must reference another id in the same payload)
 *
 * Empty array is valid (wipe-all).
 *
 * @param {Array} items
 * @returns {{ ok: true, rows: object[] } | { ok: false, response: Response }}
 */
function validateBulkItems(items) {
  if (!Array.isArray(items)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'items harus array' }, { status: 400 }),
    };
  }

  const now = new Date().toISOString();
  const rows = [];
  const seenIds = new Set();

  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `items[${i}] harus object` },
          { status: 400 },
        ),
      };
    }
    if (typeof raw.label !== 'string' || !raw.label.trim()) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `items[${i}].label wajib diisi` },
          { status: 400 },
        ),
      };
    }
    if (typeof raw.url !== 'string' || !raw.url.trim()) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `items[${i}].url wajib diisi` },
          { status: 400 },
        ),
      };
    }

    const row = prepareMenuRow(raw, now);
    if (seenIds.has(row.id)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `items mengandung id duplikat: ${row.id}` },
          { status: 400 },
        ),
      };
    }
    seenIds.add(row.id);
    rows.push(row);
  }

  // Orphan check: parentId must point to another row in the same bulk payload.
  // (Self-parent is also rejected as an orphan of a usable tree.)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.parentId == null) continue;
    if (row.parentId === row.id || !seenIds.has(row.parentId)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `items[${i}].parentId tidak valid (orphan atau self-parent)` },
          { status: 400 },
        ),
      };
    }
  }

  return { ok: true, rows };
}

/**
 * Run `fn(tx)` inside a Serializable interactive transaction with bounded
 * retry on Prisma P2034 (write conflict / serialization failure).
 *
 * @param {(tx: import('@prisma/client').PrismaClient) => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
async function withSerializableRetry(fn) {
  const client = getPrisma();
  let lastErr;
  for (let attempt = 0; attempt < BULK_TX_MAX_ATTEMPTS; attempt++) {
    try {
      return await client.$transaction(fn, BULK_TX_OPTIONS);
    } catch (err) {
      lastErr = err;
      if (isPrismaErrorCode(err, 'P2034') && attempt < BULK_TX_MAX_ATTEMPTS - 1) {
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Build the public one-level tree from a flat list of active menu items.
 * Top-level order follows the input order (already sorted by `order` asc);
 * children are sorted by `order` asc within each parent.
 *
 * @param {Array<object>} flat serialized rows
 * @returns {Array<object>}
 */
function buildPublicTree(flat) {
  return flat
    .filter((i) => !i.parentId)
    .map((item) => ({
      ...item,
      children: flat
        .filter((c) => c.parentId === item.id)
        .sort((a, b) => a.order - b.order),
    }));
}

export async function handleMenus(request, segments, method) {
  const [sub] = segments;

  // ── Collection: GET public tree / POST create ─────────────────────────────
  if (!sub) {
    if (method === 'GET') {
      const rows = await prisma.menuItem.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
      });
      const flat = serializeList('MenuItem', rows);
      return NextResponse.json({ items: buildPublicTree(flat) });
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const now = new Date().toISOString();
      const { id: _ignoreId, createdAt: _c, updatedAt: _u, ...rest } = body;
      try {
        const created = await prisma.menuItem.create({
          data: {
            ...rest,
            parentId: rest.parentId || null,
            isActive: rest.isActive !== false,
            order: rest.order || 0,
            createdAt: now,
            updatedAt: now,
          },
        });
        return NextResponse.json(serializeRecord('MenuItem', created), { status: 201 });
      } catch (err) {
        const mapped = mapError(err);
        if (mapped.kind === 'foreign-key') {
          return NextResponse.json(mapped.body, { status: mapped.status });
        }
        throw err;
      }
    }
  }

  // ── PUT /menus/bulk — replace-all in Serializable TX ──────────────────────
  if (sub === 'bulk' && method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const checked = validateBulkItems(body.items);
    if (!checked.ok) return checked.response;

    const { rows } = checked;
    try {
      await withSerializableRetry(async (tx) => {
        // Restrict FK: delete children first, then parents, so a single bulk
        // wipe never trips the self-relation. (A plain deleteMany({}) can fail
        // depending on row evaluation order under Restrict.)
        await tx.menuItem.deleteMany({ where: { parentId: { not: null } } });
        await tx.menuItem.deleteMany({ where: { parentId: null } });

        if (rows.length === 0) return;

        // Parents first so child parentId FKs resolve within the same TX.
        const parents = rows.filter((r) => r.parentId == null);
        const children = rows.filter((r) => r.parentId != null);
        if (parents.length > 0) {
          await tx.menuItem.createMany({ data: parents });
        }
        if (children.length > 0) {
          await tx.menuItem.createMany({ data: children });
        }
      });
    } catch (err) {
      // Exhausted P2034 retries -> 409 with retry signal. FK / other Prisma
      // codes map to stable bodies; unexpected errors re-throw.
      const mapped = mapError(err);
      if (
        mapped.kind === 'conflict' ||
        mapped.kind === 'foreign-key' ||
        mapped.kind === 'duplicate'
      ) {
        return NextResponse.json(mapped.body, { status: mapped.status });
      }
      throw err;
    }

    return NextResponse.json({
      message: 'Menu berhasil disimpan',
      count: rows.length,
    });
  }

  // ── GET /menus/all — flat admin list ──────────────────────────────────────
  if (sub === 'all' && method === 'GET') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rows = await prisma.menuItem.findMany({
      orderBy: { order: 'asc' },
    });
    return NextResponse.json({ items: serializeList('MenuItem', rows) });
  }

  // ── /menus/:id ────────────────────────────────────────────────────────────
  if (sub) {
    if (method === 'PUT') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const { id: _ignoreId, createdAt: _c, ...rest } = body;
      try {
        // updateMany preserves the legacy "always 200" baseline: missing id is
        // a no-op, then findUnique returns null -> 200 `null`.
        await prisma.menuItem.updateMany({
          where: { id: sub },
          data: {
            ...rest,
            // Coerce empty-string parentId to null so Prisma UUID column is happy.
            ...(Object.prototype.hasOwnProperty.call(rest, 'parentId')
              ? { parentId: rest.parentId || null }
              : {}),
            updatedAt: new Date().toISOString(),
          },
        });
      } catch (err) {
        const mapped = mapError(err, { behavior: 'put' });
        if (mapped.kind === 'foreign-key' || mapped.kind === 'duplicate') {
          return NextResponse.json(mapped.body, { status: mapped.status });
        }
        throw err;
      }
      const row = await prisma.menuItem.findUnique({ where: { id: sub } });
      return NextResponse.json(serializeRecord('MenuItem', row));
    }
    if (method === 'DELETE') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      // One-level semantics only: explicit child wipe, then parent. Does NOT
      // recurse into grandchildren (schema Restrict + legacy deleteMany
      // {parentId: sub} only removes direct children).
      await prisma.menuItem.deleteMany({ where: { parentId: sub } });
      await prisma.menuItem.deleteMany({ where: { id: sub } });
      return NextResponse.json({ message: 'Berhasil dihapus' });
    }
  }
  return null;
}
