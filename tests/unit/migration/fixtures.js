// In-memory fixtures for the migration profiler unit tests.
// These mirror the shape of MongoDB documents but never touch a real database.
// They are deliberately crafted to exercise every anomaly dimension.

const UUID_V4 = '10000000-0000-4000-8000-000000000001';
const UUID_V4_ALT = '10000000-0000-4000-8000-000000000002';
const UUID_NON_V4 = '10000000-0000-1000-8000-000000000001'; // version digit 1
const NON_UUID = 'legacy-id-12345';
// Valid 53-char bcrypt body: $2a$10$<53 chars of ./A-Za-z0-9> (total 60 chars).
const BCRYPT_VALID = '$2a$10$.FMTahov29ELSZgnu18DKRYfmt07CJQXelsz6BIPWdkry5AHOVcjq';
const BCRYPT_INVALID = 'not-a-hash';

export const FIXTURES = Object.freeze({
  UUID_V4,
  UUID_V4_ALT,
  UUID_NON_V4,
  NON_UUID,
  BCRYPT_VALID,
  BCRYPT_INVALID,
});

export function usersFixture() {
  return [
    {
      id: UUID_V4,
      name: 'Admin',
      email: 'ADMIN@example.test', // casing anomaly
      password: BCRYPT_VALID,
      role: 'superadmin',
      createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: UUID_V4_ALT,
      name: 'Editor',
      email: 'editor@example.test',
      password: BCRYPT_INVALID, // invalid hash format
      role: 'editor',
      createdAt: '2024-01-02T00:00:00.000Z',
    },
    {
      // duplicate normalized email of Admin (case differs)
      id: '10000000-0000-4000-8000-000000000003',
      name: 'Dup',
      email: 'admin@example.test',
      password: BCRYPT_VALID,
      role: 'admin',
      createdAt: '2024-01-03T00:00:00.000Z',
    },
    {
      // missing id entirely
      name: 'NoId',
      email: 'noid@example.test',
      password: BCRYPT_VALID,
      role: 'admin',
      createdAt: '2024-01-04T00:00:00.000Z',
      rogueField: true, // unknown field
    },
  ];
}

export function pagesFixture() {
  return [
    {
      id: '20000000-0000-4000-8000-000000000001',
      title: 'Page A',
      slug: 'dup-slug',
      status: 'published',
      blocks: [{ id: 'b1', type: 'hero', settings: { title: 'A' } }],
      createdAt: '2024-02-01T00:00:00.000Z',
      updatedAt: '2024-02-01T00:00:00.000Z',
    },
    {
      id: '20000000-0000-4000-8000-000000000002',
      title: 'Page B',
      slug: 'dup-slug', // duplicate slug
      status: 'draft',
      blocks: [], // empty blocks
      createdAt: '2024-02-02T00:00:00.000Z',
      updatedAt: '2024-02-02T00:00:00.000Z',
    },
    {
      id: '20000000-0000-4000-8000-000000000003',
      title: 'Page C',
      slug: 'page-c',
      status: 'published',
      blocks: { root: 'object' }, // non-array root type
      createdAt: '2024-02-03T00:00:00.000Z',
      updatedAt: '2024-02-03T00:00:00.000Z',
    },
  ];
}

export function settingsFixture() {
  return [
    { key: 'court_name', value: 'Pengadilan Agama Test' },
    { key: 'court_name', value: 'Dup' }, // duplicate key
    { key: 'nullable_value', value: null },
    { key: 'empty_value', value: '' },
    { key: 'json_blob', value: { nested: { deep: [1, 2, 3] } } },
    { key: 'array_blob', value: [1, 2, 3] },
  ];
}

export function analyticsFixture() {
  return [
    { date: '2024-01-01', path: '/', views: 2 },
    { date: '2024-01-01', path: '/', views: 3 }, // duplicate (date, path)
    { date: '2024-01-02', path: '/faq', views: 5 },
    { date: '2024-01-03', path: '/', views: 2147483648 }, // int32 overflow
    { date: '2024-01-04', path: '/', views: 'oops' }, // wrong type
  ];
}

export function surveyResponsesFixture() {
  return [
    { id: '12000000-0000-4000-8000-000000000001', rating: 4, comment: '', createdAt: '2024-01-01T00:00:00.000Z' },
    { id: '12000000-0000-4000-8000-000000000002', rating: 5, comment: 'great', createdAt: '2024-01-02T00:00:00.000Z' },
    { id: '12000000-0000-4000-8000-000000000003', rating: 0, comment: 'bad', createdAt: '2024-01-03T00:00:00.000Z' }, // out of range
    { id: '12000000-0000-4000-8000-000000000004', rating: 9, comment: 'great', createdAt: '2024-01-04T00:00:00.000Z' }, // out of range
    { id: '12000000-0000-4000-8000-000000000005', rating: null, comment: '', createdAt: '2024-01-05T00:00:00.000Z' },
  ];
}

export function menusFixture() {
  const TOP = 'f0000000-0000-4000-8000-000000000001';
  const CHILD = 'f0000000-0000-4000-8000-000000000002';
  const GRANDCHILD = 'f0000000-0000-4000-8000-000000000003';
  const GREAT_GRAND = 'f0000000-0000-4000-8000-000000000004'; // depth 3 -> anomaly
  const SELF = 'f0000000-0000-4000-8000-000000000005';
  const ORPHAN = 'f0000000-0000-4000-8000-000000000006';
  const MISSING = 'ffffffff-0000-4000-8000-000000000099';
  return [
    { id: TOP, title: 'Top', url: '/', parentId: null, isActive: true, order: 1, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
    { id: CHILD, title: 'Child', url: '/c', parentId: TOP, isActive: true, order: 1, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
    { id: GRANDCHILD, title: 'GC', url: '/g', parentId: CHILD, isActive: true, order: 1, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
    { id: GREAT_GRAND, title: 'GGC', url: '/gg', parentId: GRANDCHILD, isActive: true, order: 1, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
    { id: SELF, title: 'Self', url: '/s', parentId: SELF, isActive: true, order: 1, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
    { id: ORPHAN, title: 'Orphan', url: '/o', parentId: MISSING, isActive: true, order: 1, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
  ];
}

export function mediaFixture() {
  return [
    {
      id: '11000000-0000-4000-8000-000000000001',
      filename: 'a.png',
      originalName: 'a.png',
      url: '/uploads/a.png',
      type: 'image',
      mimeType: 'image/png',
      size: 100,
      ext: 'png',
      title: 'A',
      alt: '',
      uploadedBy: 'Admin',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: '11000000-0000-4000-8000-000000000002',
      filename: 'b.bin',
      originalName: 'b.bin',
      url: '/uploads/b.bin',
      type: 'pdf',
      mimeType: 'application/octet-stream',
      size: 5000000000, // exceeds int32 (>2GB)
      ext: 'bin',
      title: 'B',
      alt: null,
      uploadedBy: 'Admin',
      createdAt: '2024-01-02T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    },
  ];
}

export function mixedTypesFixture() {
  // collection with mixed types per field to exercise mixedTypes detection.
  return [
    { id: '30000000-0000-4000-8000-000000000001', title: 'A', count: 1, active: true, note: 'x' },
    { id: '30000000-0000-4000-8000-000000000002', title: 42, count: 'two', active: 'yes', note: null },
    { id: '30000000-0000-4000-8000-000000000003', title: 'C', count: 3, active: false }, // missing note
  ];
}

export function timestampAnomalyFixture() {
  return [
    {
      id: '40000000-0000-4000-8000-000000000001',
      title: 'ok',
      publishDate: '2024-01-01', // date-only OK
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: '40000000-0000-4000-8000-000000000002',
      title: 'bad',
      publishDate: 'January 1st 2024', // invalid
      createdAt: '2024-01-02T00:00:00.000Z',
      updatedAt: 'yesterday', // invalid
    },
  ];
}
