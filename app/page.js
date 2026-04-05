'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Menu, X, Phone, Mail, MapPin, Search, ChevronRight,
  FileText, Calendar, DollarSign, Package, Shield, Monitor, Users, Stamp,
  Facebook, Twitter, Instagram, Youtube,
  Scale, Building2, BookOpen, TrendingUp, CheckCircle, Clock, ClipboardList,
  ArrowRight, ExternalLink, Globe, Award, Newspaper
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1667849921481-9e13c239ee3d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwyfHxnb3Zlcm5tZW50JTIwY291cnQlMjBidWlsZGluZ3xlbnwwfHx8fDE3NzI4MDA1MDd8MA&ixlib=rb-4.1.0&q=85&w=1400';

const iconMap = {
  FileText, Calendar, DollarSign, Package, Shield, Monitor, Users, Stamp,
  Scale, Building2, BookOpen, Globe, Award
};

export default function LandingPage() {
  const { t, lang } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchNomor, setSearchNomor] = useState('');
  const [searchTahun, setSearchTahun] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [news, setNews] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [services, setServices] = useState([]);
  const [settings, setSettings] = useState({});
  const [stats, setStats] = useState({ casesThisYear: 0, casesDone: 0, casesOngoing: 0 });
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('beranda');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    fetchData();
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  async function fetchData() {
    try {
      await fetch('/api/seed', { method: 'POST' });
      const [newsRes, annRes, svcRes, settingsRes] = await Promise.all([
        fetch('/api/news?public=true&limit=5'),
        fetch('/api/announcements?public=true&limit=4'),
        fetch('/api/services'),
        fetch('/api/settings'),
      ]);
      const [newsData, annData, svcData, settingsData] = await Promise.all([
        newsRes.json(), annRes.json(), svcRes.json(), settingsRes.json()
      ]);
      setNews(newsData.items || []);
      setAnnouncements(annData.items || []);
      setServices(svcData.items || []);
      setSettings(settingsData || {});
      const casesRes = await fetch('/api/cases');
      const casesData = await casesRes.json();
      const allCases = casesData.items || [];
      const thisYear = String(new Date().getFullYear());
      setStats({
        casesThisYear: allCases.filter(c => c.tahun === thisYear).length,
        casesDone: allCases.filter(c => c.status === 'selesai').length,
        casesOngoing: allCases.filter(c => c.status === 'berjalan').length,
        total: allCases.length,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchNomor && !searchTahun) return;
    setSearchLoading(true);
    setSearchResult(null);
    try {
      const params = new URLSearchParams();
      if (searchNomor) params.set('search', searchNomor);
      if (searchTahun) params.set('tahun', searchTahun);
      const res = await fetch(`/api/cases?${params}`);
      const data = await res.json();
      setSearchResult(data.items || []);
    } catch (e) {
      setSearchResult([]);
    } finally {
      setSearchLoading(false);
    }
  }

  const navLinks = [
    { id: 'beranda', label: t('nav.home') },
    { id: 'profil', label: t('nav.profile') },
    { id: 'layanan', label: t('nav.services') },
    { id: 'perkara', label: t('nav.caseInfo') },
    { id: 'berita', label: t('nav.news') },
    { id: 'pengumuman', label: t('nav.announcements') },
    { id: 'kontak', label: t('nav.contact') },
  ];

  const externalLinks = [
    { label: t('nav.courtSchedule'), href: '/agenda-sidang' },
    { label: t('nav.decisions'), href: '/putusan' },
    { label: t('nav.caseSearch'), href: '/pencarian-perkara' },
  ];

  const scrollTo = (id) => {
    setActiveNav(id);
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  };

  const statusColor = (status) => {
    if (status === 'selesai') return 'bg-green-100 text-green-700';
    if (status === 'berjalan') return 'bg-blue-100 text-blue-700';
    if (status === 'terdaftar') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };

  const statusLabel = (status) => {
    if (status === 'selesai') return t('status.done');
    if (status === 'berjalan') return t('status.ongoing');
    if (status === 'terdaftar') return t('status.registered');
    return status;
  };

  return (
    <div className="min-h-screen font-sans bg-white">

      {/* ========================================================
          NAVBAR
          WCAG: nav landmark, aria-label, keyboard nav
          ======================================================== */}
      <nav
        role="navigation"
        aria-label={lang === 'id' ? 'Menu utama' : 'Main navigation'}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md' : 'bg-transparent'}`}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <a
              href="/"
              aria-label={lang === 'id' ? 'Halaman beranda Pengadilan Agama Penajam' : 'Penajam Religious Court homepage'}
              className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:ring-offset-2 rounded-lg"
            >
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8e] flex items-center justify-center shadow-md">
                <Scale className={`w-5 h-5 lg:w-6 lg:h-6 text-[#c9a84c]`} aria-hidden="true" />
              </div>
              <div>
                <p className={`font-bold text-sm lg:text-base leading-tight ${scrolled ? 'text-[#1e3a5f]' : 'text-white'}`}>
                  {lang === 'id' ? 'Pengadilan Agama' : 'Religious Court'}
                </p>
                <p className={`font-extrabold text-base lg:text-lg leading-tight text-[#c9a84c]`}>
                  Penajam
                </p>
              </div>
            </a>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map(link => (
                <button
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  aria-current={activeNav === link.id ? 'location' : undefined}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-all min-h-[44px] ${
                    activeNav === link.id
                      ? 'text-[#c9a84c] bg-[#c9a84c]/10'
                      : scrolled ? 'text-[#1e3a5f] hover:text-[#c9a84c]' : 'text-white/90 hover:text-white'
                  }`}
                >
                  {link.label}
                </button>
              ))}
              <div className="relative group ml-1">
                <button
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-1 min-h-[44px] ${scrolled ? 'text-[#1e3a5f] hover:text-[#c9a84c]' : 'text-white/90 hover:text-white'}`}
                  aria-haspopup="true"
                  aria-expanded="false"
                  aria-label={t('nav.digitalServices')}
                >
                  {t('nav.digitalServices')} ▾
                </button>
                <div
                  role="menu"
                  aria-label={t('nav.digitalServices')}
                  className="absolute top-full right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50"
                >
                  {externalLinks.map(link => (
                    <a
                      key={link.href}
                      href={link.href}
                      role="menuitem"
                      className="block px-4 py-2.5 text-sm text-[#1e3a5f] hover:bg-gray-50 hover:text-[#c9a84c] transition-colors min-h-[44px] flex items-center"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
              {/* Language Switcher */}
              <div className="ml-2 flex items-center">
                <LanguageSwitcher scrolled={scrolled} />
              </div>
              <Button
                size="sm"
                className="ml-2 bg-[#c9a84c] hover:bg-[#b8962f] text-white text-sm font-semibold min-h-[44px]"
                onClick={() => window.location.href = '/admin/login'}
                aria-label={lang === 'id' ? 'Masuk ke halaman admin' : 'Login to admin panel'}
              >
                {t('nav.admin')}
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className={`lg:hidden p-2 min-h-[44px] min-w-[44px] rounded-lg ${scrolled ? 'text-[#1e3a5f]' : 'text-white'}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={mobileMenuOpen ? (lang === 'id' ? 'Tutup menu' : 'Close menu') : (lang === 'id' ? 'Buka menu' : 'Open menu')}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label={lang === 'id' ? 'Menu navigasi mobile' : 'Mobile navigation menu'}
            className="lg:hidden bg-white border-t border-gray-100 shadow-lg"
          >
            <div className="container mx-auto px-4 py-4 space-y-1">
              {navLinks.map(link => (
                <button
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  aria-current={activeNav === link.id ? 'location' : undefined}
                  className="block w-full text-left px-4 py-3 text-sm font-medium text-[#1e3a5f] hover:bg-gray-50 rounded-xl min-h-[44px]"
                >
                  {link.label}
                </button>
              ))}
              <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
                {externalLinks.map(link => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2 px-4 py-3 text-sm text-[#c9a84c] font-medium hover:bg-gray-50 rounded-xl min-h-[44px]"
                  >
                    <ExternalLink className="w-4 h-4" aria-hidden="true" /> {link.label}
                  </a>
                ))}
              </div>
              <div className="flex items-center justify-between px-4 pt-2">
                <LanguageSwitcher scrolled={true} />
                <button
                  className="px-4 py-2 bg-[#c9a84c] text-white rounded-lg text-sm font-semibold min-h-[44px]"
                  onClick={() => window.location.href = '/admin/login'}
                >
                  {t('nav.admin')}
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ========================================================
          HERO SECTION
          WCAG: aria-label, alt text for bg image, semantic header
          ======================================================== */}
      <header
        id="beranda"
        role="banner"
        aria-label={lang === 'id' ? 'Bagian beranda' : 'Hero section'}
        className="relative min-h-screen flex items-center"
        style={{ scrollMarginTop: '80px' }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d1f35] via-[#1e3a5f] to-[#2d5a8e]" aria-hidden="true" />
        <div
          className="absolute inset-0 opacity-20 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('${HERO_IMAGE}')` }}
          role="img"
          aria-label={lang === 'id' ? 'Gedung Pengadilan Agama Penajam' : 'Penajam Religious Court building'}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0d1f35]/60" aria-hidden="true" />

        <div className="container mx-auto px-4 relative z-10 pt-20">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white/80 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-white/10" aria-label={t('underMA')}>
              <Globe className="w-4 h-4 text-[#c9a84c]" aria-hidden="true" />
              {t('underMA')}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-4">
              {t('siteName')}
              <span className="block text-[#c9a84c]">{t('siteSubtitle')}</span>
            </h1>
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed">
              {t('tagline')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center" role="group" aria-label={lang === 'id' ? 'Tombol aksi utama' : 'Main action buttons'}>
              <Button
                size="lg"
                className="bg-[#c9a84c] hover:bg-[#b8962f] text-white text-base font-bold px-8 py-4 rounded-xl shadow-lg min-h-[52px]"
                onClick={() => scrollTo('layanan')}
                aria-label={t('hero.seeServices')}
              >
                {t('hero.seeServices')} <ChevronRight className="ml-2 w-5 h-5" aria-hidden="true" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-white/30 text-white hover:bg-white/10 text-base font-bold px-8 py-4 rounded-xl min-h-[52px]"
                onClick={() => scrollTo('kontak')}
                aria-label={t('hero.contactUs')}
              >
                {t('hero.contactUs')}
              </Button>
            </div>

            {/* Stats */}
            <div
              className="mt-16 grid grid-cols-3 gap-4 max-w-2xl mx-auto"
              role="region"
              aria-label={lang === 'id' ? 'Statistik perkara' : 'Case statistics'}
            >
              {[
                { label: t('hero.caseThisYear'), val: stats.casesThisYear },
                { label: t('hero.caseDone'), val: stats.casesDone },
                { label: t('hero.caseOngoing'), val: stats.casesOngoing },
              ].map(({ label, val }) => (
                <div key={label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                  <p className="text-3xl font-extrabold text-[#c9a84c]" aria-label={`${val} ${label}`}>{val}</p>
                  <p className="text-white/70 text-xs mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================
          PROFILE SECTION
          ======================================================== */}
      <section
        id="profil"
        aria-labelledby="profile-heading"
        className="py-20 bg-gray-50"
        style={{ scrollMarginTop: '80px' }}
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 id="profile-heading" className="text-3xl font-extrabold text-[#1e3a5f] mb-4">
              {t('profile.title')}
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">{t('profile.subtitle')}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                icon: Award,
                title: t('profile.vision'),
                content: lang === 'id'
                  ? '"Terwujudnya Pengadilan Agama Penajam yang Agung"'
                  : '"A Dignified Penajam Religious Court"',
              },
              {
                icon: CheckCircle,
                title: t('profile.mission'),
                content: lang === 'id'
                  ? 'Menjaga kemandirian, memberikan pelayanan hukum yang berkeadilan, berkualitas, dan terpercaya kepada seluruh masyarakat.'
                  : 'Maintaining independence, providing just, quality, and trustworthy legal services to all people.',
              },
              {
                icon: Building2,
                title: t('profile.location'),
                content: lang === 'id'
                  ? 'Jl. Propinsi No. 01, Penajam, Kabupaten Penajam Paser Utara, Kalimantan Timur 76141'
                  : 'Jl. Propinsi No. 01, Penajam, Penajam Paser Utara Regency, East Kalimantan 76141',
              },
            ].map(({ icon: Icon, title, content }) => (
              <article key={title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-[#1e3a5f]" aria-hidden="true" />
                </div>
                <h3 className="font-bold text-[#1e3a5f] text-lg mb-2">{title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{content}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================
          SERVICES SECTION
          ======================================================== */}
      <section
        id="layanan"
        aria-labelledby="services-heading"
        className="py-20 bg-white"
        style={{ scrollMarginTop: '80px' }}
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 id="services-heading" className="text-3xl font-extrabold text-[#1e3a5f] mb-4">
              {t('services.title')}
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">{t('services.subtitle')}</p>
          </div>
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto" aria-label={lang === 'id' ? 'Memuat layanan...' : 'Loading services...'} aria-busy="true">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-2xl h-40 animate-pulse" aria-hidden="true" />
              ))}
            </div>
          ) : (
            <ul className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto list-none p-0">
              {services.map((svc) => {
                const Icon = iconMap[svc.icon] || FileText;
                return (
                  <li key={svc.id}>
                    <article className="bg-gradient-to-br from-[#1e3a5f]/5 to-[#2d5a8e]/5 rounded-2xl p-6 border border-[#1e3a5f]/10 hover:shadow-md transition-all h-full">
                      <div className="w-12 h-12 bg-[#1e3a5f] rounded-xl flex items-center justify-center mb-4">
                        <Icon className="w-6 h-6 text-[#c9a84c]" aria-hidden="true" />
                      </div>
                      <h3 className="font-bold text-[#1e3a5f] mb-2">{svc.title}</h3>
                      <p className="text-gray-600 text-sm leading-relaxed">{svc.description}</p>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ========================================================
          CASE SEARCH SECTION
          WCAG: form labels, aria-describedby, accessible search
          ======================================================== */}
      <section
        id="perkara"
        aria-labelledby="case-search-heading"
        className="py-20 bg-[#1e3a5f]"
        style={{ scrollMarginTop: '80px' }}
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 id="case-search-heading" className="text-3xl font-extrabold text-white mb-4">
              {t('caseSearch.title')}
            </h2>
            <p className="text-white/70 max-w-2xl mx-auto">{t('caseSearch.subtitle')}</p>
          </div>
          <div className="max-w-2xl mx-auto">
            <form
              onSubmit={handleSearch}
              aria-label={lang === 'id' ? 'Form pencarian perkara' : 'Case search form'}
              role="search"
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 space-y-4"
            >
              <div>
                <label
                  htmlFor="search-nomor"
                  className="block text-white font-semibold mb-1.5 text-sm"
                >
                  {t('caseSearch.label')}
                  <span className="text-white/50 text-xs ml-1 font-normal">({t('common.optional')})</span>
                </label>
                <Input
                  id="search-nomor"
                  type="search"
                  placeholder={t('caseSearch.placeholder')}
                  value={searchNomor}
                  onChange={e => setSearchNomor(e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:bg-white/30 focus:border-white text-base"
                  aria-describedby="search-help"
                  autoComplete="off"
                />
                <p id="search-help" className="sr-only">
                  {lang === 'id'
                    ? 'Masukkan nomor perkara atau nama pihak yang terlibat'
                    : 'Enter case number or name of the party involved'}
                </p>
              </div>
              <div>
                <label
                  htmlFor="search-tahun"
                  className="block text-white font-semibold mb-1.5 text-sm"
                >
                  {t('caseSearch.yearLabel')}
                  <span className="text-white/50 text-xs ml-1 font-normal">({t('common.optional')})</span>
                </label>
                <Input
                  id="search-tahun"
                  type="number"
                  placeholder={t('caseSearch.yearPlaceholder')}
                  value={searchTahun}
                  onChange={e => setSearchTahun(e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:bg-white/30 focus:border-white text-base"
                  min="2000"
                  max="2099"
                  aria-label={t('caseSearch.yearLabel')}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#c9a84c] hover:bg-[#b8962f] text-white font-bold text-base py-3 min-h-[52px]"
                disabled={searchLoading}
                aria-label={searchLoading ? t('caseSearch.searching') : t('caseSearch.searchBtn')}
              >
                <Search className="w-5 h-5 mr-2" aria-hidden="true" />
                {searchLoading ? t('caseSearch.searching') : t('caseSearch.searchBtn')}
              </Button>
            </form>

            {/* Search Results */}
            {searchResult !== null && (
              <div
                role="region"
                aria-live="polite"
                aria-label={t('caseSearch.resultTitle')}
                className="mt-4"
              >
                <h3 className="text-white font-bold mb-3">
                  {t('caseSearch.resultTitle')} ({searchResult.length})
                </h3>
                {searchResult.length === 0 ? (
                  <div className="bg-white/10 rounded-xl p-6 text-center" role="alert">
                    <p className="text-white font-semibold">{t('caseSearch.noResult')}</p>
                    <p className="text-white/60 text-sm mt-1">{t('caseSearch.noResultDesc')}</p>
                  </div>
                ) : (
                  <ul className="space-y-3 list-none p-0">
                    {searchResult.map(c => (
                      <li key={c.id}>
                        <article className="bg-white rounded-xl p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-[#1e3a5f] text-sm">
                                {t('caseSearch.caseNumber')}: {c.nomorPerkara || c.caseNumber}
                              </h4>
                              <p className="text-gray-600 text-xs mt-1">
                                {t('caseSearch.parties')}: {c.pihak || c.parties}
                              </p>
                              {c.jenisPerkara && (
                                <p className="text-gray-500 text-xs">{t('caseSearch.caseType')}: {c.jenisPerkara}</p>
                              )}
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${statusColor(c.status)}`}>
                              {statusLabel(c.status)}
                            </span>
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

      {/* ========================================================
          BERITA & PENGUMUMAN — 1 SECTION, 2 KOLOM KARTU
          ======================================================== */}
      <main id="main-content" tabIndex={-1} aria-label={lang === 'id' ? 'Konten utama' : 'Main content'}>
        <section
          id="berita"
          aria-labelledby="news-ann-heading"
          className="py-20 bg-gray-50"
          style={{ scrollMarginTop: '80px' }}
        >
          <div className="container mx-auto px-4">
            {/* Section Header */}
            <div className="text-center mb-12">
              <h2 id="news-ann-heading" className="text-3xl font-extrabold text-[#1e3a5f] mb-3">
                {lang === 'id' ? 'Berita & Pengumuman' : 'News & Announcements'}
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto text-sm">
                {lang === 'id'
                  ? 'Informasi terbaru dan pengumuman resmi dari Pengadilan Agama Penajam'
                  : 'Latest news and official announcements from Penajam Religious Court'}
              </p>
            </div>

            {/* 2-Column Card Layout */}
            <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">

              {/* ---- KARTU BERITA ---- */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                {/* Card Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-[#1e3a5f]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                      <Newspaper className="w-4 h-4 text-[#c9a84c]" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">{t('news.title')}</h3>
                      <p className="text-white/50 text-xs">{t('news.subtitle')}</p>
                    </div>
                  </div>
                  <a
                    href="/berita"
                    className="text-[#c9a84c] text-xs font-semibold hover:underline flex items-center gap-1 min-h-[44px]"
                    aria-label={t('news.allNews')}
                  >
                    {t('news.allNews')} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                </div>

                {/* Card Body */}
                <div className="flex-1 divide-y divide-gray-50">
                  {loading ? (
                    <div className="p-6 space-y-4" aria-busy="true">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex gap-3 animate-pulse">
                          <div className="w-20 h-16 bg-gray-100 rounded-xl flex-shrink-0" aria-hidden="true" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 bg-gray-100 rounded w-3/4" aria-hidden="true" />
                            <div className="h-3 bg-gray-100 rounded w-1/2" aria-hidden="true" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : news.length === 0 ? (
                    <div className="p-10 text-center text-gray-400 text-sm">{t('news.noNews')}</div>
                  ) : (
                    <ul className="list-none p-0 m-0" role="list">
                      {news.slice(0, 4).map((item) => (
                        <li key={item.id}>
                          <a
                            href={`/berita/${item.id}`}
                            aria-label={`${t('news.readMore')}: ${item.title}`}
                            className="flex gap-3.5 px-5 py-4 hover:bg-gray-50 transition-colors group"
                          >
                            {/* Thumbnail */}
                            {item.image ? (
                              <div className="w-20 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                                <img
                                  src={item.image}
                                  alt={item.imageAlt || item.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                  width="80"
                                  height="64"
                                />
                              </div>
                            ) : (
                              <div className="w-20 h-16 rounded-xl bg-[#1e3a5f]/5 flex items-center justify-center flex-shrink-0">
                                <Newspaper className="w-6 h-6 text-[#1e3a5f]/30" aria-hidden="true" />
                              </div>
                            )}
                            {/* Text */}
                            <div className="flex-1 min-w-0">
                              {item.category && (
                                <span className="inline-block text-[10px] font-semibold text-[#c9a84c] bg-[#c9a84c]/10 px-2 py-0.5 rounded-full mb-1">
                                  {item.category}
                                </span>
                              )}
                              <p className="text-sm font-semibold text-[#1e3a5f] line-clamp-2 leading-snug group-hover:text-[#c9a84c] transition-colors">
                                {item.title}
                              </p>
                              <time
                                dateTime={item.publishedAt || item.createdAt}
                                className="text-xs text-gray-400 mt-1 block"
                              >
                                {formatDate(item.publishedAt || item.createdAt)}
                              </time>
                            </div>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* ---- KARTU PENGUMUMAN ---- */}
              <div id="pengumuman" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col" style={{ scrollMarginTop: '80px' }}>
                {/* Card Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-[#c9a84c]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <ClipboardList className="w-4 h-4 text-white" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">{t('announcements.title')}</h3>
                      <p className="text-white/70 text-xs">{t('announcements.subtitle')}</p>
                    </div>
                  </div>
                  <a
                    href="/pengumuman"
                    className="text-white/90 text-xs font-semibold hover:text-white hover:underline flex items-center gap-1 min-h-[44px]"
                    aria-label={t('announcements.allAnnouncements')}
                  >
                    {t('announcements.allAnnouncements')} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                </div>

                {/* Card Body */}
                <div className="flex-1 divide-y divide-gray-50">
                  {loading ? (
                    <div className="p-6 space-y-4" aria-busy="true">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" aria-hidden="true" />
                      ))}
                    </div>
                  ) : announcements.length === 0 ? (
                    <div className="p-10 text-center text-gray-400 text-sm">{t('announcements.noAnnouncements')}</div>
                  ) : (
                    <ul className="list-none p-0 m-0" role="list">
                      {announcements.slice(0, 5).map((ann, idx) => (
                        <li key={ann.id}>
                          <div className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group">
                            {/* Index Badge */}
                            <div className="w-8 h-8 rounded-full bg-[#c9a84c]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[#c9a84c] text-xs font-extrabold" aria-hidden="true">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-[#1e3a5f] text-sm leading-snug line-clamp-2">
                                {ann.title}
                              </h4>
                              <p className="text-gray-500 text-xs mt-1 line-clamp-2 leading-relaxed">
                                {ann.content?.replace(/<[^>]+>/g, '').substring(0, 100)}
                              </p>
                              <time
                                dateTime={ann.publishedAt || ann.createdAt}
                                className="text-xs text-gray-400 mt-1 block"
                              >
                                {formatDate(ann.publishedAt || ann.createdAt)}
                              </time>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

            </div>{/* end grid */}
          </div>
        </section>


        {/* ========================================================
            CONTACT SECTION
            ======================================================== */}
        <section
          id="kontak"
          aria-labelledby="contact-heading"
          className="py-20 bg-white"
          style={{ scrollMarginTop: '80px' }}
        >
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 id="contact-heading" className="text-3xl font-extrabold text-[#1e3a5f] mb-4">
                {t('contact.title')}
              </h2>
              <p className="text-gray-600">{t('contact.subtitle')}</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {[
                {
                  icon: MapPin,
                  title: t('contact.address'),
                  content: settings.address || 'Jl. Propinsi No. 01, Penajam, Kabupaten Penajam Paser Utara, Kalimantan Timur 76141',
                  href: 'https://maps.google.com/?q=Pengadilan+Agama+Penajam',
                  linkLabel: t('contact.mapLink'),
                },
                {
                  icon: Phone,
                  title: t('contact.phone'),
                  content: settings.phone || '(0543) 337-1012',
                  href: `tel:${(settings.phone || '05433371012').replace(/[^0-9+]/g, '')}`,
                  linkLabel: lang === 'id' ? 'Hubungi melalui telepon' : 'Call by phone',
                },
                {
                  icon: Mail,
                  title: t('contact.email'),
                  content: settings.email || 'pa.penajam@gmail.com',
                  href: `mailto:${settings.email || 'pa.penajam@gmail.com'}`,
                  linkLabel: lang === 'id' ? 'Kirim email' : 'Send email',
                },
                {
                  icon: Clock,
                  title: t('contact.operationalHours'),
                  content: t('contact.hours'),
                  href: null,
                  linkLabel: null,
                },
              ].map(({ icon: Icon, title, content, href, linkLabel }) => (
                <article key={title} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <div className="w-10 h-10 bg-[#1e3a5f] rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-[#c9a84c]" aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-[#1e3a5f] text-sm mb-1">{title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{content}</p>
                  {href && linkLabel && (
                    <a
                      href={href}
                      className="text-[#c9a84c] text-xs font-semibold hover:underline mt-2 inline-flex items-center gap-1 min-h-[44px]"
                      aria-label={linkLabel}
                      target={href.startsWith('http') ? '_blank' : undefined}
                      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    >
                      {linkLabel} {href.startsWith('http') && <ExternalLink className="w-3 h-3" aria-hidden="true" />}
                    </a>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================
          FOOTER
          WCAG: contentinfo landmark, link descriptions
          ======================================================== */}
      <footer
        role="contentinfo"
        aria-label={lang === 'id' ? 'Informasi footer website' : 'Website footer information'}
        className="bg-[#1e3a5f] text-white py-12"
      >
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4" aria-label={t('siteName')}>
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <Scale className="w-5 h-5 text-[#c9a84c]" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-bold text-sm">{lang === 'id' ? 'Pengadilan Agama' : 'Religious Court'}</p>
                  <p className="font-extrabold text-[#c9a84c]">Penajam</p>
                </div>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">{t('footer.description')}</p>
            </div>
            <nav aria-label={lang === 'id' ? 'Tautan cepat' : 'Quick links'}>
              <h3 className="font-bold text-[#c9a84c] mb-4 text-sm uppercase tracking-wide">{t('footer.quickLinks')}</h3>
              <ul className="space-y-2 list-none p-0">
                {navLinks.map(link => (
                  <li key={link.id}>
                    <button
                      onClick={() => scrollTo(link.id)}
                      className="text-white/60 hover:text-white text-sm transition-colors text-left min-h-[44px]"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label={lang === 'id' ? 'Informasi digital' : 'Digital information'}>
              <h3 className="font-bold text-[#c9a84c] mb-4 text-sm uppercase tracking-wide">{t('footer.information')}</h3>
              <ul className="space-y-2 list-none p-0">
                {externalLinks.map(link => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-white/60 hover:text-white text-sm transition-colors flex items-center gap-1 min-h-[44px]"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
                <li>
                  <a href="/accessibility" className="text-white/60 hover:text-white text-sm transition-colors min-h-[44px] flex items-center">
                    ♿ {t('footer.accessibility')}
                  </a>
                </li>
              </ul>
            </nav>
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/50 text-sm">
              &copy; {new Date().getFullYear()} {t('siteName')}. {t('footer.allRights')}
            </p>
            <div className="flex items-center gap-4">
              <LanguageSwitcher variant="dark" scrolled={false} />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
