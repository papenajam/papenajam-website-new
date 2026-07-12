// Unit tests for the migration schema-map (Task 2 / Task 3 reconciliation).
//
// These tests pin schema-map decisions that the transform engine relies on.
// They exist as a separate file from anomaly.test.js / transform-rules.test.js
// so that a schema-map regression surfaces with a clear file path.
//
// Coverage includes the M2 reconciliation with plan line 33:
// `settings.value` stays TEXT (per plan), so it MUST NOT be listed in
// `jsonBlobFields` (that set is reserved for fields mapped to Prisma `Json`).

import { describe, expect, test } from 'vitest';
import { SCHEMA_MAP, getSchemaEntry, isKnownCollection, listKnownCollections } from '../../../scripts/migration/lib/schema-map.mjs';

describe('schema-map: basic shape', () => {
  test('every known collection resolves to a frozen entry', () => {
    for (const name of listKnownCollections()) {
      const entry = getSchemaEntry(name);
      expect(entry).toBeTruthy();
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });

  test('isKnownCollection matches SCHEMA_MAP keys', () => {
    for (const name of Object.keys(SCHEMA_MAP)) {
      expect(isKnownCollection(name)).toBe(true);
    }
    expect(isKnownCollection('totally-made-up')).toBe(false);
  });

  test('every collection has createdAt and updatedAt in its timestampFields', () => {
    for (const name of listKnownCollections()) {
      const entry = getSchemaEntry(name);
      expect(entry.timestampFields.has('createdAt')).toBe(true);
      expect(entry.timestampFields.has('updatedAt')).toBe(true);
      // And in the master field set (so transformFieldValue does not flag them unknown).
      expect(entry.fields.has('createdAt')).toBe(true);
      expect(entry.fields.has('updatedAt')).toBe(true);
    }
  });
});

describe('schema-map: M2 reconciliation — settings.value stays TEXT (plan line 33)', () => {
  test('settings.value is NOT in jsonBlobFields (plan: keep as text)', () => {
    // Plan line 33: "Pertahankan settings.value sebagai teks karena seluruh
    // consumer saat ini memperlakukannya sebagai string". Only pages.blocks
    // is a true JSONB column among the blob candidates; settings.value is text.
    const settings = getSchemaEntry('settings');
    expect(settings.jsonBlobFields.has('value')).toBe(false);
    expect(settings.fields.has('value')).toBe(true); // still a known field
  });

  test('pages.blocks IS in jsonBlobFields (it is the JSONB column)', () => {
    const pages = getSchemaEntry('pages');
    expect(pages.jsonBlobFields.has('blocks')).toBe(true);
  });

  test('the only jsonBlobFields across the whole map are pages.blocks', () => {
    // Document the invariant: removing settings.value leaves pages.blocks as
    // the sole JSON-blob field. If a future change adds another, this test
    // must be updated intentionally so the plan reconciliation is revisited.
    const allJsonBlobs = [];
    for (const name of listKnownCollections()) {
      for (const f of getSchemaEntry(name).jsonBlobFields) {
        allJsonBlobs.push(`${name}.${f}`);
      }
    }
    expect(allJsonBlobs.sort()).toEqual(['pages.blocks']);
  });
});
