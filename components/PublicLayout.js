'use client';
import { useState, useEffect } from 'react';
import { Scale } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import MegaMenuNavbar from '@/components/MegaMenu';
import SiteFooter from '@/components/SiteFooter';

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

      {/* ── UNIFIED FOOTER ── */}
      <SiteFooter siteSettings={siteSettings} />
    </div>
  );
}
