// Unit tests for app/api/handlers/uploadHandler.js (Task 13).
//
// Covers:
//   - POST /upload success (image + pdf) -> 200 {url,fileName,type,id}
//   - unauthorized -> 401
//   - missing file -> 400
//   - DB insert failure after file write -> compensation unlink + 500
//
// Mocks: prisma, requireAuth, fs/promises, uuid. No real disk or DB.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPrisma = {
  media: {
    create: vi.fn(),
  },
};
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, getPrisma: () => mockPrisma }));

const mockAuth = { requireAuth: vi.fn() };
vi.mock('@/lib/auth', () => mockAuth);

const mockFs = {
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
};
vi.mock('fs/promises', () => mockFs);

vi.mock('uuid', () => ({
  v4: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
}));

const { handleUpload, uploadAbsolutePath } = await import(
  '../../../app/api/handlers/uploadHandler.js'
);

function makeFile({ name, type, bytes }) {
  const buffer = Buffer.from(bytes);
  return {
    name,
    type,
    arrayBuffer: async () =>
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };
}

function uploadRequest(file) {
  return {
    formData: async () => ({
      get: (key) => (key === 'file' ? file : null),
    }),
    headers: new Headers(),
    url: 'http://localhost/api/upload',
  };
}

async function read(res) {
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.requireAuth.mockReturnValue({
    id: 'auth',
    name: 'Contract Admin',
    email: 'admin@example.com',
    role: 'admin',
  });
  mockFs.mkdir.mockResolvedValue(undefined);
  mockFs.writeFile.mockResolvedValue(undefined);
  mockFs.unlink.mockResolvedValue(undefined);
  mockPrisma.media.create.mockResolvedValue({});
});

describe('POST /upload', () => {
  test('image upload success: writes file then inserts Media metadata', async () => {
    const file = makeFile({
      name: 'contract.png',
      type: 'image/png',
      bytes: [137, 80, 78, 71],
    });

    const out = await read(await handleUpload(uploadRequest(file), [], 'POST'));

    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      url: '/uploads/images/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png',
      fileName: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png',
      type: 'images',
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    });

    expect(mockFs.mkdir).toHaveBeenCalled();
    expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
    const [writtenPath, writtenBuf] = mockFs.writeFile.mock.calls[0];
    expect(writtenPath).toBe(
      uploadAbsolutePath('images', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png'),
    );
    expect(Buffer.isBuffer(writtenBuf)).toBe(true);
    expect(writtenBuf.length).toBe(4);

    // DB insert AFTER write, with expected metadata shape.
    expect(mockPrisma.media.create).toHaveBeenCalledTimes(1);
    const data = mockPrisma.media.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      filename: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png',
      originalName: 'contract.png',
      url: '/uploads/images/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png',
      type: 'image',
      mimeType: 'image/png',
      size: 4,
      ext: 'png',
      title: 'contract',
      alt: '',
      uploadedBy: 'Contract Admin',
    });
    expect(typeof data.createdAt).toBe('string');
    expect(typeof data.updatedAt).toBe('string');
    // Compensation unlink must NOT run on success.
    expect(mockFs.unlink).not.toHaveBeenCalled();
  });

  test('pdf upload routes to pdfs folder and type=pdf', async () => {
    const file = makeFile({
      name: 'report.pdf',
      type: 'application/pdf',
      bytes: [37, 80, 68, 70],
    });

    const out = await read(await handleUpload(uploadRequest(file), [], 'POST'));

    expect(out.status).toBe(200);
    expect(out.body.type).toBe('pdfs');
    expect(out.body.url).toContain('/uploads/pdfs/');
    expect(mockPrisma.media.create.mock.calls[0][0].data.type).toBe('pdf');
    expect(mockPrisma.media.create.mock.calls[0][0].data.ext).toBe('pdf');
  });

  test('unauthenticated -> 401; no fs or prisma calls', async () => {
    mockAuth.requireAuth.mockReturnValue(null);
    const file = makeFile({ name: 'x.png', type: 'image/png', bytes: [1] });

    const out = await read(await handleUpload(uploadRequest(file), [], 'POST'));

    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: 'Unauthorized' });
    expect(mockFs.writeFile).not.toHaveBeenCalled();
    expect(mockPrisma.media.create).not.toHaveBeenCalled();
  });

  test('missing file -> 400', async () => {
    const out = await read(await handleUpload(uploadRequest(null), [], 'POST'));
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: 'No file provided' });
    expect(mockFs.writeFile).not.toHaveBeenCalled();
  });

  test('DB insert failure after file write -> compensation unlink + 500', async () => {
    mockPrisma.media.create.mockRejectedValue(new Error('db down'));
    const file = makeFile({
      name: 'orphan.png',
      type: 'image/png',
      bytes: [1, 2, 3],
    });

    const out = await read(await handleUpload(uploadRequest(file), [], 'POST'));

    expect(out.status).toBe(500);
    expect(out.body.error).toBe('Upload gagal');
    // Internal driver/Prisma messages must not leak to the client.
    expect(JSON.stringify(out.body)).not.toMatch(/db down/i);
    // File was written then cleaned up.
    expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
    expect(mockFs.unlink).toHaveBeenCalledTimes(1);
    expect(mockFs.unlink.mock.calls[0][0]).toBe(
      uploadAbsolutePath('images', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png'),
    );
  });

  test('non-POST method -> null', async () => {
    const res = await handleUpload(uploadRequest(null), [], 'GET');
    expect(res).toBeNull();
  });
});
