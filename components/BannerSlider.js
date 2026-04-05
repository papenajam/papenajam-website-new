'use client';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function BannerSlider({ settings }) {
  const { lang } = useLanguage();
  const [banners, setBanners] = useState([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/banners').then(r=>r.json()).then(d=>{ setBanners(d.items||[]); setLoading(false); }).catch(()=>setLoading(false));
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => setCurrent(c => (c+1) % banners.length), 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (loading || banners.length === 0) return null;

  const banner = banners[current];

  return (
    <section className="relative overflow-hidden" style={{ minHeight: 400, background: banner.bgColor||'#1e3a5f' }}>
      {banner.imageUrl && (
        <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage:`url(${banner.imageUrl})` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
      <div className="container mx-auto px-4 py-24 relative z-10 flex items-center min-h-[400px]">
        <div className="max-w-2xl">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight" style={{ color: banner.textColor||'#ffffff' }}>{banner.title}</h2>
          {banner.subtitle && <p className="text-lg mb-8 opacity-80" style={{ color: banner.textColor||'#ffffff' }}>{banner.subtitle}</p>}
          {banner.buttonText && (
            <a href={banner.buttonUrl||'#'} target={banner.buttonUrl?.startsWith('http')?'_blank':undefined} rel={banner.buttonUrl?.startsWith('http')?'noopener':undefined}
              className="inline-flex items-center bg-[#c9a84c] hover:bg-[#b8962f] text-white font-bold px-8 py-4 rounded-xl text-base transition-colors">
              {banner.buttonText}
            </a>
          )}
        </div>
      </div>
      {banners.length > 1 && (
        <>
          <button onClick={() => setCurrent(c=>(c-1+banners.length)%banners.length)} className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors"><ChevronLeft className="w-5 h-5"/></button>
          <button onClick={() => setCurrent(c=>(c+1)%banners.length)} className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors"><ChevronRight className="w-5 h-5"/></button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {banners.map((_,i)=>(<button key={i} onClick={()=>setCurrent(i)} className={`w-2 h-2 rounded-full transition-all ${i===current?'bg-white w-6':'bg-white/50'}`}/>))}
          </div>
        </>
      )}
    </section>
  );
}
