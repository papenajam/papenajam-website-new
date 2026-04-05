'use client';
import { useState, useEffect, useRef } from 'react';
import { X, ChevronRight, Phone, Mail, Clock, MapPin, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Widget Renderers ──────────────────────────────────────────────────────────
function FAQWidget({ settings, faqItems }) {
  const { lang } = useLanguage();
  const [openId, setOpenId] = useState(null);
  const s = settings || {};
  const items = faqItems.slice(0, s.limit || 4);
  return (
    <div className="p-4 space-y-2">
      {s.title && <p className="font-bold text-[#1e3a5f] text-sm mb-3">{lang === 'en' && s.titleEn ? s.titleEn : s.title}</p>}
      {items.length === 0 ? (
        <p className="text-gray-400 text-xs text-center py-4">Belum ada FAQ</p>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => {
            const q = lang === 'en' && item.questionEn ? item.questionEn : item.question;
            const a = lang === 'en' && item.answerEn ? item.answerEn : item.answer;
            const isOpen = openId === item.id;
            return (
              <div key={item.id} className="border border-gray-100 rounded-xl overflow-hidden">
                <button onClick={() => setOpenId(isOpen ? null : item.id)}
                  className="w-full text-left px-3 py-2.5 text-xs font-semibold text-[#1e3a5f] hover:bg-gray-50 flex items-start justify-between gap-2">
                  <span className="line-clamp-2 flex-1">{q}</span>
                  <span className={`text-[#c9a84c] flex-shrink-0 font-bold text-base leading-none mt-0.5 transition-transform ${isOpen ? 'rotate-45' : ''}`}>+</span>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 text-xs text-gray-600 leading-relaxed border-t border-gray-50 pt-2">{a}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {s.showAll !== false && (
        <a href="/faq" className="flex items-center gap-1 text-xs text-[#c9a84c] font-semibold hover:underline mt-2">
          {lang === 'id' ? 'Lihat Semua FAQ' : 'View All FAQ'} <ChevronRight className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

function StatsWidget({ settings, caseStats, visitorTotal }) {
  const { lang } = useLanguage();
  const s = settings || {};
  return (
    <div className="p-4 space-y-3">
      {s.title && <p className="font-bold text-[#1e3a5f] text-sm">{lang === 'en' && s.titleEn ? s.titleEn : s.title}</p>}
      {s.showVisitors !== false && (
        <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8e] rounded-xl p-3 text-center">
          <p className="text-2xl font-extrabold text-[#c9a84c]">{visitorTotal?.toLocaleString() || '0'}</p>
          <p className="text-white/70 text-xs mt-0.5">{lang === 'id' ? 'Total Kunjungan' : 'Total Visits'}</p>
          <p className="text-white/40 text-[10px]">{s.days || 30} {lang === 'id' ? 'hari terakhir' : 'days'}</p>
        </div>
      )}
      {s.showCases !== false && caseStats && (
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { val: caseStats.casesThisYear, label: lang === 'id' ? 'Perkara\nTahun Ini' : 'Cases\nThis Year', color: 'bg-blue-50 text-blue-700' },
            { val: caseStats.casesDone, label: lang === 'id' ? 'Perkara\nSelesai' : 'Cases\nDone', color: 'bg-green-50 text-green-700' },
            { val: caseStats.casesOngoing, label: lang === 'id' ? 'Perkara\nBerjalan' : 'Cases\nOngoing', color: 'bg-amber-50 text-amber-700' },
          ].map(({ val, label, color }) => (
            <div key={label} className={`rounded-xl p-2 text-center ${color}`}>
              <p className="font-extrabold text-lg">{val}</p>
              <p className="text-[9px] font-medium leading-tight whitespace-pre-line opacity-80">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactWidget({ settings, siteSettings }) {
  const { lang } = useLanguage();
  const s = settings || {};
  const items = [
    s.showPhone !== false && siteSettings.phone && { icon: Phone, label: siteSettings.phone, href: `tel:${siteSettings.phone.replace(/[^0-9+]/g,'')}`, color: 'text-emerald-600' },
    s.showEmail !== false && siteSettings.email && { icon: Mail, label: siteSettings.email, href: `mailto:${siteSettings.email}`, color: 'text-blue-600' },
    s.showHours !== false && { icon: Clock, label: lang === 'id' ? 'Sen-Kam: 08:00-16:00 WITA\nJumat: 08:00-11:00 WITA' : 'Mon-Thu: 08:00-16:00 WITA\nFri: 08:00-11:00 WITA', href: null, color: 'text-amber-600' },
    s.showAddress !== false && siteSettings.address && { icon: MapPin, label: siteSettings.address.substring(0, 60) + '...', href: `https://maps.google.com/?q=Pengadilan+Agama+Penajam`, color: 'text-rose-600' },
  ].filter(Boolean);
  return (
    <div className="p-4 space-y-3">
      {s.title && <p className="font-bold text-[#1e3a5f] text-sm">{lang === 'en' && s.titleEn ? s.titleEn : s.title}</p>}
      {items.map(({ icon: Icon, label, href, color }, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className={`w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 ${color}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          {href ? (
            <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener' : undefined}
              className="text-xs text-gray-600 hover:text-[#1e3a5f] leading-relaxed whitespace-pre-line">{label}</a>
          ) : (
            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{label}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function QuickLinksWidget({ settings }) {
  const { lang } = useLanguage();
  const s = settings || {};
  const links = s.links || [];
  return (
    <div className="p-4 space-y-2">
      {s.title && <p className="font-bold text-[#1e3a5f] text-sm mb-3">{lang === 'en' && s.titleEn ? s.titleEn : s.title}</p>}
      {links.length === 0 ? (
        <p className="text-gray-400 text-xs text-center py-4">Belum ada tautan</p>
      ) : (
        <div className="space-y-1">
          {links.map((link, i) => (
            <a key={i} href={link.url} target={link.external ? '_blank' : undefined} rel={link.external ? 'noopener' : undefined}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[#1e3a5f]/5 text-sm text-[#1e3a5f] font-medium transition-colors group">
              <span className="text-base">{link.icon || '🔗'}</span>
              <span className="flex-1 text-xs">{lang === 'en' && link.labelEn ? link.labelEn : link.label}</span>
              {link.external && <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-[#c9a84c]" />}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ComplaintWidget({ settings }) {
  const { lang } = useLanguage();
  const s = settings || {};
  return (
    <div className="p-4">
      {s.title && <p className="font-bold text-[#1e3a5f] text-sm mb-2">{lang === 'en' && s.titleEn ? s.titleEn : s.title}</p>}
      {s.description && <p className="text-xs text-gray-500 mb-4 leading-relaxed">{lang === 'en' && s.descriptionEn ? s.descriptionEn : s.description}</p>}
      <a href="/pengaduan" className="flex items-center justify-center gap-2 w-full bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white py-3 rounded-xl text-sm font-semibold transition-colors">
        📩 {s.buttonText || (lang === 'id' ? 'Kirim Pengaduan' : 'Submit Complaint')}
      </a>
    </div>
  );
}

function SocialWidget({ settings, siteSettings }) {
  const { lang } = useLanguage();
  const s = settings || {};
  const socials = [
    siteSettings.facebook && { label: 'Facebook', icon: '📘', color: '#1877f2', href: siteSettings.facebook },
    siteSettings.instagram && { label: 'Instagram', icon: '📸', color: '#e4405f', href: siteSettings.instagram },
    siteSettings.twitter && { label: 'Twitter / X', icon: '🐦', color: '#1da1f2', href: siteSettings.twitter },
    siteSettings.youtube && { label: 'YouTube', icon: '▶️', color: '#ff0000', href: siteSettings.youtube },
  ].filter(Boolean);
  return (
    <div className="p-4">
      {s.title && <p className="font-bold text-[#1e3a5f] text-sm mb-3">{lang === 'en' && s.titleEn ? s.titleEn : s.title}</p>}
      {socials.length === 0 ? (
        <p className="text-gray-400 text-xs text-center py-4">Belum ada media sosial<br /><span className="text-[10px]">Atur di Pengaturan → Media Sosial</span></p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {socials.map(s => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-100 hover:shadow-sm transition-all text-xs font-medium text-gray-700 hover:text-[#1e3a5f]">
              <span className="text-lg">{s.icon}</span> {s.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function HoursWidget({ settings }) {
  const { lang } = useLanguage();
  const s = settings || {};
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const isOpen = day >= 1 && day <= 4 && hour >= 8 && hour < 16 || day === 5 && hour >= 8 && hour < 11;
  const schedule = s.schedule || [
    { days: lang === 'id' ? 'Senin - Kamis' : 'Monday - Thursday', hours: '08:00 - 16:00 WITA' },
    { days: lang === 'id' ? 'Jumat' : 'Friday', hours: '08:00 - 11:00 WITA' },
    { days: lang === 'id' ? 'Sabtu - Minggu' : 'Saturday - Sunday', hours: lang === 'id' ? 'Tutup' : 'Closed' },
  ];
  return (
    <div className="p-4">
      {s.title && <p className="font-bold text-[#1e3a5f] text-sm mb-3">{lang === 'en' && s.titleEn ? s.titleEn : s.title}</p>}
      <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl ${isOpen ? 'bg-green-50' : 'bg-red-50'}`}>
        <div className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
        <span className={`text-xs font-bold ${isOpen ? 'text-green-700' : 'text-red-700'}`}>
          {isOpen ? (lang === 'id' ? 'Sedang Buka' : 'Currently Open') : (lang === 'id' ? 'Sedang Tutup' : 'Currently Closed')}
        </span>
      </div>
      <div className="space-y-2">
        {schedule.map((item, i) => (
          <div key={i} className="flex justify-between items-center text-xs">
            <span className="text-gray-500">{item.days}</span>
            <span className={`font-semibold ${item.hours === 'Tutup' || item.hours === 'Closed' ? 'text-red-500' : 'text-[#1e3a5f]'}`}>{item.hours}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Widget Registry ───────────────────────────────────────────────────────────
const WIDGET_RENDERERS = {
  faq: (widget, data) => <FAQWidget settings={widget.settings} faqItems={data.faqItems} />,
  stats: (widget, data) => <StatsWidget settings={widget.settings} caseStats={data.caseStats} visitorTotal={data.visitorTotal} />,
  contact: (widget, data) => <ContactWidget settings={widget.settings} siteSettings={data.siteSettings} />,
  quicklinks: (widget, data) => <QuickLinksWidget settings={widget.settings} />,
  complaint: (widget, data) => <ComplaintWidget settings={widget.settings} />,
  social: (widget, data) => <SocialWidget settings={widget.settings} siteSettings={data.siteSettings} />,
  hours: (widget, data) => <HoursWidget settings={widget.settings} />,
};

// ─── Main Floating Sidebar ─────────────────────────────────────────────────────
export default function FloatingSidebar() {
  const { lang } = useLanguage();
  const [widgets, setWidgets] = useState([]);
  const [activeWidget, setActiveWidget] = useState(null);
  const [data, setData] = useState({ faqItems: [], caseStats: null, visitorTotal: 0, siteSettings: {} });
  const [loaded, setLoaded] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    loadAll();
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        // check if click is on a tab button
        if (!e.target.closest('[data-sidebar-tab]')) {
          setActiveWidget(null);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadAll() {
    try {
      const [widgetsRes, faqRes, settingsRes, casesRes, statsRes] = await Promise.all([
        fetch('/api/sidebar-widgets'),
        fetch('/api/faq'),
        fetch('/api/settings'),
        fetch('/api/cases'),
        fetch('/api/analytics?days=30').catch(() => ({ ok: false })),
      ]);
      const [widgetsData, faqData, settingsData, casesData] = await Promise.all([
        widgetsRes.json(), faqRes.json(), settingsRes.json(), casesRes.json(),
      ]);
      setWidgets(widgetsData.items || []);
      const allCases = casesData.items || [];
      const yr = String(new Date().getFullYear());
      const caseStats = {
        casesThisYear: allCases.filter(c => c.tahun === yr).length,
        casesDone: allCases.filter(c => c.status === 'selesai').length,
        casesOngoing: allCases.filter(c => c.status === 'berjalan').length,
      };
      let visitorTotal = 0;
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        visitorTotal = statsData.total || 0;
      }
      setData({ faqItems: faqData.items || [], caseStats, visitorTotal, siteSettings: settingsData || {} });
    } catch (e) { console.error(e); }
    finally { setLoaded(true); }
  }

  if (!loaded || widgets.length === 0) return null;

  const activeWidgetData = widgets.find(w => w.id === activeWidget);

  return (
    <div className="fixed right-0 top-1/2 -translate-y-1/2 z-[9990] flex items-center">
      {/* Panel */}
      {activeWidget && activeWidgetData && (
        <div
          ref={panelRef}
          className="w-72 max-h-[80vh] bg-white rounded-l-2xl shadow-2xl border border-r-0 border-gray-100 overflow-y-auto flex flex-col"
          style={{ marginRight: '48px' }}
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-tl-2xl flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">{activeWidgetData.icon}</span>
              <span className="font-bold text-[#1e3a5f] text-sm">
                {lang === 'en' && activeWidgetData.labelEn ? activeWidgetData.labelEn : activeWidgetData.label}
              </span>
            </div>
            <button onClick={() => setActiveWidget(null)}
              className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-500 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto">
            {WIDGET_RENDERERS[activeWidgetData.type]?.(activeWidgetData, data) || (
              <div className="p-4 text-center text-gray-400 text-sm">Widget tidak dikenal</div>
            )}
          </div>
        </div>
      )}

      {/* Tab Buttons */}
      <div className="flex flex-col gap-1.5">
        {widgets.map(widget => {
          const isActive = activeWidget === widget.id;
          return (
            <button
              key={widget.id}
              data-sidebar-tab="true"
              onClick={() => setActiveWidget(isActive ? null : widget.id)}
              title={lang === 'en' && widget.labelEn ? widget.labelEn : widget.label}
              className={`relative flex flex-col items-center justify-center w-12 rounded-l-xl shadow-md transition-all duration-200 border border-r-0 group ${
                isActive
                  ? 'shadow-xl scale-105'
                  : 'hover:w-14 hover:shadow-lg'
              }`}
              style={{
                background: isActive ? widget.color || '#1e3a5f' : '#ffffff',
                borderColor: isActive ? widget.color || '#1e3a5f' : '#e5e7eb',
                minHeight: '64px',
              }}
            >
              <span className="text-xl mb-1">{widget.icon}</span>
              <span
                className="text-[9px] font-bold leading-tight text-center px-1"
                style={{ color: isActive ? '#ffffff' : (widget.color || '#1e3a5f'), writingMode: 'horizontal-tb' }}
              >
                {(lang === 'en' && widget.labelEn ? widget.labelEn : widget.label).substring(0, 8)}
              </span>
              {isActive && (
                <div
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-4 rounded-r-full"
                  style={{ background: widget.color || '#1e3a5f' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
