'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Bell, Search, Calendar, ChevronRight, FileText } from 'lucide-react';
import PublicLayout from '@/components/PublicLayout';

export default function PengumumanListPage() {
  const { lang } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [openId, setOpenId] = useState(null);
  const LIMIT = 10;

  useEffect(() => { loadData(); }, [search, page]);

  async function loadData() {
    setLoading(true);
    const params = new URLSearchParams({ public: 'true', limit: LIMIT, page });
    if (search) params.set('search', search);
    try {
      const d = await (await fetch(`/api/announcements?${params}`)).json();
      setItems(d.items || []);
      setTotal(d.total || 0);
      setTotalPages(d.totalPages || 1);
    } catch {}
    finally { setLoading(false); }
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString(
    lang === 'id' ? 'id-ID' : 'en-US',
    { day: 'numeric', month: 'long', year: 'numeric' }
  ) : '';

  return (
    <PublicLayout
      title={lang === 'id' ? 'Pengumuman' : 'Announcements'}
      subtitle={lang === 'id' ? 'Pengumuman dan informasi resmi Pengadilan Agama Penajam' : 'Official announcements from Penajam Religious Court'}
      bgHeader="#d4a017"
    >
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        {/* Search */}
        <div className="relative mb-8 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={lang === 'id' ? 'Cari pengumuman...' : 'Search announcements...'}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="space-y-4">{[...Array(5)].map((_,i)=><div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <div className="py-24 text-center">
            <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-400 text-lg font-medium">{lang === 'id' ? 'Belum ada pengumuman' : 'No announcements yet'}</p>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-6">{total} {lang === 'id' ? 'pengumuman ditemukan' : 'announcements found'}</p>
            <div className="space-y-4">
              {items.map((ann, idx) => (
                <div key={ann.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setOpenId(openId === ann.id ? null : ann.id)}
                    className="w-full flex items-start gap-4 px-6 py-5 text-left hover:bg-gray-50 transition-colors"
                  >
                    {/* Number badge */}
                    <div className="w-10 h-10 rounded-full bg-[#d4a017]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[#d4a017] text-sm font-extrabold">{String(idx + 1 + (page-1)*LIMIT).padStart(2, '0')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-[#1b5e20] text-base leading-snug mb-1.5">{ann.title}</h2>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(ann.publishedAt || ann.createdAt)}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[#d4a017] text-2xl font-bold flex-shrink-0 mt-1 transition-transform duration-200 ${openId === ann.id ? 'rotate-45' : ''}`}>+</span>
                  </button>

                  {/* Expanded content */}
                  {openId === ann.id && (
                    <div className="px-6 pb-6 border-t border-gray-50 pt-4">
                      <div
                        className="prose prose-sm prose-headings:text-[#1b5e20] max-w-none text-gray-700 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: ann.content || '' }}
                      />
                      {ann.fileUrl && (
                        <a href={ann.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 mt-4 bg-[#1b5e20] hover:bg-[#2e7d32] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                          <FileText className="w-4 h-4" />{lang === 'id' ? 'Unduh Lampiran' : 'Download Attachment'}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-10">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  ← {lang === 'id' ? 'Sebelumnya' : 'Previous'}
                </button>
                {[...Array(Math.min(totalPages, 7))].map((_, i) => (
                  <button key={i} onClick={() => setPage(i+1)}
                    className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${
                      page === i+1 ? 'bg-[#d4a017] text-white shadow-sm' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
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
