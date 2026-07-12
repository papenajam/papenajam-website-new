// Profiler-blocker detection for the Mongo exporter.
//
// The exporter refuses to run when a prior profile report still lists
// unresolved *blocking* anomalies. Blockers are the anomaly categories that
// the transform engine cannot deterministically resolve without owner sign-off
// (see docs/database-migration.md §4–§6 and PENDING_RULES).

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Map profile analysis dimensions → PENDING anomaly ids.
 * The profiler (anomaly.mjs) stores findings under nested objects; we translate
 * those into the PENDING_RULES vocabulary so the cutover gate is one checklist.
 */
const ANALYSIS_BLOCKER_CHECKS = Object.freeze([
  {
    anomaly: 'duplicate-id',
    pick: (a) => a.idUniqueness?.duplicateCount || 0,
  },
  {
    anomaly: 'missing-id',
    pick: (a) => a.idUniqueness?.missingCount || 0,
  },
  {
    anomaly: 'id-uuid-vs-text',
    pick: (a) =>
      (a.idUuidValidity?.notUuidCount || 0) + (a.idUuidValidity?.nonV4Count || 0),
  },
  {
    anomaly: 'unknown-field',
    pick: (a) => a.unknownFields?.perRecordUnknownCount || 0,
  },
  {
    anomaly: 'duplicate-natural-key',
    pick: (a) =>
      (a.emailDuplicates?.duplicateCount || 0) +
      (a.slugDuplicates?.duplicateCount || 0) +
      (a.keyDuplicates?.duplicateCount || 0) +
      (a.datePathDuplicates?.duplicateCount || 0),
  },
  {
    anomaly: 'email-casing-anomaly',
    pick: (a) => a.emailCasing?.anomalyCount || 0,
  },
  {
    anomaly: 'invalid-bcrypt-hash',
    pick: (a) => {
      let n = 0;
      for (const info of Object.values(a.bcryptHashes || {})) {
        n += info.invalidCount || 0;
      }
      return n;
    },
  },
  {
    anomaly: 'rating-out-of-range',
    pick: (a) => {
      let n = 0;
      for (const info of Object.values(a.ratingAnomalies || {})) {
        n += info.outOfRangeCount || info.invalidCount || 0;
      }
      return n;
    },
  },
  {
    anomaly: 'integer-overflow',
    pick: (a) => {
      let n = 0;
      for (const info of Object.values(a.integerOverflow || {})) {
        n += info.overflowCount || info.count || 0;
      }
      return n;
    },
  },
  {
    anomaly: 'menu-graph-anomaly',
    pick: (a) =>
      (a.menuGraph?.orphanCount || 0) +
      (a.menuGraph?.selfCycleCount || 0) +
      (a.menuGraph?.depthExceededCount || 0),
  },
  {
    // Mixed-type fields: any fieldStats entry with mixedTypes=true
    anomaly: 'mixed-type-field',
    pick: (a) => {
      let n = 0;
      for (const info of Object.values(a.fieldStats || {})) {
        if (info && info.mixedTypes) n += 1;
      }
      return n;
    },
  },
]);

/**
 * Inspect a profile report object (JSON written by profile-mongodb.mjs) and
 * return blocking findings. Empty array ⇒ safe to export.
 */
export function findBlockersInProfile(report) {
  if (!report || typeof report !== 'object') {
    return [
      {
        kind: 'missing-profile',
        message: 'No profile report provided; cannot prove blockers are resolved.',
      },
    ];
  }

  const findings = [];
  const collections = report.collections || [];

  for (const col of collections) {
    const analysis = col.analysis || {};
    for (const check of ANALYSIS_BLOCKER_CHECKS) {
      const count = check.pick(analysis);
      if (count > 0) {
        findings.push({
          kind: 'blocking-anomaly',
          collection: col.collection,
          anomaly: check.anomaly,
          count,
          message: `${col.collection}: ${check.anomaly} count=${count} is unresolved`,
        });
      }
    }
  }

  if (Array.isArray(report.blockers)) {
    for (const b of report.blockers) {
      if (b && b.resolved !== true) {
        findings.push({
          kind: 'explicit-blocker',
          collection: b.collection || null,
          anomaly: b.anomaly || b.kind || 'unknown',
          count: b.count || 1,
          message: b.message || String(b.anomaly || b.kind),
        });
      }
    }
  }

  if (report.gate && report.gate.blockersUnresolved === true) {
    findings.push({
      kind: 'gate-flag',
      message: 'profile.gate.blockersUnresolved === true',
    });
  }

  return findings;
}

/**
 * Load a profile.json from disk and return blockers.
 *
 * @param {string|null} profilePath
 * @param {{ required?: boolean }} [options]
 */
export async function loadProfileBlockers(profilePath, { required = true } = {}) {
  if (!profilePath) {
    if (required) {
      return [
        {
          kind: 'missing-profile',
          message:
            'Exporter requires a profile report (--profile=<path-to-profile.json>) ' +
            'proving blockers are resolved. Re-run the profiler and pass a clean report, ' +
            'or pass --allow-unprofiled only for local dry-runs (NOT for cutover).',
        },
      ];
    }
    return [];
  }
  const resolved = path.resolve(profilePath);
  if (!existsSync(resolved)) {
    return [
      {
        kind: 'missing-profile',
        message: `Profile report not found: ${resolved}`,
      },
    ];
  }
  const raw = await readFile(resolved, 'utf8');
  let report;
  try {
    report = JSON.parse(raw);
  } catch (err) {
    return [
      {
        kind: 'invalid-profile',
        message: `Profile report is not valid JSON: ${err.message}`,
      },
    ];
  }
  return findBlockersInProfile(report);
}

export function hasUnresolvedBlockers(findings) {
  return Array.isArray(findings) && findings.length > 0;
}
