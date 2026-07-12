import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { rm } from 'node:fs/promises';
import path from 'node:path';

import baseline from './fixtures/mongodb-baseline.json';
import { createSeedData, IDS } from './fixtures/seed-data.js';
import { startTestServer } from '../helpers/test-server.js';
import {
  CONTRACT_DB_PREFIX,
  DESTRUCTIVE_OPT_IN_ENV,
  generateContractDatabaseName,
  validateContractDatabaseSafety,
} from '../helpers/mongodb-safety.js';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DESTRUCTIVE_OPT_IN = process.env[DESTRUCTIVE_OPT_IN_ENV] || '';
const SKIP_REASON = `requires MONGODB_URI plus ${DESTRUCTIVE_OPT_IN_ENV}=true for a disposable MongoDB test instance`;
const COLLECTION_NAMES = [
  'users', 'news', 'announcements', 'services', 'cases', 'pages', 'agenda', 'putusan',
  'sidebar_widgets', 'gallery', 'documents', 'faq', 'banners', 'complaints', 'analytics',
  'survey_config', 'survey_responses', 'menus', 'settings', 'media'
];
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_FRAGMENT = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
const SEEDED = Object.freeze({
  newsNewest: { id: IDS.newsNewest, title: 'Contract News Newest', content: '<p>Contract searchable alpha content</p>', author: 'Admin', category: 'Kegiatan', isPublished: true, publishDate: '2024-02-02', createdAt: '2024-02-02T10:00:00.000Z', updatedAt: '2024-02-02T10:00:00.000Z' },
  newsOlder: { id: IDS.newsOlder, title: 'Contract News Older', content: '<p>Older content</p>', author: 'Admin', category: 'Kegiatan', isPublished: false, publishDate: '', createdAt: '2024-01-01T10:00:00.000Z', updatedAt: '2024-01-01T10:00:00.000Z' },
  announcementActive: { id: IDS.announcementActive, title: 'Contract Announcement Active', content: 'Contract searchable announcement', isActive: true, publishDate: '2024-02-01', createdAt: '2024-02-01T09:00:00.000Z', updatedAt: '2024-02-01T09:00:00.000Z' },
  announcementInactive: { id: IDS.announcementInactive, title: 'Contract Announcement Inactive', content: 'Hidden', isActive: false, publishDate: '', createdAt: '2024-01-01T09:00:00.000Z', updatedAt: '2024-01-01T09:00:00.000Z' },
  serviceFirst: { id: IDS.serviceFirst, title: 'First Service', description: 'First', icon: 'Calendar', order: 1, isActive: true, createdAt: '2024-01-01T00:00:00.000Z' },
  serviceSecond: { id: IDS.serviceSecond, title: 'Second Service', description: 'Second', icon: 'FileText', order: 2, isActive: true, createdAt: '2024-01-02T00:00:00.000Z' },
  caseNewest: { id: IDS.caseNewest, nomorPerkara: '0002/Pdt.G/2024/PA.Pnj', tahun: '2024', jenisPerkara: 'Cerai Gugat', pemohon: 'Siti Contract', termohon: 'Budi Contract', status: 'berjalan', jadwalSidang: '2024-03-01', ruangSidang: 'Ruang I', hakim: 'Hakim A', createdAt: '2024-02-02T00:00:00.000Z' },
  caseOlder: { id: IDS.caseOlder, nomorPerkara: '0001/Pdt.G/2024/PA.Pnj', tahun: '2024', jenisPerkara: 'Itsbat Nikah', pemohon: 'Rina', termohon: '-', status: 'selesai', jadwalSidang: '', ruangSidang: 'Ruang II', hakim: 'Hakim B', createdAt: '2024-01-01T00:00:00.000Z' },
  pagePublished: { id: IDS.pagePublished, title: 'Published Contract Page', slug: 'contract-published', status: 'published', blocks: [], createdAt: '2024-02-01T00:00:00.000Z', updatedAt: '2024-02-01T00:00:00.000Z' },
  pageDraft: { id: IDS.pageDraft, title: 'Draft Contract Page', slug: 'contract-draft', status: 'draft', blocks: [{ id: 'hero-contract', type: 'hero', settings: { title: 'Draft' } }], createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
  agendaEarly: { id: IDS.agendaEarly, nomorPerkara: '0001/Pdt.G/2024/PA.Pnj', jenisPerkara: 'Itsbat Nikah', tanggalSidang: '2024-03-01', waktuSidang: '08:30', ruangSidang: 'Ruang I', hakim: 'Hakim A', panitera: 'Panitera', status: 'selesai', keterangan: '', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
  agendaLate: { id: IDS.agendaLate, nomorPerkara: '0002/Pdt.G/2024/PA.Pnj', jenisPerkara: 'Cerai Gugat', tanggalSidang: '2024-03-02', waktuSidang: '09:00', ruangSidang: 'Ruang II', hakim: 'Hakim B', panitera: 'Panitera', status: 'dijadwalkan', keterangan: '', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
  agendaCancelled: { id: IDS.agendaCancelled, nomorPerkara: '0003/Pdt.G/2024/PA.Pnj', jenisPerkara: 'Waris', tanggalSidang: '2024-03-03', waktuSidang: '10:00', ruangSidang: 'Ruang I', hakim: 'Hakim A', panitera: 'Panitera', status: 'dibatalkan', keterangan: 'Dibatalkan', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
  putusanPublished: { id: IDS.putusanPublished, nomorPerkara: '0002/Pdt.G/2024/PA.Pnj', jenisPerkara: 'Cerai Gugat', tanggalPutusan: '2024-02-02', statusPublish: true, ringkasan: 'Published', fileUrl: '/uploads/pdfs/published.pdf', createdAt: '2024-02-02T00:00:00.000Z', updatedAt: '2024-02-02T00:00:00.000Z' },
  putusanDraft: { id: IDS.putusanDraft, nomorPerkara: '0001/Pdt.G/2024/PA.Pnj', jenisPerkara: 'Waris', tanggalPutusan: '', statusPublish: false, ringkasan: '', fileUrl: '', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
  sidebar: { id: IDS.sidebar, title: 'Sidebar Contract', type: 'link', isActive: true, order: 1, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
  gallery: { id: IDS.gallery, title: 'Gallery Contract', imageUrl: '/gallery.jpg', category: 'Kegiatan', isActive: true, order: 1, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
  documentNewest: { id: IDS.documentNewest, title: 'Contract Document Newest', description: 'Contract searchable document', category: 'Laporan', fileUrl: '/documents/newest.pdf', isActive: true, downloadCount: 0, createdAt: '2024-02-02T00:00:00.000Z', updatedAt: '2024-02-02T00:00:00.000Z' },
  documentOlder: { id: IDS.documentOlder, title: 'Contract Document Older', description: '', category: 'Laporan', fileUrl: '/documents/older.pdf', isActive: true, downloadCount: 3, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
  faq: { id: IDS.faq, question: 'Contract searchable question?', answer: '<p>Contract answer</p>', category: 'Umum', isActive: true, order: 1, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
  bannerNullEnd: { id: IDS.bannerNullEnd, title: 'Null End Date', imageUrl: '/banner-null.jpg', isActive: true, order: 1, startDate: '2024-01-01', endDate: null, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
  bannerEmptyEnd: { id: IDS.bannerEmptyEnd, title: 'Empty End Date', imageUrl: '/banner-empty.jpg', isActive: true, order: 2, startDate: '2024-01-01', endDate: '', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
  menuParent: { id: IDS.menuParent, title: 'Contract Menu', url: '/', parentId: null, isActive: true, order: 1, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
  menuChild: { id: IDS.menuChild, title: 'Contract Child', url: '/child', parentId: IDS.menuParent, isActive: true, order: 2, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
  mediaNewest: { id: IDS.mediaNewest, filename: 'newest.png', originalName: 'newest.png', url: '/uploads/images/newest.png', type: 'image', mimeType: 'image/png', size: 100, ext: 'png', title: 'Newest', alt: '', uploadedBy: 'Contract Admin', createdAt: '2024-02-02T00:00:00.000Z', updatedAt: '2024-02-02T00:00:00.000Z' },
  mediaOlder: { id: IDS.mediaOlder, filename: 'older.pdf', originalName: 'older.pdf', url: '/uploads/pdfs/older.pdf', type: 'pdf', mimeType: 'application/pdf', size: 200, ext: 'pdf', title: 'Older', alt: null, uploadedBy: 'Contract Admin', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
});

function normalizeNondeterministic(value, { normalizeGenerated = false } = {}) {
  if (Array.isArray(value)) {
    return value.map(item => normalizeNondeterministic(item, { normalizeGenerated }));
  }
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).flatMap(([key, child]) => {
    if (key === '_id') return [];
    if (normalizeGenerated && key === 'token') return [[key, '<jwt>']];
    if (normalizeGenerated && ['iat', 'exp'].includes(key) && typeof child === 'number') {
      return [[key, '<jwt-timestamp>']];
    }
    if (normalizeGenerated && ['createdAt', 'updatedAt'].includes(key) && ISO_TIMESTAMP.test(child)) {
      return [[key, '<timestamp>']];
    }
    if (normalizeGenerated && key === 'id' && typeof child === 'string' && UUID.test(child)) {
      return [[key, '<uuid>']];
    }
    if (normalizeGenerated && key === 'fileName' && typeof child === 'string') {
      return [[key, child.replace(UUID_FRAGMENT, '<uuid>')]];
    }
    if (normalizeGenerated && key === 'url' && typeof child === 'string') {
      return [[key, child.replace(UUID_FRAGMENT, '<uuid>')]];
    }
    return [[key, normalizeNondeterministic(child, { normalizeGenerated })]];
  }));
}

async function readJson(response, expectedStatus = 200) {
  expect(response.status).toBe(expectedStatus);
  expect(response.headers.get('content-type')).toContain(baseline.stableExpectations.jsonContentType);
  return response.json();
}

function expectKeys(value, keys) {
  expect(Object.keys(value).sort()).toEqual([...keys].sort());
}

function expectStableEqual(value, expected) {
  expect(normalizeNondeterministic(value, { normalizeGenerated: true })).toEqual(expected);
}

function expectExact(value, expected) {
  expectKeys(value, Object.keys(expected));
  expect(value).toEqual(expected);
}

function expectExactItems(value, expectedItems, extra = {}) {
  expectExact(value, { items: expectedItems, ...extra });
}

function expectPaginated(value, expectedPage, expectedTotal, expectedIds) {
  expectKeys(value, baseline.stableExpectations.paginationKeys);
  expect(value.page).toBe(expectedPage);
  expect(value.total).toBe(expectedTotal);
  expect(value.totalPages).toBe(Math.ceil(expectedTotal / expectedIds.length));
  expect(value.items.map(item => item.id)).toEqual(expectedIds);
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function api(baseUrl, route, init) {
  return fetch(`${baseUrl}/api${route}`, init);
}

async function login(baseUrl) {
  const response = await api(baseUrl, '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'CONTRACT-ADMIN@EXAMPLE.TEST', password: 'ContractPassword!1' })
  });
  return readJson(response);
}

async function resetDatabase(db, seedData, dbName) {
  validateContractDatabaseSafety({ dbName, destructiveOptIn: DESTRUCTIVE_OPT_IN });
  await Promise.all(COLLECTION_NAMES.map(name => db.collection(name).deleteMany({})));
  await Promise.all(Object.entries(seedData).map(([name, documents]) => (
    documents.length ? db.collection(name).insertMany(documents) : Promise.resolve()
  )));
}

describe('MongoDB contract database safety', () => {
  test('accepts only a strict generated contract database name with explicit destructive opt-in', () => {
    const dbName = generateContractDatabaseName({ pid: 1234, now: 1720785600000, random: 'a1b2c3d4' });
    expect(dbName).toBe(`${CONTRACT_DB_PREFIX}1234_1720785600000_a1b2c3d4`);
    expect(validateContractDatabaseSafety({
      dbName,
      destructiveOptIn: 'true',
    })).toBe(dbName);
  });

  test.each([
    ['', 'true'],
    ['pa_penajam', 'true'],
    ['pa_penajam_contract', 'true'],
    [`${CONTRACT_DB_PREFIX}1234_1720785600000_bad-hyphen`, 'true'],
    [`${CONTRACT_DB_PREFIX}1234_1720785600000_a1b2c3d4`, ''],
    [`${CONTRACT_DB_PREFIX}1234_1720785600000_a1b2c3d4`, 'yes'],
  ])('rejects unsafe database name %j with opt-in %j', (dbName, destructiveOptIn) => {
    expect(() => validateContractDatabaseSafety({ dbName, destructiveOptIn })).toThrow(/refusing destructive MongoDB contract test/i);
  });
});

describe('contract fixture and normalization policy', () => {
  test('documents every routed domain and only approved nondeterministic fields', () => {
    expect(baseline.inventory).toHaveLength(25);
    expect(baseline.inventory.map(domain => domain.route)).toEqual(expect.arrayContaining([
      'auth', 'stats', 'upload', 'media', 'news', 'announcements', 'services', 'cases', 'users',
      'settings', 'pages', 'agenda', 'putusan', 'sidebar-widgets', 'gallery', 'documents', 'faq',
      'banners', 'complaints', 'analytics', 'surveys', 'search', 'menus', 'seed', 'catch-all',
    ]));
    expect(baseline.inventory.find(domain => domain.route === 'seed')).toEqual({
      route: 'seed',
      operational: true,
      excluded: true,
      reason: 'Public operational seed route is intentionally never invoked; fixtures are inserted directly into the validated disposable database.',
      requests: [],
    });
    expect(baseline.inventory.flatMap(group => group.requests)).toEqual(expect.arrayContaining([
      'POST /api/auth/login valid',
      'GET /api/news?public=true&page=1&limit=2',
      'GET /api/pages',
      'GET /api/pages/slug/:draft (public/authenticated)',
      'GET /api/documents/download/:id',
      'GET /api/surveys/config',
      'POST+PUT+DELETE successful authenticated CRUD for every mutable handler domain',
      'GET /api/stats (public/authenticated)',
      'POST /api/upload (unauthenticated/authenticated)',
      'GET /api/not-a-route',
      'OPTIONS /api/news'
    ]));
    expect(baseline.normalization).toEqual({
      ignoredKeys: ['_id'],
      uuidKeys: ['id', 'fileName', 'url'],
      timestampKeys: ['createdAt', 'updatedAt'],
      jwtKeys: ['token', 'iat', 'exp']
    });
  });

  test('normalizes Mongo _id and generated UUID/timestamp/JWT values but preserves stable fields', () => {
    expect(normalizeNondeterministic({
      _id: 'mongo-only',
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      title: 'stable',
      createdAt: '2026-07-12T12:34:56.789Z',
      token: 'header.payload.signature',
      fileName: 'ffffffff-ffff-4fff-8fff-ffffffffffff.png',
      url: '/uploads/images/ffffffff-ffff-4fff-8fff-ffffffffffff.png'
    }, { normalizeGenerated: true })).toEqual({
      id: '<uuid>',
      title: 'stable',
      createdAt: '<timestamp>',
      token: '<jwt>',
      fileName: '<uuid>.png',
      url: '/uploads/images/<uuid>.png'
    });
  });
});

if (!MONGODB_URI) {
  test.skip(`MongoDB HTTP contract ${SKIP_REASON}`, () => {});
}

describe.skipIf(!MONGODB_URI)(`MongoDB HTTP contract (${SKIP_REASON})`, () => {
  let mongoClient;
  let db;
  let server;
  let baseUrl;
  let seedData;
  let dbName;

  beforeAll(async () => {
    dbName = validateContractDatabaseSafety({
      dbName: process.env.MONGODB_DB_NAME || generateContractDatabaseName(),
      destructiveOptIn: DESTRUCTIVE_OPT_IN,
    });
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db(dbName);
    seedData = createSeedData(await bcrypt.hash('ContractPassword!1', 4));
    server = await startTestServer({
      mongoUri: MONGODB_URI,
      dbName,
      destructiveOptIn: DESTRUCTIVE_OPT_IN,
      stdio: 'inherit',
    });
    baseUrl = server.baseUrl;
  }, 150_000);

  beforeEach(async () => {
    await resetDatabase(db, seedData, dbName);
  });

  afterAll(async () => {
    if (db) {
      validateContractDatabaseSafety({ dbName, destructiveOptIn: DESTRUCTIVE_OPT_IN });
      await db.dropDatabase();
    }
    if (server) await server.stop();
    if (mongoClient) await mongoClient.close();
  });

  test('freezes authentication, authorization, catch-all errors, and CORS', async () => {
    const invalidLogin = await readJson(await api(baseUrl, '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'contract-admin@example.test', password: 'wrong' })
    }), 401);
    expect(invalidLogin).toEqual({ error: 'Email atau password salah' });

    const unauthenticatedVerify = await readJson(await api(baseUrl, '/auth/verify'), 401);
    expect(unauthenticatedVerify).toEqual(baseline.stableExpectations.unauthorized.body);

    const session = await login(baseUrl);
    const normalizedSession = normalizeNondeterministic(session, { normalizeGenerated: true });
    expect(normalizedSession.token).toBe('<jwt>');
    expect(session.token.split('.')).toHaveLength(3);
    expect(normalizedSession.user).toEqual({
      id: '<uuid>',
      name: 'Contract Admin',
      email: 'contract-admin@example.test',
      role: 'superadmin'
    });

    const verified = await readJson(await api(baseUrl, '/auth/verify', { headers: authHeaders(session.token) }));
    expect(normalizeNondeterministic(verified, { normalizeGenerated: true })).toEqual({
      user: {
        id: '<uuid>',
        email: 'contract-admin@example.test',
        name: 'Contract Admin',
        role: 'superadmin',
        iat: '<jwt-timestamp>',
        exp: '<jwt-timestamp>'
      }
    });

    const notFound = await readJson(await api(baseUrl, '/not-a-route'), 404);
    expect(notFound).toEqual(baseline.stableExpectations.notFoundRoute.body);

    const options = await api(baseUrl, '/news', { method: 'OPTIONS' });
    expect(options.status).toBe(baseline.stableExpectations.cors.status);
    for (const [header, expected] of Object.entries(baseline.stableExpectations.cors).filter(([key]) => key !== 'status')) {
      expect(options.headers.get(header)).toBe(expected);
    }
  });

  test('freezes paginated public collections, filters, date formats, null/empty values, and sort order', async () => {
    const news = normalizeNondeterministic(await readJson(await api(baseUrl, '/news?page=1&limit=2')));
    expectExact(news, { items: [SEEDED.newsNewest, SEEDED.newsOlder], total: 2, page: 1, totalPages: 1 });
    expect(news.items[0].createdAt).toMatch(ISO_TIMESTAMP);
    expect(news.items[0].publishDate).toMatch(DATE_ONLY);

    const publicNews = normalizeNondeterministic(await readJson(await api(baseUrl, '/news?public=true&page=1&limit=2')));
    expectExact(publicNews, { items: [SEEDED.newsNewest], total: 1, page: 1, totalPages: 1 });

    const announcements = normalizeNondeterministic(await readJson(await api(baseUrl, '/announcements?public=true')));
    expectExact(announcements, { items: [SEEDED.announcementActive], total: 1, page: 1, totalPages: 1 });

    const allAnnouncements = normalizeNondeterministic(await readJson(await api(baseUrl, '/announcements?page=1&limit=2')));
    expectExact(allAnnouncements, { items: [SEEDED.announcementActive, SEEDED.announcementInactive], total: 2, page: 1, totalPages: 1 });

    const cases = normalizeNondeterministic(await readJson(await api(baseUrl, '/cases?page=1&limit=2')));
    expectExact(cases, { items: [SEEDED.caseNewest, SEEDED.caseOlder], total: 2, page: 1, totalPages: 1 });
    const partyFilter = normalizeNondeterministic(await readJson(await api(baseUrl, '/cases?namaPihak=siti')));
    expectExact(partyFilter, { items: [SEEDED.caseNewest], total: 1, page: 1, totalPages: 1 });

    const agenda = normalizeNondeterministic(await readJson(await api(baseUrl, '/agenda?public=true&page=1&limit=2')));
    expectExact(agenda, { items: [SEEDED.agendaEarly, SEEDED.agendaLate], total: 2, page: 1, totalPages: 1 });
    expect(agenda.items.every(item => DATE_ONLY.test(item.tanggalSidang))).toBe(true);
    const agendaRange = normalizeNondeterministic(await readJson(await api(baseUrl, '/agenda?dateFrom=2024-03-02&dateTo=2024-03-03')));
    expectExact(agendaRange, { items: [SEEDED.agendaLate, SEEDED.agendaCancelled], total: 2, page: 1, totalPages: 1 });

    const putusan = normalizeNondeterministic(await readJson(await api(baseUrl, '/putusan?public=true&page=1&limit=2')));
    expectExact(putusan, { items: [SEEDED.putusanPublished], total: 1, page: 1, totalPages: 1 });

    const documents = normalizeNondeterministic(await readJson(await api(baseUrl, '/documents?page=1&limit=2')));
    expectExact(documents, { items: [SEEDED.documentNewest, SEEDED.documentOlder], total: 2, categories: ['Laporan'], totalPages: 1 });

    const banners = normalizeNondeterministic(await readJson(await api(baseUrl, '/banners')));
    expectExactItems(banners, [SEEDED.bannerNullEnd, SEEDED.bannerEmptyEnd]);
  });

  test('freezes item lookup, ordered public lists, nested menus, settings, and search shapes', async () => {
    const itemRoutes = [
      ['/news', SEEDED.newsNewest],
      ['/announcements', SEEDED.announcementActive],
      ['/services', SEEDED.serviceFirst],
      ['/cases', SEEDED.caseNewest],
      ['/agenda', SEEDED.agendaEarly],
      ['/putusan', SEEDED.putusanPublished],
      ['/documents', SEEDED.documentNewest]
    ];
    for (const [route, expected] of itemRoutes) {
      const body = normalizeNondeterministic(await readJson(await api(baseUrl, `${route}/${expected.id}`)));
      expectExact(body, expected);
    }

    const pages = normalizeNondeterministic(await readJson(await api(baseUrl, '/pages')));
    expectExactItems(pages, [SEEDED.pagePublished, SEEDED.pageDraft]);

    const pageDetail = normalizeNondeterministic(await readJson(await api(baseUrl, `/pages/${IDS.pagePublished}`)));
    expectExact(pageDetail, SEEDED.pagePublished);

    const services = normalizeNondeterministic(await readJson(await api(baseUrl, '/services')));
    expectExactItems(services, [SEEDED.serviceFirst, SEEDED.serviceSecond]);
    const sidebar = normalizeNondeterministic(await readJson(await api(baseUrl, '/sidebar-widgets')));
    expectExactItems(sidebar, [SEEDED.sidebar]);
    const gallery = normalizeNondeterministic(await readJson(await api(baseUrl, '/gallery')));
    expectExact(gallery, { items: [SEEDED.gallery], categories: ['Kegiatan'] });
    const faq = normalizeNondeterministic(await readJson(await api(baseUrl, '/faq')));
    expectExact(faq, { items: [SEEDED.faq], categories: ['Umum'] });

    const menus = normalizeNondeterministic(await readJson(await api(baseUrl, '/menus')));
    expectExactItems(menus, [{ ...SEEDED.menuParent, children: [SEEDED.menuChild] }]);

    const surveyConfig = normalizeNondeterministic(await readJson(await api(baseUrl, '/surveys/config')));
    expect(surveyConfig).toEqual({ id: 'main', isActive: true, title: 'Contract Survey', subtitle: '' });

    const download = await readJson(await api(baseUrl, `/documents/download/${IDS.documentOlder}`));
    expect(download).toEqual({ fileUrl: '/documents/older.pdf', title: 'Contract Document Older' });
    const downloadedDocument = normalizeNondeterministic(await readJson(await api(baseUrl, `/documents/${IDS.documentOlder}`)));
    expectExact(downloadedDocument, { ...SEEDED.documentOlder, downloadCount: 4 });

    const settings = normalizeNondeterministic(await readJson(await api(baseUrl, '/settings')));
    expect(settings).toEqual({
      court_name: 'Pengadilan Agama Contract',
      empty_value: '',
      nullable_value: null
    });

    const search = normalizeNondeterministic(await readJson(await api(baseUrl, '/search?q=contract')));
    expectExact(search, {
      results: [
        { id: IDS.newsNewest, type: 'news', title: 'Contract News Newest', excerpt: 'Contract searchable alpha content', url: `/berita/${IDS.newsNewest}` },
        { id: IDS.announcementActive, type: 'announcement', title: 'Contract Announcement Active', excerpt: 'Contract searchable announcement', url: '/#pengumuman' },
        { id: IDS.documentNewest, type: 'document', title: 'Contract Document Newest', excerpt: 'Contract searchable document', url: '/dokumen' },
        { id: IDS.faq, type: 'faq', title: 'Contract searchable question?', excerpt: 'Contract answer', url: '/faq' },
        { id: IDS.pagePublished, type: 'page', title: 'Published Contract Page', excerpt: '', url: '/p/contract-published' }
      ],
      total: 5
    });
    expect(await readJson(await api(baseUrl, '/search?q=x'))).toEqual({ results: [] });
  });

  test('freezes public versus authenticated variants for protected reads and page slugs', async () => {
    const session = await login(baseUrl);
    const headers = authHeaders(session.token);
    const protectedRoutes = ['/users', '/sidebar-widgets/all', '/gallery/all', '/faq/all', '/banners/all', '/menus/all', '/complaints', '/surveys', '/stats'];

    for (const route of protectedRoutes) {
      const publicBody = await readJson(await api(baseUrl, route), 401);
      expect(publicBody).toEqual(baseline.stableExpectations.unauthorized.body);
    }

    const users = normalizeNondeterministic(await readJson(await api(baseUrl, '/users', { headers })));
    expectExactItems(users, [{
      id: IDS.admin,
      name: 'Contract Admin',
      email: 'contract-admin@example.test',
      role: 'superadmin',
      createdAt: '2024-01-01T00:00:00.000Z'
    }]);

    const sidebarAll = normalizeNondeterministic(await readJson(await api(baseUrl, '/sidebar-widgets/all', { headers })));
    expectExactItems(sidebarAll, [SEEDED.sidebar]);

    const galleryAll = normalizeNondeterministic(await readJson(await api(baseUrl, '/gallery/all', { headers })));
    expectExactItems(galleryAll, [SEEDED.gallery]);

    const faqAll = normalizeNondeterministic(await readJson(await api(baseUrl, '/faq/all', { headers })));
    expectExactItems(faqAll, [SEEDED.faq]);

    const bannersAll = normalizeNondeterministic(await readJson(await api(baseUrl, '/banners/all', { headers })));
    expectExactItems(bannersAll, [SEEDED.bannerNullEnd, SEEDED.bannerEmptyEnd]);

    const menusAll = normalizeNondeterministic(await readJson(await api(baseUrl, '/menus/all', { headers })));
    expectExactItems(menusAll, [SEEDED.menuParent, SEEDED.menuChild]);

    const complaints = normalizeNondeterministic(await readJson(await api(baseUrl, '/complaints', { headers })));
    expectExact(complaints, {
      items: [{ id: IDS.complaint, name: 'Contract User', email: '', phone: null, message: 'Existing complaint', status: 'baru', adminNotes: '', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' }],
      total: 1,
      totalPages: 1
    });

    const surveys = normalizeNondeterministic(await readJson(await api(baseUrl, '/surveys', { headers })));
    expectExact(surveys, {
      items: [{ id: IDS.survey, rating: 4, comment: '', createdAt: '2024-01-01T00:00:00.000Z' }],
      total: 1,
      totalPages: 1,
      averageRating: 4,
      totalResponses: 1
    });

    const stats = normalizeNondeterministic(await readJson(await api(baseUrl, '/stats', { headers })));
    expectKeys(stats, [
      'totalNews', 'totalAnnouncements', 'totalServices', 'totalCases', 'totalUsers',
      'totalAgenda', 'totalPutusan', 'totalPages',
      'casesThisYear', 'casesThisMonth', 'casesDone', 'casesOngoing', 'todayAgenda',
      'monthlyData', 'caseTypes'
    ]);
    expect(stats).toEqual({
      totalNews: 2,
      totalAnnouncements: 2,
      totalServices: 2,
      totalCases: 2,
      totalUsers: 1,
      totalAgenda: 3,
      totalPutusan: 2,
      totalPages: 2,
      casesThisYear: 0,
      casesThisMonth: 0,
      casesDone: 1,
      casesOngoing: 1,
      todayAgenda: 0,
      monthlyData: stats.monthlyData,
      caseTypes: stats.caseTypes
    });
    expect(stats.monthlyData).toHaveLength(6);
    for (const item of stats.monthlyData) expectKeys(item, ['month', 'count']);
    expect(stats.monthlyData.every(item => item.count === 0)).toBe(true);
    expect([...stats.caseTypes].sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: 'Cerai Gugat', value: 1 },
      { name: 'Itsbat Nikah', value: 1 }
    ]);

    const publicAnalytics = await readJson(await api(baseUrl, '/analytics?days=5000'));
    expectExact(publicAnalytics, { total: 5, days: 5000 });
    const authenticatedAnalytics = normalizeNondeterministic(await readJson(await api(baseUrl, '/analytics?days=5000', { headers })));
    expectExact(authenticatedAnalytics, {
      total: 5,
      dailyData: [{ date: '2024-01-01', views: 2 }, { date: '2024-01-02', views: 3 }],
      topPages: [{ path: '/faq', views: 3 }, { path: '/', views: 2 }],
      days: 5000
    });

    const published = normalizeNondeterministic(await readJson(await api(baseUrl, '/pages/slug/contract-published')));
    expectExact(published, SEEDED.pagePublished);
    expect(await readJson(await api(baseUrl, '/pages/slug/contract-draft'), 404)).toEqual({ error: 'Halaman tidak ditemukan' });
    const authenticatedDraft = normalizeNondeterministic(await readJson(await api(baseUrl, '/pages/slug/contract-draft', { headers })));
    expectExact(authenticatedDraft, SEEDED.pageDraft);

    const mediaList = normalizeNondeterministic(await readJson(await api(baseUrl, '/media?page=1&limit=2')));
    expectExact(mediaList, { items: [SEEDED.mediaNewest, SEEDED.mediaOlder], total: 2, page: 1, totalPages: 1 });
    expect(await readJson(await api(baseUrl, `/media/${IDS.mediaNewest}`), 401)).toEqual(baseline.stableExpectations.unauthorized.body);
    const mediaItem = normalizeNondeterministic(await readJson(await api(baseUrl, `/media/${IDS.mediaNewest}`, { headers })));
    expectExact(mediaItem, SEEDED.mediaNewest);
  });

  test('freezes validation and unauthenticated mutation behavior for every write domain', async () => {
    const protectedWrites = [
      ['/news', 'POST'], ['/announcements', 'POST'], ['/services', 'POST'], ['/cases', 'POST'],
      ['/users', 'POST'], ['/settings', 'PUT'], ['/pages', 'POST'], ['/agenda', 'POST'],
      ['/putusan', 'POST'], ['/sidebar-widgets', 'POST'], ['/gallery', 'POST'], ['/documents', 'POST'],
      ['/faq', 'POST'], ['/banners', 'POST'], ['/menus', 'POST'], ['/upload', 'POST']
    ];
    for (const [route, method] of protectedWrites) {
      const body = await readJson(await api(baseUrl, route, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' || method === 'PUT' ? JSON.stringify({}) : undefined
      }), 401);
      expect(body).toEqual(baseline.stableExpectations.unauthorized.body);
    }

    const protectedMutationsById = [
      '/news', '/announcements', '/services', '/cases', '/pages', '/agenda', '/putusan',
      '/sidebar-widgets', '/gallery', '/documents', '/faq', '/banners', '/menus'
    ];
    for (const route of protectedMutationsById) {
      const id = '00000000-0000-4000-8000-000000000000';
      for (const method of ['PUT', 'DELETE']) {
        const body = await readJson(await api(baseUrl, `${route}/${id}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }), 401);
        expect(body).toEqual(baseline.stableExpectations.unauthorized.body);
      }
    }

    for (const idRoute of ['/users', '/complaints', '/media']) {
      for (const method of ['PUT', 'DELETE']) {
        const body = await readJson(await api(baseUrl, `${idRoute}/00000000-0000-4000-8000-000000000000`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }), 401);
        expect(body).toEqual(baseline.stableExpectations.unauthorized.body);
      }
    }

    expect(await readJson(await api(baseUrl, '/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', message: '' })
    }), 400)).toEqual({ error: 'Nama dan pesan wajib diisi' });

    expect(await readJson(await api(baseUrl, '/sidebar-widgets/bulk', {
      method: 'PUT',
      headers: authHeaders((await login(baseUrl)).token),
      body: JSON.stringify({ items: 'not-an-array' })
    }), 400)).toEqual({ error: 'items harus array' });

    for (const bulkRoute of ['/sidebar-widgets/bulk', '/menus/bulk']) {
      const body = await readJson(await api(baseUrl, bulkRoute, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [] })
      }), 401);
      expect(body).toEqual(baseline.stableExpectations.unauthorized.body);
    }
  });

  test('freezes representative authenticated CRUD responses and approved normalization', async () => {
    const session = await login(baseUrl);
    const headers = { ...authHeaders(session.token), 'Content-Type': 'application/json' };
    const created = await readJson(await api(baseUrl, '/news', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Generated Contract News',
        content: 'Generated body',
        author: 'Contract Admin',
        category: 'Test',
        isPublished: false,
        publishDate: ''
      })
    }), 201);
    expect(normalizeNondeterministic(created, { normalizeGenerated: true })).toEqual({
      id: '<uuid>',
      title: 'Generated Contract News',
      content: 'Generated body',
      author: 'Contract Admin',
      category: 'Test',
      isPublished: false,
      publishDate: '',
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>'
    });
    expectKeys(created, ['id', 'title', 'content', 'author', 'category', 'isPublished', 'publishDate', 'createdAt', 'updatedAt']);

    const updated = normalizeNondeterministic(await readJson(await api(baseUrl, `/news/${created.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ title: 'Updated Contract News', summary: null })
    })), { normalizeGenerated: true });
    expectExact(updated, {
      id: '<uuid>',
      title: 'Updated Contract News',
      content: 'Generated body',
      author: 'Contract Admin',
      category: 'Test',
      isPublished: false,
      publishDate: '',
      summary: null,
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>'
    });

    expect(await readJson(await api(baseUrl, `/news/${created.id}`, { method: 'DELETE', headers }))).toEqual({ message: 'Berhasil dihapus' });
    expect(await readJson(await api(baseUrl, `/news/${created.id}`), 404)).toEqual({ error: 'Tidak ditemukan' });

    expect(await readJson(await api(baseUrl, '/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/contract-track' })
    }))).toEqual({ ok: true });
    expect(await readJson(await api(baseUrl, '/surveys/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 5, comment: '' })
    }))).toEqual({ message: 'Terima kasih atas masukan Anda!' });
    const complaint = await readJson(await api(baseUrl, '/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Contract User', email: '', phone: null, message: 'Please help' })
    }), 201);
    expect(normalizeNondeterministic(complaint, { normalizeGenerated: true })).toEqual({
      message: 'Pengaduan berhasil dikirim',
      id: '<uuid>'
    });

  });

  test('freezes successful authenticated CRUD and handler subroutes for every mutable domain', async () => {
    const session = await login(baseUrl);
    const headers = { ...authHeaders(session.token), 'Content-Type': 'application/json' };
    const domains = [
      { route: '/announcements', create: { title: 'Created Announcement', content: 'Body', isActive: true, publishDate: '' }, update: { title: 'Updated Announcement' }, expectedCreate: { title: 'Created Announcement', content: 'Body', isActive: true, publishDate: '' } },
      { route: '/services', create: { title: 'Created Service', description: 'Body', icon: 'FileText', order: 9, isActive: true }, update: { title: 'Updated Service' }, expectedCreate: { title: 'Created Service', description: 'Body', icon: 'FileText', order: 9, isActive: true } },
      { route: '/cases', create: { nomorPerkara: '0099/Pdt.G/2024/PA.Pnj', tahun: '2024', jenisPerkara: 'Test', pemohon: 'A', termohon: 'B', status: 'berjalan' }, update: { status: 'selesai' }, expectedCreate: { nomorPerkara: '0099/Pdt.G/2024/PA.Pnj', tahun: '2024', jenisPerkara: 'Test', pemohon: 'A', termohon: 'B', status: 'berjalan' } },
      { route: '/pages', create: { title: 'Created Page', slug: 'created-contract-page' }, update: { title: 'Updated Page' }, expectedCreate: { title: 'Created Page', slug: 'created-contract-page', blocks: [], status: 'draft' } },
      { route: '/agenda', create: { nomorPerkara: '0099/Pdt.G/2024/PA.Pnj', jenisPerkara: 'Test', tanggalSidang: '2024-04-01', waktuSidang: '08:00', ruangSidang: 'Ruang I', hakim: 'Hakim A', panitera: 'Panitera', status: 'dijadwalkan', keterangan: '' }, update: { status: 'selesai' }, expectedCreate: { nomorPerkara: '0099/Pdt.G/2024/PA.Pnj', jenisPerkara: 'Test', tanggalSidang: '2024-04-01', waktuSidang: '08:00', ruangSidang: 'Ruang I', hakim: 'Hakim A', panitera: 'Panitera', status: 'dijadwalkan', keterangan: '' } },
      { route: '/putusan', create: { nomorPerkara: '0099/Pdt.G/2024/PA.Pnj', jenisPerkara: 'Test', tanggalPutusan: '', statusPublish: false, ringkasan: '', fileUrl: '' }, update: { statusPublish: true }, expectedCreate: { nomorPerkara: '0099/Pdt.G/2024/PA.Pnj', jenisPerkara: 'Test', tanggalPutusan: '', statusPublish: false, ringkasan: '', fileUrl: '' } },
      { route: '/sidebar-widgets', create: { title: 'Created Widget', type: 'link' }, update: { title: 'Updated Widget' }, expectedCreate: { title: 'Created Widget', type: 'link', isActive: true, order: 0 } },
      { route: '/gallery', create: { title: 'Created Gallery', imageUrl: '/created.jpg', category: 'Test' }, update: { title: 'Updated Gallery' }, expectedCreate: { title: 'Created Gallery', imageUrl: '/created.jpg', category: 'Test', isActive: true, order: 0 } },
      { route: '/documents', create: { title: 'Created Document', description: '', category: 'Test', fileUrl: '/created.pdf' }, update: { title: 'Updated Document' }, expectedCreate: { title: 'Created Document', description: '', category: 'Test', fileUrl: '/created.pdf', isActive: true, downloadCount: 0 } },
      { route: '/faq', create: { question: 'Created question?', answer: 'Created answer', category: 'Test' }, update: { answer: 'Updated answer' }, expectedCreate: { question: 'Created question?', answer: 'Created answer', category: 'Test', isActive: true, order: 0 } },
      { route: '/banners', create: { title: 'Created Banner', imageUrl: '/created-banner.jpg', startDate: '2024-01-01', endDate: null }, update: { title: 'Updated Banner' }, expectedCreate: { title: 'Created Banner', imageUrl: '/created-banner.jpg', startDate: '2024-01-01', endDate: null, isActive: true, order: 0 } },
      { route: '/menus', create: { title: 'Created Menu', url: '/created', parentId: null }, update: { title: 'Updated Menu' }, expectedCreate: { title: 'Created Menu', url: '/created', parentId: null, isActive: true, order: 0 } },
    ];

    for (const domain of domains) {
      const created = await readJson(await api(baseUrl, domain.route, {
        method: 'POST', headers, body: JSON.stringify(domain.create),
      }), 201);
      expect(created.id).toMatch(UUID);
      expectStableEqual(created, { id: '<uuid>', ...domain.expectedCreate, createdAt: '<timestamp>', updatedAt: '<timestamp>' });
      expectKeys(created, ['id', ...Object.keys(domain.expectedCreate), 'createdAt', 'updatedAt']);

      const updated = normalizeNondeterministic(await readJson(await api(baseUrl, `${domain.route}/${created.id}`, {
        method: 'PUT', headers, body: JSON.stringify(domain.update),
      })), { normalizeGenerated: true });
      expectExact(updated, {
        id: '<uuid>',
        ...domain.expectedCreate,
        ...domain.update,
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>'
      });

      expect(await readJson(await api(baseUrl, `${domain.route}/${created.id}`, {
        method: 'DELETE', headers,
      }))).toEqual(baseline.stableExpectations.deleteBody);
      expect(await db.collection(domain.route.slice(1).replace('-', '_')).countDocuments({ id: created.id })).toBe(0);
    }

    const createdUser = await readJson(await api(baseUrl, '/users', {
      method: 'POST', headers, body: JSON.stringify({ name: 'Created User', email: 'CREATED@EXAMPLE.TEST', password: 'Secret!123', role: 'admin' }),
    }), 201);
    expectKeys(createdUser, ['id', 'name', 'email', 'role', 'createdAt']);
    expectStableEqual(createdUser, { id: '<uuid>', name: 'Created User', email: 'created@example.test', role: 'admin', createdAt: '<timestamp>' });
    expect(createdUser).not.toHaveProperty('password');
    const updatedUser = await readJson(await api(baseUrl, `/users/${createdUser.id}`, {
      method: 'PUT', headers, body: JSON.stringify({ name: 'Updated User', email: 'updated@example.test', role: 'editor' }),
    }));
    expectKeys(updatedUser, ['id', 'name', 'email', 'role', 'createdAt', 'updatedAt']);
    expect(updatedUser.updatedAt).toMatch(ISO_TIMESTAMP);
    expect(normalizeNondeterministic(updatedUser, { normalizeGenerated: true })).toEqual({ id: '<uuid>', name: 'Updated User', email: 'updated@example.test', role: 'editor', createdAt: '<timestamp>', updatedAt: '<timestamp>' });
    expect(updatedUser).not.toHaveProperty('password');
    expect(await readJson(await api(baseUrl, `/users/${createdUser.id}`, { method: 'DELETE', headers }))).toEqual(baseline.stableExpectations.deleteBody);
    expect(await db.collection('users').countDocuments({ id: createdUser.id })).toBe(0);

    expect(await readJson(await api(baseUrl, '/settings', {
      method: 'PUT', headers, body: JSON.stringify({ contract_setting: 'saved', nullable_setting: null }),
    }))).toEqual({ message: 'Pengaturan berhasil disimpan' });
    expect(await readJson(await api(baseUrl, '/settings'))).toEqual({ court_name: 'Pengadilan Agama Contract', empty_value: '', nullable_value: null, contract_setting: 'saved', nullable_setting: null });

    const complaint = await readJson(await api(baseUrl, '/complaints', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'CRUD Complaint', message: 'Created complaint' }),
    }), 201);
    const complaintDetail = await readJson(await api(baseUrl, `/complaints/${complaint.id}`, { headers }));
    expectKeys(complaintDetail, ['id', 'name', 'email', 'phone', 'message', 'status', 'adminNotes', 'createdAt', 'updatedAt']);
    expectStableEqual(complaintDetail, { id: complaint.id, name: 'CRUD Complaint', email: '', phone: null, message: 'Created complaint', status: 'baru', adminNotes: '', createdAt: '<timestamp>', updatedAt: '<timestamp>' });
    const updatedComplaint = await readJson(await api(baseUrl, `/complaints/${complaint.id}`, {
      method: 'PUT', headers, body: JSON.stringify({ status: 'selesai', adminNotes: 'Handled' }),
    }));
    expectKeys(updatedComplaint, ['id', 'name', 'email', 'phone', 'message', 'status', 'adminNotes', 'createdAt', 'updatedAt']);
    expect(updatedComplaint.updatedAt).toMatch(ISO_TIMESTAMP);
    expectStableEqual(updatedComplaint, { id: '<uuid>', name: 'CRUD Complaint', email: '', phone: null, message: 'Created complaint', status: 'selesai', adminNotes: 'Handled', createdAt: '<timestamp>', updatedAt: '<timestamp>' });
    expect(await readJson(await api(baseUrl, `/complaints/${complaint.id}`, { method: 'DELETE', headers }))).toEqual(baseline.stableExpectations.deleteBody);

    expect(await readJson(await api(baseUrl, '/surveys/config', {
      method: 'PUT', headers, body: JSON.stringify({ isActive: false, title: 'Updated Survey', subtitle: null }),
    }))).toEqual({ message: 'Konfigurasi survei disimpan' });
    expect(await readJson(await api(baseUrl, '/surveys/config'))).toEqual({ id: 'main', isActive: false, title: 'Updated Survey', subtitle: null });

    const bulkWidget = { id: '91000000-0000-4000-8000-000000000001', title: 'Bulk Widget', type: 'link', isActive: true, order: 1, createdAt: '2024-01-01T00:00:00.000Z' };
    expect(await readJson(await api(baseUrl, '/sidebar-widgets/bulk', {
      method: 'PUT', headers, body: JSON.stringify({ items: [bulkWidget] }),
    }))).toEqual({ message: 'Sidebar widgets disimpan', count: 1 });
    const bulkWidgetStored = normalizeNondeterministic(await readJson(await api(baseUrl, '/sidebar-widgets/all', { headers })));
    expectExactItems(bulkWidgetStored, [{ ...bulkWidget, updatedAt: '<timestamp>' }]);

    const bulkMenu = { id: 'f1000000-0000-4000-8000-000000000001', title: 'Bulk Menu', url: '/bulk', parentId: null, isActive: true, order: 1, createdAt: '2024-01-01T00:00:00.000Z' };
    expect(await readJson(await api(baseUrl, '/menus/bulk', {
      method: 'PUT', headers, body: JSON.stringify({ items: [bulkMenu] }),
    }))).toEqual({ message: 'Menu berhasil disimpan', count: 1 });
    const bulkMenuStored = normalizeNondeterministic(await readJson(await api(baseUrl, '/menus/all', { headers })));
    expectExactItems(bulkMenuStored, [{ ...bulkMenu, updatedAt: '<timestamp>' }]);
  });

  test('freezes authenticated upload response and media integration', async () => {
    const session = await login(baseUrl);
    const form = new FormData();
    form.set('file', new File([new Uint8Array([137, 80, 78, 71])], 'contract.png', { type: 'image/png' }));
    const uploaded = await readJson(await api(baseUrl, '/upload', {
      method: 'POST',
      headers: authHeaders(session.token),
      body: form
    }));

    expectKeys(uploaded, ['url', 'fileName', 'type', 'id']);
    expect(normalizeNondeterministic(uploaded, { normalizeGenerated: true })).toEqual({
      url: '/uploads/images/<uuid>.png',
      fileName: '<uuid>.png',
      type: 'images',
      id: '<uuid>'
    });

    const stored = normalizeNondeterministic(await readJson(await api(baseUrl, `/media/${uploaded.id}`, {
      headers: authHeaders(session.token)
    })), { normalizeGenerated: true });
    expectKeys(stored, ['id', 'filename', 'originalName', 'url', 'type', 'mimeType', 'size', 'ext', 'title', 'alt', 'uploadedBy', 'createdAt', 'updatedAt']);
    expect(stored).toEqual({
      id: '<uuid>',
      filename: '<uuid>.png',
      originalName: 'contract.png',
      url: '/uploads/images/<uuid>.png',
      type: 'image',
      mimeType: 'image/png',
      size: 4,
      ext: 'png',
      title: 'contract',
      alt: '',
      uploadedBy: 'Contract Admin',
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>'
    });

    const updatedMedia = normalizeNondeterministic(await readJson(await api(baseUrl, `/media/${uploaded.id}`, {
      method: 'PUT',
      headers: { ...authHeaders(session.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Media', alt: null })
    })), { normalizeGenerated: true });
    expectKeys(updatedMedia, ['id', 'filename', 'originalName', 'url', 'type', 'mimeType', 'size', 'ext', 'title', 'alt', 'uploadedBy', 'createdAt', 'updatedAt']);
    expect(updatedMedia).toEqual({
      id: '<uuid>',
      filename: '<uuid>.png',
      originalName: 'contract.png',
      url: '/uploads/images/<uuid>.png',
      type: 'image',
      mimeType: 'image/png',
      size: 4,
      ext: 'png',
      title: 'Updated Media',
      alt: null,
      uploadedBy: 'Contract Admin',
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>'
    });

    expect(await readJson(await api(baseUrl, `/media/${uploaded.id}`, {
      method: 'DELETE',
      headers: authHeaders(session.token)
    }))).toEqual({ message: 'File berhasil dihapus' });
    expect(await db.collection('media').countDocuments({ id: uploaded.id })).toBe(0);
    await rm(path.join(process.cwd(), 'public', uploaded.url), { force: true });

    for (const method of ['PUT', 'DELETE']) {
      const body = await readJson(await api(baseUrl, `/media/${uploaded.id}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }), 401);
      expect(body).toEqual(baseline.stableExpectations.unauthorized.body);
    }
  });
});
