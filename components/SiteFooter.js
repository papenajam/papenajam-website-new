'use client';
import { Scale } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

function parseFooterLinks(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return null;
  } catch {
    return null;
  }
}

const DEFAULT_LINKS = [
  { href: '/', label: 'Beranda', labelEn: 'Home' },
  { href: '/agenda-sidang', label: 'Agenda Sidang', labelEn: 'Court Schedule' },
  { href: '/putusan', label: 'Putusan', labelEn: 'Court Decisions' },
  { href: '/pencarian-perkara', label: 'Pencarian Perkara', labelEn: 'Case Search' },
  { href: '/galeri', label: 'Galeri Foto', labelEn: 'Photo Gallery' },
  { href: '/dokumen', label: 'Dokumen Publik', labelEn: 'Public Documents' },
  { href: '/faq', label: 'FAQ', labelEn: 'FAQ' },
  { href: '/pengaduan', label: 'Pengaduan', labelEn: 'Complaints' },
  { href: '/accessibility', label: '♿ Aksesibilitas', labelEn: 'Accessibility' },
];

export default function SiteFooter({ siteSettings = {} }) {
  const { lang } = useLanguage();

  const footerLinks = parseFooterLinks(siteSettings.footer_links) || DEFAULT_LINKS;

  const socialLinks = [
    siteSettings.facebook && { href: siteSettings.facebook, label: 'Facebook', icon: '📘' },
    siteSettings.instagram && { href: siteSettings.instagram, label: 'Instagram', icon: '📸' },
    siteSettings.twitter && { href: siteSettings.twitter, label: 'Twitter / X', icon: '🐦' },
    siteSettings.youtube && { href: siteSettings.youtube, label: 'YouTube', icon: '▶️' },
  ].filter(Boolean);

  const brandFirst = (() => {
    const raw = siteSettings.court_name || '';
    if (!raw) return lang === 'id' ? 'Pengadilan Agama' : 'Religious Court';
    // If setting contains "Penajam", strip trailing part for first line visual
    return raw.replace(/Penajam.*$/i, '').trim() || raw;
  })();

  return (
    <footer role="contentinfo" className="bg-pa-green text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Brand + description + social */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <Scale className="w-5 h-5 text-pa-gold" aria-hidden="true" />
              </div>
              <div>
                <p className="font-bold text-sm leading-tight">{brandFirst}</p>
                <p className="font-extrabold text-pa-gold leading-tight text-base">Penajam</p>
              </div>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              {siteSettings.footer_description ||
                (lang === 'id'
                  ? 'Pengadilan Agama Penajam adalah lembaga peradilan yang bertugas memberikan keadilan bagi masyarakat Muslim di Kabupaten Penajam Paser Utara.'
                  : 'Penajam Religious Court serves justice for the Muslim community in Penajam Paser Utara Regency.')}
            </p>
            {socialLinks.length > 0 && (
              <div className="flex gap-2 mt-4">
                {socialLinks.map((s) => (
                  <a
                    key={s.href}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={s.label}
                    aria-label={s.label}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm transition-colors min-h-[32px] min-w-[32px]"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Quick Links - 100% dynamic from settings */}
          <nav aria-label={lang === 'id' ? 'Tautan cepat' : 'Quick links'}>
            <h3 className="font-bold text-pa-gold mb-4 text-sm uppercase tracking-wide">
              {lang === 'id'
                ? siteSettings.footer_links_title || 'Tautan Cepat'
                : siteSettings.footer_links_title_en || 'Quick Links'}
            </h3>
            <ul className="list-none p-0 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {footerLinks.map((link, idx) => (
                <li key={`${link.href}-${idx}`}>
                  <a
                    href={link.href}
                    className="text-white/60 hover:text-white text-sm transition-colors flex items-center gap-1 min-h-[36px]"
                  >
                    {lang === 'id' ? link.label : link.labelEn || link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact dynamic */}
          <div>
            <h3 className="font-bold text-pa-gold mb-4 text-sm uppercase tracking-wide">
              {lang === 'id'
                ? siteSettings.footer_contact_title || 'Kontak Kami'
                : siteSettings.footer_contact_title_en || 'Contact Us'}
            </h3>
            <div className="space-y-2 text-sm text-white/60">
              {siteSettings.address && (
                <p className="flex items-start gap-2">
                  <span className="flex-shrink-0" aria-hidden="true">
                    📍
                  </span>
                  <span className="leading-relaxed">{siteSettings.address}</span>
                </p>
              )}
              {siteSettings.phone && (
                <p className="flex items-center gap-2">
                  <span aria-hidden="true">📞</span>
                  <a
                    href={`tel:${siteSettings.phone.replace(/[^0-9+]/g, '')}`}
                    className="hover:text-white transition-colors"
                  >
                    {siteSettings.phone}
                  </a>
                </p>
              )}
              {siteSettings.email && (
                <p className="flex items-center gap-2">
                  <span aria-hidden="true">✉️</span>
                  <a href={`mailto:${siteSettings.email}`} className="hover:text-white transition-colors">
                    {siteSettings.email}
                  </a>
                </p>
              )}
              <p className="flex items-start gap-2">
                <span className="flex-shrink-0" aria-hidden="true">
                  🕐
                </span>
                <span className="leading-relaxed whitespace-pre-line">
                  {siteSettings.footer_hours ||
                    (lang === 'id'
                      ? 'Sen–Kam: 08.00–16.00 WITA\nJum: 08.00–11.00 WITA'
                      : 'Mon–Thu: 08:00–16:00\nFri: 08:00–11:00')}
                </span>
              </p>
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
  );
}
