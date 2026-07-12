// Unit tests for Task 5 — Prisma v7 schema, config, and client singleton.
//
// These tests pin the structural invariants of the PostgreSQL/Prisma foundation
// WITHOUT making any network connection and WITHOUT requiring a live database.
// They assert:
//   1. prisma/schema.prisma parses and contains ALL 20 models from plan
//      section 5, with the expected field types/nullability and table maps.
//   2. The schema uses the binding conventions (Timestamptz(3), Date, Text,
//      JsonB, no @updatedAt, no enums, UUID ids).
//   3. The binding uniqueness targets exist (users.email, pages.slug,
//      analytics(date,path)) and the menu FK is ON DELETE RESTRICT.
//   4. lib/prisma.js exports a singleton getter, caches on globalThis in
//      development, and fails loud when DATABASE_URL is missing.
//   5. prisma.config.mjs loads cleanly via the v7 defineConfig loader and
//      points at the right schema + migrations path.
//
// These tests are read-only file/text assertions plus module import behavior.
// They do NOT start any container and do NOT connect to PostgreSQL.

import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
);

function readRepo(rel) {
  return readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

// ---------------------------------------------------------------------------
// Schema parsing helpers (intentionally lightweight — no Prisma DSL dep).
// ---------------------------------------------------------------------------

/**
 * Strip // line comments and /* block comments so assertions do not match
 * keywords that appear inside explanatory prose (e.g. a comment that says
 * "we do NOT use @updatedAt" must not trip the `not.toMatch(/@updatedAt/)` check).
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+\/\/.*$/gm, '');
}

function readSchema() {
  return stripComments(readRepo('prisma/schema.prisma'));
}

function readSchemaRaw() {
  return readRepo('prisma/schema.prisma');
}

/** Extract a single model block by name. Returns the raw block text. */
function extractModelBlock(schema, modelName) {
  const re = new RegExp(`model\\s+${modelName}\\s*\\{`, '');
  const match = re.exec(schema);
  if (!match) return null;
  let depth = 1;
  let i = match.index + match[0].length;
  while (i < schema.length && depth > 0) {
    if (schema[i] === '{') depth++;
    else if (schema[i] === '}') depth--;
    i++;
  }
  return schema.slice(match.index, i);
}

function hasModel(schema, modelName) {
  return new RegExp(`^model\\s+${modelName}\\s*\\{`, 'm').test(schema);
}

function hasField(block, fieldName) {
  // Match the field name at the start of a line (after optional whitespace),
  // followed by whitespace + a type. Avoids matching substrings inside
  // comments or other field names.
  return new RegExp(`^\\s+${fieldName}\\s+\\S+`, 'm').test(block);
}

// ---------------------------------------------------------------------------
// 1. Schema model matrix (plan section 5) — all 20 models with their @@map.
// ---------------------------------------------------------------------------

const EXPECTED_MODELS = [
  { model: 'User', map: 'users' },
  { model: 'News', map: 'news' },
  { model: 'Announcement', map: 'announcements' },
  { model: 'Service', map: 'services' },
  { model: 'CaseRecord', map: 'cases' },
  { model: 'Agenda', map: 'agenda' },
  { model: 'Decision', map: 'putusan' },
  { model: 'Setting', map: 'settings' },
  { model: 'Page', map: 'pages' },
  { model: 'MenuItem', map: 'menus' },
  { model: 'SidebarWidget', map: 'sidebar_widgets' },
  { model: 'GalleryItem', map: 'gallery' },
  { model: 'Document', map: 'documents' },
  { model: 'Faq', map: 'faq' },
  { model: 'Banner', map: 'banners' },
  { model: 'Complaint', map: 'complaints' },
  { model: 'AnalyticsDailyPath', map: 'analytics' },
  { model: 'SurveyConfig', map: 'survey_config' },
  { model: 'SurveyResponse', map: 'survey_responses' },
  { model: 'Media', map: 'media' },
];

describe('prisma schema: model matrix (plan section 5)', () => {
  const schema = readSchema();

  test('schema file exists and parses into at least 20 model blocks', () => {
    const modelCount = (schema.match(/^model\s+\w+\s*\{/gm) || []).length;
    expect(modelCount).toBeGreaterThanOrEqual(20);
  });

  test('all 20 expected models are present with correct @@map table names', () => {
    for (const { model, map } of EXPECTED_MODELS) {
      expect(hasModel(schema, model), `model ${model} should exist`).toBe(true);
      const block = extractModelBlock(schema, model);
      expect(block, `block for ${model}`).not.toBeNull();
      expect(
        block,
        `${model} should @@map to "${map}"`
      ).toMatch(new RegExp(`@@map\\("${map}"\\)`));
    }
  });

  test('exactly 20 models (no stray/extra models introduced)', () => {
    const modelMatches = schema.match(/^model\s+(\w+)\s*\{/gm) || [];
    expect(modelMatches.length).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// 2. Schema conventions (plan section 5.1 binding rules).
// ---------------------------------------------------------------------------

describe('prisma schema: binding conventions', () => {
  const schema = readSchema();

  test('generator uses prisma-client with esm + ts ext (file and import match)', () => {
    expect(schema).toMatch(/provider\s*=\s*"prisma-client"/);
    expect(schema).toMatch(/moduleFormat\s*=\s*"esm"/);
    expect(schema).toMatch(/generatedFileExtension\s*=\s*"ts"/);
    // importFileExtension MUST equal generatedFileExtension so the generated
    // `.ts` files import each other via `.ts` specifiers; otherwise neither
    // Turbopack nor webpack can resolve them (Next.js issue #82945).
    expect(schema).toMatch(/importFileExtension\s*=\s*"ts"/);
  });

  test('datasource is postgresql with no url in schema (v7 config-managed)', () => {
    const dsBlock = extractModelBlock(schema, 'db') || '';
    // datasource block isn't a "model"; extract manually.
    const dsMatch = schema.match(/datasource\s+db\s*\{[^}]*\}/);
    expect(dsMatch, 'datasource db block should exist').not.toBeNull();
    expect(dsMatch[0]).toMatch(/provider\s*=\s*"postgresql"/);
    // v7: URL must NOT live in schema (it lives in prisma.config.mjs).
    expect(dsMatch[0]).not.toMatch(/url\s*=\s*env/);
    expect(dsMatch[0]).not.toMatch(/directUrl/);
  });

  test('timestamps use Timestamptz(3) and updatedAt is nullable (no @updatedAt)', () => {
    // Every createdAt is a non-null Timestamptz(3); every updatedAt is a
    // nullable Timestamptz(3). The schema must NOT use @updatedAt anywhere
    // (plan line 159: handlers set updatedAt explicitly).
    expect(schema).not.toMatch(/@updatedAt/);
    const createdMatches = schema.match(/createdAt\s+DateTime\s+@db\.Timestamptz\(3\)/g) || [];
    // 17 models have createdAt: all 20 EXCEPT Setting (key-only), SurveyConfig
    // (id-only singleton), and AnalyticsDailyPath (uses `date` @db.Date).
    expect(createdMatches.length).toBe(17);
    const updatedMatches =
      schema.match(/updatedAt\s+DateTime\?\s+@db\.Timestamptz\(3\)/g) || [];
    // updatedAt is present on 17 models: the 16 with createdAt EXCEPT
    // SurveyResponse (plan line 246: insert-only, no updatedAt), PLUS
    // SurveyConfig (plan line 243: has updatedAt? despite no createdAt).
    // Setting, AnalyticsDailyPath, and SurveyResponse have no updatedAt.
    expect(updatedMatches.length).toBe(17);
  });

  test('calendar date-only fields use @db.Date (nullable unless plan says otherwise)', () => {
    // Optional date-only fields (plan section 5): publishDate, jadwalSidang,
    // tanggalPutusan, startDate, endDate — all `DateTime? @db.Date`.
    const optionalDateFields = [
      'publishDate',
      'jadwalSidang',
      'tanggalPutusan',
      'startDate',
      'endDate',
    ];
    for (const f of optionalDateFields) {
      const re = new RegExp(`${f}\\s+DateTime\\?\\s+@db\\.Date`, 'g');
      const matches = schema.match(re) || [];
      expect(matches.length, `${f} should be DateTime? @db.Date`).toBeGreaterThan(0);
    }
    // Non-nullable date-only fields (plan line 191: agenda.tanggalSidang is
    // required; analytics.date is part of the compound unique key).
    expect(schema).toMatch(/tanggalSidang\s+DateTime\s+@db\.Date/);
    expect(schema).toMatch(/date\s+DateTime\s+@db\.Date/);
  });

  test('JSON blobs use Json @db.JsonB (pages.blocks, sidebar_widgets.settings)', () => {
    const pageBlock = extractModelBlock(schema, 'Page');
    expect(pageBlock).toMatch(/blocks\s+Json\s+@db\.JsonB/);
    const swBlock = extractModelBlock(schema, 'SidebarWidget');
    expect(swBlock).toMatch(/settings\s+Json\s+@db\.JsonB/);
  });

  test('no Prisma enums (legacy MongoDB values unconstrained — plan line 164)', () => {
    expect(schema).not.toMatch(/^enum\s+\w+\s*\{/m);
  });

  test('public ids are String @id @default(uuid()) @db.Uuid', () => {
    const idMatches = schema.match(/id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/g) || [];
    // 16 models use UUID ids (Setting uses natural key, SurveyConfig uses
    // static 'main', AnalyticsDailyPath uses surrogate UUID). Count >= 16.
    expect(idMatches.length).toBeGreaterThanOrEqual(16);
  });

  test('text/HTML fields use @db.Text', () => {
    expect(schema).toMatch(/@db\.Text/);
  });
});

// ---------------------------------------------------------------------------
// 3. Binding uniqueness + FK targets.
// ---------------------------------------------------------------------------

describe('prisma schema: uniqueness and FK targets', () => {
  const schema = readSchema();

  test('User.email is @unique (target state per plan line 170)', () => {
    const block = extractModelBlock(schema, 'User');
    expect(block).toMatch(/email\s+String\s+@unique\s+@db\.Text/);
  });

  test('Page.slug is @unique (target state per plan line 204)', () => {
    const block = extractModelBlock(schema, 'Page');
    expect(block).toMatch(/slug\s+String\s+@unique\s+@db\.Text/);
  });

  test('AnalyticsDailyPath has @@unique([date, path]) (plan line 238)', () => {
    const block = extractModelBlock(schema, 'AnalyticsDailyPath');
    expect(block).toMatch(/@@unique\(\[date,\s*path\]\)/);
  });

  test('Setting.key is a natural string @id (plan line 199)', () => {
    const block = extractModelBlock(schema, 'Setting');
    expect(block).toMatch(/key\s+String\s+@id\s+@db\.Text/);
  });

  test('SurveyConfig.id is a natural string @id (plan line 243)', () => {
    const block = extractModelBlock(schema, 'SurveyConfig');
    expect(block).toMatch(/id\s+String\s+@id\s+@db\.Text/);
  });

  test('MenuItem self-relation uses onDelete: Restrict (plan line 209)', () => {
    const block = extractModelBlock(schema, 'MenuItem');
    expect(block).toMatch(/parent\s+MenuItem\?.+parentId.+references:\s*\[id\].+onDelete:\s*Restrict/);
    expect(block).toMatch(/children\s+MenuItem\[\]\s+@relation\("MenuItemParent"\)/);
    // Must NOT be Cascade (one-level deletion semantics).
    expect(block).not.toMatch(/onDelete:\s*Cascade/);
  });
});

// ---------------------------------------------------------------------------
// 4. Key per-model fields (spot-check that fields from plan section 5 exist).
// ---------------------------------------------------------------------------

describe('prisma schema: per-model field presence (spot checks)', () => {
  const schema = readSchema();

  const FIELD_CHECKS = [
    ['User', ['id', 'name', 'email', 'password', 'role', 'createdAt', 'updatedAt']],
    ['News', ['id', 'title', 'titleEn', 'content', 'contentEn', 'image', 'imageAlt', 'imageAltEn', 'author', 'category', 'isPublished', 'publishDate', 'createdAt', 'updatedAt']],
    ['Announcement', ['id', 'title', 'content', 'publishDate', 'isActive', 'createdAt', 'updatedAt']],
    ['Service', ['id', 'title', 'description', 'icon', 'order', 'isActive', 'createdAt', 'updatedAt']],
    ['CaseRecord', ['id', 'nomorPerkara', 'tahun', 'jenisPerkara', 'pemohon', 'termohon', 'status', 'jadwalSidang', 'ruangSidang', 'hakim', 'createdAt', 'updatedAt']],
    ['Agenda', ['id', 'nomorPerkara', 'jenisPerkara', 'tanggalSidang', 'waktuSidang', 'ruangSidang', 'hakim', 'panitera', 'status', 'keterangan', 'createdAt', 'updatedAt']],
    ['Decision', ['id', 'nomorPerkara', 'jenisPerkara', 'tanggalPutusan', 'ringkasanPutusan', 'filePutusan', 'hakim', 'statusPublish', 'createdAt', 'updatedAt']],
    ['Setting', ['key', 'value']],
    ['Page', ['id', 'title', 'slug', 'status', 'blocks', 'createdAt', 'updatedAt']],
    ['MenuItem', ['id', 'label', 'labelEn', 'url', 'type', 'icon', 'order', 'isActive', 'parentId', 'description', 'descriptionEn', 'target', 'createdAt', 'updatedAt']],
    ['SidebarWidget', ['id', 'type', 'label', 'labelEn', 'icon', 'color', 'isActive', 'order', 'settings', 'createdAt', 'updatedAt']],
    ['GalleryItem', ['id', 'title', 'titleEn', 'description', 'category', 'imageUrl', 'isActive', 'order', 'createdAt', 'updatedAt']],
    ['Document', ['id', 'title', 'titleEn', 'description', 'category', 'fileUrl', 'fileType', 'isActive', 'order', 'downloadCount', 'createdAt', 'updatedAt']],
    ['Faq', ['id', 'question', 'questionEn', 'answer', 'answerEn', 'category', 'isActive', 'order', 'createdAt', 'updatedAt']],
    ['Banner', ['id', 'title', 'subtitle', 'buttonText', 'buttonUrl', 'imageUrl', 'bgColor', 'textColor', 'isActive', 'order', 'startDate', 'endDate', 'createdAt', 'updatedAt']],
    ['Complaint', ['id', 'name', 'email', 'phone', 'category', 'subject', 'message', 'status', 'adminNotes', 'createdAt', 'updatedAt']],
    ['AnalyticsDailyPath', ['id', 'date', 'path', 'views']],
    ['SurveyConfig', ['id', 'isActive', 'title', 'subtitle', 'thankYouMessage', 'updatedAt']],
    ['SurveyResponse', ['id', 'rating', 'comment', 'page', 'createdAt']],
    ['Media', ['id', 'filename', 'originalName', 'url', 'type', 'mimeType', 'size', 'ext', 'title', 'alt', 'uploadedBy', 'createdAt', 'updatedAt']],
  ];

  for (const [model, fields] of FIELD_CHECKS) {
    test(`${model} has all expected fields`, () => {
      const block = extractModelBlock(schema, model);
      expect(block, `${model} block`).not.toBeNull();
      for (const f of fields) {
        expect(hasField(block, f), `${model}.${f} should be present`).toBe(true);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 5. Indexes (minimum set per plan section 5).
// ---------------------------------------------------------------------------

describe('prisma schema: minimum index coverage', () => {
  const schema = readSchema();

  const INDEX_CHECKS = [
    ['User', '@@index([createdAt(sort: Desc)])'],
    ['Announcement', '@@index([isActive, createdAt(sort: Desc)])'],
    ['Service', '@@index([order])'],
    ['CaseRecord', '@@index([tahun])'],
    ['Agenda', '@@index([tanggalSidang, waktuSidang])'],
    ['Decision', '@@index([statusPublish, createdAt(sort: Desc)])'],
    ['Page', '@@index([status, createdAt(sort: Desc)])'],
    ['MenuItem', '@@index([parentId, order])'],
    ['SidebarWidget', '@@index([isActive, order])'],
    ['GalleryItem', '@@index([isActive, category, order])'],
    ['Document', '@@index([isActive, category, createdAt(sort: Desc)])'],
    ['Faq', '@@index([isActive, category, order])'],
    ['Banner', '@@index([isActive, order])'],
    ['Complaint', '@@index([status, createdAt(sort: Desc)])'],
    ['AnalyticsDailyPath', '@@index([date(sort: Desc)])'],
    ['SurveyResponse', '@@index([createdAt(sort: Desc)])'],
    ['Media', '@@index([originalName])'],
  ];

  for (const [model, idx] of INDEX_CHECKS) {
    test(`${model} has index ${idx}`, () => {
      const block = extractModelBlock(schema, model);
      expect(block, `${model} block`).not.toBeNull();
      expect(block, `${model} should declare ${idx}`).toContain(idx);
    });
  }
});

// ---------------------------------------------------------------------------
// 6. lib/prisma.js singleton behavior.
// ---------------------------------------------------------------------------

describe('lib/prisma.js: lazy singleton getter and loud failure', () => {
  const libPrismaPath = path.join(REPO_ROOT, 'lib', 'prisma.js');
  const ORIGINAL_DB_URL = process.env.DATABASE_URL;
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  function freshImport() {
    // Dynamic import with cache-busting query so each test gets a fresh
    // module evaluation (and therefore a fresh singleton attempt).
    return import(`file://${libPrismaPath}?t=${Date.now()}-${Math.random()}`);
  }

  afterEach(() => {
    // Restore env.
    if (ORIGINAL_DB_URL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIGINAL_DB_URL;
    if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    // Clear the globalThis cache so the next test can re-evaluate.
    delete globalThis.__prismaClient;
  });

  test('exports `prisma` proxy and `getPrisma` getter returning the real client', async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@host:5432/db?schema=public';
    process.env.NODE_ENV = 'production';
    const mod = await freshImport();
    expect(mod.prisma).toBeTruthy();
    expect(typeof mod.getPrisma).toBe('function');
    // getPrisma() returns the real PrismaClient; `prisma` is a lazy Proxy.
    // Accessing a property on the proxy forces construction.
    const real = mod.getPrisma();
    expect(real).toBeTruthy();
    expect(mod.default).toBe(mod.prisma);
  });

  test('getDbUrlForDiagnostics returns the runtime URL after first access', async () => {
    const url = 'postgresql://u:p@host:5432/db?schema=public';
    process.env.DATABASE_URL = url;
    process.env.NODE_ENV = 'production';
    const mod = await freshImport();
    expect(typeof mod.getDbUrlForDiagnostics).toBe('function');
    // Lazy: URL is recorded only once the client is constructed.
    expect(mod.getDbUrlForDiagnostics()).toBeUndefined();
    mod.getPrisma(); // force construction
    expect(mod.getDbUrlForDiagnostics()).toBe(url);
  });

  test('caches the real client on globalThis in non-production (HMR safety)', async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@host:5432/db?schema=public';
    process.env.NODE_ENV = 'development';
    delete globalThis.__prismaClient;
    const mod = await freshImport();
    // Construction is lazy — force it, then assert cache holds the real client.
    const real = mod.getPrisma();
    expect(globalThis.__prismaClient).toBe(real);
  });

  test('does NOT cache on globalThis in production', async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@host:5432/db?schema=public';
    process.env.NODE_ENV = 'production';
    delete globalThis.__prismaClient;
    const mod = await freshImport();
    mod.getPrisma(); // force construction
    expect(globalThis.__prismaClient).toBeUndefined();
  });

  test('import succeeds without DATABASE_URL; access throws loud error (lazy)', async () => {
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = 'production';
    delete globalThis.__prismaClient;
    // Lazy-init: module import must NOT throw (so next build page collection works).
    const mod = await freshImport();
    expect(mod.prisma).toBeTruthy();
    // First access that constructs the client must throw.
    expect(() => mod.getPrisma()).toThrow(/DATABASE_URL/);
  });

  test('parseDatabaseUrl strips ?schema= and returns schema option', async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@host:5432/db?schema=public';
    process.env.NODE_ENV = 'production';
    const mod = await freshImport();
    expect(typeof mod.parseDatabaseUrl).toBe('function');
    const parsed = mod.parseDatabaseUrl(
      'postgresql://u:p@127.0.0.1:5432/pa_penajam_dev?schema=public'
    );
    expect(parsed.schema).toBe('public');
    expect(parsed.connectionString).not.toMatch(/schema=/);
    expect(parsed.connectionString).toMatch(/^postgresql:\/\//);
  });
});

// ---------------------------------------------------------------------------
// 7. prisma.config.mjs loads via the v7 config loader.
// ---------------------------------------------------------------------------

describe('prisma.config.mjs: v7 defineConfig wiring', () => {
  test('config file imports defineConfig and exports a config object', async () => {
    // Dynamic import of the config. The config accesses process.env.DATABASE_URL
    // with a fallback (no env() helper) so it loads cleanly even without it.
    const configPath = path.join(REPO_ROOT, 'prisma.config.mjs');
    const mod = await import(`file://${configPath}?t=${Date.now()}-${Math.random()}`);
    expect(mod.default).toBeTruthy();
    expect(mod.default.schema).toBe('prisma/schema.prisma');
    expect(mod.default.migrations).toBeTruthy();
    expect(mod.default.migrations.path).toBe('prisma/migrations');
    expect(mod.default.migrations.seed).toMatch(/prisma\/seed\.mjs/);
    expect(mod.default.datasource).toBeTruthy();
  });

  test('config text uses defineConfig (not raw export) and loads dotenv', () => {
    const src = stripComments(readRepo('prisma.config.mjs'));
    expect(src).toMatch(/import\s+\{\s*defineConfig\s*\}\s+from\s+['"]prisma\/config['"]/);
    expect(src).toMatch(/import\s+['"]dotenv\/config['"]/);
    // Must NOT use the strict env() helper that throws on missing var
    // (breaks postinstall in CI without DATABASE_URL).
    expect(src).not.toMatch(/\benv\(['"]DATABASE_URL['"]\)/);
    // Must NOT use legacy v6 directUrl pattern.
    expect(src).not.toMatch(/directUrl/);
  });
});

// ---------------------------------------------------------------------------
// 8. Migration artifact exists and is non-trivial.
// ---------------------------------------------------------------------------

describe('initial migration artifact', () => {
  test('migration.sql exists under prisma/migrations/*_init_postgresql/', () => {
    const migrationsDir = path.join(REPO_ROOT, 'prisma', 'migrations');
    expect(existsSync(migrationsDir)).toBe(true);
    const entries = readdirSync(migrationsDir);
    const initDir = entries.find((e) => /_init_postgresql$/.test(e));
    expect(initDir, 'expected <timestamp>_init_postgresql directory').toBeTruthy();
    const sql = readFileSync(
      path.join(migrationsDir, initDir, 'migration.sql'),
      'utf8'
    );
    // 20 CREATE TABLE statements (one per model).
    const tableCount = (sql.match(/CREATE TABLE /g) || []).length;
    expect(tableCount).toBe(20);
    // Menu FK uses ON DELETE RESTRICT.
    expect(sql).toMatch(/ON DELETE RESTRICT/);
    // Target unique indexes present.
    expect(sql).toMatch(/"users_email_key"/);
    expect(sql).toMatch(/"pages_slug_key"/);
    expect(sql).toMatch(/"analytics_date_path_key"/);
    // No pg_trgm / CHECK constraints in the initial migration (deferred per plan).
    expect(sql).not.toMatch(/pg_trgm/);
    expect(sql).not.toMatch(/CHECK\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// 9. package.json scripts + generated client ignore.
// ---------------------------------------------------------------------------

describe('package.json + .gitignore: Task 5 wiring', () => {
  test('package.json has the required prisma scripts', () => {
    const pkg = JSON.parse(readRepo('package.json'));
    const scripts = pkg.scripts;
    expect(scripts.postinstall).toBe('prisma generate');
    expect(scripts['prisma:generate']).toBe('prisma generate');
    expect(scripts['db:migrate:dev']).toBe('prisma migrate dev');
    expect(scripts['db:migrate:deploy']).toBe('prisma migrate deploy');
    expect(scripts['db:migrate:status']).toBe('prisma migrate status');
    expect(scripts['db:seed']).toBe('prisma db seed');
  });

  test('prisma deps pinned to 7.8.0 and pg/dotenv present', () => {
    const pkg = JSON.parse(readRepo('package.json'));
    expect(pkg.dependencies['@prisma/client']).toBe('7.8.0');
    expect(pkg.dependencies['@prisma/adapter-pg']).toBe('7.8.0');
    expect(pkg.dependencies.pg).toMatch(/^8\./);
    expect(pkg.dependencies.dotenv).toMatch(/^17\./);
    expect(pkg.devDependencies.prisma).toBe('7.8.0');
    // mongodb retained for profiler/export (plan line 331).
    expect(pkg.dependencies.mongodb).toBeTruthy();
  });

  test('.gitignore ignores the generated client directory', () => {
    const gi = readRepo('.gitignore');
    expect(gi).toMatch(/lib\/generated\/prisma/);
  });
});
