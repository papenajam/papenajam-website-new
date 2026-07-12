// NDJSON / Extended-JSON helpers for the Mongo exporter.
// Pure + small fs wrappers used by the CLI and unit tests.

import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import { stableStringify } from './canonical-hash.mjs';

/**
 * Serialize one Mongo document to a deterministic Extended-JSON-ish line.
 * - ObjectId → `{ "$oid": "..." }`
 * - Date → `{ "$date": "ISO" }`
 * - other values via stableStringify (sorted keys)
 *
 * Lines are UTF-8; trailing newline is the caller's responsibility when writing.
 */
export function documentToNdjsonLine(doc) {
  return stableStringify(toExtendedJson(doc));
}

function toExtendedJson(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return { $date: Number.isNaN(value.getTime()) ? null : value.toISOString() };
  }
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function' && value._bsontype === 'ObjectId') {
      return { $oid: value.toHexString() };
    }
    // Defensive: mongodb driver ObjectId without _bsontype in some versions
    if (
      value.constructor &&
      value.constructor.name === 'ObjectId' &&
      typeof value.toHexString === 'function'
    ) {
      return { $oid: value.toHexString() };
    }
    if (Array.isArray(value)) {
      return value.map((v) => toExtendedJson(v));
    }
    const keys = Object.keys(value).sort();
    const out = {};
    for (const k of keys) {
      if (value[k] === undefined) continue;
      out[k] = toExtendedJson(value[k]);
    }
    return out;
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return value;
}

/**
 * Parse one NDJSON line back to a plain object. `$oid` / `$date` are restored
 * to strings / Date so the importer does not need the Mongo driver.
 */
export function parseNdjsonLine(line) {
  if (!line || !String(line).trim()) return null;
  const raw = JSON.parse(line);
  return fromExtendedJson(raw);
}

function fromExtendedJson(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map((v) => fromExtendedJson(v));
  if (typeof value === 'object') {
    if (Object.keys(value).length === 1 && Object.prototype.hasOwnProperty.call(value, '$oid')) {
      return String(value.$oid);
    }
    if (Object.keys(value).length === 1 && Object.prototype.hasOwnProperty.call(value, '$date')) {
      if (value.$date === null) return null;
      return new Date(value.$date);
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = fromExtendedJson(v);
    }
    return out;
  }
  return value;
}

/**
 * Streaming writer that also accumulates a running SHA-256 of every line
 * (including the trailing newline) so the manifest can record a byte-exact
 * content digest without re-reading the file.
 */
export function createNdjsonWriter(filePath) {
  const stream = createWriteStream(filePath, { encoding: 'utf8' });
  const hash = createHash('sha256');
  let bytes = 0;
  let lines = 0;

  return {
    write(doc) {
      const line = `${documentToNdjsonLine(doc)}\n`;
      hash.update(line, 'utf8');
      bytes += Buffer.byteLength(line, 'utf8');
      lines += 1;
      if (!stream.write(line)) {
        return new Promise((resolve, reject) => {
          stream.once('drain', resolve);
          stream.once('error', reject);
        });
      }
      return Promise.resolve();
    },
    async close() {
      stream.end();
      await finished(stream);
      return {
        lines,
        bytes,
        sha256: hash.digest('hex'),
      };
    },
  };
}

/**
 * Parse an entire NDJSON file content (string) into documents.
 */
export function parseNdjsonContent(content) {
  const docs = [];
  for (const line of String(content).split('\n')) {
    const doc = parseNdjsonLine(line);
    if (doc) docs.push(doc);
  }
  return docs;
}
