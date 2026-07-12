import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

// Import all domain handlers
import { handleAuth }           from '../handlers/authHandler';
import { handleStats }          from '../handlers/statsHandler';
import { handleUpload }         from '../handlers/uploadHandler';
import { handleMedia }          from '../handlers/mediaHandler';
import { handleNews }           from '../handlers/newsHandler';
import { handleAnnouncements }  from '../handlers/announcementsHandler';
import { handleServices }       from '../handlers/servicesHandler';
import { handleCases }          from '../handlers/casesHandler';
import { handleUsers }          from '../handlers/usersHandler';
import { handleSettings }       from '../handlers/settingsHandler';
import { handlePages }          from '../handlers/pagesHandler';
import { handleAgenda }         from '../handlers/agendaHandler';
import { handlePutusan }        from '../handlers/putusanHandler';
import { handleSidebarWidgets } from '../handlers/sidebarWidgetsHandler';
import { handleGallery }        from '../handlers/galleryHandler';
import { handleDocuments }      from '../handlers/documentsHandler';
import { handleFaq }            from '../handlers/faqHandler';
import { handleBanners }        from '../handlers/bannersHandler';
import { handleComplaints }     from '../handlers/complaintsHandler';
import { handleAnalytics }      from '../handlers/analyticsHandler';
import { handleSurveys }        from '../handlers/surveysHandler';
import { handleSearch }         from '../handlers/searchHandler';
import { handleMenus }          from '../handlers/menusHandler';
import { handleSeed }           from '../handlers/seedHandler';

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
  auth:             handleAuth,
  stats:            handleStats,
  upload:           handleUpload,
  media:            handleMedia,
  news:             handleNews,
  announcements:    handleAnnouncements,
  services:         handleServices,
  cases:            handleCases,
  users:            handleUsers,
  settings:         handleSettings,
  pages:            handlePages,
  agenda:           handleAgenda,
  putusan:          handlePutusan,
  'sidebar-widgets': handleSidebarWidgets,
  gallery:          handleGallery,
  documents:        handleDocuments,
  faq:              handleFaq,
  banners:          handleBanners,
  complaints:       handleComplaints,
  analytics:        handleAnalytics,
  surveys:          handleSurveys,
  search:           handleSearch,
  menus:            handleMenus,
  seed:             handleSeed,
};

async function handleRequest(request, pathSegments, method) {
  await connectDB();
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
  try { return await handleRequest(request, p, 'GET'); }
  catch (err) { console.error('API Error:', err); return NextResponse.json({ error: 'Internal Server Error', detail: err.message }, { status: 500 }); }
}
export async function POST(request, { params }) {
  const resolvedParams = await params;
  const p = resolvedParams.path || [];
  try { return await handleRequest(request, p, 'POST'); }
  catch (err) { console.error('API Error:', err); return NextResponse.json({ error: 'Internal Server Error', detail: err.message }, { status: 500 }); }
}
export async function PUT(request, { params }) {
  const resolvedParams = await params;
  const p = resolvedParams.path || [];
  try { return await handleRequest(request, p, 'PUT'); }
  catch (err) { console.error('API Error:', err); return NextResponse.json({ error: 'Internal Server Error', detail: err.message }, { status: 500 }); }
}
export async function DELETE(request, { params }) {
  const resolvedParams = await params;
  const p = resolvedParams.path || [];
  try { return await handleRequest(request, p, 'DELETE'); }
  catch (err) { console.error('API Error:', err); return NextResponse.json({ error: 'Internal Server Error', detail: err.message }, { status: 500 }); }
}
