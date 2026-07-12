// Upload handler (Task 13: MongoDB -> PostgreSQL/Prisma migration).
//
// Behaviour matches the legacy Mongo handler wire contract:
//   - POST /upload (auth) -> 200 `{ url, fileName, type, id }`
//     1. Write file to public/uploads/{images|pdfs|videos}/
//     2. Insert Media metadata via Prisma AFTER the file is on disk
//     3. If the DB insert fails, delete the newly written file (compensation)
//        so we never leave an orphan file without a media row
//   - unauth -> 401 `{ error: 'Unauthorized' }`
//   - missing file -> 400 `{ error: 'No file provided' }`
//   - other failures -> 500 `{ error: 'Upload failed: …' }`
//
// Prisma model is `Media` (@@map("media")). The public `id` is generated here
// (uuid v4) so the filename and DB row share the same id, matching the
// legacy handler. File bytes stay on the local filesystem; only metadata
// moves to PostgreSQL.

import { NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
const PDF_EXTS = ['pdf'];
const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'wmv', 'mkv'];

/**
 * Absolute path for a newly written upload. Exported for unit tests that need
 * to assert compensation cleanup targets the same path the handler wrote.
 */
export function uploadAbsolutePath(folderType, fileName) {
  return path.join(process.cwd(), 'public', 'uploads', folderType, fileName);
}

export async function handleUpload(request, _segments, method) {
  if (method !== 'POST') return null;

  const auth = requireAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Absolute path of a file written in this request; used by the compensation
  // path when the DB insert fails after a successful write.
  let writtenPath = null;

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split('.').pop().toLowerCase();
    const folderType = PDF_EXTS.includes(ext)
      ? 'pdfs'
      : VIDEO_EXTS.includes(ext)
        ? 'videos'
        : 'images';
    const mediaType = IMAGE_EXTS.includes(ext)
      ? 'image'
      : PDF_EXTS.includes(ext)
        ? 'pdf'
        : VIDEO_EXTS.includes(ext)
          ? 'video'
          : 'file';
    const mediaId = uuidv4();
    const fileName = `${mediaId}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folderType);
    const fileUrl = `/uploads/${folderType}/${fileName}`;
    writtenPath = uploadAbsolutePath(folderType, fileName);

    await mkdir(uploadDir, { recursive: true });
    await writeFile(writtenPath, buffer);

    // DB insert AFTER file write. On failure the catch block deletes writtenPath.
    const now = new Date().toISOString();
    await prisma.media.create({
      data: {
        id: mediaId,
        filename: fileName,
        originalName: file.name,
        url: fileUrl,
        type: mediaType,
        mimeType: file.type || '',
        size: bytes.byteLength,
        ext,
        title: file.name.replace(/\.[^/.]+$/, ''),
        alt: '',
        uploadedBy: auth.name || auth.email || 'admin',
        createdAt: now,
        updatedAt: now,
      },
    });

    return NextResponse.json({ url: fileUrl, fileName, type: folderType, id: mediaId });
  } catch (err) {
    // Compensation: if we already wrote a file but the DB insert (or any later
    // step) failed, remove the orphan so disk and DB stay consistent.
    if (writtenPath) {
      try {
        await unlink(writtenPath);
      } catch (cleanupErr) {
        // Log and continue — the primary error is more important to surface.
        console.error(
          '[upload] compensation unlink failed after DB/metadata error:',
          writtenPath,
          cleanupErr?.message || cleanupErr,
        );
      }
    }
    // Never echo driver/Prisma messages to the client (may contain table
    // names, constraint text, or connection detail). Log server-side only.
    console.error('[upload] failed:', err?.code || err?.name || 'Error', err?.message || err);
    return NextResponse.json(
      { error: 'Upload gagal' },
      { status: 500 },
    );
  }
}
