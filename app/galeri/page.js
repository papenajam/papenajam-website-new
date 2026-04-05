'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ImageIcon } from 'lucide-react';

export default function GaleriPage() {
  const { lang } = useLanguage();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    fetch('/api/gallery').then(r => r.json()).then(d => {
      setItems(d.items || []);
      setCategories(d.categories || []);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = filter ? items.filter(i => i.category === filter) : items;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1e3a5f] py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-extrabold text-white mb-3">{lang === 'id' ? 'Galeri Foto' : 'Photo Gallery'}</h1>
          <p className="text-white/70">{lang === 'id' ? 'Dokumentasi kegiatan Pengadilan Agama Penajam' : 'Documentation of Penajam Religious Court activities'}</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Filter */}
        <div className="flex gap-2 mb-8 flex-wrap justify-center">
          <button onClick={() => setFilter('')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${ !filter ? 'bg-[#1e3a5f] text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200' }`}>{lang === 'id' ? 'Semua' : 'All'}</button>
          {categories.map(c => (<button key={c} onClick={() => setFilter(c)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${ filter === c ? 'bg-[#1e3a5f] text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200' }`}>{c}</button>))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <div key={i} className="aspect-square bg-gray-200 rounded-2xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center"><ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" /><p className="text-gray-400">{lang === 'id' ? 'Belum ada foto' : 'No photos yet'}</p></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(item => (
              <button key={item.id} onClick={() => setLightbox(item)} className="group relative aspect-square rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all">
                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <p className="text-white text-xs font-semibold text-left line-clamp-2">{lang === 'en' && item.titleEn ? item.titleEn : item.title}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox.imageUrl} alt={lightbox.title} className="w-full max-h-[80vh] object-contain rounded-xl" />
            <div className="text-white text-center mt-4">
              <p className="font-bold text-lg">{lang === 'en' && lightbox.titleEn ? lightbox.titleEn : lightbox.title}</p>
              {lightbox.description && <p className="text-white/70 text-sm mt-1">{lightbox.description}</p>}
            </div>
            <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl">&times;</button>
          </div>
        </div>
      )}
    </div>
  );
}
