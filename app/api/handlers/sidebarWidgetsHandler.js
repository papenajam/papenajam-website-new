// Sidebar widgets handler (Task 11: MongoDB -> PostgreSQL/Prisma migration).
//
// Behaviour is byte-identical to the legacy Mongo handler:
//   - GET    /sidebar-widgets       -> 200 `{ items }` public active list
//     isActive=true, sort order asc
//   - POST   /sidebar-widgets       -> 201 created row (auth)
//     defaults: isActive=true, order=0, settings={}
//   - GET    /sidebar-widgets/all   -> 200 `{ items }` (auth), order asc
//   - PUT    /sidebar-widgets/bulk  -> 200 `{ message, count }` replace-all (auth)
//     Serializable $transaction (deleteMany then createMany); bounded retry
//     on P2034. Whole `settings` JSONB is written/read verbatim.
//   - PUT    /sidebar-widgets/:id   -> 200 post-update | 200 null when missing
//   - DELETE /sidebar-widgets/:id   -> 200 `{ message: 'Berhasil dihapus' }` ALWAYS
//
// settings is stored/read as whole JSONB via Prisma Json; serializeRecord
// ('SidebarWidget', …) preserves nested links/schedule/etc. deep-equal.

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
 * Normalise a bulk sidebar widget into a Prisma createMany row.
 * `settings` defaults to `{}` because the column is NOT NULL Json.
 *
 * @param {object} raw
 * @param {string} now ISO timestamp
 * @returns {object}
 */
function prepareWidgetRow(raw, now) {
  const {
    id,
    type,
    label,
    labelEn = null,
    icon = null,
    color = null,
    isActive = true,
    order = 0,
    settings = {},
    createdAt,
  } = raw;

  return {
    id: id || randomUUID(),
    type,
    label,
    labelEn: labelEn ?? null,
    icon: icon ?? null,
    color: color ?? null,
    isActive: isActive !== false,
    order: typeof order === 'number' ? order : Number(order) || 0,
    // Whole settings blob — no per-type normalisation. Nested links/schedule
    // round-trip as-is through JSONB.
    settings: settings == null ? {} : settings,
    createdAt: createdAt ? new Date(createdAt) : new Date(now),
    updatedAt: new Date(now),
  };
}

/**
 * Validate bulk payload BEFORE the transaction.
 *
 * Checks:
 *   - each item is an object with non-empty type + label (schema NOT NULL)
 *   - settings, when present, is a plain object (not array / primitive)
 *   - no duplicate ids within the payload
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
    if (typeof raw.type !== 'string' || !raw.type.trim()) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `items[${i}].type wajib diisi` },
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
    if (
      raw.settings !== undefined &&
      raw.settings !== null &&
      (typeof raw.settings !== 'object' || Array.isArray(raw.settings))
    ) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `items[${i}].settings harus object` },
          { status: 400 },
        ),
      };
    }

    const row = prepareWidgetRow(raw, now);
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

export async function handleSidebarWidgets(request, segments, method) {
  const [sub] = segments;

  // ── Collection: GET active list / POST create ─────────────────────────────
  if (!sub) {
    if (method === 'GET') {
      const rows = await prisma.sidebarWidget.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
      });
      return NextResponse.json({ items: serializeList('SidebarWidget', rows) });
    }
    if (method === 'POST') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();
      const now = new Date().toISOString();
      const { id: _ignoreId, createdAt: _c, updatedAt: _u, ...rest } = body;

      // settings is NOT NULL Json — default to {} when the client omits it so
      // create never writes a null into the JSONB column.
      let settings = rest.settings;
      if (settings === undefined || settings === null) {
        settings = {};
      } else if (typeof settings !== 'object' || Array.isArray(settings)) {
        return NextResponse.json(
          { error: 'settings harus object' },
          { status: 400 },
        );
      }

      const created = await prisma.sidebarWidget.create({
        data: {
          ...rest,
          settings,
          isActive: rest.isActive !== false,
          order: rest.order || 0,
          createdAt: now,
          updatedAt: now,
        },
      });
      return NextResponse.json(serializeRecord('SidebarWidget', created), {
        status: 201,
      });
    }
  }

  // ── GET /sidebar-widgets/all ──────────────────────────────────────────────
  if (sub === 'all' && method === 'GET') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rows = await prisma.sidebarWidget.findMany({
      orderBy: { order: 'asc' },
    });
    return NextResponse.json({ items: serializeList('SidebarWidget', rows) });
  }

  // ── PUT /sidebar-widgets/bulk — replace-all in Serializable TX ────────────
  if (sub === 'bulk' && method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const checked = validateBulkItems(body.items);
    if (!checked.ok) return checked.response;

    const { rows } = checked;
    try {
      await withSerializableRetry(async (tx) => {
        // No self-FK on sidebar widgets: single deleteMany is enough.
        await tx.sidebarWidget.deleteMany({});
        if (rows.length === 0) return;
        await tx.sidebarWidget.createMany({ data: rows });
      });
    } catch (err) {
      const mapped = mapError(err);
      if (mapped.kind === 'conflict' || mapped.kind === 'duplicate') {
        return NextResponse.json(mapped.body, { status: mapped.status });
      }
      throw err;
    }

    return NextResponse.json({
      message: 'Sidebar widgets disimpan',
      count: rows.length,
    });
  }

  // ── /sidebar-widgets/:id ──────────────────────────────────────────────────
  if (sub) {
    if (method === 'PUT') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await request.json();

      // Only validate settings when the client actually sends them. A partial
      // PUT that omits settings must leave the existing JSONB untouched.
      let settingsPatch = {};
      if (Object.prototype.hasOwnProperty.call(body, 'settings')) {
        if (
          body.settings === null ||
          typeof body.settings !== 'object' ||
          Array.isArray(body.settings)
        ) {
          return NextResponse.json(
            { error: 'settings harus object' },
            { status: 400 },
          );
        }
        settingsPatch = { settings: body.settings };
      }

      const { id: _ignoreId, createdAt: _c, settings: _s, ...rest } = body;
      await prisma.sidebarWidget.updateMany({
        where: { id: sub },
        data: {
          ...rest,
          ...settingsPatch,
          updatedAt: new Date().toISOString(),
        },
      });
      const row = await prisma.sidebarWidget.findUnique({ where: { id: sub } });
      return NextResponse.json(serializeRecord('SidebarWidget', row));
    }
    if (method === 'DELETE') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await prisma.sidebarWidget.deleteMany({ where: { id: sub } });
      return NextResponse.json({ message: 'Berhasil dihapus' });
    }
  }
  return null;
}
