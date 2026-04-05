'use client';
import { useState, useEffect } from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
   SHARED PUBLIC BLOCK RENDERER
   Used by: Page Builder canvas (live preview), /halaman/[slug], DynamicHomepage
   ───────────────────────────────────────────────────────────────────────────── */

/* ── Padding map ── */
const PAD_MAP = {
  none: { padding: '0' },
  xs:   { padding: '16px' },
  sm:   { padding: '32px 16px' },
  md:   { padding: '48px 24px' },
  lg:   { padding: '64px 32px' },
  xl:   { padding: '96px 48px' },
};

/* ── Breakpoint detection hook ── */
function useBreakpoint() {
  const [bp, setBp] = useState(() => {
    if (typeof window === 'undefined') return 'desktop';
    const w = window.innerWidth;
    return w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
  });
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      setBp(w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop');
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return bp;
}

/* ── Style resolver — reads block.settings.style + responsive overrides ── */
function resolveStyle(s, breakpoint = 'desktop') {
  const st = s?.style || {};
  const r  = st.responsive || {};

  // Pick breakpoint-specific overrides (fall back to desktop style)
  const titleSize = (breakpoint === 'mobile' && r.mobileTitleSize) ? r.mobileTitleSize
    : (breakpoint === 'tablet' && r.tabletTitleSize) ? r.tabletTitleSize
    : st.titleSize;

  const bodySize = (breakpoint === 'mobile' && r.mobileBodySize) ? r.mobileBodySize
    : (breakpoint === 'tablet' && r.tabletBodySize) ? r.tabletBodySize
    : st.bodySize;

  const padding = (breakpoint === 'mobile' && r.mobilePadding) ? r.mobilePadding
    : (breakpoint === 'tablet' && r.tabletPadding) ? r.tabletPadding
    : st.padding;

  const sectionStyle = {
    ...(st.bgColor   ? { background: st.bgColor } : {}),
    ...(st.textColor ? { color: st.textColor }     : {}),
    ...(padding && PAD_MAP[padding] ? PAD_MAP[padding] : {}),
    ...(st.textAlign ? { textAlign: st.textAlign } : {}),
  };
  const titleStyle = {
    ...(titleSize      ? { fontSize:   titleSize      } : {}),
    ...(st.titleWeight ? { fontWeight: st.titleWeight } : {}),
    ...(st.titleColor  ? { color:      st.titleColor  } : {}),
  };
  const bodyStyle = {
    ...(bodySize       ? { fontSize:   bodySize       } : {}),
    ...(st.bodyWeight  ? { fontWeight: st.bodyWeight  } : {}),
  };
  return { sectionStyle, titleStyle, bodyStyle };
}

/* ── Merge style objects safely ── */
function mergeStyle(...objs) {
  return Object.assign({}, ...objs.filter(Boolean));
}

/* ── Responsive visibility wrapper ──
   All class strings are listed explicitly so Tailwind JIT picks them up.      */
const VISIBILITY_CLASSES = {
  'ttt': '',
  'ttf': 'lg:hidden',
  'tft': 'md:hidden lg:block',
  'tff': 'md:hidden',
  'ftt': 'hidden md:block',
  'ftf': 'hidden md:block lg:hidden',
  'fft': 'hidden lg:block',
  'fff': 'hidden',
};

function ResponsiveWrapper({ settings, children }) {
  const r    = settings?.style?.responsive || {};
  const showM = r.showMobile  !== false;
  const showT = r.showTablet  !== false;
  const showD = r.showDesktop !== false;
  const key  = `${showM?'t':'f'}${showT?'t':'f'}${showD?'t':'f'}`;
  const cls  = VISIBILITY_CLASSES[key] || '';
  if (!cls) return <>{children}</>;
  return <div className={cls}>{children}</div>;
}

/* ────────────────────────── BLOCK COMPONENTS ────────────────────────────────*/

function HeroBlock({ settings: s, breakpoint }) {
  const { sectionStyle, titleStyle } = resolveStyle(s, breakpoint);
  const defaultBg = s.backgroundImage
    ? `linear-gradient(rgba(0,0,0,0.55),rgba(0,0,0,0.55)), url(${s.backgroundImage}) center/cover no-repeat`
    : 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 60%, #388e3c 100%)';

  return (
    <section
      className="relative py-20 md:py-28 flex items-center justify-center text-center overflow-hidden"
      style={mergeStyle({ background: defaultBg }, sectionStyle)}
    >
      <div className="relative z-10 container mx-auto px-6 max-w-4xl">
        {s.tag && (
          <span className="inline-block text-xs font-bold tracking-widest uppercase text-[#d4a017] bg-white/10 px-4 py-1.5 rounded-full mb-5">
            {s.tag}
          </span>
        )}
        <h1
          className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-4 drop-shadow-md"
          style={titleStyle}
        >
          {s.title || 'Judul Hero'}
        </h1>
        {s.subtitle && (
          <p className="text-white/80 text-lg md:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
            {s.subtitle}
          </p>
        )}
        {s.buttonText && s.buttonLink && (
          <a
            href={s.buttonLink}
            className="inline-block bg-[#d4a017] hover:bg-[#b88010] text-white font-bold px-8 py-3.5 rounded-xl text-base transition-all hover:shadow-lg hover:-translate-y-0.5"
          >
            {s.buttonText}
          </a>
        )}
      </div>
    </section>
  );
}

function TextBlock({ settings: s, breakpoint }) {
  const { sectionStyle, titleStyle, bodyStyle } = resolveStyle(s, breakpoint);
  return (
    <section className="py-12 bg-white" style={sectionStyle}>
      <div className="container mx-auto px-4 max-w-3xl">
        {s.title && (
          <h2 className="text-2xl md:text-3xl font-bold text-[#1b5e20] mb-5" style={titleStyle}>
            {s.title}
          </h2>
        )}
        <div
          className="prose prose-lg prose-headings:text-[#1b5e20] prose-a:text-[#d4a017] max-w-none text-gray-700 leading-relaxed"
          style={bodyStyle}
          dangerouslySetInnerHTML={{ __html: s.content || '<p>Tambahkan konten teks di sini...</p>' }}
        />
      </div>
    </section>
  );
}

function ImageBlock({ settings: s, breakpoint }) {
  const { sectionStyle } = resolveStyle(s, breakpoint);
  const align = s.alignment === 'left' ? 'items-start' : s.alignment === 'right' ? 'items-end' : 'items-center';
  return (
    <section className="py-10 bg-white" style={sectionStyle}>
      <div className="container mx-auto px-4">
        <div className={`flex flex-col ${align} gap-3`}>
          {s.src
            ? <img src={s.src} alt={s.caption || ''} className="max-w-full rounded-2xl shadow-md max-h-[500px] object-cover" />
            : <div className="w-full max-w-lg h-48 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 border-2 border-dashed">Belum ada gambar</div>
          }
          {s.caption && <p className="text-sm text-gray-400 italic">{s.caption}</p>}
        </div>
      </div>
    </section>
  );
}

function CardGridBlock({ settings: s, breakpoint }) {
  const { sectionStyle, titleStyle, bodyStyle } = resolveStyle(s, breakpoint);
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[s.columns || 3] || 'sm:grid-cols-2 lg:grid-cols-3';
  return (
    <section className="py-14 bg-gray-50" style={sectionStyle}>
      <div className="container mx-auto px-4">
        {s.title && (
          <h2 className="text-2xl md:text-3xl font-bold text-[#1b5e20] text-center mb-10" style={titleStyle}>
            {s.title}
          </h2>
        )}
        <div className={`grid grid-cols-1 ${cols} gap-6 max-w-5xl mx-auto`}>
          {(s.items || []).map((item) => (
            <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-center">
              {item.icon  && <div className="text-4xl mb-4">{item.icon}</div>}
              {item.image && <img src={item.image} alt={item.title || ''} className="w-16 h-16 rounded-xl object-cover mx-auto mb-4" />}
              <h3 className="font-bold text-[#1b5e20] text-lg mb-2" style={titleStyle}>{item.title}</h3>
              {item.description && <p className="text-gray-500 text-sm leading-relaxed" style={bodyStyle}>{item.description}</p>}
              {item.link && <a href={item.link} className="inline-block mt-3 text-sm text-[#d4a017] font-semibold hover:text-[#b88010]">Selengkapnya →</a>}
            </div>
          ))}
          {!(s.items || []).length && (
            <div className="col-span-3 py-10 text-center text-gray-400 border-2 border-dashed rounded-2xl">Tambahkan kartu di pengaturan</div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatsBlock({ settings: s, breakpoint }) {
  const { sectionStyle, titleStyle, bodyStyle } = resolveStyle(s, breakpoint);
  const count = Math.min((s.items || []).length || 4, 4);
  const bgOverride = s?.style?.bgColor || s.bgColor;
  return (
    <section
      className="py-14"
      style={mergeStyle({ background: bgOverride || '#1b5e20' }, sectionStyle)}
    >
      <div className="container mx-auto px-4">
        {s.title && (
          <h2 className="text-xl font-bold text-white text-center mb-8" style={titleStyle}>{s.title}</h2>
        )}
        <div className={`grid grid-cols-2 md:grid-cols-${count} gap-6 max-w-4xl mx-auto`}>
          {(s.items || []).map((item) => (
            <div key={item.id} className="text-center">
              <div className="text-3xl md:text-5xl font-extrabold text-[#d4a017] mb-2" style={titleStyle}>{item.number}</div>
              <div className="text-white/70 text-sm font-medium" style={bodyStyle}>{item.label}</div>
            </div>
          ))}
          {!(s.items || []).length && (
            <div className="col-span-4 py-8 text-center text-white/40">Tambahkan statistik di pengaturan</div>
          )}
        </div>
      </div>
    </section>
  );
}

function CtaBlock({ settings: s, breakpoint }) {
  const { sectionStyle, titleStyle, bodyStyle } = resolveStyle(s, breakpoint);
  const bgOverride = s?.style?.bgColor || s.bgColor;
  return (
    <section
      className="py-16"
      style={mergeStyle({ background: bgOverride || '#1b5e20' }, sectionStyle)}
    >
      <div className="container mx-auto px-4 text-center text-white">
        {s.title && (
          <h2 className="text-2xl md:text-4xl font-extrabold mb-4" style={titleStyle}>{s.title}</h2>
        )}
        {s.subtitle && (
          <p className="text-white/75 mb-8 text-lg max-w-xl mx-auto" style={bodyStyle}>{s.subtitle}</p>
        )}
        {s.buttonText && s.buttonLink && (
          <a href={s.buttonLink} className="inline-block bg-[#d4a017] hover:bg-[#b88010] text-white font-bold px-10 py-4 rounded-xl text-base transition-all hover:shadow-xl">
            {s.buttonText}
          </a>
        )}
        {!s.title && <p className="text-white/40">Atur teks CTA di pengaturan</p>}
      </div>
    </section>
  );
}

function GalleryBlock({ settings: s, breakpoint }) {
  const { sectionStyle, titleStyle } = resolveStyle(s, breakpoint);
  const cols = { 2: 'grid-cols-2', 3: 'grid-cols-2 md:grid-cols-3', 4: 'grid-cols-2 md:grid-cols-4' }[s.columns] || 'grid-cols-2 md:grid-cols-3';
  return (
    <section className="py-10 bg-white" style={sectionStyle}>
      <div className="container mx-auto px-4">
        {s.title && (
          <h2 className="text-2xl font-bold text-[#1b5e20] text-center mb-8" style={titleStyle}>{s.title}</h2>
        )}
        <div className={`grid ${cols} gap-3 md:gap-4`}>
          {(s.images || []).map((img, i) => (
            <img key={i} src={img} alt="" className="w-full aspect-square object-cover rounded-xl hover:scale-105 transition-transform duration-300" />
          ))}
          {!(s.images || []).length && (
            <div className="col-span-3 py-12 text-center text-gray-400 border-2 border-dashed rounded-2xl">Tambahkan gambar di pengaturan</div>
          )}
        </div>
      </div>
    </section>
  );
}

function AccordionBlock({ settings: s, breakpoint }) {
  const { sectionStyle, titleStyle, bodyStyle } = resolveStyle(s, breakpoint);
  const [openIdx, setOpenIdx] = useState(null);
  return (
    <section className="py-14 bg-white" style={sectionStyle}>
      <div className="container mx-auto px-4 max-w-3xl">
        {s.title && (
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#1b5e20] text-center mb-8" style={titleStyle}>{s.title}</h2>
        )}
        <div className="space-y-2">
          {(s.items || []).map((item, i) => (
            <div key={item.id || i} className={`border rounded-2xl overflow-hidden transition-all ${openIdx === i ? 'border-[#1b5e20]/40 shadow-sm' : 'border-gray-200'}`}>
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${openIdx === i ? 'bg-[#1b5e20]/5' : 'bg-white hover:bg-gray-50'}`}
              >
                <span className={`font-semibold text-base ${openIdx === i ? 'text-[#1b5e20]' : 'text-gray-800'}`} style={bodyStyle}>
                  {item.question || 'Pertanyaan...'}
                </span>
                <span className={`ml-4 flex-shrink-0 transition-transform duration-300 text-sm ${openIdx === i ? 'rotate-180 text-[#1b5e20]' : 'text-gray-400'}`}>▼</span>
              </button>
              {openIdx === i && (
                <div className="px-5 py-4 border-t border-[#1b5e20]/10 bg-white">
                  {item.answer?.includes('<')
                    ? <div className="prose prose-sm max-w-none text-gray-600" style={bodyStyle} dangerouslySetInnerHTML={{ __html: item.answer }} />
                    : <p className="text-gray-600 leading-relaxed" style={bodyStyle}>{item.answer}</p>}
                </div>
              )}
            </div>
          ))}
          {!(s.items || []).length && (
            <div className="py-12 text-center text-gray-400 border-2 border-dashed rounded-2xl">Tambahkan item accordion di pengaturan</div>
          )}
        </div>
      </div>
    </section>
  );
}

function TabsBlock({ settings: s, breakpoint }) {
  const { sectionStyle, titleStyle, bodyStyle } = resolveStyle(s, breakpoint);
  const [activeTab, setActiveTab] = useState(0);
  const tabs = s.tabs || [];
  return (
    <section className="py-14 bg-white" style={sectionStyle}>
      <div className="container mx-auto px-4 max-w-4xl">
        {s.title && (
          <h2 className="text-2xl md:text-3xl font-bold text-[#1b5e20] text-center mb-6" style={titleStyle}>{s.title}</h2>
        )}
        {tabs.length > 0 ? (
          <>
            <div className="flex gap-1 border-b-2 border-gray-200 overflow-x-auto mb-0">
              {tabs.map((tab, i) => (
                <button key={tab.id || i} onClick={() => setActiveTab(i)}
                  className={`px-5 py-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 -mb-0.5 ${i === activeTab ? 'border-[#1b5e20] text-[#1b5e20] bg-[#1b5e20]/5' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  style={i === activeTab ? titleStyle : {}}>
                  {tab.label || `Tab ${i + 1}`}
                </button>
              ))}
            </div>
            <div className="bg-white border border-t-0 border-gray-200 rounded-b-2xl p-6 min-h-[120px]">
              {tabs[activeTab]?.content?.includes('<')
                ? <div className="prose prose-lg max-w-none text-gray-700" style={bodyStyle} dangerouslySetInnerHTML={{ __html: tabs[activeTab].content }} />
                : <p className="text-gray-700 leading-relaxed" style={bodyStyle}>{tabs[activeTab]?.content}</p>}
            </div>
          </>
        ) : (
          <div className="py-12 text-center text-gray-400 border-2 border-dashed rounded-2xl">Tambahkan tab di pengaturan</div>
        )}
      </div>
    </section>
  );
}

function MapBlock({ settings: s, breakpoint }) {
  const { sectionStyle, titleStyle } = resolveStyle(s, breakpoint);
  return (
    <section className="py-10 bg-white" style={sectionStyle}>
      <div className="container mx-auto px-4">
        {s.title && (
          <h2 className="text-2xl font-bold text-[#1b5e20] text-center mb-5" style={titleStyle}>
            📍 {s.title}
          </h2>
        )}
        {s.embedUrl ? (
          <div className="rounded-2xl overflow-hidden shadow-md border border-gray-200" style={{ height: `${s.height || 400}px` }}>
            <iframe src={s.embedUrl} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" title={s.title || 'Peta'} />
          </div>
        ) : (
          <div className="bg-gray-100 rounded-2xl flex flex-col items-center justify-center gap-3 border-2 border-dashed" style={{ height: `${s.height || 400}px` }}>
            <div className="text-5xl">📍</div>
            <p className="text-gray-500 font-medium">Paste URL Embed Google Maps di pengaturan</p>
          </div>
        )}
      </div>
    </section>
  );
}

function CountdownBlock({ settings: s, breakpoint }) {
  const { sectionStyle, titleStyle, bodyStyle } = resolveStyle(s, breakpoint);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    if (!s.targetDate) return;
    function calc() {
      const diff = new Date(s.targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }
      setTimeLeft({
        days:    Math.floor(diff / 86400000),
        hours:   Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        expired: false,
      });
    }
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [s.targetDate]);

  const bgOverride = s?.style?.bgColor || s.bgColor;
  const units = [
    s.showDays    !== false && { label: 'Hari',  value: timeLeft.days },
    s.showHours   !== false && { label: 'Jam',   value: timeLeft.hours },
    s.showMinutes !== false && { label: 'Menit', value: timeLeft.minutes },
    s.showSeconds !== false && { label: 'Detik', value: timeLeft.seconds },
  ].filter(Boolean);

  return (
    <section
      className="py-14"
      style={mergeStyle({ background: bgOverride || '#1b5e20' }, sectionStyle)}
    >
      <div className="container mx-auto px-4 text-center text-white">
        {s.title && (
          <h2 className="text-2xl md:text-3xl font-extrabold mb-2" style={titleStyle}>{s.title}</h2>
        )}
        {s.description && (
          <p className="text-white/70 mb-8 max-w-xl mx-auto" style={bodyStyle}>{s.description}</p>
        )}
        {!s.targetDate ? (
          <p className="text-white/40 text-sm">→ Atur tanggal di pengaturan</p>
        ) : timeLeft.expired ? (
          <div className="text-2xl font-bold text-[#d4a017]">🎉 Acara Telah Berlangsung!</div>
        ) : (
          <div className="flex justify-center gap-3 md:gap-5 flex-wrap">
            {units.map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center bg-white/10 rounded-2xl px-5 md:px-8 py-4 md:py-6 min-w-[80px] md:min-w-[110px] border border-white/20">
                <span className="text-4xl md:text-6xl font-extrabold text-[#d4a017] tabular-nums leading-none">{String(value).padStart(2, '0')}</span>
                <span className="text-white/60 text-xs uppercase tracking-widest mt-2 font-semibold">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── BLOCK MAP ── */
const BLOCK_MAP = {
  hero:      HeroBlock,
  text:      TextBlock,
  image:     ImageBlock,
  cardgrid:  CardGridBlock,
  stats:     StatsBlock,
  cta:       CtaBlock,
  gallery:   GalleryBlock,
  accordion: AccordionBlock,
  tabs:      TabsBlock,
  map:       MapBlock,
  countdown: CountdownBlock,
};

/* ── Main exported renderer ── */
export default function BlockRenderer({ block }) {
  const breakpoint = useBreakpoint();
  const s = block?.settings || {};
  const Component = BLOCK_MAP[block?.type];
  if (!Component) return null;
  return (
    <ResponsiveWrapper settings={s}>
      <Component settings={s} breakpoint={breakpoint} />
    </ResponsiveWrapper>
  );
}

export {
  HeroBlock, TextBlock, ImageBlock, CardGridBlock, StatsBlock,
  CtaBlock, GalleryBlock, AccordionBlock, TabsBlock, MapBlock, CountdownBlock,
};
