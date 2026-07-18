// Pagination and allowlisted sorting helpers for PostgreSQL/Prisma queries.
//
// They normalize invalid page/limit input before it reaches Prisma and keep
// pagination envelopes consistent across API resources.

/**
 * Default `limit` per collection, mirroring the established API contracts
 * (inspected from app/api/handlers/*.js). Any new collection added by a
 * handler task MUST be registered here, otherwise `parsePagination` throws
 * (fail-loud: prevents silently falling back to a wrong default).
 */
const DEFAULT_LIMITS = Object.freeze({
  news: 10,
  announcements: 10,
  services: 10,
  cases: 10,
  agenda: 20,
  putusan: 10,
  gallery: 50,
  faq: 10,
  documents: 20,
  banners: 10,
  complaints: 20,
  media: 30,
  survey_responses: 20,
  pages: 10,
  sidebar_widgets: 10,
  menus: 10,
  leaders: 50,
  achievements: 50,
});

const DEFAULT_PAGE = 1;

/**
 * Parse the `page` and `limit` query-string params for a paginated endpoint.
 *
 * Behaviour (matches legacy handlers for valid input, stabilises NaN):
 *   - `page` missing / unparseable -> `DEFAULT_PAGE` (1)
 *   - `page` parseable -> the parsed integer, CLAMPED to >= 1 so a request
 *     like `?page=0` or `?page=-2` does not produce a negative Prisma `skip`
 *     (the established API behaviour for `skip(-N)` was undefined; clamping to 1
 *     is safe and matches the documented default-page semantic).
 *   - `limit` missing / unparseable -> the registered default for `collection`
 *   - `limit` parseable -> the parsed integer, CLAMPED to >= 1 (Prisma
 *     requires `take >= 0`; we use `>= 1` because `take=0` returns nothing
 *     and was never useful in the legacy handlers).
 *
 * @param {URLSearchParams|URL} searchParamsOrUrl - the request's query params
 * @param {string} collection - collection/model name (must be registered in
 *   `DEFAULT_LIMITS`; throws otherwise so omissions are caught at handler time)
 * @returns {{page: number, limit: number, skip: number, take: number}}
 *   Prisma-ready values: `skip = (page - 1) * limit`, `take = limit`.
 */
export function parsePagination(searchParamsOrUrl, collection) {
  const defaultLimit = DEFAULT_LIMITS[collection];
  if (defaultLimit === undefined) {
    throw new Error(
      `parsePagination: no default limit registered for collection "${collection}". ` +
        'Add it to DEFAULT_LIMITS in lib/api/query.js before wiring this endpoint.',
    );
  }

  const params =
    searchParamsOrUrl instanceof URL
      ? searchParamsOrUrl.searchParams
      : searchParamsOrUrl;

  const rawPage = params.get('page');
  const rawLimit = params.get('limit');

  // parseInt(s, 10) returns NaN for empty/non-numeric; NaN falls back to
  // defaults, matching `parseInt(x || 'default')` from the API handlers.
  const parsedPage = parseInt(rawPage, 10);
  const parsedLimit = parseInt(rawLimit, 10);

  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? DEFAULT_PAGE : parsedPage;
  const limit =
    Number.isNaN(parsedLimit) || parsedLimit < 1 ? defaultLimit : parsedLimit;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * Helper to compute the standard `{ items, total, page, totalPages }`
 * envelope that MOST paginated handlers emit. A few handlers omit `page`
 * (e.g. `complaints`) or add extra fields (`documents` adds `categories`,
 * `surveys` adds `averageRating`) — those handlers assemble their own
 * envelope; this helper covers the common case.
 *
 * @param {Array} items
 * @param {number} total
 * @param {number} page
 * @param {number} limit
 */
export function paginationEnvelope(items, total, page, limit) {
  return {
    items,
    total,
    page,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}

// ---------------------------------------------------------------------------
// Media sort allowlist (security tightening, plan lines 132 & 287)
// ---------------------------------------------------------------------------

/**
 * Allowlist of fields the media list endpoint will accept for `sortField`.
 * Mirrors the values the UI sends today (plan line 132). ANY other value is
 * rejected so a malicious client cannot probe arbitrary Prisma columns by
 * passing e.g. `?sortField=user.password`.
 */
export const MEDIA_SORT_FIELDS = Object.freeze(['createdAt', 'originalName', 'size']);

/**
 * Default sort for the media list when no/invalid `sortField` is supplied.
 * Matches the legacy `mediaHandler.js` default (`sortField || 'createdAt'`).
 */
export const DEFAULT_MEDIA_SORT = 'createdAt';

/**
 * Resolve a `sortField` / `sortDir` pair from the media list request to a
 * Prisma-ready `{ field, direction }`.
 *
 *   - `field` is CLAMPED to the allowlist. Unknown / missing / empty ->
 *     `createdAt` (the legacy default). We do NOT throw because the legacy
 *     handler silently fell back to `createdAt`; throwing would be a behavior
 *     change. The security improvement is that arbitrary user input never
 *     reaches Prisma: it is normalised to a known-safe value.
 *   - `direction` is `'asc'` if the request literally sent `sortDir=asc`
 *     (case-insensitive), otherwise `'desc'`. Matches the legacy
 *     `sortDir === 'asc' ? 1 : -1` rule.
 *
 * The handler builds Prisma `orderBy: { [field]: direction }` from the
 * returned values.
 *
 * @param {string} [sortField]
 * @param {string} [sortDir]
 * @returns {{field: string, direction: 'asc'|'desc'}}
 */
export function mediaOrderBy(sortField, sortDir) {
  const allow = new Set(MEDIA_SORT_FIELDS);
  const field =
    typeof sortField === 'string' && allow.has(sortField)
      ? sortField
      : DEFAULT_MEDIA_SORT;
  const direction =
    typeof sortDir === 'string' && sortDir.toLowerCase() === 'asc'
      ? 'asc'
      : 'desc';
  return { field, direction };
}

/**
 * Read the media sort params straight off a `URLSearchParams` / `URL`. Thin
 * convenience wrapper around `mediaOrderBy` so handlers do not have to repeat
 * the `searchParams.get('sortField')` dance.
 *
 * @param {URLSearchParams|URL} searchParamsOrUrl
 * @returns {{field: string, direction: 'asc'|'desc'}}
 */
export function mediaOrderByFromQuery(searchParamsOrUrl) {
  const params =
    searchParamsOrUrl instanceof URL
      ? searchParamsOrUrl.searchParams
      : searchParamsOrUrl;
  return mediaOrderBy(params.get('sortField'), params.get('sortDir'));
}

export { DEFAULT_LIMITS };
