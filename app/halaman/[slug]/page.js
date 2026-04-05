'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

function BlockRenderer({ block }) {
  const s = block.settings || {};
  switch (block.type) {
    case 'hero':
      return (
        <section
          className="relative py-24 flex items-center justify-center text-center overflow-hidden"
          style={{ background: s.backgroundImage ? `linear-gradient(rgba(0,0,0,0.55),rgba(0,0,0,0.55)), url(${s.backgroundImage}) center/cover` : '#1b5e20' }}
        >
          <div className="relative z-10 container mx-auto px-4">
            <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4 leading-tight">{s.title}</h1>
            {s.subtitle && <p className="text-white/80 text-lg max-w-2xl mx-auto mb-8">{s.subtitle}</p>}
            {s.buttonText && s.buttonLink && (
              <a href={s.buttonLink} className="inline-block bg-[#d4a017] hover:bg-[#b88010] text-white font-bold px-8 py-3 rounded-xl text-base transition-colors">
                {s.buttonText}
              </a>
            )}
          </div>
        </section>
      );
    case 'text':
      return (
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: s.content || '' }} />
          </div>
        </section>
      );
    case 'image':
      return (
        <section className="py-10">
          <div className="container mx-auto px-4">
            <div className={`flex flex-col items-${s.alignment === 'left' ? 'start' : s.alignment === 'right' ? 'end' : 'center'} gap-3`}>
              {s.src && <img src={s.src} alt={s.caption || ''} className="max-w-full rounded-2xl shadow-md max-h-[500px] object-cover" />}
              {s.caption && <p className="text-gray-500 text-sm italic">{s.caption}</p>}
            </div>
          </div>
        </section>
      );
    case 'cardgrid':
      return (
        <section className="py-14 bg-gray-50">
          <div className="container mx-auto px-4">
            {s.title && <h2 className="text-2xl md:text-3xl font-bold text-[#1b5e20] text-center mb-10">{s.title}</h2>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {(s.items || []).map(item => (
                <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-center">
                  <div className="text-3xl mb-4">{item.icon}</div>
                  <h3 className="font-bold text-[#1b5e20] mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case 'stats':
      return (
        <section className="py-14 bg-[#1b5e20]">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {(s.items || []).map(item => (
                <div key={item.id} className="text-center">
                  <div className="text-3xl md:text-4xl font-extrabold text-[#d4a017] mb-1">{item.number}</div>
                  <div className="text-white/70 text-sm">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case 'cta':
      return (
        <section className="py-16" style={{ background: s.bgColor || '#1b5e20' }}>
          <div className="container mx-auto px-4 text-center text-white">
            <h2 className="text-2xl md:text-3xl font-extrabold mb-4">{s.title}</h2>
            {s.subtitle && <p className="text-white/80 mb-8 max-w-xl mx-auto">{s.subtitle}</p>}
            {s.buttonText && s.buttonLink && (
              <a href={s.buttonLink} className="inline-block bg-[#d4a017] hover:bg-[#b88010] text-white font-bold px-8 py-3 rounded-xl transition-colors">
                {s.buttonText}
              </a>
            )}
          </div>
        </section>
      );
    case 'gallery':
      const cols = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[s.columns] || 'grid-cols-3';
      return (
        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className={`grid ${cols} gap-4`}>
              {(s.images || []).map((img, i) => (
                <img key={i} src={img} alt="" className="w-full aspect-square object-cover rounded-xl hover:scale-105 transition-transform duration-300" />
              ))}
            </div>
          </div>
        </section>
      );
    default:
      return null;
  }
}

export default function DynamicPage() {
  const params = useParams();
  const slug = params?.slug;
  const [pageData, setPageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/pages/slug/${slug}`)
      .then(r => {
        if (!r.ok) { setNotFound(true); setLoading(false); return; }
        return r.json();
      })
      .then(data => { if (data) setPageData(data); setLoading(false); })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [slug]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="w-8 h-8 animate-spin text-[#1b5e20]" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <h1 className="text-4xl font-extrabold text-[#1b5e20] mb-4">404</h1>
      <p className="text-gray-500 mb-6">Halaman tidak ditemukan</p>
      <Link href="/" className="bg-[#1b5e20] hover:bg-[#2e7d32] text-white px-6 py-2.5 rounded-xl font-semibold transition-colors">
        Kembali ke Beranda
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Topbar */}
      <div className="bg-[#1b5e20] text-white/60 text-xs px-4 py-2">
        <div className="container mx-auto flex items-center justify-between">
          <Link href="/" className="hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Beranda
          </Link>
          <span>{pageData?.title}</span>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-[#d4a017] via-[#f5d98a] to-[#d4a017]" />

      {/* Render blocks */}
      {(pageData?.blocks || []).map(block => (
        <BlockRenderer key={block.id} block={block} />
      ))}

      {(pageData?.blocks || []).length === 0 && (
        <div className="min-h-[60vh] flex items-center justify-center text-gray-400">
          <p>Halaman ini belum memiliki konten</p>
        </div>
      )}

      <footer className="bg-[#1b5e20] text-white/50 text-center py-6 text-sm">
        © {new Date().getFullYear()} Pengadilan Agama Penajam — Mahkamah Agung RI
      </footer>
    </div>
  );
}
