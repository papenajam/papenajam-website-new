// Catalog of collections profiled by the read-only MongoDB profiler.
//
// The list mirrors the contract test inventory (COLLECTION_NAMES in
// tests/contract/api-contract.test.js) so the profiled set always matches the
// application's known data domains. Order is stable so report output is
// deterministic.

import { SCHEMA_MAP, listKnownCollections } from './lib/schema-map.mjs';

// Order is curated to keep related domains together in the report.
export const COLLECTION_ORDER = Object.freeze([
  'users',
  'news',
  'announcements',
  'services',
  'cases',
  'pages',
  'agenda',
  'putusan',
  'sidebar_widgets',
  'gallery',
  'documents',
  'faq',
  'banners',
  'complaints',
  'analytics',
  'survey_config',
  'survey_responses',
  'menus',
  'settings',
  'media',
]);

/**
 * Resolve the list of collections to profile.
 *
 * Accepts an optional filter list (CLI flag `--only=news,users`). Unknown
 * filter values are rejected with a helpful error so reviewers cannot
 * accidentally profile a typo collection.
 */
export function resolveCollections({ only } = {}) {
  if (!only || !only.trim()) {
    return [...COLLECTION_ORDER];
  }
  const requested = only.split(',').map((s) => s.trim()).filter(Boolean);
  const known = new Set(listKnownCollections());
  const unknown = requested.filter((name) => !known.has(name));
  if (unknown.length) {
    throw new Error(
      `Unknown collection(s) requested: ${unknown.join(', ')}. Known: ${[...known].join(', ')}`,
    );
  }
  // Preserve curated order.
  return COLLECTION_ORDER.filter((name) => requested.includes(name));
}

export { SCHEMA_MAP };
