import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export async function handleUpload(request, _segments, method) {
  if (method !== 'POST') return null;

  const auth = requireAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split('.').pop().toLowerCase();
    const imageExts = ['jpg','jpeg','png','gif','webp','svg','bmp'];
    const pdfExts   = ['pdf'];
    const videoExts = ['mp4','mov','avi','wmv','mkv'];
    const folderType = pdfExts.includes(ext) ? 'pdfs' : videoExts.includes(ext) ? 'videos' : 'images';
    const mediaType  = imageExts.includes(ext) ? 'image' : pdfExts.includes(ext) ? 'pdf' : videoExts.includes(ext) ? 'video' : 'file';
    const mediaId  = uuidv4();
    const fileName  = `${mediaId}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folderType);
    const fileUrl   = `/uploads/${folderType}/${fileName}`;

    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), buffer);

    const mediaCol = await getCollection('media');
    await mediaCol.insertOne({
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ url: fileUrl, fileName, type: folderType, id: mediaId });
  } catch (err) {
    return NextResponse.json({ error: 'Upload failed: ' + err.message }, { status: 500 });
  }
}
