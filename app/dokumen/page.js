'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { FileText, Download, Search, FolderOpen } from 'lucide-react';
import PublicLayout from '@/components/PublicLayout';

export default function DokumenPage() {
  const { lang } = useLanguage();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [filter, search]);

  async function loadData() {
    const params = new URLSearchParams({ limit: '50' });
    if (filter) params.set('category', filter);
    if (search) params.set('search', search);
    const d = await (await fetch(`/api/documents?${params}`)).json();
    setItems(d.items || []);
    setCategories(d.categories || []);
    setLoading(false);
  }

  async function handleDownload(item) {
    if (!item.fileUrl) { alert(lang === 'id' ? 'File belum tersedia' : 'File not available yet'); return; }
    await fetch(`/api/documents/download/${item.id}`, { method: 'POST' }).catch(() => {});
    window.open(item.fileUrl, '_blank');
  }

  const fileTypeIcon = (type) => type === 'pdf' ? '📄' : '📋';

  return (
    <PublicLayout
      title={lang === 'id' ? 'Dokumen & Peraturan' : 'Documents & Regulations'}
      subtitle={lang === 'id' ? 'Unduh dokumen, formulir, dan peraturan resmi Pengadilan Agama Penajam' : 'Download official documents, forms and regulations'}
    >
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === 'id' ? 'Cari dokumen...' : 'Search documents...'} className="pl-9" />
          </div>
        </div>

        <div className="flex gap-2 mb-8 flex-wrap">
          <button onClick={() => setFilter('')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${!filter ? 'bg-[#1b5e20] text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
            {lang === 'id' ? 'Semua' : 'All'}
          </button>
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === c ? 'bg-[#1b5e20] text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>{c}</button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <div className="py-24 text-center"><FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" /><p className="text-gray-400">{lang === 'id' ? 'Belum ada dokumen' : 'No documents yet'}</p></div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {items.map(item => (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
                <span className="text-3xl flex-shrink-0">{fileTypeIcon(item.fileType)}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-[#1b5e20] text-sm leading-snug">{lang === 'en' && item.titleEn ? item.titleEn : item.title}</h3>
                  {item.description && <p className="text-gray-500 text-xs mt-1">{item.description}</p>}
                  <div className="flex items-center gap-3 mt-3">
                    <span className="px-2 py-0.5 bg-[#1b5e20]/10 text-[#1b5e20] text-xs rounded-full font-medium">{item.category}</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Download className="w-3 h-3" />{item.downloadCount || 0}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(item)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    item.fileUrl ? 'bg-[#1b5e20] hover:bg-[#2e7d32] text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                  disabled={!item.fileUrl}
                >
                  <Download className="w-4 h-4" />
                  {item.fileUrl ? (lang === 'id' ? 'Unduh' : 'Download') : (lang === 'id' ? 'Segera' : 'Soon')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
