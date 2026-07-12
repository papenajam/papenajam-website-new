// Re-export transform helpers for the migration CLIs and unit tests.

export {
  IMPORT_ORDER,
  APPLICATION_TABLES,
  PRISMA_MAP,
  getPrismaEntry,
  listImportCollections,
} from './prisma-map.mjs';

export {
  stableStringify,
  sha256Canonical,
  businessFieldHash,
  collectionBusinessHash,
} from './canonical-hash.mjs';

export {
  documentToNdjsonLine,
  parseNdjsonLine,
  parseNdjsonContent,
  createNdjsonWriter,
} from './ndjson.mjs';

export {
  findBlockersInProfile,
  loadProfileBlockers,
  hasUnresolvedBlockers,
} from './blockers.mjs';

export {
  transformForImport,
  sortMenusParentsFirst,
  chunk,
} from './document.mjs';

export {
  assertEmptyTarget,
  buildRejectEntry,
  ALL_OR_NOTHING_STRATEGY,
} from './import-guards.mjs';

export {
  normalizeRecordForCompare,
  compareCounts,
  compareIdSets,
  findDuplicates,
  compareBusinessHashes,
  sumField,
  countWhere,
  groupCount,
  averageField,
  checkMenuIntegrity,
  compareJsonFields,
  sampleDateBounds,
  pickTargetedSamples,
  sampleFileUrlExistence,
} from './verify.mjs';
