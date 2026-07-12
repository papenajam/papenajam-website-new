import { NextResponse } from 'next/server';

// Import all domain handlers.
// Prisma lazy-connects via the shared pool in lib/prisma.js — no per-request
// Mongo bootstrap. Public POST /api/seed is intentionally NOT mapped (Task 15);
// use `corepack yarn db:seed` / `prisma db seed` instead.
import { handleAuth } from '../handlers/authHandler';
import { handleStats } from '../handlers/statsHandler';
import { handleUpload } from '../handlers/uploadHandler';
import { handleMedia } from '../handlers/mediaHandler';
import { handleNews } from '../handlers/newsHandler';
import { handleAnnouncements } from '../handlers/announcementsHandler';
import { handleServices } from '../handlers/servicesHandler';
import { handleCases } from '../handlers/casesHandler';
import { handleUsers } from '../handlers/usersHandler';
import { handleSettings } from '../handlers/settingsHandler';
import { handlePages } from '../handlers/pagesHandler';
import { handleAgenda } from '../handlers/agendaHandler';
import { handlePutusan } from '../handlers/putusanHandler';
import { handleSidebarWidgets } from '../handlers/sidebarWidgetsHandler';
import { handleGallery } from '../handlers/galleryHandler';
import { handleDocuments } from '../handlers/documentsHandler';
import { handleFaq } from '../handlers/faqHandler';
import { handleBanners } from '../handlers/bannersHandler';
import { handleComplaints } from '../handlers/complaintsHandler';
import { handleAnalytics } from '../handlers/analyticsHandler';
import { handleSurveys } from '../handlers/surveysHandler';
import { handleSearch } from '../handlers/searchHandler';
import { handleMenus } from '../handlers/menusHandler';
import { mapError } from '@/lib/prisma-errors.js';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

const ROUTE_MAP = {
  auth: handleAuth,
  stats: handleStats,
  upload: handleUpload,
  media: handleMedia,
  news: handleNews,
  announcements: handleAnnouncements,
  services: handleServices,
  cases: handleCases,
  users: handleUsers,
  settings: handleSettings,
  pages: handlePages,
  agenda: handleAgenda,
  putusan: handlePutusan,
  'sidebar-widgets': handleSidebarWidgets,
  gallery: handleGallery,
  documents: handleDocuments,
  faq: handleFaq,
  banners: handleBanners,
  complaints: handleComplaints,
  analytics: handleAnalytics,
  surveys: handleSurveys,
  search: handleSearch,
  menus: handleMenus,
  // seed: intentionally omitted — public POST /api/seed is disabled (Task 15).
};

/**
 * Build a safe 500 response. Never leak SQL, connection strings, stack traces,
 * or PII in the client body. Full error is logged server-side only.
 *
 * @param {unknown} err
 * @returns {NextResponse}
 */
function errorResponse(err) {
  console.error('API Error:', err);
  const mapped = mapError(err, { behavior: 'get' });
  // mapError already returns a generic internal body for unknown errors;
  // never attach err.message / detail to the client response.
  return NextResponse.json(mapped.body, { status: mapped.status });
}

async function handleRequest(request, pathSegments, method) {
  const [segment1, ...rest] = pathSegments;

  const handler = ROUTE_MAP[segment1];
  if (handler) {
    const result = await handler(request, rest, method);
    if (result) return result;
  }

  return NextResponse.json({ error: 'Route tidak ditemukan' }, { status: 404 });
}

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const p = resolvedParams.path || [];
  try {
    return await handleRequest(request, p, 'GET');
  } catch (err) {
    return errorResponse(err);
  }
}
export async function POST(request, { params }) {
  const resolvedParams = await params;
  const p = resolvedParams.path || [];
  try {
    return await handleRequest(request, p, 'POST');
  } catch (err) {
    return errorResponse(err);
  }
}
export async function PUT(request, { params }) {
  const resolvedParams = await params;
  const p = resolvedParams.path || [];
  try {
    return await handleRequest(request, p, 'PUT');
  } catch (err) {
    return errorResponse(err);
  }
}
export async function DELETE(request, { params }) {
  const resolvedParams = await params;
  const p = resolvedParams.path || [];
  try {
    return await handleRequest(request, p, 'DELETE');
  } catch (err) {
    return errorResponse(err);
  }
}
