// Report assembly and rendering for the read-only MongoDB migration profiler.
//
// Pure functions only. `buildReport` takes a metadata header + an array of
// per-collection analyses and returns a single JSON-serializable object.
// `renderMarkdown` takes that same object and returns a Markdown string.
//
// Both layers redact secrets defensively (the analyzer already avoids
// embedding bcrypt hashes / passwords) by passing all sample records through
// `sanitizeRecord` before they ever reach the report builder.

import { sanitizeConnectionUri, sanitizeRecord } from './canonicalize.mjs';
import { countAnomalies } from './anomaly.mjs';

/**
 * Build the full report payload from per-collection analyses.
 *
 * Inputs:
 *   - options.mongoUriRaw   the raw MONGODB_URI (will be sanitized)
 *   - options.dbName        database name (safe to print)
 *   - options.generatedAt   ISO timestamp string
 *   - options.sampleLimit   sample size cap applied per collection
 *   - options.fullCounts    map collectionName -> total document count
 *   - options.collectionAnalyses  array of { collection, analysis, sampleRecords }
 *
 * The `sampleRecords` array is included in the report but ALWAYS passed through
 * `sanitizeRecord` first, so secret fields are redacted regardless of input.
 */
export function buildReport(options = {}) {
  const {
    mongoUriRaw = '',
    dbName = '',
    generatedAt = new Date().toISOString(),
    sampleLimit = 0,
    fullCounts = {},
    collectionAnalyses = [],
    profileVersion = '1',
  } = options;

  const header = {
    profileVersion,
    generatedAt,
    source: {
      mongoUri: sanitizeConnectionUri(mongoUriRaw),
      dbName: dbName || '<unset>',
      sampleLimitPerCollection: sampleLimit,
    },
    policy: {
      readOnly: true,
      secretFieldsRedacted: ['password'],
      noHashesPrinted: true,
    },
  };

  const collections = collectionAnalyses.map(({ collection, analysis, sampleRecords, total }) => {
    const anomalyCount = countAnomalies(analysis);
    const safeSample = (sampleRecords || []).map((record) => sanitizeRecord(record));
    return {
      collection,
      total: typeof total === 'number' ? total : analysis.sampleSize,
      sampleSize: analysis.sampleSize,
      anomalyCount,
      analysis,
      // Sample records are emitted SANITIZED. Reviewers can inspect the shape
      // of fields without ever seeing a password or bcrypt hash.
      sampleRecords: safeSample,
    };
  });

  const totals = {
    collections: collections.length,
    totalDocuments: collections.reduce((sum, c) => sum + (c.total || 0), 0),
    totalSampledRecords: collections.reduce((sum, c) => sum + c.sampleSize, 0),
    totalAnomalies: collections.reduce((sum, c) => sum + c.anomalyCount, 0),
  };

  return { header, totals, collections };
}

/**
 * Render the report payload to a Markdown summary string. Pure function.
 *
 * The summary is intentionally compact: it surfaces every anomaly dimension
 * required by the brief so a reviewer can scan one collection's row and see
 * everything at once, then expand into per-collection sections for detail.
 */
export function renderMarkdown(report) {
  const lines = [];
  const h = report.header;

  lines.push('# MongoDB Migration Profile');
  lines.push('');
  lines.push(`- Generated: ${h.generatedAt}`);
  lines.push(`- Source URI: \`${h.source.mongoUri}\``);
  lines.push(`- Database: \`${h.source.dbName}\``);
  lines.push(`- Sample limit per collection: ${h.source.sampleLimitPerCollection}`);
  lines.push(`- Read-only policy: ${h.policy.readOnly ? 'enforced' : 'NOT enforced'}`);
  lines.push(`- Secret fields redacted: ${h.policy.secretFieldsRedacted.join(', ')}`);
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push(`- Collections: **${report.totals.collections}**`);
  lines.push(`- Total documents (full count): **${report.totals.totalDocuments}**`);
  lines.push(`- Sampled records: **${report.totals.totalSampledRecords}**`);
  lines.push(`- Total anomalies flagged: **${report.totals.totalAnomalies}**`);
  lines.push('');

  lines.push('## Per-collection summary');
  lines.push('');
  lines.push('| Collection | Total | Sample | Fields | Dups/Missing ID | UUID anomalies | Unknown fields | Anomalies | Bytes (sample) |');
  lines.push('|---|---:|---:|---:|---|---|---:|---:|---:|');
  for (const c of report.collections) {
    const a = c.analysis;
    lines.push(
      `| ${c.collection} | ${c.total} | ${c.sampleSize} | ${a.fieldStats.length} ` +
      `| dup=${a.idUniqueness.duplicateCount}/missing=${a.idUniqueness.missingCount} ` +
      `| ${a.idUuidValidity ? `notUuid=${a.idUuidValidity.notUuidCount}, nonV4=${a.idUuidValidity.nonV4Count}` : 'n/a'} ` +
      `| ${a.unknownFields.unknownFields.length} ` +
      `| ${c.anomalyCount} | ${a.byteStats.totalBytes} |`,
    );
  }
  lines.push('');

  for (const c of report.collections) {
    renderCollectionSection(lines, c);
  }

  lines.push('## Sample records');
  lines.push('');
  lines.push('All sample records below are emitted with secret fields (e.g. `password`) replaced by `<redacted>`. No bcrypt hash, password, or credential is ever printed by this profiler.');
  lines.push('');
  for (const c of report.collections) {
    lines.push(`### ${c.collection}`);
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(c.sampleRecords, null, 2));
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

function renderCollectionSection(lines, c) {
  const a = c.analysis;
  lines.push(`## ${c.collection}`);
  lines.push('');
  lines.push(`- Total documents: **${c.total}**`);
  lines.push(`- Sample size: **${c.sampleSize}**`);
  lines.push(`- Schema known: ${a.schemaKnown ? 'yes' : 'NO (no entry in proposed schema map)'}`);
  lines.push(`- Anomalies flagged: **${c.anomalyCount}**`);
  lines.push(`- Estimated bytes (sample): ${a.byteStats.totalBytes} (avg ${a.byteStats.averageBytes})`);
  if (a.byteStats.largestRecords.length) {
    lines.push(`- Largest record bytes: ${a.byteStats.largestRecords[0].bytes}`);
  }
  lines.push('');

  // Field statistics
  lines.push('### Fields');
  lines.push('');
  lines.push('| Field | Freq | Types | Mixed | Null | Empty | Missing |');
  lines.push('|---|---:|---|:---:|---:|---:|---:|');
  for (const f of a.fieldStats) {
    const types = Object.entries(f.types).map(([t, n]) => `${t}×${n}`).join(', ');
    lines.push(`| ${f.name} | ${f.frequency} | ${types || '-'} | ${f.mixedTypes ? 'yes' : 'no'} | ${f.nullCount} | ${f.emptyCount} | ${f.missingCount} |`);
  }
  lines.push('');

  // ID
  lines.push('### ID');
  lines.push('');
  lines.push(`- Duplicates: ${a.idUniqueness.duplicateCount} (covering ${a.idUniqueness.duplicateValueCount} records)`);
  lines.push(`- Missing/empty: ${a.idUniqueness.missingCount}`);
  if (a.idUniqueness.duplicates.length) {
    lines.push(`- Duplicate ids: ${formatSamples(a.idUniqueness.duplicates.map((d) => `${d.id} (×${d.count})`))}`);
  }
  if (a.idUuidValidity) {
    lines.push(`- UUID v4 valid: ${a.idUuidValidity.validUuidV4} of ${a.idUuidValidity.total}`);
    lines.push(`- Non-v4 UUID: ${a.idUuidValidity.nonV4Count}${formatSamplesInline(a.idUuidValidity.samples.nonV4)}`);
    lines.push(`- Not UUID: ${a.idUuidValidity.notUuidCount}${formatSamplesInline(a.idUuidValidity.samples.notUuid)}`);
  }
  lines.push('');

  // Unknown fields
  if (!a.unknownFields.schemaKnown) {
    lines.push('### Unknown fields');
    lines.push('');
    lines.push('_Proposed schema map has no entry for this collection; unknown-field detection skipped._');
    lines.push('');
  } else if (a.unknownFields.unknownFields.length) {
    lines.push('### Unknown fields (vs proposed schema)');
    lines.push('');
    lines.push(`- Unknown field names: ${a.unknownFields.unknownFields.join(', ')}`);
    lines.push(`- Total unknown field occurrences across sample: ${a.unknownFields.perRecordUnknownCount}`);
    lines.push('');
  } else {
    lines.push('### Unknown fields');
    lines.push('');
    lines.push('_None — every observed field is in the proposed schema._');
    lines.push('');
  }

  // Timestamps
  renderTimestampSection(lines, a.timestampAnomalies);

  // Integer overflow
  if (Object.keys(a.integerOverflow || {}).length) {
    lines.push('### Integer overflow');
    lines.push('');
    let any = false;
    for (const [field, e] of Object.entries(a.integerOverflow)) {
      if (e.overflowCount > 0) {
        any = true;
        lines.push(`- \`${field}\`: ${e.overflowCount} records exceed Int32${formatSamplesInline(e.samples)}`);
      }
    }
    if (!any) lines.push('_No overflow detected._');
    lines.push('');
  }

  // Ratings
  if (Object.keys(a.ratingAnomalies || {}).length) {
    lines.push('### Ratings');
    lines.push('');
    let any = false;
    for (const [field, e] of Object.entries(a.ratingAnomalies)) {
      if (e.outOfRangeCount > 0) {
        any = true;
        lines.push(`- \`${field}\`: ${e.outOfRangeCount} of ${e.totalNonEmpty} outside 1-5${formatSamplesInline(e.samples)}`);
      }
    }
    if (!any) lines.push('_All ratings within 1-5._');
    lines.push('');
  }

  // bcrypt
  if (Object.keys(a.bcryptHashes || {}).length) {
    lines.push('### bcrypt hash format');
    lines.push('');
    for (const [field, e] of Object.entries(a.bcryptHashes)) {
      lines.push(`- \`${field}\`: present=${e.presentCount}, valid=${e.validFormatCount}, invalid=${e.invalidFormatCount}`);
    }
    lines.push('_Hash values are never printed by this profiler._');
    lines.push('');
  }

  // JSON blobs
  renderJsonBlobsSection(lines, a.jsonBlobs);

  // Per-collection natural keys
  if (a.emailDuplicates) {
    lines.push('### Email duplicates (normalized)');
    lines.push('');
    lines.push(`- Duplicate groups: ${a.emailDuplicates.duplicateCount}`);
    lines.push(`- Records in duplicate groups: ${a.emailDuplicates.duplicateValueCount}`);
    lines.push(`- Missing/empty email: ${a.emailDuplicates.missingCount}`);
    if (a.emailDuplicates.duplicates.length) {
      lines.push(`- Duplicate keys: ${formatSamples(a.emailDuplicates.duplicates.map((d) => `${d.key.join('/')} (×${d.count})`))}`);
    }
    lines.push('');
    lines.push('### Email casing anomaly');
    lines.push('');
    lines.push(`- Records with uppercase letters in email: ${a.emailCasing.anomalyCount} of ${a.emailCasing.totalNonEmpty}`);
    lines.push('_Offending emails are never printed; sample redacted._');
    lines.push('');
  }
  if (a.slugDuplicates) {
    lines.push('### Slug duplicates (pages.slug)');
    lines.push('');
    lines.push(`- Duplicate groups: ${a.slugDuplicates.duplicateCount}`);
    lines.push(`- Records in duplicate groups: ${a.slugDuplicates.duplicateValueCount}`);
    lines.push('');
  }
  if (a.keyDuplicates) {
    lines.push('### Key duplicates (settings.key)');
    lines.push('');
    lines.push(`- Duplicate groups: ${a.keyDuplicates.duplicateCount}`);
    lines.push(`- Records in duplicate groups: ${a.keyDuplicates.duplicateValueCount}`);
    lines.push('');
  }
  if (a.datePathDuplicates) {
    lines.push('### (date, path) duplicates (analytics)');
    lines.push('');
    lines.push(`- Duplicate groups: ${a.datePathDuplicates.duplicateCount}`);
    lines.push(`- Records in duplicate groups: ${a.datePathDuplicates.duplicateValueCount}`);
    lines.push('');
  }
  if (a.menuGraph) {
    const g = a.menuGraph;
    lines.push('### Menu graph (menus.parentId)');
    lines.push('');
    lines.push(`- Total nodes: ${g.total}`);
    lines.push(`- Max depth observed: ${g.maxDepthObserved} (policy max: ${g.maxMenuDepth})`);
    lines.push(`- Orphan parentId: ${g.orphanCount}`);
    lines.push(`- Self-cycles: ${g.selfCycleCount}`);
    lines.push(`- Depth > ${g.maxMenuDepth}: ${g.depthExceededCount}`);
    lines.push('');
  }
}

function renderTimestampSection(lines, ts) {
  if (!ts || !Object.keys(ts).length) return;
  lines.push('### Timestamps / dates');
  lines.push('');
  let any = false;
  for (const [field, e] of Object.entries(ts)) {
    if (e.invalidCount > 0) {
      any = true;
      lines.push(`- \`${field}\`: ${e.invalidCount} invalid${formatSamplesInline(e.samples)} (iso=${e.isoTimestampCount}, dateOnly=${e.dateOnlyCount})`);
    }
  }
  if (!any) lines.push('_All timestamp/date fields valid._');
  lines.push('');
}

function renderJsonBlobsSection(lines, blobs) {
  if (!blobs || !Object.keys(blobs).length) return;
  lines.push('### JSON blobs (blocks / value)');
  lines.push('');
  for (const [field, e] of Object.entries(blobs)) {
    const rootTypes = Object.entries(e.rootTypeCounts).map(([t, n]) => `${t}×${n}`).join(', ');
    lines.push(`- \`${field}\`: root types { ${rootTypes || '-'} }`);
    if (e.sizeBytesStats.count) {
      lines.push(`  - bytes: min=${e.sizeBytesStats.min}, max=${e.sizeBytesStats.max}, avg=${e.sizeBytesStats.avg}, sum=${e.sizeBytesStats.sum}`);
    }
    if (e.arrayItemCountStats.count) {
      lines.push(`  - array items: min=${e.arrayItemCountStats.min}, max=${e.arrayItemCountStats.max}, avg=${e.arrayItemCountStats.avg}`);
    }
    if (e.objectKeyCountStats.count) {
      lines.push(`  - object keys: min=${e.objectKeyCountStats.min}, max=${e.objectKeyCountStats.max}, avg=${e.objectKeyCountStats.avg}`);
    }
    lines.push(`  - empty: ${e.emptyCount}`);
  }
  lines.push('');
}

function formatSamples(samples) {
  if (!samples || !samples.length) return '';
  return samples.slice(0, 5).join(', ');
}

function formatSamplesInline(samples) {
  if (!samples || !samples.length) return '';
  return ` (sample: ${samples.slice(0, 5).map((s) => `\`${s}\``).join(', ')})`;
}
