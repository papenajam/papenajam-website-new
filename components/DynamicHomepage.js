'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Scale, Phone, Mail, MapPin, Search, ChevronRight,
  FileText, Calendar, DollarSign, Package, Shield, Monitor,
  Users, Stamp, Building2, BookOpen, Award, CheckCircle,
  Clock, ClipboardList, ArrowRight, ExternalLink, Globe, Newspaper,
  Download, ChevronDown, Plus, X, MessageSquare
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import MegaMenuNavbar from '@/components/MegaMenu';
import { sanitizeHTML } from '@/lib/sanitize';

const ICON_MAP = {
  FileText, Calendar, DollarSign, Package, Shield, Monitor,
  Users, Stamp, Scale, Building2, BookOpen, Globe, Award
};

const HERO_FALLBACK = 'https://images.unsplash.com/photo-1667849921481-9e13c239ee3d?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1400';

// Default blocks jika homepage belum dikonfigurasi admin
const DEFAULT_BLOCKS = [
  { id: 'default-hero',      type: 'hero_home',     settings: { title: 'Pengadilan Agama Penajam', subtitle: 'Memberikan Keadilan yang Cepat, Sederhana, dan Berbiaya Ringan untuk Masyarakat Kabupaten Penajam Paser Utara', buttonText: 'Lihat Layanan', buttonLink: '#layanan', button2Text: 'Hubungi Kami', button2Link: '#kontak', showStats: true } },
  { id: 'default-banner',    type: 'banner_slider', settings: { autoPlay: true, showArrows: true, showDots: true } },
  { id: 'default-services',  type: 'services_grid', settings: { title: 'Layanan Kami', subtitle: 'Berbagai layanan tersedia untuk masyarakat' } },
  { id: 'default-news',      type: 'news_ann',      settings: { title: 'Berita & Pengumuman', newsCount: 4, annCount: 5 } },
  { id: 'default-gallery',   type: 'gallery_grid',  settings: { title: 'Galeri Foto', subtitle: 'Dokumentasi kegiatan kami', limit: 8, columns: 4, showViewAll: true } },
  { id: 'default-docs',      type: 'document_list', settings: { title: 'Dokumen & Peraturan', subtitle: 'Unduh dokumen resmi Pengadilan Agama Penajam', limit: 6, showViewAll: true } },
  { id: 'default-perkara',   type: 'case_search',   settings: { title: 'Informasi Perkara', subtitle: 'Cari informasi perkara Anda dengan mudah' } },
  { id: 'default-contact',   type: 'contact_info',  settings: { title: 'Hubungi Kami', subtitle: 'Kami siap melayani Anda', bgColor: '#f9fafb' } },
];

// ============================================================
// DYNAMIC BLOCK RENDERERS
// ============================================================

function HeroHomeBlock({ settings, stats }) {
  const s = settings || {};
  const { t, lang } = useLanguage();
  return (
    <header id="beranda" role="banner" className="relative min-h-screen flex items-center" style={{ scrollMarginTop: '80px' }}>
      <div className="absolute inset-0 bg-gradient-to-br from-pa-green-dark via-pa-green to-pa-green-mid" aria-hidden="true" />
      {s.backgroundImage && (
        <div className="absolute inset-0 opacity-20 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url('${s.backgroundImage}')` }} role="img" aria-label={lang === 'id' ? 'Gedung Pengadilan Agama Penajam' : 'Penajam Religious Court building'} />
      )}
      {!s.backgroundImage && (
        <div className="absolute inset-0 opacity-20 bg-cover bg-center" style={{ backgroundImage: `url('${HERO_FALLBACK}')` }} aria-hidden="true" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-pa-green-dark/60" aria-hidden="true" />
      <div className="container mx-auto px-4 relative z-10 pt-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white/80 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-white/10">
            <Globe className="w-4 h-4 text-pa-gold" aria-hidden="true" />
            {t('underMA')}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-4">
            {s.title || t('siteName')}
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed">
            {s.subtitle || t('tagline')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {s.buttonText && (
              <a href={s.buttonLink || '#layanan'} className="inline-flex items-center justify-center bg-pa-orange hover:bg-pa-orange-dark text-white text-base font-bold px-8 py-4 rounded-xl shadow-lg min-h-[52px] transition-colors">
                {s.buttonText} <ChevronRight className="ml-2 w-5 h-5" aria-hidden="true" />
              </a>
            )}
            {s.button2Text && (
              <a href={s.button2Link || '#kontak'} className="inline-flex items-center justify-center border-2 border-white/30 text-white hover:bg-white/10 text-base font-bold px-8 py-4 rounded-xl min-h-[52px] transition-colors">
                {s.button2Text}
              </a>
            )}
          </div>
          {s.showStats !== false && (
            <div className="mt-16 grid grid-cols-3 gap-4 max-w-2xl mx-auto" role="region" aria-label={lang === 'id' ? 'Statistik perkara' : 'Case statistics'}>
              {(() => {
                const isLoading = (stats?.casesThisYear ?? 0) === 0 && (stats?.casesDone ?? 0) === 0 && (stats?.casesOngoing ?? 0) === 0;
                return [
                { label: t('hero.caseThisYear'), val: stats?.casesThisYear ?? 0 },
                { label: t('hero.caseDone'), val: stats?.casesDone ?? 0 },
                { label: t('hero.caseOngoing'), val: stats?.casesOngoing ?? 0 },
              ].map(({ label, val }) => (

                  <div key={label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                    {isLoading ? (
                      <div className="animate-pulse">
                        <div className="h-9 w-16 mx-auto bg-white/20 rounded-lg" />
                        <p className="text-white/80 text-xs mt-1">{label}</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-3xl font-extrabold text-pa-gold">{val}</p>
                        <p className="text-white/80 text-xs mt-1">{label}</p>
                      </>
                    )}
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function NewsAnnBlock({ settings, news, announcements, formatDate }) {
  const s = settings || {};
  const { t, lang } = useLanguage();
  return (
    <section id="berita" aria-labelledby="news-ann-h" className="py-20 bg-gray-50" style={{ scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 id="news-ann-h" className="text-3xl font-extrabold text-pa-green mb-3">
            {s.title || (lang === 'id' ? 'Berita & Pengumuman' : 'News & Announcements')}
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto text-sm">
            {lang === 'id' ? 'Informasi terbaru dan pengumuman resmi' : 'Latest news and official announcements'}
          </p>
        </div>
        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* News Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-pa-green">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><Newspaper className="w-4 h-4 text-pa-gold" /></div>
                <div>
                  <h3 className="font-bold text-white text-sm">{t('news.title')}</h3>
                  <p className="text-white/80 text-xs">{t('news.subtitle')}</p>
                </div>
              </div>
              <a href="/berita" className="text-pa-gold text-xs font-semibold hover:underline flex items-center gap-1 min-h-[44px]">
                {t('news.allNews')} <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="flex-1 divide-y divide-gray-50">
              {!news.length ? (
                <div className="p-10 text-center text-gray-500 text-sm">{t('news.noNews')}</div>
              ) : (
                <ul className="list-none p-0 m-0" role="list">
                  {news.slice(0, s.newsCount || 4).map(item => (
                    <li key={item.id}>
                      <a href={`/berita/${item.id}`} aria-label={`${t('news.readMore')}: ${item.title}`} className="flex gap-3.5 px-5 py-4 hover:bg-gray-50 transition-colors group">
                        {item.image ? (
                          <div className="w-20 h-16 rounded-xl overflow-hidden flex-shrink-0">
                            <img src={item.image} alt={item.imageAlt || item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" width="80" height="64" />
                          </div>
                        ) : (
                          <div className="w-20 h-16 rounded-xl bg-pa-green/5 flex items-center justify-center flex-shrink-0">
                            <Newspaper className="w-6 h-6 text-pa-green/30" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          {item.category && <span className="inline-block text-[10px] font-semibold text-pa-gold-dark bg-pa-gold/10 px-2 py-0.5 rounded-full mb-1">{item.category}</span>}
                          <p className="text-sm font-semibold text-pa-green line-clamp-2 leading-snug group-hover:text-pa-gold-dark transition-colors">{item.title}</p>
                          <time dateTime={item.publishedAt || item.createdAt} className="text-xs text-gray-500 mt-1 block">{formatDate(item.publishedAt || item.createdAt)}</time>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {/* Announcements Card */}
          <div id="pengumuman" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col" style={{ scrollMarginTop: '80px' }}>
            <div className="flex items-center justify-between px-6 py-4 bg-pa-gold">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center"><ClipboardList className="w-4 h-4 text-white" /></div>
                <div>
                  <h3 className="font-bold text-white text-sm">{t('announcements.title')}</h3>
                  <p className="text-white/90 text-xs">{t('announcements.subtitle')}</p>
                </div>
              </div>
              <a href="/pengumuman" className="text-white/90 text-xs font-semibold hover:text-white hover:underline flex items-center gap-1 min-h-[44px]">
                {t('announcements.allAnnouncements')} <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="flex-1 divide-y divide-gray-50">
              {!announcements.length ? (
                <div className="p-10 text-center text-gray-500 text-sm">{t('announcements.noAnnouncements')}</div>
              ) : (
                <ul className="list-none p-0 m-0" role="list">
                  {announcements.slice(0, s.annCount || 5).map((ann, idx) => (
                    <li key={ann.id}>
                      <div className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-pa-gold/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-pa-gold-dark text-xs font-extrabold">{String(idx + 1).padStart(2, '0')}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-pa-green text-sm leading-snug line-clamp-2">{ann.title}</h4>
                          <p className="text-gray-500 text-xs mt-1 line-clamp-2">{ann.content?.replace(/<[^>]+>/g, '').substring(0, 100)}</p>
                          <time dateTime={ann.publishedAt || ann.createdAt} className="text-xs text-gray-500 mt-1 block">{formatDate(ann.publishedAt || ann.createdAt)}</time>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ServicesGridBlock({ settings, services }) {
  const s = settings || {};
  const { t } = useLanguage();
  return (
    <section id="layanan" aria-labelledby="services-h" className="py-20 bg-white" style={{ scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 id="services-h" className="text-3xl font-extrabold text-pa-green mb-4">{s.title || t('services.title')}</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">{s.subtitle || t('services.subtitle')}</p>
        </div>
        <ul className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto list-none p-0">
          {services.map(svc => {
            const Icon = ICON_MAP[svc.icon] || FileText;
            return (
              <li key={svc.id}>
                <article className="bg-gradient-to-br from-pa-green/5 to-pa-green-mid/5 rounded-2xl p-6 border border-pa-green/10 hover:shadow-md transition-all h-full">
                  <div className="w-12 h-12 bg-pa-green rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-pa-gold" aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-pa-green mb-2">{svc.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{svc.description}</p>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function CaseSearchBlock({ settings, onSearch, searchNomor, setSearchNomor, searchTahun, setSearchTahun, searchLoading, searchResult, statusColor, statusLabel }) {
  const s = settings || {};
  const { t, lang } = useLanguage();
  return (
    <section id="perkara" aria-labelledby="case-search-h" className="py-20 bg-pa-green" style={{ scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 id="case-search-h" className="text-3xl font-extrabold text-white mb-4">{s.title || t('caseSearch.title')}</h2>
          <p className="text-white/80 max-w-2xl mx-auto">{s.subtitle || t('caseSearch.subtitle')}</p>
        </div>
        <div className="max-w-2xl mx-auto">
          <form onSubmit={onSearch} role="search" className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 space-y-4">
            <div>
              <label htmlFor="hp-search" className="block text-white font-semibold mb-1.5 text-sm">{t('caseSearch.label')}</label>
              <Input id="hp-search" type="search" placeholder={t('caseSearch.placeholder')} value={searchNomor} onChange={e => setSearchNomor(e.target.value)} className="bg-white/20 border-white/30 text-white placeholder:text-white/80 focus:bg-white/30 focus:border-white text-base" />
            </div>
            <div>
              <label htmlFor="hp-tahun" className="block text-white font-semibold mb-1.5 text-sm">{t('caseSearch.yearLabel')}</label>
              <Input id="hp-tahun" type="number" placeholder={t('caseSearch.yearPlaceholder')} value={searchTahun} onChange={e => setSearchTahun(e.target.value)} className="bg-white/20 border-white/30 text-white placeholder:text-white/80 focus:bg-white/30 focus:border-white text-base" min="2000" max="2099" />
            </div>
            <Button type="submit" className="w-full bg-pa-orange hover:bg-pa-orange-dark text-white font-bold text-base py-3 min-h-[52px]" disabled={searchLoading}>
              <Search className="w-5 h-5 mr-2" aria-hidden="true" />
              {searchLoading ? t('caseSearch.searching') : t('caseSearch.searchBtn')}
            </Button>
          </form>
          {searchResult !== null && (
            <div role="region" aria-live="polite" className="mt-4">
              <h3 className="text-white font-bold mb-3">{t('caseSearch.resultTitle')} ({searchResult.length})</h3>
              {searchResult.length === 0 ? (
                <div className="bg-white/10 rounded-xl p-6 text-center" role="alert">
                  <p className="text-white font-semibold">{t('caseSearch.noResult')}</p>
                  <p className="text-white/70 text-sm mt-1">{t('caseSearch.noResultDesc')}</p>
                </div>
              ) : (
                <ul className="space-y-3 list-none p-0">
                  {searchResult.map(c => (
                    <li key={c.id}>
                      <article className="bg-white rounded-xl p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-pa-green text-sm">{t('caseSearch.caseNumber')}: {c.nomorPerkara || c.caseNumber}</h4>
                            <p className="text-gray-600 text-xs mt-1">{t('caseSearch.parties')}: {c.pihak || c.parties}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${statusColor(c.status)}`}>{statusLabel(c.status)}</span>
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ContactInfoBlock({ settings, siteSettings }) {
  const s = settings || {};
  const { t, lang } = useLanguage();
  const items = [
    { icon: MapPin, title: t('contact.address'), content: siteSettings.address || 'Jl. Propinsi No. 01, Penajam, Kab. Penajam Paser Utara, Kaltim 76141', href: 'https://maps.google.com/?q=Pengadilan+Agama+Penajam', linkLabel: t('contact.mapLink') },
    { icon: Phone, title: t('contact.phone'), content: siteSettings.phone || '(0543) 337-1012', href: `tel:${(siteSettings.phone || '05433371012').replace(/[^0-9+]/g, '')}`, linkLabel: lang === 'id' ? 'Hubungi via telepon' : 'Call us' },
    { icon: Mail, title: t('contact.email'), content: siteSettings.email || 'pa.penajam@gmail.com', href: `mailto:${siteSettings.email || 'pa.penajam@gmail.com'}`, linkLabel: lang === 'id' ? 'Kirim email' : 'Send email' },
    { icon: Clock, title: t('contact.operationalHours'), content: t('contact.hours'), href: null },
  ];
  return (
    <section id="kontak" aria-labelledby="contact-h" className="py-20" style={{ background: s.bgColor || '#f9fafb', scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 id="contact-h" className="text-3xl font-extrabold text-pa-green mb-4">{s.title || t('contact.title')}</h2>
          <p className="text-gray-600">{s.subtitle || t('contact.subtitle')}</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {items.map(({ icon: Icon, title, content, href, linkLabel }) => (
            <article key={title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="w-10 h-10 bg-pa-green rounded-xl flex items-center justify-center mb-4"><Icon className="w-5 h-5 text-pa-gold" aria-hidden="true" /></div>
              <h3 className="font-bold text-pa-green text-sm mb-1">{title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{content}</p>
              {href && linkLabel && (
                <a href={href} className="text-pa-gold-dark text-xs font-semibold hover:underline mt-2 inline-flex items-center gap-1 min-h-[44px]" target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}>
                  {linkLabel} {href.startsWith('http') && <ExternalLink className="w-3 h-3" />}
                </a>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProfileCardsBlock({ settings }) {
  const s = settings || {};
  const { t, lang } = useLanguage();
  const cards = [
    { icon: Award, title: t('profile.vision'), content: lang === 'id' ? '"Terwujudnya Pengadilan Agama Penajam yang Agung"' : '"A Dignified Penajam Religious Court"' },
    { icon: CheckCircle, title: t('profile.mission'), content: lang === 'id' ? 'Menjaga kemandirian, memberikan pelayanan hukum yang berkeadilan, berkualitas, dan terpercaya.' : 'Maintaining independence, providing just, quality, and trustworthy legal services.' },
    { icon: Building2, title: t('profile.location'), content: lang === 'id' ? 'Jl. Propinsi No. 01, Penajam, Kab. Penajam Paser Utara, Kalimantan Timur 76141' : 'Jl. Propinsi No. 01, Penajam, Penajam Paser Utara, East Kalimantan 76141' },
  ];
  return (
    <section id="profil" aria-labelledby="profile-h" className="py-20 bg-gray-50" style={{ scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 id="profile-h" className="text-3xl font-extrabold text-pa-green mb-4">{s.title || t('profile.title')}</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">{s.subtitle || t('profile.subtitle')}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {cards.map(({ icon: Icon, title, content }) => (
            <article key={title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-pa-green/10 rounded-xl flex items-center justify-center mb-4"><Icon className="w-6 h-6 text-pa-green" aria-hidden="true" /></div>
              <h3 className="font-bold text-pa-green text-lg mb-2">{title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{content}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// Static blocks
function HeroStaticBlock({ settings }) {
  const s = settings || {};
  return (
    <header id="beranda" role="banner" className="relative min-h-[70vh] flex items-center" style={{ scrollMarginTop: '80px' }}>
      <div className="absolute inset-0" style={{ background: s.backgroundImage ? `linear-gradient(rgba(0,0,0,0.55),rgba(0,0,0,0.55)), url(${s.backgroundImage}) center/cover` : '#1b5e20' }} aria-hidden="true" />
      <div className="container mx-auto px-4 relative z-10 text-center pt-20">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">{s.title}</h1>
        <p className="text-xl text-white/80 max-w-2xl mx-auto mb-8">{s.subtitle}</p>
        {s.buttonText && <a href={s.buttonLink || '#'} className="inline-flex items-center bg-pa-orange hover:bg-pa-orange-dark text-white font-bold px-8 py-4 rounded-xl text-base transition-colors min-h-[52px]">{s.buttonText} <ChevronRight className="ml-2 w-5 h-5" /></a>}
      </div>
    </header>
  );
}

function StatsBlock({ settings }) {
  const s = settings || {};
  return (
    <section className="py-12 bg-pa-green">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
          {(s.items || []).map(item => (
            <div key={item.id} className="text-center">
              <div className="text-3xl font-extrabold text-pa-gold">{item.number}</div>
              <div className="text-white/80 text-sm mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TextBlock({ settings }) {
  return <section className="py-12 bg-white"><div className="container mx-auto px-4 max-w-3xl prose prose-lg" dangerouslySetInnerHTML={{ __html: sanitizeHTML(settings?.content || '') }} /></section>;
}

function ImageBlock({ settings }) {
  const s = settings || {};
  return (
    <section className="py-8 bg-white">
      <div className={`container mx-auto px-4 flex flex-col items-${s.alignment || 'center'} gap-3`}>
        {s.src ? <img src={s.src} alt={s.caption || ''} className="max-w-3xl w-full rounded-2xl shadow-md" loading="lazy" /> : null}
        {s.caption && <p className="text-gray-500 text-sm italic">{s.caption}</p>}
      </div>
    </section>
  );
}

function CardGridBlock({ settings }) {
  const s = settings || {};
  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        {s.title && <h2 className="text-3xl font-extrabold text-pa-green text-center mb-10">{s.title}</h2>}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {(s.items || []).map(item => (
            <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="font-bold text-pa-green mb-2">{item.title}</h3>
              <p className="text-gray-500 text-sm">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBlock({ settings }) {
  const s = settings || {};
  return (
    <section className="py-20" style={{ background: s.bgColor || '#1b5e20' }}>
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-extrabold text-white mb-4">{s.title}</h2>
        <p className="text-white/80 mb-8 max-w-xl mx-auto">{s.subtitle}</p>
        {s.buttonText && <a href={s.buttonLink || '#'} className="inline-flex items-center bg-pa-orange hover:bg-pa-orange-dark text-white font-bold px-8 py-4 rounded-xl text-base transition-colors min-h-[52px]">{s.buttonText}</a>}
      </div>
    </section>
  );
}

function GalleryBlock({ settings }) {
  const s = settings || {};
  if (!(s.images || []).length) return null;
  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${s.columns || 3}, 1fr)` }}>
          {s.images.map((img, i) => <img key={i} src={img} alt="" className="w-full aspect-video object-cover rounded-xl" loading="lazy" />)}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// NEW BLOCK RENDERERS (Gallery, FAQ, Complaint CTA, Visitor Stats, Banner, Documents)
// ============================================================

function GalleryGridBlock({ settings, galleryItems }) {
  const s = settings || {};
  const { lang } = useLanguage();
  const limit = s.limit || 8;
  const cols = s.columns || 4;
  const items = (s.category ? galleryItems.filter(i => i.category === s.category) : galleryItems).slice(0, limit);
  const [lightbox, setLightbox] = useState(null);
  return (
    <section id="galeri" className="py-20 bg-white" style={{ scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-pa-green mb-3">{s.title || 'Galeri Foto'}</h2>
          {s.subtitle && <p className="text-gray-500">{s.subtitle}</p>}
        </div>
        {items.length === 0 ? (
          <div className="text-center py-12 text-gray-500"><p>Belum ada foto di galeri</p></div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {items.map(item => (
              <button key={item.id} onClick={() => setLightbox(item)}
                className="group relative aspect-square rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all">
                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <p className="text-white text-xs font-semibold text-left line-clamp-2">{lang === 'en' && item.titleEn ? item.titleEn : item.title}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {s.showViewAll !== false && (
          <div className="text-center mt-8">
            <a href="/galeri" className="inline-flex items-center gap-2 border-2 border-pa-green text-pa-green hover:bg-pa-green hover:text-white font-semibold px-6 py-3 rounded-xl transition-colors">
              {lang === 'id' ? 'Lihat Semua Galeri' : 'View All Gallery'} <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>
        )}
      </div>
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox.imageUrl} alt={lightbox.title} className="w-full max-h-[75vh] object-contain rounded-xl" />
            <div className="text-white text-center mt-3">
              <p className="font-bold">{lang === 'en' && lightbox.titleEn ? lightbox.titleEn : lightbox.title}</p>
            </div>
            <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white/70 hover:text-white" aria-label="Close"><X className="w-6 h-6" /></button>
          </div>
        </div>
      )}
    </section>
  );
}

function FAQSectionBlock({ settings, faqItems }) {
  const s = settings || {};
  const { lang } = useLanguage();
  const [openId, setOpenId] = useState(null);
  const limit = s.limit || 6;
  const items = (s.category ? faqItems.filter(i => i.category === s.category) : faqItems).slice(0, limit);
  return (
    <section id="faq" className="py-20" style={{ background: s.bgColor || '#f9fafb', scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-pa-green mb-3">{s.title || 'Tanya Jawab'}</h2>
          {s.subtitle && <p className="text-gray-500">{s.subtitle}</p>}
        </div>
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500"><p>Belum ada FAQ tersedia</p></div>
        ) : (
          <div className="space-y-3 mb-8">
            {items.map(item => {
              const q = lang === 'en' && item.questionEn ? item.questionEn : item.question;
              const a = lang === 'en' && item.answerEn ? item.answerEn : item.answer;
              const isOpen = openId === item.id;
              return (
                <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button onClick={() => setOpenId(isOpen ? null : item.id)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors">
                    <span className="font-semibold text-pa-green text-sm pr-4">{q}</span>
                    <Plus className={`w-4 h-4 text-pa-gold-dark flex-shrink-0 transition-transform ${isOpen ? 'rotate-45' : ''}`} aria-hidden="true" />
                  </button>
                  {isOpen && <div className="px-6 pb-5 text-gray-600 text-sm leading-relaxed border-t border-gray-50 pt-4">{a}</div>}
                </div>
              );
            })}
          </div>
        )}
        <div className="text-center">
          <a href="/faq" className="inline-flex items-center gap-2 border-2 border-pa-green text-pa-green hover:bg-pa-green hover:text-white font-semibold px-6 py-3 rounded-xl transition-colors">
            {lang === 'id' ? 'Lihat Semua FAQ' : 'View All FAQ'} <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

function ComplaintCTABlock({ settings, siteSettings }) {
  const s = settings || {};
  const { lang } = useLanguage();
  return (
    <section id="pengaduan" className="py-20" style={{ background: s.bgColor || '#1b5e20', scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6"><MessageSquare className="w-8 h-8 text-white" aria-hidden="true" /></div>
          <h2 className="text-3xl font-extrabold text-white mb-4">{s.title || 'Sampaikan Pengaduan Anda'}</h2>
          <p className="text-white/80 text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
            {s.subtitle || 'Kami berkomitmen untuk meningkatkan pelayanan. Sampaikan masukan atau pengaduan Anda kepada kami.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href={s.buttonLink || '/pengaduan'}
              className="inline-flex items-center justify-center bg-pa-orange hover:bg-pa-orange-dark text-white font-bold px-8 py-4 rounded-xl text-base transition-colors min-h-[52px]">
              {s.buttonText || 'Kirim Pengaduan'} <ArrowRight className="w-4 h-4 ml-1" aria-hidden="true" />
            </a>
            {s.showPhone !== false && siteSettings.phone && (
              <a href={`tel:${siteSettings.phone.replace(/[^0-9+]/g, '')}`}
                className="inline-flex items-center justify-center border-2 border-white/30 text-white hover:bg-white/10 font-bold px-8 py-4 rounded-xl text-base transition-colors min-h-[52px]">
                <Phone className="w-4 h-4" aria-hidden="true" /> {siteSettings.phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function VisitorStatsBlock({ settings, visitorStats }) {
  const s = settings || {};
  const { lang } = useLanguage();
  const stats = visitorStats || { total: 0, topPages: [], dailyData: [] };
  const maxViews = stats.dailyData?.length ? Math.max(...stats.dailyData.map(d => d.views), 1) : 1;
  return (
    <section className="py-16" style={{ background: s.bgColor || '#1b5e20', scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        {s.title && (
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-white mb-2">{s.title}</h2>
          </div>
        )}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
          {[
            { label: lang === 'id' ? 'Total Kunjungan' : 'Total Visits', value: stats.total?.toLocaleString() || '0', sub: `${s.days || 30} ${lang === 'id' ? 'hari terakhir' : 'days'}` },
            { label: lang === 'id' ? 'Rata-rata/Hari' : 'Daily Average', value: stats.dailyData?.length ? Math.round(stats.total / stats.dailyData.length).toLocaleString() : '0', sub: lang === 'id' ? 'Kunjungan per hari' : 'Visits per day' },
            { label: lang === 'id' ? 'Halaman Terpopuler' : 'Top Page', value: stats.topPages?.[0]?.path?.replace('/', '') || '-', sub: `${stats.topPages?.[0]?.views || 0} ${lang === 'id' ? 'kunjungan' : 'visits'}` },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center border border-white/10">
              <p className="text-3xl font-extrabold text-pa-gold">{value}</p>
              <p className="text-white font-semibold text-sm mt-1">{label}</p>
              <p className="text-white/80 text-xs mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
        {s.showChart !== false && stats.dailyData?.length > 0 && (
          <div className="max-w-4xl mx-auto bg-white/10 rounded-2xl p-6 border border-white/10">
            <p className="text-white/80 text-sm mb-3 font-medium">{lang === 'id' ? 'Tren kunjungan harian' : 'Daily visit trend'}</p>
            <div className="flex items-end gap-1 h-20">
              {stats.dailyData.slice(-30).map(d => (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end" title={`${d.date}: ${d.views}`}>
                  <div className="w-full rounded-t-sm bg-pa-gold/80 transition-all" style={{ height: `${(d.views / maxViews) * 70}px`, minHeight: d.views > 0 ? 2 : 0 }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function BannerSliderBlock({ settings, bannerItems }) {
  const s = settings || {};
  const [current, setCurrent] = useState(0);
  const { lang } = useLanguage();
  const banners = bannerItems || [];

  useEffect(() => {
    if (!s.autoPlay || banners.length <= 1) return;
    const t = setInterval(() => setCurrent(c => (c + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length, s.autoPlay]);

  if (banners.length === 0) return null;
  const banner = banners[current];

  return (
    <section className="relative overflow-hidden" style={{ minHeight: 420, background: banner.bgColor || '#1b5e20' }}>
      {banner.imageUrl && (
        <div className="absolute inset-0 bg-cover bg-center opacity-30 transition-all duration-700" style={{ backgroundImage: `url(${banner.imageUrl})` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />
      <div className="container mx-auto px-4 py-24 relative z-10 flex items-center min-h-[420px]">
        <div className="max-w-2xl">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight" style={{ color: banner.textColor || '#ffffff' }}>{banner.title}</h2>
          {banner.subtitle && <p className="text-lg mb-8 opacity-80" style={{ color: banner.textColor || '#ffffff' }}>{banner.subtitle}</p>}
          {banner.buttonText && (
            <a href={banner.buttonUrl || '#'} target={banner.buttonUrl?.startsWith('http') ? '_blank' : undefined} rel={banner.buttonUrl?.startsWith('http') ? 'noopener' : undefined}
              className="inline-flex items-center bg-pa-orange hover:bg-pa-orange-dark text-white font-bold px-8 py-4 rounded-xl text-base transition-colors">
              {banner.buttonText}
            </a>
          )}
        </div>
      </div>
      {banners.length > 1 && s.showArrows !== false && (
        <>
          <button onClick={() => setCurrent(c => (c - 1 + banners.length) % banners.length)} className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors">‹</button>
          <button onClick={() => setCurrent(c => (c + 1) % banners.length)} className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors">›</button>
        </>
      )}
      {banners.length > 1 && s.showDots !== false && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {banners.map((_, i) => <button key={i} onClick={() => setCurrent(i)} className={`h-2 rounded-full transition-all ${i === current ? 'bg-white w-6' : 'bg-white/50 w-2'}`} />)}
        </div>
      )}
    </section>
  );
}

function DocumentListBlock({ settings, documentItems }) {
  const s = settings || {};
  const { lang } = useLanguage();
  const limit = s.limit || 6;
  const items = (s.category ? documentItems.filter(i => i.category === s.category) : documentItems).slice(0, limit);

  async function handleDownload(item) {
    if (!item.fileUrl) return;
    await fetch(`/api/documents/download/${item.id}`, { method: 'POST' }).catch(() => {});
    window.open(item.fileUrl, '_blank');
  }

  return (
    <section id="dokumen" className="py-20 bg-gray-50" style={{ scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-pa-green mb-3">{s.title || 'Dokumen & Peraturan'}</h2>
          {s.subtitle && <p className="text-gray-500">{s.subtitle}</p>}
        </div>
        {items.length === 0 ? (
          <div className="text-center py-12 text-gray-500"><p>Belum ada dokumen tersedia</p></div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {items.map(item => (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
                <span className="flex-shrink-0">{item.fileType === 'pdf' ? <FileText className="w-6 h-6 text-pa-green" aria-hidden="true" /> : <ClipboardList className="w-6 h-6 text-pa-green" aria-hidden="true" />}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-pa-green text-sm leading-snug line-clamp-2">{lang === 'en' && item.titleEn ? item.titleEn : item.title}</h3>
                  {item.description && <p className="text-gray-500 text-xs mt-1 line-clamp-1">{item.description}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 bg-pa-green/10 text-pa-green text-xs rounded-full">{item.category}</span>
                  </div>
                </div>
                <button onClick={() => handleDownload(item)} disabled={!item.fileUrl}
                  className={`flex-shrink-0 p-2 rounded-xl transition-colors ${item.fileUrl ? 'bg-pa-green hover:bg-pa-green-mid text-white' : 'bg-gray-100 text-gray-500 cursor-not-allowed'}`}>
                  <Download className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
        {s.showViewAll !== false && (
          <div className="text-center mt-8">
            <a href="/dokumen" className="inline-flex items-center gap-2 border-2 border-pa-green text-pa-green hover:bg-pa-green hover:text-white font-semibold px-6 py-3 rounded-xl transition-colors">
              {lang === 'id' ? 'Lihat Semua Dokumen' : 'View All Documents'} <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

function renderBlock(block, ctx) {
  const { stats, news, announcements, siteSettings, services, galleryItems, faqItems, visitorStats, bannerItems, documentItems,
    onSearch, searchNomor, setSearchNomor, searchTahun, setSearchTahun,
    searchLoading, searchResult, statusColor, statusLabel, formatDate } = ctx;
  const s = block.settings || {};
  switch (block.type) {
    case 'hero_home':     return <HeroHomeBlock key={block.id} settings={s} stats={stats} />;
    case 'news_ann':      return <NewsAnnBlock key={block.id} settings={s} news={news} announcements={announcements} formatDate={formatDate} />;
    case 'services_grid': return <ServicesGridBlock key={block.id} settings={s} services={services} />;
    case 'case_search':   return <CaseSearchBlock key={block.id} settings={s} onSearch={onSearch} searchNomor={searchNomor} setSearchNomor={setSearchNomor} searchTahun={searchTahun} setSearchTahun={setSearchTahun} searchLoading={searchLoading} searchResult={searchResult} statusColor={statusColor} statusLabel={statusLabel} />;
    case 'contact_info':  return <ContactInfoBlock key={block.id} settings={s} siteSettings={siteSettings} />;
    case 'profile_cards': return <ProfileCardsBlock key={block.id} settings={s} />;
    case 'gallery_grid':  return <GalleryGridBlock key={block.id} settings={s} galleryItems={galleryItems} />;
    case 'faq_section':   return <FAQSectionBlock key={block.id} settings={s} faqItems={faqItems} />;
    case 'complaint_cta': return <ComplaintCTABlock key={block.id} settings={s} siteSettings={siteSettings} />;
    case 'visitor_stats': return <VisitorStatsBlock key={block.id} settings={s} visitorStats={visitorStats} />;
    case 'banner_slider': return <BannerSliderBlock key={block.id} settings={s} bannerItems={bannerItems} />;
    case 'document_list': return <DocumentListBlock key={block.id} settings={s} documentItems={documentItems} />;
    case 'hero':          return <HeroStaticBlock key={block.id} settings={s} />;
    case 'stats':         return <StatsBlock key={block.id} settings={s} />;
    case 'text':          return <TextBlock key={block.id} settings={s} />;
    case 'image':         return <ImageBlock key={block.id} settings={s} />;
    case 'cardgrid':      return <CardGridBlock key={block.id} settings={s} />;
    case 'cta':           return <CtaBlock key={block.id} settings={s} />;
    case 'gallery':       return <GalleryBlock key={block.id} settings={s} />;
    case 'accordion':     return <AccordionPublicBlock key={block.id} settings={s} />;
    case 'tabs':          return <TabsPublicBlock key={block.id} settings={s} />;
    case 'map':           return <MapPublicBlock key={block.id} settings={s} />;
    case 'countdown':     return <CountdownPublicBlock key={block.id} settings={s} />;
    default:              return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW BLOCK RENDERERS (Accordion, Tabs, Map, Countdown)
// ─────────────────────────────────────────────────────────────────────────────

function AccordionPublicBlock({ settings: s }) {
  const [openIdx, setOpenIdx] = useState(null);
  const items = s.items || [];
  return (
    <section className="py-14 bg-white">
      <div className="container mx-auto px-4 max-w-3xl">
        {s.title && (
          <h2 className="text-2xl md:text-3xl font-extrabold text-pa-green text-center mb-8">
            {s.title}
          </h2>
        )}
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={item.id || i} className={`border rounded-2xl overflow-hidden transition-all duration-200 ${openIdx === i ? 'border-pa-green/40 shadow-sm' : 'border-gray-200'}`}>
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${openIdx === i ? 'bg-pa-green/5' : 'bg-white hover:bg-gray-50'}`}
              >
                <span className={`font-semibold ${openIdx === i ? 'text-pa-green' : 'text-gray-800'}`}>
                  {item.question}
                </span>
                <ChevronDown className={`ml-4 w-4 h-4 flex-shrink-0 transition-transform duration-200 ${openIdx === i ? 'rotate-180 text-pa-green' : 'text-gray-500'}`} aria-hidden="true" />
              </button>
              {openIdx === i && (
                <div className="px-5 py-4 border-t border-pa-green/10 bg-white">
                  {item.answer?.includes('<') ? (
                    <div className="prose prose-sm max-w-none text-gray-600" dangerouslySetInnerHTML={{ __html: sanitizeHTML(item.answer) }} />
                  ) : (
                    <p className="text-gray-600 leading-relaxed">{item.answer}</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <div className="py-10 text-center text-gray-500 border-2 border-dashed rounded-2xl">
              Belum ada item accordion
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TabsPublicBlock({ settings: s }) {
  const [activeTab, setActiveTab] = useState(0);
  const tabs = s.tabs || [];
  return (
    <section className="py-14 bg-white">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Tab headers */}
        {tabs.length > 0 && (
          <div className="flex gap-1 border-b-2 border-gray-200 mb-0 overflow-x-auto">
            {tabs.map((tab, i) => (
              <button
                key={tab.id || i}
                onClick={() => setActiveTab(i)}
                className={`px-5 py-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 -mb-0.5 ${
                  i === activeTab
                    ? 'border-pa-green text-pa-green bg-pa-green/5'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        {/* Tab content */}
        {tabs[activeTab] && (
          <div className="bg-white border border-t-0 border-gray-200 rounded-b-2xl p-6 min-h-[120px]">
            {tabs[activeTab].content?.includes('<') ? (
              <div className="prose prose-lg max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: sanitizeHTML(tabs[activeTab].content) }} />
            ) : (
              <p className="text-gray-700 leading-relaxed">{tabs[activeTab].content}</p>
            )}
          </div>
        )}
        {tabs.length === 0 && (
          <div className="py-10 text-center text-gray-500 border-2 border-dashed rounded-2xl">
            Belum ada tab
          </div>
        )}
      </div>
    </section>
  );
}

function MapPublicBlock({ settings: s }) {
  if (!s.embedUrl) return null;
  return (
    <section className="py-10">
      <div className="container mx-auto px-4">
        {s.title && (
          <h2 className="text-2xl font-bold text-pa-green text-center mb-5 flex items-center justify-center gap-2">
            <MapPin className="w-5 h-5" aria-hidden="true" /> {s.title}
          </h2>
        )}
        <div className="rounded-2xl overflow-hidden shadow-md border border-gray-200" style={{ height: `${s.height || 400}px` }}>
          <iframe
            src={s.embedUrl}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={s.title || 'Peta Lokasi'}
          />
        </div>
      </div>
    </section>
  );
}

function CountdownPublicBlock({ settings: s }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    if (!s.targetDate) return;
    function calc() {
      const now = new Date().getTime();
      const target = new Date(s.targetDate).getTime();
      const diff = target - now;
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }); return; }
      setTimeLeft({
        days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours:   Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        expired: false,
      });
    }
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [s.targetDate]);

  const bg = s.bgColor || '#1b5e20';
  const units = [
    s.showDays    !== false && { label: 'Hari',   value: timeLeft.days    },
    s.showHours   !== false && { label: 'Jam',    value: timeLeft.hours   },
    s.showMinutes !== false && { label: 'Menit',  value: timeLeft.minutes },
    s.showSeconds !== false && { label: 'Detik',  value: timeLeft.seconds },
  ].filter(Boolean);

  return (
    <section className="py-14" style={{ background: bg }}>
      <div className="container mx-auto px-4 text-center text-white">
        {s.title && (
          <h2 className="text-2xl md:text-3xl font-extrabold mb-2">{s.title}</h2>
        )}
        {s.description && (
          <p className="text-white/80 mb-8 max-w-xl mx-auto">{s.description}</p>
        )}
        {!s.targetDate ? (
          <p className="text-white/40 text-sm">Tanggal target belum diatur</p>
        ) : timeLeft.expired ? (
          <div className="text-2xl font-bold text-pa-gold flex items-center justify-center gap-2"><CheckCircle className="w-6 h-6" aria-hidden="true" /> Acara Telah Berlangsung!</div>
        ) : (
          <div className="flex justify-center gap-3 md:gap-6 flex-wrap">
            {units.map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center bg-white/10 rounded-2xl px-5 md:px-8 py-4 md:py-6 min-w-[80px] md:min-w-[110px] backdrop-blur-sm border border-white/20">
                <span className="text-4xl md:text-6xl font-extrabold text-pa-gold tabular-nums leading-none">
                  {String(value).padStart(2, '0')}
                </span>
                <span className="text-white/70 text-xs uppercase tracking-widest mt-2 font-semibold">{label}</span>
              </div>
            ))}
          </div>
        )}
        {s.targetDate && !timeLeft.expired && (
          <p className="text-white/40 text-sm mt-6">
            Target: {new Date(s.targetDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </section>
  );
}

// ============================================================
// MAIN HOMEPAGE COMPONENT (Dynamic Renderer)
// ============================================================
export default function DynamicHomepage() {
  const { t, lang } = useLanguage();
  const [blocks, setBlocks] = useState(null);
  const [news, setNews] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [services, setServices] = useState([]);
  const [siteSettings, setSiteSettings] = useState({});
  const [stats, setStats] = useState({ casesThisYear: 0, casesDone: 0, casesOngoing: 0 });
  const [galleryItems, setGalleryItems] = useState([]);
  const [faqItems, setFaqItems] = useState([]);
  const [visitorStats, setVisitorStats] = useState({ total: 0, dailyData: [], topPages: [] });
  const [bannerItems, setBannerItems] = useState([]);
  const [documentItems, setDocumentItems] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchNomor, setSearchNomor] = useState('');
  const [searchTahun, setSearchTahun] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('beranda');

  useEffect(() => {
    loadAll();
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // IntersectionObserver for automatic nav sync on scroll
  useEffect(() => {
    if (blocks === null || dataLoading) return;
    const sectionIds = ['beranda', 'layanan', 'berita', 'pengumuman', 'perkara', 'galeri', 'dokumen', 'faq', 'pengaduan', 'kontak'];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveNav(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -50% 0px', threshold: 0.1 }
    );
    // Observe after a short delay to ensure DOM is painted
    const timer = setTimeout(() => {
      sectionIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }, 100);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [blocks, dataLoading]);

  async function loadAll() {
    try {
      // Seed removed — POST /api/seed no longer fires on page load
      const [hpRes, newsRes, annRes, svcRes, settingsRes, casesRes, galleryRes, faqRes, statsRes, bannersRes, docsRes] = await Promise.all([
        fetch('/api/pages/slug/_homepage'),
        fetch('/api/news?public=true&limit=8'),
        fetch('/api/announcements?public=true&limit=8'),
        fetch('/api/services'),
        fetch('/api/settings'),
        fetch('/api/cases'),
        fetch('/api/gallery'),
        fetch('/api/faq'),
        fetch('/api/analytics?days=30').catch(() => ({ ok: false })),
        fetch('/api/banners'),
        fetch('/api/documents?limit=12'),
      ]);
      if (hpRes.ok) {
        const hp = await hpRes.json();
        setBlocks(hp.blocks && hp.blocks.length > 0 ? hp.blocks : DEFAULT_BLOCKS);
      } else {
        setBlocks(DEFAULT_BLOCKS);
      }
      const [newsData, annData, svcData, settingsData, casesData, galleryData, faqData, bannersData, docsData] = await Promise.all([
        newsRes.json(), annRes.json(), svcRes.json(), settingsRes.json(), casesRes.json(),
        galleryRes.json(), faqRes.json(), bannersRes.json(), docsRes.json(),
      ]);
      setNews(newsData.items || []);
      setAnnouncements(annData.items || []);
      setServices(svcData.items || []);
      setSiteSettings(settingsData || {});
      setGalleryItems(galleryData.items || []);
      setFaqItems(faqData.items || []);
      setBannerItems(bannersData.items || []);
      setDocumentItems(docsData.items || []);
      const allCases = casesData.items || [];
      const thisYear = String(new Date().getFullYear());
      setStats({
        casesThisYear: allCases.filter(c => c.tahun === thisYear).length,
        casesDone: allCases.filter(c => c.status === 'selesai').length,
        casesOngoing: allCases.filter(c => c.status === 'berjalan').length,
      });
      // Analytics (non-critical — no auth needed for public)
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setVisitorStats(statsData);
      }
    } catch (e) { console.error(e); setBlocks([]); }
    finally { setDataLoading(false); }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchNomor && !searchTahun) return;
    setSearchLoading(true); setSearchResult(null);
    try {
      const p = new URLSearchParams();
      if (searchNomor) p.set('search', searchNomor);
      if (searchTahun) p.set('tahun', searchTahun);
      const res = await fetch(`/api/cases?${p}`);
      const data = await res.json();
      setSearchResult(data.items || []);
    } catch { setSearchResult([]); }
    finally { setSearchLoading(false); }
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const statusColor = (s) => ({ selesai: 'bg-green-100 text-green-700', berjalan: 'bg-blue-100 text-blue-700', terdaftar: 'bg-yellow-100 text-yellow-700' }[s] || 'bg-gray-100 text-gray-700');
  const statusLabel = (s) => ({ selesai: t('status.done'), berjalan: t('status.ongoing'), terdaftar: t('status.registered') }[s] || s);

  const ctx = { stats, news, announcements, siteSettings, services, galleryItems, faqItems, visitorStats, bannerItems, documentItems, onSearch: handleSearch, searchNomor, setSearchNomor, searchTahun, setSearchTahun, searchLoading, searchResult, statusColor, statusLabel, formatDate };

  const scrollTo = (id) => {
    setActiveNav(id);
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Loading
  if (blocks === null || dataLoading) {
    return (
      <div className="min-h-screen bg-pa-green flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/20 border-t-pa-gold rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/80 text-sm">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Tidak perlu tampilan kosong - DEFAULT_BLOCKS sudah menjadi fallback

  return (
    <div className="min-h-screen font-sans bg-white">
      {/* NAVBAR */}
      <nav
        role="navigation"
        aria-label={lang === 'id' ? 'Menu utama' : 'Main navigation'}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md' : 'bg-transparent'}`}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 lg:h-20 relative">
            {/* Logo */}
            <a href="/" aria-label={t('siteName')} className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-pa-gold focus:ring-offset-2 rounded-lg flex-shrink-0">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-br from-pa-green to-pa-green-mid flex items-center justify-center shadow-md">
                <Scale className="w-5 h-5 lg:w-6 lg:h-6 text-pa-gold" aria-hidden="true" />
              </div>
              <div>
                <p className={`font-bold text-sm lg:text-base leading-tight ${scrolled ? 'text-pa-green' : 'text-white'}`}>
                  {lang === 'id' ? 'Pengadilan Agama' : 'Religious Court'}
                </p>
                <p className="font-extrabold text-base lg:text-lg leading-tight text-pa-gold-dark">Penajam</p>
              </div>
            </a>
            {/* Dynamic Mega Menu */}
            <MegaMenuNavbar
              scrolled={scrolled}
              activeNav={activeNav}
              onScrollTo={scrollTo}
              mobileMenuOpen={mobileMenuOpen}
              setMobileMenuOpen={setMobileMenuOpen}
            />
          </div>
        </div>
      </nav>

      {/* RENDER BLOCKS */}
      <main id="main-content" tabIndex={-1}>
        {blocks.map(block => renderBlock(block, ctx))}
      </main>

      {/* FOOTER */}
      <footer role="contentinfo" className="bg-pa-green text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><Scale className="w-5 h-5 text-pa-gold" aria-hidden="true" /></div>
                <div>
                  <p className="font-bold text-sm">{lang === 'id' ? 'Pengadilan Agama' : 'Religious Court'}</p>
                  <p className="font-extrabold text-pa-gold">Penajam</p>
                </div>
              </div>
              <p className="text-white/70 text-sm leading-relaxed">{t('footer.description')}</p>
            </div>
            <nav aria-label={lang === 'id' ? 'Tautan cepat' : 'Quick links'}>
              <h3 className="font-bold text-pa-gold mb-4 text-sm uppercase tracking-wide">{t('footer.quickLinks')}</h3>
              <ul className="space-y-2 list-none p-0">
                {[
                  { id: 'beranda', label: t('nav.home') },
                  { id: 'layanan', label: t('nav.services') },
                  { id: 'perkara', label: t('nav.caseInfo') },
                  { id: 'berita', label: t('nav.news') },
                  { id: 'kontak', label: t('nav.contact') },
                ].map(link => (
                  <li key={link.id}>
                    <button
                      onClick={() => scrollTo(link.id)}
                      className="text-white/70 hover:text-white text-sm transition-colors text-left min-h-[44px]"
                    >{link.label}</button>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label={lang === 'id' ? 'Informasi' : 'Information'}>
              <h3 className="font-bold text-pa-gold mb-4 text-sm uppercase tracking-wide">{t('footer.information')}</h3>
              <ul className="space-y-2 list-none p-0">
                {[
                  { href: '/agenda-sidang', label: t('nav.courtSchedule') },
                  { href: '/putusan', label: t('nav.decisions') },
                  { href: '/pencarian-perkara', label: t('nav.caseSearch') },
                  { href: '/accessibility', label: '♿ ' + t('footer.accessibility') },
                ].map(l => (
                  <li key={l.href}>
                    <a href={l.href} className="text-white/70 hover:text-white text-sm transition-colors min-h-[44px] flex items-center">{l.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/80 text-sm">&copy; {new Date().getFullYear()} {t('siteName')}. {t('footer.allRights')}</p>
            <LanguageSwitcher variant="dark" scrolled={false} />
          </div>
        </div>
      </footer>
    </div>
  );
}
