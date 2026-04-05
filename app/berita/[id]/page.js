'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { Calendar, User, Tag, ArrowLeft, Newspaper, Share2, ChevronRight } from 'lucide-react';
import PublicLayout from '@/components/PublicLayout';

export default function BeritaDetailPage() {
  const { id } = useParams();
  const { lang } = useLanguage();
  const [item, setItem] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/news/${id}`);
      if (!res.ok) { setNotFound(true); return; }
      const data = await res.json();
      setItem(data);
      // Load related news (excluding current)
      const relRes = await fetch('/api/news?public=true&limit=4');
      const relData = await relRes.json();
      setRelated((relData.items || []).filter(n => n.id !== id).slice(0, 3));
    } catch { setNotFound(true); }
    finally { setLoading(false); }
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString(
    lang === 'id' ? 'id-ID' : 'en-US',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  ) : '';

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: item?.title, url: window.location.href });
    } else {
      navigator.clipboard?.writeText(window.location.href);
      alert('Link berhasil disalin!');
    }
  }

  if (loading) return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded-2xl" />
          <div className="space-y-2">{[...Array(6)].map((_,i)=><div key={i} className="h-4 bg-gray-200 rounded" />)}</div>
        </div>
      </div>
    </PublicLayout>
  );

  if (notFound) return (
    <PublicLayout title="Berita Tidak Ditemukan">
      <div className="container mx-auto px-4 py-24 text-center">
        <Newspaper className="w-20 h-20 mx-auto mb-6 text-gray-300" />
        <h2 className="text-2xl font-bold text-gray-600 mb-3">Berita tidak ditemukan</h2>
        <p className="text-gray-400 mb-6">Berita yang Anda cari mungkin sudah dihapus atau tidak tersedia</p>
        <a href="/berita" className="inline-flex items-center gap-2 bg-[#1b5e20] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#2e7d32] transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Berita
        </a>
      </div>
    </PublicLayout>
  );

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <a href="/" className="hover:text-[#1b5e20]">Beranda</a>
          <ChevronRight className="w-3.5 h-3.5" />
          <a href="/berita" className="hover:text-[#1b5e20]">{lang === 'id' ? 'Berita' : 'News'}</a>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-700 line-clamp-1 max-w-xs">{item?.title}</span>
        </nav>

        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl">
          {/* Article */}
          <article className="lg:col-span-2">
            {/* Category */}
            {item.category && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#d4a017] bg-[#d4a017]/10 px-3 py-1.5 rounded-full mb-4">
                <Tag className="w-3 h-3" />{item.category}
              </span>
            )}

            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#1b5e20] leading-tight mb-4">
              {item.title}
            </h1>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-6 pb-6 border-b border-gray-100">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#1b5e20]" />
                {formatDate(item.publishedAt || item.createdAt)}
              </span>
              {item.author && (
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-[#1b5e20]" />{item.author}
                </span>
              )}
              <button onClick={handleShare}
                className="flex items-center gap-1.5 ml-auto text-[#1b5e20] hover:text-[#2e7d32] font-medium transition-colors">
                <Share2 className="w-4 h-4" />{lang === 'id' ? 'Bagikan' : 'Share'}
              </button>
            </div>

            {/* Hero image */}
            {item.image && (
              <div className="rounded-2xl overflow-hidden mb-8 shadow-sm">
                <img src={item.image} alt={item.imageAlt || item.title}
                  className="w-full object-cover max-h-96"
                  onError={e => e.target.parentElement.style.display='none'} />
                {item.imageAlt && (
                  <p className="text-xs text-gray-400 italic px-4 py-2 bg-gray-50">{item.imageAlt}</p>
                )}
              </div>
            )}

            {/* Content */}
            <div
              className="prose prose-lg prose-headings:text-[#1b5e20] prose-a:text-[#d4a017] prose-strong:text-[#1b5e20] max-w-none leading-relaxed text-gray-700"
              dangerouslySetInnerHTML={{ __html: item.content || '' }}
            />

            {/* Back button */}
            <div className="mt-10 pt-6 border-t border-gray-100">
              <a href="/berita"
                className="inline-flex items-center gap-2 text-[#1b5e20] hover:text-[#2e7d32] font-semibold transition-colors">
                <ArrowLeft className="w-4 h-4" />
                {lang === 'id' ? 'Kembali ke Daftar Berita' : 'Back to News List'}
              </a>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Related news */}
            {related.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 bg-[#1b5e20]">
                  <h3 className="font-bold text-white text-sm">{lang === 'id' ? 'Berita Terkait' : 'Related News'}</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {related.map(rel => (
                    <a key={rel.id} href={`/berita/${rel.id}`}
                      className="flex gap-3 p-4 hover:bg-gray-50 transition-colors group">
                      {rel.image ? (
                        <img src={rel.image} alt={rel.title}
                          className="w-16 h-14 rounded-xl object-cover flex-shrink-0 group-hover:opacity-90" />
                      ) : (
                        <div className="w-16 h-14 rounded-xl bg-[#1b5e20]/10 flex items-center justify-center flex-shrink-0">
                          <Newspaper className="w-5 h-5 text-[#1b5e20]/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#1b5e20] line-clamp-2 leading-snug group-hover:text-[#2e7d32]">{rel.title}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(rel.publishedAt||rel.createdAt).toLocaleDateString(lang==='id'?'id-ID':'en-US',{day:'numeric',month:'short',year:'numeric'})}</p>
                      </div>
                    </a>
                  ))}
                </div>
                <div className="p-4 border-t border-gray-50">
                  <a href="/berita" className="flex items-center justify-center gap-1.5 text-sm font-semibold text-[#1b5e20] hover:text-[#2e7d32] transition-colors">
                    {lang === 'id' ? 'Lihat Semua Berita' : 'View All News'} →
                  </a>
                </div>
              </div>
            )}

            {/* Share box */}
            <div className="bg-[#1b5e20]/5 rounded-2xl p-5">
              <h3 className="font-bold text-[#1b5e20] text-sm mb-3">{lang === 'id' ? 'Bagikan Berita Ini' : 'Share This News'}</h3>
              <button onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 bg-[#1b5e20] hover:bg-[#2e7d32] text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                <Share2 className="w-4 h-4" />{lang === 'id' ? 'Bagikan' : 'Share'}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </PublicLayout>
  );
}
