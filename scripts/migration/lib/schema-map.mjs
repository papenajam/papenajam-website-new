// Proposed schema map for the MongoDB -> PostgreSQL/Prisma migration.
//
// This is the reference the profiler diffs live documents against to report
// "unknown fields vs proposed schema". It is derived from:
//   - the field sets observed in tests/contract/fixtures/seed-data.js
//   - the inserts/updates written by app/api/handlers/*.js
//   - the normalized API shapes frozen by tests/contract/api-contract.test.js
//
// Field names use the exact casing the application writes (camelCase plus a
// handful of snake_case for analytics/settings). The plan preserves public
// string/UUID ids, so `id` is always a proposed field for UUID collections.
//
// Each collection entry exposes:
//   - fields: Set<string>          proposed field names (excluding `_id`)
//   - idKind: 'uuid'|'static'|'none'
//   - naturalKey: string[]|null     field(s) used for duplicate detection
//   - integerFields: Set<string>    integer/counter/size fields (overflow check)
//   - bcryptFields: Set<string>     fields validated as bcrypt-format hashes
//   - jsonBlobFields: Set<string>   fields analyzed as JSON root/type/size
//   - timestampFields: Set<string>  ISO-timestamp validity fields
//   - dateOnlyFields: Set<string>   YYYY-MM-DD fields (publishDate, jadwalSidang)
//   - ratingFields: Set<string>     numeric fields constrained to a range
//   - menuParentField: string|null  field used to build the menu graph

const COMMON_TIMESTAMP_FIELDS = ['createdAt', 'updatedAt'];

function makeEntry({
  fields,
  idKind = 'uuid',
  naturalKey = null,
  integerFields = [],
  bcryptFields = [],
  jsonBlobFields = [],
  timestampFields = [],
  dateOnlyFields = [],
  ratingFields = [],
  menuParentField = null,
} = {}) {
  const fieldSet = new Set(fields);
  for (const ts of COMMON_TIMESTAMP_FIELDS) fieldSet.add(ts);
  const timestampSet = new Set([...timestampFields, ...COMMON_TIMESTAMP_FIELDS]);
  return Object.freeze({
    fields: fieldSet,
    idKind,
    naturalKey,
    integerFields: new Set(integerFields),
    bcryptFields: new Set(bcryptFields),
    jsonBlobFields: new Set(jsonBlobFields),
    timestampFields: timestampSet,
    dateOnlyFields: new Set(dateOnlyFields),
    ratingFields: new Set(ratingFields),
    menuParentField,
  });
}

export const SCHEMA_MAP = Object.freeze({
  users: makeEntry({
    fields: ['id', 'name', 'email', 'password', 'role'],
    naturalKey: ['email'],
    bcryptFields: ['password'],
    timestampFields: [],
  }),
  news: makeEntry({
    fields: ['id', 'title', 'content', 'author', 'category', 'isPublished', 'publishDate', 'summary'],
    dateOnlyFields: ['publishDate'],
  }),
  announcements: makeEntry({
    fields: ['id', 'title', 'content', 'isActive', 'publishDate'],
    dateOnlyFields: ['publishDate'],
  }),
  services: makeEntry({
    fields: ['id', 'title', 'description', 'icon', 'order', 'isActive'],
    integerFields: ['order'],
  }),
  cases: makeEntry({
    fields: [
      'id', 'nomorPerkara', 'tahun', 'jenisPerkara', 'pemohon', 'termohon',
      'status', 'jadwalSidang', 'ruangSidang', 'hakim',
    ],
    dateOnlyFields: ['jadwalSidang'],
  }),
  pages: makeEntry({
    fields: ['id', 'title', 'slug', 'status', 'blocks'],
    naturalKey: ['slug'],
    jsonBlobFields: ['blocks'],
  }),
  agenda: makeEntry({
    fields: [
      'id', 'nomorPerkara', 'jenisPerkara', 'tanggalSidang', 'waktuSidang',
      'ruangSidang', 'hakim', 'panitera', 'status', 'keterangan',
    ],
    dateOnlyFields: ['tanggalSidang'],
  }),
  putusan: makeEntry({
    fields: [
      'id', 'nomorPerkara', 'jenisPerkara', 'tanggalPutusan', 'statusPublish',
      'ringkasan', 'fileUrl',
    ],
    dateOnlyFields: ['tanggalPutusan'],
  }),
  sidebar_widgets: makeEntry({
    fields: ['id', 'title', 'type', 'url', 'isActive', 'order'],
    integerFields: ['order'],
  }),
  gallery: makeEntry({
    fields: ['id', 'title', 'imageUrl', 'category', 'isActive', 'order'],
    integerFields: ['order'],
  }),
  documents: makeEntry({
    fields: [
      'id', 'title', 'description', 'category', 'fileUrl', 'isActive', 'downloadCount',
    ],
    integerFields: ['downloadCount'],
  }),
  faq: makeEntry({
    fields: ['id', 'question', 'answer', 'category', 'isActive', 'order'],
    integerFields: ['order'],
  }),
  banners: makeEntry({
    fields: ['id', 'title', 'imageUrl', 'isActive', 'order', 'startDate', 'endDate'],
    integerFields: ['order'],
    dateOnlyFields: ['startDate', 'endDate'],
  }),
  complaints: makeEntry({
    fields: [
      'id', 'name', 'email', 'phone', 'message', 'status', 'adminNotes',
    ],
  }),
  analytics: makeEntry({
    idKind: 'none',
    fields: ['date', 'path', 'views'],
    naturalKey: ['date', 'path'],
    integerFields: ['views'],
    dateOnlyFields: ['date'],
  }),
  survey_config: makeEntry({
    idKind: 'static',
    fields: ['id', 'isActive', 'title', 'subtitle'],
  }),
  survey_responses: makeEntry({
    fields: ['id', 'rating', 'comment'],
    ratingFields: ['rating'],
  }),
  menus: makeEntry({
    fields: ['id', 'title', 'url', 'parentId', 'isActive', 'order'],
    integerFields: ['order'],
    menuParentField: 'parentId',
  }),
  settings: makeEntry({
    idKind: 'none',
    fields: ['key', 'value'],
    naturalKey: ['key'],
    // NOTE: per plan line 33, `settings.value` STAYS as text (every consumer
    // treats it as a string, including `footer_links` which is a JSON string).
    // It is deliberately NOT listed in `jsonBlobFields` — that set is reserved
    // for fields whose column type is Prisma `Json`. The value is carried
    // through as identity (plain text) by the transform engine.
  }),
  media: makeEntry({
    fields: [
      'id', 'filename', 'originalName', 'url', 'type', 'mimeType', 'size',
      'ext', 'title', 'alt', 'uploadedBy',
    ],
    integerFields: ['size'],
  }),
});

export function getSchemaEntry(collectionName) {
  return SCHEMA_MAP[collectionName] || null;
}

export function isKnownCollection(collectionName) {
  return Object.prototype.hasOwnProperty.call(SCHEMA_MAP, collectionName);
}

export function listKnownCollections() {
  return Object.keys(SCHEMA_MAP);
}

/**
 * Compute the set of fields present in `fieldNames` that are not in the
 * proposed schema for `collectionName`. Returns a sorted array.
 *
 * If the collection is not in the schema map, returns an empty array AND a
 * flag so the report can note "schema map missing for this collection".
 */
export function findUnknownFields(collectionName, fieldNames) {
  const entry = getSchemaEntry(collectionName);
  if (!entry) {
    return { unknown: [], schemaKnown: false };
  }
  const unknown = [...fieldNames].filter((name) => !entry.fields.has(name) && name !== '_id');
  return { unknown: [...unknown].sort(), schemaKnown: true };
}
