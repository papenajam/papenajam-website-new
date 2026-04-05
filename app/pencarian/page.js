'use client';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Newspaper, Bell, FileText, HelpCircle, Globe } from 'lucide-react';

const TYPE_ICONS = { news: Newspaper, announcement: Bell, document: FileText, faq: HelpCircle, page: Globe };
const TYPE_LABELS = { news: 'Berita', announcement: 'Pengumuman', document: 'Dokumen', faq: 'FAQ', page: 'Halaman' };
const TYPE_COLORS = { news: 'bg-blue-100 text-blue-700', announcement: 'bg-amber-100 text-amber-700', document: 'bg-emerald-100 text-emerald-700', faq: 'bg-violet-100 text-violet-700', page: 'bg-gray-100 text-gray-700' };

export default function PencarianPage() {
  const { lang } = useLanguage();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [filter, setFilter] = useState('');

  async function handleSearch(e) {
    e.preventDefault();
    if (!q.trim() || q.length < 2) return;
    setLoading(true); setSearched(true);
    try {
      const d = await (await fetch(`/api/search?q=${encodeURIComponent(q)}`)).json();
      setResults(d.results || []);
    } catch { setResults([]); } finally { setLoading(false); }
  }

  const filtered = filter ? results.filter(r => r.type === filter) : results;
  const types = [...new Set(results.map(r => r.type))];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1e3a5f] py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-extrabold text-white mb-3">{lang==='id'?'Pencarian':'Search'}</h1>
          <p className="text-white/70 mb-8">{lang==='id'?'Cari berita, dokumen, FAQ, dan halaman':'Search news, documents, FAQ, and pages'}</p>
          <form onSubmit={handleSearch} className="max-w-xl mx-auto flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input value={q} onChange={e=>setQ(e.target.value)} placeholder={lang==='id'?'Ketik kata kunci pencarian...':'Type search keyword...'} className="pl-11 h-12 text-base bg-white border-0 shadow-sm" />
            </div>
            <Button type="submit" className="bg-[#c9a84c] hover:bg-[#b8962f] text-white h-12 px-6" disabled={loading}>
              {loading?<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<Search className="w-5 h-5"/>}
            </Button>
          </form>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-3xl">
        {searched && (
          <>
            {types.length > 0 && (
              <div className="flex gap-2 mb-6 flex-wrap">
                <button onClick={()=>setFilter('')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${!filter?'bg-[#1e3a5f] text-white':'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{lang==='id'?'Semua':'All'} ({results.length})</button>
                {types.map(t=>(
                  <button key={t} onClick={()=>setFilter(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter===t?'bg-[#1e3a5f] text-white':'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{TYPE_LABELS[t]||t} ({results.filter(r=>r.type===t).length})</button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="space-y-3">{[...Array(4)].map((_,i)=><div key={i} className="h-20 bg-gray-200 rounded-2xl animate-pulse"/>)}</div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center"><Search className="w-16 h-16 mx-auto mb-4 text-gray-300"/><p className="text-xl font-bold text-gray-400">{lang==='id'?'Tidak ada hasil':'No results found'}</p><p className="text-gray-400 text-sm mt-2">{lang==='id'?`Tidak ditemukan hasil untuk "${q}"`:`No results for "${q}"`}</p></div>
            ) : (
              <div className="space-y-3">
                {filtered.map(r => {
                  const Icon = TYPE_ICONS[r.type] || Globe;
                  return (
                    <a key={r.id} href={r.url} className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md hover:border-[#c9a84c]/30 transition-all group">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${TYPE_COLORS[r.type]||'bg-gray-100 text-gray-600'}`}><Icon className="w-4 h-4"/></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${TYPE_COLORS[r.type]||'bg-gray-100 text-gray-600'}`}>{TYPE_LABELS[r.type]||r.type}</span>
                          </div>
                          <h3 className="font-semibold text-[#1e3a5f] text-sm group-hover:text-[#c9a84c] transition-colors line-clamp-1">{r.title}</h3>
                          {r.excerpt && <p className="text-gray-500 text-xs mt-1 line-clamp-2">{r.excerpt}</p>}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </>
        )}

        {!searched && (
          <div className="py-20 text-center text-gray-400">
            <Search className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">{lang==='id'?'Masukkan kata kunci untuk mulai mencari':'Enter a keyword to start searching'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
