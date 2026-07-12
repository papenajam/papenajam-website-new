// Collection → Prisma model / table mapping for the MongoDB → PostgreSQL importer.
//
// Source of truth for *column* names is prisma/schema.prisma (Task 5). The
// profiler's schema-map.mjs (Task 2) describes the *legacy Mongo* field set and
// may lag bilingual renames that landed with the Prisma schema (menus.title →
// label, putusan.ringkasan → ringkasanPutusan, etc.). This module is the bridge:
// it renames known legacy keys, lists every Prisma column the importer may
// write, and defines the ordered import sequence (parents before children).

/**
 * Import order (plan Task 16):
 *   independent reference/config → content → menu parents/children →
 *   analytics/survey/media. No cross-domain FKs other than menus.parentId.
 */
export const IMPORT_ORDER = Object.freeze([
  'settings',
  'users',
  'survey_config',
  'news',
  'announcements',
  'services',
  'cases',
  'pages',
  'agenda',
  'putusan',
  'faq',
  'banners',
  'complaints',
  'gallery',
  'documents',
  'menus', // parents then children handled inside the menus importer
  'sidebar_widgets',
  'analytics',
  'survey_responses',
  'media',
]);

/**
 * Application tables the importer/verifier touch. `_prisma_migrations` is
 * intentionally excluded — it is owned by Prisma migrate, never truncated by
 * migration tooling.
 */
export const APPLICATION_TABLES = Object.freeze([...IMPORT_ORDER]);

/**
 * Per-collection Prisma client accessor + table metadata.
 *
 * `clientKey` is the PrismaClient property name (camelCase model).
 * `table` is the @@map SQL table name.
 * `idKind` mirrors schema-map.mjs (uuid | static | none).
 * `fields` is the complete Prisma column set the importer may write.
 * `dateOnlyFields` / `timestampFields` / `integerFields` / `jsonBlobFields` /
 * `bcryptFields` drive type coercion (same rules as transform-rules.mjs).
 * `requiredDefaults` fills NOT NULL columns when the Mongo document omits them.
 * `fieldRenames` maps legacy Mongo keys → Prisma column names.
 */
export const PRISMA_MAP = Object.freeze({
  users: Object.freeze({
    clientKey: 'user',
    table: 'users',
    idKind: 'uuid',
    fields: Object.freeze(['id', 'name', 'email', 'password', 'role', 'createdAt', 'updatedAt']),
    dateOnlyFields: Object.freeze([]),
    timestampFields: Object.freeze(['createdAt', 'updatedAt']),
    integerFields: Object.freeze([]),
    jsonBlobFields: Object.freeze([]),
    bcryptFields: Object.freeze(['password']),
    naturalKey: Object.freeze(['email']),
    fieldRenames: Object.freeze({}),
    requiredDefaults: Object.freeze({}),
  }),
  news: Object.freeze({
    clientKey: 'news',
    table: 'news',
    idKind: 'uuid',
    fields: Object.freeze([
      'id', 'title', 'titleEn', 'content', 'contentEn', 'image', 'imageAlt',
      'imageAltEn', 'author', 'category', 'isPublished', 'publishDate',
      'createdAt', 'updatedAt',
    ]),
    dateOnlyFields: Object.freeze(['publishDate']),
    timestampFields: Object.freeze(['createdAt', 'updatedAt']),
    integerFields: Object.freeze([]),
    jsonBlobFields: Object.freeze([]),
    bcryptFields: Object.freeze([]),
    naturalKey: null,
    fieldRenames: Object.freeze({}),
    // `summary` was in the Task 2 schema map but is not a Prisma column —
    // dropped via dropFields after explicit policy (not silent: listed here).
    dropFields: Object.freeze(['summary']),
    requiredDefaults: Object.freeze({ isPublished: false }),
  }),
  announcements: Object.freeze({
    clientKey: 'announcement',
    table: 'announcements',
    idKind: 'uuid',
    fields: Object.freeze([
      'id', 'title', 'content', 'publishDate', 'isActive', 'createdAt', 'updatedAt',
    ]),
    dateOnlyFields: Object.freeze(['publishDate']),
    timestampFields: Object.freeze(['createdAt', 'updatedAt']),
    integerFields: Object.freeze([]),
    jsonBlobFields: Object.freeze([]),
    bcryptFields: Object.freeze([]),
    naturalKey: null,
    fieldRenames: Object.freeze({}),
    requiredDefaults: Object.freeze({ isActive: true }),
  }),
  services: Object.freeze({
    clientKey: 'service',
    table: 'services',
    idKind: 'uuid',
    fields: Object.freeze([
      'id', 'title', 'description', 'icon', 'order', 'isActive', 'createdAt', 'updatedAt',
    ]),
    dateOnlyFields: Object.freeze([]),
    timestampFields: Object.freeze(['createdAt', 'updatedAt']),
    integerFields: Object.freeze(['order']),
    jsonBlobFields: Object.freeze([]),
    bcryptFields: Object.freeze([]),
    naturalKey: null,
    fieldRenames: Object.freeze({}),
    requiredDefaults: Object.freeze({ order: 0, isActive: true }),
  }),
  cases: Object.freeze({
    clientKey: 'caseRecord',
    table: 'cases',
    idKind: 'uuid',
    fields: Object.freeze([
      'id', 'nomorPerkara', 'tahun', 'jenisPerkara', 'pemohon', 'termohon',
      'status', 'jadwalSidang', 'ruangSidang', 'hakim', 'createdAt', 'updatedAt',
    ]),
    dateOnlyFields: Object.freeze(['jadwalSidang']),
    timestampFields: Object.freeze(['createdAt', 'updatedAt']),
    integerFields: Object.freeze([]),
    jsonBlobFields: Object.freeze([]),
    bcryptFields: Object.freeze([]),
    naturalKey: null,
    fieldRenames: Object.freeze({}),
    requiredDefaults: Object.freeze({}),
  }),
  pages: Object.freeze({
    clientKey: 'page',
    table: 'pages',
    idKind: 'uuid',
    fields: Object.freeze([
      'id', 'title', 'slug', 'status', 'blocks', 'createdAt', 'updatedAt',
    ]),
    dateOnlyFields: Object.freeze([]),
    timestampFields: Object.freeze(['createdAt', 'updatedAt']),
    integerFields: Object.freeze([]),
    jsonBlobFields: Object.freeze(['blocks']),
    bcryptFields: Object.freeze([]),
    naturalKey: Object.freeze(['slug']),
    fieldRenames: Object.freeze({}),
    requiredDefaults: Object.freeze({ blocks: [], status: 'draft' }),
  }),
  agenda: Object.freeze({
    clientKey: 'agenda',
    table: 'agenda',
    idKind: 'uuid',
    fields: Object.freeze([
      'id', 'nomorPerkara', 'jenisPerkara', 'tanggalSidang', 'waktuSidang',
      'ruangSidang', 'hakim', 'panitera', 'status', 'keterangan',
      'createdAt', 'updatedAt',
    ]),
    dateOnlyFields: Object.freeze(['tanggalSidang']),
    timestampFields: Object.freeze(['createdAt', 'updatedAt']),
    integerFields: Object.freeze([]),
    jsonBlobFields: Object.freeze([]),
    bcryptFields: Object.freeze([]),
    naturalKey: null,
    fieldRenames: Object.freeze({}),
    requiredDefaults: Object.freeze({}),
  }),
  putusan: Object.freeze({
    clientKey: 'decision',
    table: 'putusan',
    idKind: 'uuid',
    fields: Object.freeze([
      'id', 'nomorPerkara', 'jenisPerkara', 'tanggalPutusan', 'ringkasanPutusan',
      'filePutusan', 'hakim', 'statusPublish', 'createdAt', 'updatedAt',
    ]),
    dateOnlyFields: Object.freeze(['tanggalPutusan']),
    timestampFields: Object.freeze(['createdAt', 'updatedAt']),
    integerFields: Object.freeze([]),
    jsonBlobFields: Object.freeze([]),
    bcryptFields: Object.freeze([]),
    naturalKey: null,
    // Legacy Mongo used ringkasan/fileUrl; Prisma uses ringkasanPutusan/filePutusan.
    fieldRenames: Object.freeze({
      ringkasan: 'ringkasanPutusan',
      fileUrl: 'filePutusan',
    }),
    requiredDefaults: Object.freeze({ statusPublish: false }),
  }),
  sidebar_widgets: Object.freeze({
    clientKey: 'sidebarWidget',
    table: 'sidebar_widgets',
    idKind: 'uuid',
    fields: Object.freeze([
      'id', 'type', 'label', 'labelEn', 'icon', 'color', 'isActive', 'order',
      'settings', 'createdAt', 'updatedAt',
    ]),
    dateOnlyFields: Object.freeze([]),
    timestampFields: Object.freeze(['createdAt', 'updatedAt']),
    integerFields: Object.freeze(['order']),
    jsonBlobFields: Object.freeze(['settings']),
    bcryptFields: Object.freeze([]),
    naturalKey: null,
    fieldRenames: Object.freeze({
      title: 'label',
      url: null, // dropped: not a Prisma column; URL lives inside settings for link widgets
    }),
    requiredDefaults: Object.freeze({
      isActive: true,
      order: 0,
      settings: {},
      type: 'link',
      label: '',
    }),
  }),
  gallery: Object.freeze({
    clientKey: 'galleryItem',
    table: 'gallery',
    idKind: 'uuid',
    fields: Object.freeze([
      'id', 'title', 'titleEn', 'description', 'category', 'imageUrl',
      'isActive', 'order', 'createdAt', 'updatedAt',
    ]),
    dateOnlyFields: Object.freeze([]),
    timestampFields: Object.freeze(['createdAt', 'updatedAt']),
    integerFields: Object.freeze(['order']),
    jsonBlobFields: Object.freeze([]),
    bcryptFields: Object.freeze([]),
    naturalKey: null,
    fieldRenames: Object.freeze({}),
    requiredDefaults: Object.freeze({ isActive: true, order: 0 }),
  }),
  documents: Object.freeze({
    clientKey: 'document',
    table: 'documents',
    idKind: 'uuid',
    fields: Object.freeze([
      'id', 'title', 'titleEn', 'description', 'category', 'fileUrl', 'fileType',
      'isActive', 'order', 'downloadCount', 'createdAt', 'updatedAt',
    ]),
    dateOnlyFields: Object.freeze([]),
    timestampFields: Object.freeze(['createdAt', 'updatedAt']),
    integerFields: Object.freeze(['order', 'downloadCount']),
    jsonBlobFields: Object.freeze([]),
    bcryptFields: Object.freeze([]),
    naturalKey: null,
    fieldRenames: Object.freeze({}),
    requiredDefaults: Object.freeze({
      isActive: true,
      order: 0,
      downloadCount: 0,
    }),
  }),
  faq: Object.freeze({
    clientKey: 'faq',
    table: 'faq',
    idKind: 'uuid',
    fields: Object.freeze([
      'id', 'question', 'questionEn', 'answer', 'answerEn', 'category',
      'isActive', 'order', 'createdAt', 'updatedAt',
    ]),
    dateOnlyFields: Object.freeze([]),
    timestampFields: Object.freeze(['createdAt', 'updatedAt']),
    integerFields: Object.freeze(['order']),
    jsonBlobFields: Object.freeze([]),
    bcryptFields: Object.freeze([]),
    naturalKey: null,
    fieldRenames: Object.freeze({}),
    requiredDefaults: Object.freeze({ isActive: true, order: 0 }),
  }),
  banners: Object.freeze({
    clientKey: 'banner',
    table: 'banners',
    idKind: 'uuid',
    fields: Object.freeze([
      'id', 'title', 'subtitle', 'buttonText', 'buttonUrl', 'imageUrl',
      'bgColor', 'textColor', 'isActive', 'order', 'startDate', 'endDate',
      'createdAt', 'updatedAt',
    ]),
    dateOnlyFields: Object.freeze(['startDate', 'endDate']),
    timestampFields: Object.freeze(['createdAt', 'updatedAt']),
    integerFields: Object.freeze(['order']),
    jsonBlobFields: Object.freeze([]),
    bcryptFields: Object.freeze([]),
    naturalKey: null,
    fieldRenames: Object.freeze({}),
    requiredDefaults: Object.freeze({ isActive: true, order: 0 }),
  }),
  complaints: Object.freeze({
    clientKey: 'complaint',
    table: 'complaints',
    idKind: 'uuid',
    fields: Object.freeze([
      'id', 'name', 'email', 'phone', 'category', 'subject', 'message',
      'status', 'adminNotes', 'createdAt', 'updatedAt',
    ]),
    dateOnlyFields: Object.freeze([]),
    timestampFields: Object.freeze(['createdAt', 'updatedAt']),
    integerFields: Object.freeze([]),
    jsonBlobFields: Object.freeze([]),
    bcryptFields: Object.freeze([]),
    naturalKey: null,
    fieldRenames: Object.freeze({}),
    requiredDefaults: Object.freeze({ status: 'baru' }),
  }),
  analytics: Object.freeze({
    clientKey: 'analyticsDailyPath',
    table: 'analytics',
    idKind: 'none', // Mongo has no id; Prisma surrogate UUID is synthesised
    fields: Object.freeze(['id', 'date', 'path', 'views']),
    dateOnlyFields: Object.freeze(['date']),
    timestampFields: Object.freeze([]),
    integerFields: Object.freeze(['views']),
    jsonBlobFields: Object.freeze([]),
    bcryptFields: Object.freeze([]),
    naturalKey: Object.freeze(['date', 'path']),
    fieldRenames: Object.freeze({}),
    requiredDefaults: Object.freeze({ views: 0 }),
    synthesizeId: true,
  }),
  survey_config: Object.freeze({
    clientKey: 'surveyConfig',
    table: 'survey_config',
    idKind: 'static',
    fields: Object.freeze([
      'id', 'isActive', 'title', 'subtitle', 'thankYouMessage', 'updatedAt',
    ]),
    dateOnlyFields: Object.freeze([]),
    timestampFields: Object.freeze(['updatedAt']),
    integerFields: Object.freeze([]),
    jsonBlobFields: Object.freeze([]),
    bcryptFields: Object.freeze([]),
    naturalKey: Object.freeze(['id']),
    fieldRenames: Object.freeze({}),
    requiredDefaults: Object.freeze({ isActive: true, id: 'main' }),
  }),
  survey_responses: Object.freeze({
    clientKey: 'surveyResponse',
    table: 'survey_responses',
    idKind: 'uuid',
    fields: Object.freeze(['id', 'rating', 'comment', 'page', 'createdAt']),
    dateOnlyFields: Object.freeze([]),
    timestampFields: Object.freeze(['createdAt']),
    integerFields: Object.freeze(['rating']),
    jsonBlobFields: Object.freeze([]),
    bcryptFields: Object.freeze([]),
    naturalKey: null,
    fieldRenames: Object.freeze({}),
    requiredDefaults: Object.freeze({}),
  }),
  menus: Object.freeze({
    clientKey: 'menuItem',
    table: 'menus',
    idKind: 'uuid',
    fields: Object.freeze([
      'id', 'label', 'labelEn', 'url', 'type', 'icon', 'order', 'isActive',
      'parentId', 'description', 'descriptionEn', 'target', 'createdAt', 'updatedAt',
    ]),
    dateOnlyFields: Object.freeze([]),
    timestampFields: Object.freeze(['createdAt', 'updatedAt']),
    integerFields: Object.freeze(['order']),
    jsonBlobFields: Object.freeze([]),
    bcryptFields: Object.freeze([]),
    naturalKey: null,
    // Legacy Mongo used `title`; Prisma uses `label`.
    fieldRenames: Object.freeze({ title: 'label' }),
    requiredDefaults: Object.freeze({ isActive: true, order: 0 }),
  }),
  settings: Object.freeze({
    clientKey: 'setting',
    table: 'settings',
    idKind: 'none',
    fields: Object.freeze(['key', 'value']),
    dateOnlyFields: Object.freeze([]),
    timestampFields: Object.freeze([]),
    integerFields: Object.freeze([]),
    jsonBlobFields: Object.freeze([]),
    bcryptFields: Object.freeze([]),
    naturalKey: Object.freeze(['key']),
    fieldRenames: Object.freeze({}),
    requiredDefaults: Object.freeze({}),
    // settings.value stays text (plan §5). Objects/arrays are JSON.stringified.
    stringifyValue: true,
  }),
  media: Object.freeze({
    clientKey: 'media',
    table: 'media',
    idKind: 'uuid',
    fields: Object.freeze([
      'id', 'filename', 'originalName', 'url', 'type', 'mimeType', 'size',
      'ext', 'title', 'alt', 'uploadedBy', 'createdAt', 'updatedAt',
    ]),
    dateOnlyFields: Object.freeze([]),
    timestampFields: Object.freeze(['createdAt', 'updatedAt']),
    integerFields: Object.freeze(['size']),
    jsonBlobFields: Object.freeze([]),
    bcryptFields: Object.freeze([]),
    naturalKey: null,
    fieldRenames: Object.freeze({}),
    requiredDefaults: Object.freeze({ size: 0 }),
  }),
});

export function getPrismaEntry(collection) {
  return PRISMA_MAP[collection] || null;
}

export function listImportCollections() {
  return [...IMPORT_ORDER];
}
