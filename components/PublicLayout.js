'use client';
import { useState, useEffect } from 'react';
import { Scale } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import MegaMenuNavbar from '@/components/MegaMenu';

export default function PublicLayout({ children, title, subtitle, bgHeader = '#1b5e20' }) {
  const { lang } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('');
  const [siteSettings, setSiteSettings] = useState({});

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    fetch('/api/settings').then(r => r.json()).then(d => setSiteSettings(d || {})).catch(() => {});
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.location.href = `/#${id}`;
    }
  };

  const footerLinksData = (() => {
    try {
      if (siteSettings.footer_links) return JSON.parse(siteSettings.footer_links);
    } catch {}
    return [
      { href: '/', label: lang === 'id' ? 'Beranda' : 'Home', labelEn: 'Home' },
      { href: '/agenda-sidang', label: lang === 'id' ? 'Agenda Sidang' : 'Court Schedule', labelEn: 'Court Schedule' },
      { href: '/putusan', label: lang === 'id' ? 'Putusan' : 'Court Decisions', labelEn: 'Court Decisions' },
      { href: '/pencarian-perkara', label: lang === 'id' ? 'Pencarian Perkara' : 'Case Search', labelEn: 'Case Search' },
      { href: '/galeri', label: lang === 'id' ? 'Galeri Foto' : 'Photo Gallery', labelEn: 'Photo Gallery' },
      { href: '/dokumen', label: lang === 'id' ? 'Dokumen Publik' : 'Public Documents', labelEn: 'Public Documents' },
      { href: '/faq', label: 'FAQ', labelEn: 'FAQ' },
      { href: '/pengaduan', label: lang === 'id' ? 'Pengaduan' : 'Complaints', labelEn: 'Complaints' },
      { href: '/accessibility', label: `♿ ${lang === 'id' ? 'Aksesibilitas' : 'Accessibility'}`, labelEn: 'Accessibility' },
    ];
  })();

  const socialLinks = [
    siteSettings.facebook && { href: siteSettings.facebook, label: 'Facebook', icon: '📘' },
    siteSettings.instagram && { href: siteSettings.instagram, label: 'Instagram', icon: '📸' },
    siteSettings.twitter && { href: siteSettings.twitter, label: 'Twitter / X', icon: '🐦' },
    siteSettings.youtube && { href: siteSettings.youtube, label: 'YouTube', icon: '▶️' },
  ].filter(Boolean);

  return (
    <div className="min-h-screen font-sans bg-white flex flex-col">
      {/* ── NAVBAR ── */}
      <nav
        role="navigation"
        aria-label={lang === 'id' ? 'Menu utama' : 'Main navigation'}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white shadow-md' : 'bg-[#1b5e20]'
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 lg:h-20 relative">
            {/* Logo */}
            <a
              href="/"
              aria-label={lang === 'id' ? 'Kembali ke Beranda' : 'Back to Homepage'}
              className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-[#d4a017] focus:ring-offset-2 rounded-lg flex-shrink-0"
            >
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-br from-[#1b5e20] to-[#2e7d32] flex items-center justify-center shadow-md border-2 border-[#d4a017]/30">
                <Scale className="w-5 h-5 lg:w-6 lg:h-6 text-[#d4a017]" aria-hidden="true" />
              </div>
              <div>
                <p className={`font-bold text-sm lg:text-base leading-tight ${scrolled ? 'text-[#1b5e20]' : 'text-white'}`}>
                  {lang === 'id' ? 'Pengadilan Agama' : 'Religious Court'}
                </p>
                <p className="font-extrabold text-base lg:text-lg leading-tight text-[#d4a017]">Penajam</p>
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

      {/* ── PAGE HEADER ── */}
      {title && (
        <div className="pt-16 lg:pt-20">
          <div className="py-14 lg:py-20" style={{ background: bgHeader }}>
            <div className="container mx-auto px-4 text-center">
              <h1 className="text-3xl lg:text-4xl font-extrabold text-white mb-3">{title}</h1>
              {subtitle && (
                <p className="text-white/70 max-w-2xl mx-auto text-sm lg:text-base leading-relaxed">{subtitle}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CONTENT ── */}
      <main
        id="main-content"
        tabIndex={-1}
        className={`flex-1 ${!title ? 'pt-16 lg:pt-20' : ''}`}
      >
        {children}
      </main>

      {/* ── FOOTER ── */}
      <footer role="contentinfo" className="bg-[#1b5e20] text-white py-12 mt-auto">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <Scale className="w-5 h-5 text-[#d4a017]" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-bold text-sm">{siteSettings.court_name ? siteSettings.court_name.replace('Penajam', '').trim() : (lang === 'id' ? 'Pengadilan Agama' : 'Religious Court')}</p>
                  <p className="font-extrabold text-[#d4a017]">{siteSettings.court_name ? 'Penajam' : 'Penajam'}</p>
                </div>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">
                {siteSettings.footer_description || (lang === 'id'
                  ? 'Pengadilan Agama Penajam adalah lembaga peradilan yang bertugas memberikan keadilan bagi masyarakat Muslim di Kabupaten Penajam Paser Utara.'
                  : 'Penajam Religious Court serves justice for the Muslim community in Penajam Paser Utara Regency.')}
              </p>
              {socialLinks.length > 0 && (
                <div className="flex gap-2 mt-4">
                  {socialLinks.map(s => (
                    <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer"
                      title={s.label}
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm transition-colors"
                    >
                      {s.icon}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Links — 100% dynamic */}
            <nav aria-label={lang === 'id' ? 'Tautan cepat' : 'Quick links'}>
              <h3 className="font-bold text-[#d4a017] mb-4 text-sm uppercase tracking-wide">
                {lang === 'id'
                  ? (siteSettings.footer_links_title || 'Tautan Cepat')
                  : (siteSettings.footer_links_title_en || 'Quick Links')}
              </h3>
              <ul className="list-none p-0 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {footerLinksData.map((link, idx) => (
                  <li key={idx}>
                    <a href={link.href}
                      className="text-white/60 hover:text-white text-sm transition-colors flex items-center gap-1 min-h-[36px]">
                      {lang === 'id' ? link.label : (link.labelEn || link.label)}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Contact — dynamic */}
            <div>
              <h3 className="font-bold text-[#d4a017] mb-4 text-sm uppercase tracking-wide">
                {lang === 'id'
                  ? (siteSettings.footer_contact_title || 'Kontak Kami')
                  : (siteSettings.footer_contact_title_en || 'Contact Us')}
              </h3>
              <div className="space-y-2 text-sm text-white/60">
                {siteSettings.address && (
                  <p className="flex items-start gap-2">
                    <span className="flex-shrink-0">📍</span>
                    <span className="leading-relaxed">{siteSettings.address}</span>
                  </p>
                )}
                {siteSettings.phone && (
                  <p className="flex items-center gap-2">
                    <span>📞</span>
                    <a href={`tel:${siteSettings.phone.replace(/[^0-9+]/g, '')}`}
                      className="hover:text-white transition-colors">{siteSettings.phone}</a>
                  </p>
                )}
                {siteSettings.email && (
                  <p className="flex items-center gap-2">
                    <span>✉️</span>
                    <a href={`mailto:${siteSettings.email}`}
                      className="hover:text-white transition-colors">{siteSettings.email}</a>
                  </p>
                )}
                {(siteSettings.footer_hours || true) && (
                  <p className="flex items-start gap-2">
                    <span className="flex-shrink-0">🕐</span>
                    <span className="leading-relaxed whitespace-pre-line">
                      {siteSettings.footer_hours || (lang === 'id'
                        ? 'Sen–Kam: 08.00–16.00 WITA\nJum: 08.00–11.00 WITA'
                        : 'Mon–Thu: 08:00–16:00\nFri: 08:00–11:00')}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/50 text-sm">
              &copy; {new Date().getFullYear()}{' '}
              {siteSettings.footer_copyright ||
                (lang === 'id'
                  ? 'Pengadilan Agama Penajam. Hak Cipta Dilindungi.'
                  : 'Penajam Religious Court. All Rights Reserved.')}
            </p>
            <LanguageSwitcher variant="dark" scrolled={false} />
          </div>
        </div>
      </footer>
    </div>
  );
}
