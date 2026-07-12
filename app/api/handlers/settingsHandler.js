// Settings handler (settings task: MongoDB -> PostgreSQL/Prisma migration).
//
// Behaviour is byte-identical to the legacy Mongo handler:
//   - GET /settings -> 200 flat map `{ [key]: value }`
//     Every Setting row is folded into a single object; natural key is `key`
//     (`@id`). Values stay text (including `footer_links`, which is a JSON
//     *string*, not a JSON object column).
//   - PUT /settings -> 200 `{ message: 'Pengaturan berhasil disimpan' }`
//     Auth required. Body is a multi-key object; the entire submitted batch is
//     upserted inside one Prisma `$transaction` so a mid-batch failure does
//     not leave a partial write.
//
// Model: `Setting { key String @id, value String }` mapped to table `settings`.

import { NextResponse } from 'next/server';
import { prisma, getPrisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { mapError } from '@/lib/prisma-errors.js';

/**
 * Coerce a submitted setting value to Text.
 * Objects/arrays are JSON.stringified so `footer_links` remains a JSON string
 * on the wire and in the DB (matches legacy Mongo storage).
 *
 * @param {*} value
 * @returns {string}
 */
export function toSettingValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/**
 * Fold Setting rows into the legacy flat map shape.
 *
 * @param {Array<{ key: string, value: string }>} rows
 * @returns {Record<string, string>}
 */
export function foldSettings(rows) {
  const result = {};
  for (const row of rows) {
    if (row && typeof row.key === 'string') {
      result[row.key] = row.value;
    }
  }
  return result;
}

export async function handleSettings(request, _segments, method) {
  if (method === 'GET') {
    try {
      const rows = await prisma.setting.findMany();
      return NextResponse.json(foldSettings(rows));
    } catch (err) {
      const mapped = mapError(err, { behavior: 'get' });
      return NextResponse.json(mapped.body, { status: mapped.status });
    }
  }

  if (method === 'PUT') {
    const auth = requireAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Body must be an object of key/value pairs' }, { status: 400 });
    }

    const entries = Object.entries(body);
    try {
      const client = getPrisma();
      await client.$transaction(async (tx) => {
        for (const [key, value] of entries) {
          if (typeof key !== 'string' || key.length === 0) continue;
          const textValue = toSettingValue(value);
          await tx.setting.upsert({
            where: { key },
            create: { key, value: textValue },
            update: { value: textValue },
          });
        }
      });
      return NextResponse.json({ message: 'Pengaturan berhasil disimpan' });
    } catch (err) {
      const mapped = mapError(err, { behavior: 'put' });
      return NextResponse.json(mapped.body, { status: mapped.status });
    }
  }

  return null;
}
