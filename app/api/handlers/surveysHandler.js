// Surveys handler (Task 12: PostgreSQL/Prisma implementation).
//
// Behaviour is byte-identical to the established API contract:
//   - GET  /surveys/config          -> singleton config (id 'main') or defaults
//   - PUT  /surveys/config          -> upsert id 'main' (auth)
//   - POST /surveys/submit          -> insert SurveyResponse
//   - GET  /surveys?page&limit      -> paginated responses + avg (auth)
//       envelope: { items, total, totalPages, averageRating, totalResponses }
//       (no `page` key — matches established API shape)
//
// Prisma models: SurveyConfig (@@map("survey_config")),
//                SurveyResponse (@@map("survey_responses")).
// averageRating: one-decimal via toFixed(1) then parseFloat (legacy parity).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { serializeRecord, serializeList } from '@/lib/api/serialize.js';
import { parsePagination } from '@/lib/api/query.js';

const CONFIG_ID = 'main';
const DEFAULT_CONFIG = {
  id: CONFIG_ID,
  isActive: true,
  title: 'Survei Kepuasan',
  subtitle: 'Bantu kami meningkatkan pelayanan',
};

/** Pick only schema-known SurveyConfig fields from a request body. */
function pickConfigFields(body) {
  const out = {};
  if ('isActive' in body) out.isActive = Boolean(body.isActive);
  if ('title' in body) out.title = body.title;
  if ('subtitle' in body) out.subtitle = body.subtitle;
  if ('thankYouMessage' in body) out.thankYouMessage = body.thankYouMessage;
  return out;
}

export async function handleSurveys(request, segments, method) {
  const [sub] = segments;

  if (sub === 'config') {
    if (method === 'GET') {
      const config = await prisma.surveyConfig.findUnique({
        where: { id: CONFIG_ID },
      });
      if (!config) return NextResponse.json(DEFAULT_CONFIG);
      return NextResponse.json(serializeRecord('SurveyConfig', config));
    }

    if (method === 'PUT') {
      const auth = requireAuth(request);
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const body = await request.json();
      const fields = pickConfigFields(body);
      const now = new Date();

      await prisma.surveyConfig.upsert({
        where: { id: CONFIG_ID },
        update: { ...fields, updatedAt: now },
        create: {
          id: CONFIG_ID,
          isActive: 'isActive' in fields ? fields.isActive : true,
          title: 'title' in fields ? fields.title : DEFAULT_CONFIG.title,
          subtitle: 'subtitle' in fields ? fields.subtitle : null,
          thankYouMessage: 'thankYouMessage' in fields ? fields.thankYouMessage : null,
          updatedAt: now,
        },
      });
      return NextResponse.json({ message: 'Konfigurasi survei disimpan' });
    }
  }

  if (sub === 'submit' && method === 'POST') {
    const body = await request.json();
    await prisma.surveyResponse.create({
      data: {
        rating: Number(body.rating) || 0,
        comment: body.comment ?? null,
        page: body.page ?? null,
        createdAt: new Date(),
      },
    });
    return NextResponse.json({ message: 'Terima kasih atas masukan Anda!' });
  }

  if (!sub && method === 'GET') {
    const auth = requireAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const { page, limit, skip, take } = parsePagination(url, 'survey_responses');

    const [total, items, agg] = await Promise.all([
      prisma.surveyResponse.count(),
      prisma.surveyResponse.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.surveyResponse.aggregate({
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    const totalResponses = agg._count._all;
    // Legacy: (sum/len).toFixed(1) then parseFloat; empty -> 0 (number).
    const averageRating =
      totalResponses && agg._avg.rating != null
        ? parseFloat(Number(agg._avg.rating).toFixed(1))
        : 0;

    return NextResponse.json({
      items: serializeList('SurveyResponse', items),
      total,
      totalPages: Math.ceil(total / limit),
      averageRating,
      totalResponses,
    });
  }

  return null;
}
