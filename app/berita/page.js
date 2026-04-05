'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Search, Newspaper, Calendar, User, Tag } from 'lucide-react';
import PublicLayout from '@/components/PublicLayout';

export default function BeritaListPage() {
  const { lang } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 9;

  useEffect(() => { loadData(); }, [search, page]);

  async function loadData() {
    setLoading(true);
    const params = new URLSearchParams({ public: 'true', limit: LIMIT, page });
    if (search) params.set('search', search);
    try {
      const d = await (await fetch(`/api/news?${params}`)).json();
      setItems(d.items || []);
      setTotal(d.total || 0);
      setTotalPages(d.totalPages || 1);
    } catch {}
    finally { setLoading(false); }
  }

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    loadData();
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString(
    lang === 'id' ? 'id-ID' : 'en-US',
    { day: 'numeric', month: 'long', year: 'numeric' }
  ) : '';

  return (
    <PublicLayout
      title={lang === 'id' ? 'Berita & Informasi' : 'News & Information'}
      subtitle={lang === 'id' ? 'Informasi terkini dari Pengadilan Agama Penajam' : 'Latest news from Penajam Religious Court'}
    >
      <div className="container mx-auto px-4 py-10">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-3 mb-8 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); if (!e.target.value) { setPage(1); } }}
              placeholder={lang === 'id' ? 'Cari berita...' : 'Search news...'}
              className="pl-9"
            />
          </div>
        </form>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
                <div className="h-48 bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 text-center">
            <Newspaper className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-400 text-lg font-medium">{lang === 'id' ? 'Belum ada berita' : 'No news yet'}</p>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-6">{total} {lang === 'id' ? 'berita ditemukan' : 'news found'}</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map(item => (
                <a key={item.id} href={`/berita/${item.id}`}
                  className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg hover:border-[#1b5e20]/20 transition-all">
                  {/* Thumbnail */}
                  <div className="h-48 bg-gradient-to-br from-[#1b5e20]/10 to-[#2e7d32]/10 overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt={item.imageAlt || item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Newspaper className="w-12 h-12 text-[#1b5e20]/30" />
                      </div>
                    )}
                  </div>
                  {/* Content */}
                  <div className="p-5">
                    {item.category && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#d4a017] bg-[#d4a017]/10 px-2.5 py-1 rounded-full mb-3">
                        <Tag className="w-3 h-3" />{item.category}
                      </span>
                    )}
                    <h2 className="font-bold text-[#1b5e20] text-base leading-snug line-clamp-2 mb-3 group-hover:text-[#2e7d32] transition-colors">
                      {item.title}
                    </h2>
                    <p className="text-gray-500 text-sm line-clamp-2 mb-4 leading-relaxed">
                      {item.content?.replace(/<[^>]+>/g, '').substring(0, 120)}...
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(item.publishedAt || item.createdAt)}
                      </span>
                      {item.author && (
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />{item.author}
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-10">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  ← {lang === 'id' ? 'Sebelumnya' : 'Previous'}
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button key={i} onClick={() => setPage(i+1)}
                    className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${
                      page === i+1 ? 'bg-[#1b5e20] text-white shadow-sm' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>{i+1}</button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  {lang === 'id' ? 'Selanjutnya' : 'Next'} →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PublicLayout>
  );
}
