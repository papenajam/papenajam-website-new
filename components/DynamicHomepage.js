'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Scale, Phone, Mail, MapPin, Search, ChevronRight,
  FileText, Calendar, DollarSign, Package, Shield, Monitor,
  Users, Stamp, Building2, BookOpen, Award, CheckCircle,
  Clock, ClipboardList, ArrowRight, ExternalLink, Globe, Newspaper,
  Download, ChevronDown, Plus, X, MessageSquare, Trophy, Video,
  ShieldCheck, Link2, Eye, Play
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import MegaMenuNavbar from '@/components/MegaMenu';
import SiteFooter from '@/components/SiteFooter';
import { sanitizeHTML } from '@/lib/sanitize';

const ICON_MAP = {
  FileText, Calendar, DollarSign, Package, Shield, Monitor,
  Users, Stamp, Scale, Building2, BookOpen, Globe, Award,
  Search, Clock, ClipboardList, CheckCircle, Phone, Mail, MapPin,
  ShieldCheck, Trophy, Video, Link2, ExternalLink, Eye,
};

const DEFAULT_ECOURT_ITEMS = [
  { id: 'ecourt', icon: 'Monitor', label: 'E-Court', labelEn: 'E-Court', url: 'https://ecourt.mahkamahagung.go.id', description: 'Pendaftaran perkara online', descriptionEn: 'Online case registration', badge: '', external: true },
  { id: 'sipp', icon: 'Search', label: 'SIPP', labelEn: 'SIPP', url: 'https://sipp.pa-penajam.go.id', description: 'Sistem Informasi Penelusuran Perkara', descriptionEn: 'Case Tracking System', badge: '', external: true },
  { id: 'gugatan-mandiri', icon: 'FileText', label: 'Gugatan Mandiri', labelEn: 'Independent Lawsuit', url: 'https://gugatan.mahkamahagung.go.id', description: 'Buat gugatan mandiri secara online', descriptionEn: 'Create independent lawsuit online', badge: '', external: true },
  { id: 'direktori-putusan', icon: 'Scale', label: 'Direktori Putusan', labelEn: 'Decision Directory', url: 'https://putusan3.mahkamahagung.go.id', description: 'Kumpulan putusan MA RI', descriptionEn: 'Supreme Court decision collection', badge: '', external: true },
  { id: 'panjar', icon: 'DollarSign', label: 'Panjar Biaya', labelEn: 'Fee Estimation', url: 'https://panjar.pa-penajam.go.id', description: 'Hitung estimasi panjar biaya perkara', descriptionEn: 'Estimate case fee advance', badge: 'Baru', external: true },
  { id: 'e-keuangan', icon: 'Building2', label: 'E-Keuangan', labelEn: 'E-Finance', url: 'https://pa-penajam.go.id', description: 'Informasi keuangan & transparansi', descriptionEn: 'Financial info & transparency', badge: '', external: true },
];

const DEFAULT_STEPPER_STEPS = [
  { id: 'step-1', number: 1, icon: 'FileText', title: 'Pendaftaran', titleEn: 'Registration', desc: 'Daftar di PTSP atau melalui E-Court online', descEn: 'Register at PTSP or via E-Court online', link: '' },
  { id: 'step-2', number: 2, icon: 'DollarSign', title: 'Pembayaran Panjar', titleEn: 'Advance Fee Payment', desc: 'Bayar panjar biaya perkara via bank/BRI VA', descEn: 'Pay case advance fee via bank', link: 'https://panjar.pa-penajam.go.id' },
  { id: 'step-3', number: 3, icon: 'Users', title: 'Mediasi', titleEn: 'Mediation', desc: 'Proses mediasi oleh mediator bersertifikat', descEn: 'Mediation by certified mediator', link: '' },
  { id: 'step-4', number: 4, icon: 'Scale', title: 'Persidangan', titleEn: 'Trial', desc: 'Hadir sidang sesuai jadwal yang ditetapkan', descEn: 'Attend trial as scheduled', link: '/agenda-sidang' },
  { id: 'step-5', number: 5, icon: 'Award', title: 'Putusan', titleEn: 'Verdict', desc: 'Putusan dibacakan & salinan dapat diambil', descEn: 'Verdict read & copy can be collected', link: '/putusan' },
];

// Default blocks - 10 informativeness priority, all admin-editable via _homepage slug, no hardcode production - generic fallbacks only
const DEFAULT_BLOCKS = [
  { id: 'default-hero',       type: 'hero_home',     settings: { title: 'Pengadilan Agama Penajam', subtitle: 'Memberikan Keadilan yang Cepat, Sederhana, dan Berbiaya Ringan untuk Masyarakat Kabupaten Penajam Paser Utara', buttonText: 'Lihat Layanan', buttonLink: '#layanan', button2Text: 'Hubungi Kami', button2Link: '#kontak', showStats: true, backgroundImage: '' } },
  { id: 'default-integrity',  type: 'integrity_strip', settings: { title: 'Zona Integritas & Anti Korupsi', subtitle: 'Berkomitmen membangun WBK/WBBM dan menolak gratifikasi', showBadgeStrip: true, bgColor: '#ffffff', badges: [{ id: 'b1', label: 'WBK', labelFull: 'Wilayah Bebas Korupsi', icon: '🛡️', year: '' }, { id: 'b2', label: 'BerAKHLAK', labelFull: 'Berorientasi Pelayanan Akuntabel Kompeten', icon: '⭐', year: '' }, { id: 'b3', label: 'APM', labelFull: 'Akreditasi Penjaminan Mutu', icon: '🏅', year: 'A' }], values: ['Berorientasi Pelayanan','Akuntabel','Kompeten','Harmonis','Loyal','Adaptif','Kolaboratif'], antiCorruptionText: 'Tolak Gratifikasi - Laporkan Pungli' } },
  { id: 'default-greeting',   type: 'leadership_greeting', settings: { title: 'Sambutan Ketua', subtitle: 'Pengadilan Agama Penajam', photoUrl: '', name: 'Ketua Pengadilan Agama Penajam', position: 'Ketua', nip: '', greeting: 'Assalamualaikum Wr. Wb. Pengadilan Agama Penajam berkomitmen memberikan pelayanan peradilan yang prima, transparan, dan berintegritas untuk masyarakat Kabupaten Penajam Paser Utara sebagai bagian dari Serambi Nusantara.', quote: 'Melayani dengan Integritas, Memutus dengan Keadilan', showNip: true, buttonText: 'Profil Lengkap', buttonLink: '/profil/pimpinan', bgColor: '#ffffff' } },
  { id: 'default-priority',   type: 'priority_services', settings: { title: 'Akses Keadilan untuk Semua', subtitle: 'Layanan khusus bagi masyarakat tidak mampu, wilayah remote, dan kelompok rentan', layout: 4, items: [{ id: 'ps1', icon: 'Scale', title: 'Posbakum Gratis', desc: 'Bantuan hukum gratis di PTSP', link: '/layanan/posbakum', badge: 'Gratis' }, { id: 'ps2', icon: 'DollarSign', title: 'Prodeo', desc: 'Bebas biaya untuk tidak mampu', link: '/layanan/prodeo', badge: '' }, { id: 'ps3', icon: 'MapPin', title: 'Sidang Keliling', desc: 'Sidang di kecamatan terdekat', link: '/layanan/sidang-keliling', badge: '' }, { id: 'ps4', icon: 'Users', title: 'Ramah Disabilitas', desc: 'Fasilitas untuk disabilitas & lansia', link: '/layanan/disabilitas', badge: 'Baru' }] } },
  { id: 'default-ecourt',     type: 'ecourt_links',  settings: { title: 'Layanan Digital Mahkamah Agung', subtitle: 'Akses layanan peradilan secara online, cepat, dan transparan', layout: 3, items: DEFAULT_ECOURT_ITEMS } },
  { id: 'default-maklumat',   type: 'maklumat_ptsp', settings: { title: 'Maklumat Pelayanan & Jam PTSP', subtitle: 'Komitmen kami memberikan pelayanan terbaik', maklumatTitle: 'Maklumat Pelayanan', maklumatText: 'Dengan ini kami menyatakan sanggup menyelenggarakan pelayanan sesuai standar pelayanan yang telah ditetapkan dan apabila tidak menepati janji ini, kami siap menerima sanksi sesuai peraturan perundang-undangan yang berlaku.', bgColor: '#f9fafb', showMaklumat: true, showHours: true, hours: [{ id: 'h1', day: 'Senin - Kamis', time: '08.00 - 16.30 WITA', desc: 'Istirahat 12.00-13.00' }, { id: 'h2', day: 'Jumat', time: '08.00 - 16.00 WITA', desc: 'Istirahat 11.30-13.00' }], ptspServices: [{ id: 'pt1', icon: 'FileText', title: 'Pendaftaran Perkara' }, { id: 'pt2', icon: 'DollarSign', title: 'Pembayaran Panjar' }, { id: 'pt3', icon: 'ClipboardList', title: 'Informasi Perkara' }, { id: 'pt4', icon: 'Award', title: 'Pengambilan Produk' }] } },
  { id: 'default-profile',    type: 'profile_cards', settings: { title: 'Profil Pengadilan', subtitle: 'Mengenal Pengadilan Agama Penajam lebih dekat - Wilayah Yurisdiksi Kab. Penajam Paser Utara' } },
  { id: 'default-stepper',    type: 'case_stepper',  settings: { title: 'Alur Berperkara', subtitle: 'Langkah mudah mengajukan perkara di Pengadilan Agama Penajam', steps: DEFAULT_STEPPER_STEPS, showNumbers: true } },
  { id: 'default-leaders',    type: 'leaders_grid', settings: { title: 'Pimpinan & Hakim', subtitle: 'Mengenal para hakim dan pejabat PA Penajam', category: '', limit: 8, columns: 4, showSearch: false } },
  { id: 'default-services',   type: 'services_grid', settings: { title: 'Layanan Kami', subtitle: 'Berbagai layanan tersedia untuk masyarakat pencari keadilan' } },
  { id: 'default-perkara',    type: 'case_search',   settings: { title: 'Informasi Perkara', subtitle: 'Cari informasi perkara Anda dengan mudah dan cepat' } },
  { id: 'default-agenda',     type: 'today_agenda',  settings: { title: 'Agenda Sidang Hari Ini', subtitle: 'Jadwal persidangan hari ini di Pengadilan Agama Penajam', limit: 6, showViewAll: true, bgColor: '#f9fafb' } },
  { id: 'default-transparency', type: 'transparency', settings: { title: 'Transparansi Anggaran & Kinerja', subtitle: 'Keterbukaan informasi anggaran dan capaian kinerja', showBudget: true, showReports: true, bgColor: '#f9fafb', items: [{ id: 'tr1', icon: 'DollarSign', label: 'DIPA Tahun Berjalan', value: '', link: '/dokumen?category=DIPA', desc: 'Daftar Isian Pelaksanaan Anggaran' }, { id: 'tr2', icon: 'BarChart2', label: 'Realisasi Anggaran', value: 'Realisasi triwulan', link: '/dokumen?category=Anggaran', desc: 'Laporan realisasi anggaran' }, { id: 'tr3', icon: 'FileText', label: 'LHKPN', value: '', link: '/dokumen?category=LHKPN', desc: 'Laporan Harta Kekayaan' }, { id: 'tr4', icon: 'ClipboardList', label: 'LKjIP / Laporan Tahunan', value: '', link: '/dokumen?category=Laporan', desc: 'Laporan Kinerja' }] } },
  { id: 'default-news',       type: 'news_ann',      settings: { title: 'Berita & Pengumuman', newsCount: 4, annCount: 5 } },
  { id: 'default-putusan',    type: 'recent_putusan',settings: { title: 'Putusan Terbaru', subtitle: 'Putusan yang baru dipublikasikan dan dapat diunduh', limit: 4, showViewAll: true } },
  { id: 'default-external',   type: 'external_links', settings: { title: 'Pusat Pelaporan & Pengawasan', subtitle: 'Saluran resmi pengaduan dan pengawasan eksternal MA RI', layout: 4, bgColor: '#1b5e20', items: [{ id: 'ex1', icon: '🔍', label: 'SIWAS MA RI', labelEn: 'SIWAS Supreme Court', url: 'https://siwas.mahkamahagung.go.id', description: 'Sistem Informasi Pengawasan', external: true, color: '#1b5e20' }, { id: 'ex2', icon: '📢', label: 'SP4N Lapor!', labelEn: 'SP4N Report', url: 'https://lapor.go.id', description: 'Layanan Aspirasi & Pengaduan Rakyat', external: true, color: '#d32f2f' }, { id: 'ex3', icon: '🚫', label: 'Saber Pungli', labelEn: 'Anti Extortion', url: 'https://saberpungli.id', description: 'Sapu Bersih Pungutan Liar', external: true, color: '#f57c00' }, { id: 'ex4', icon: '🎁', label: 'Gratifikasi', labelEn: 'Gratification', url: 'https://www.kpk.go.id', description: 'Lapor gratifikasi KPK', external: true, color: '#6a1b9a' }] } },
  { id: 'default-achievement', type: 'achievement_section', settings: { title: 'Pencapaian & Kepercayaan Publik', subtitle: 'Prestasi dan hasil survei kepuasan masyarakat', showAchievements: true, achievementsLimit: 6, showSKM: true, skmScore: '98.2', skmYear: '2024', skmCategory: 'Sangat Baik', skmLabel: 'Indeks Kepuasan Masyarakat', showSPAK: true, spakScore: '98.5', bgColor: '#ffffff' } },
  { id: 'default-gallery',    type: 'gallery_grid',  settings: { title: 'Galeri Foto', subtitle: 'Dokumentasi kegiatan dan gedung pengadilan', limit: 8, columns: 4, showViewAll: true } },
  { id: 'default-video',      type: 'video_profile', settings: { title: 'Profil Pengadilan', subtitle: 'Mengenal lebih dekat Pengadilan Agama Penajam', mainVideoUrl: '', mainTitle: 'Video Profil PA Penajam', showChannelLink: true, channelUrl: '', videos: [] } },
  { id: 'default-docs',       type: 'document_list', settings: { title: 'Dokumen & Peraturan', subtitle: 'Unduh dokumen resmi, SOP, Maklumat, dan peraturan', limit: 6, showViewAll: true } },
  { id: 'default-jurisdiction', type: 'jurisdiction_map', settings: { title: 'Wilayah Yurisdiksi & Lokasi Kantor', subtitle: 'Kabupaten Penajam Paser Utara - Serambi Nusantara (IKN)', embedUrl: '', height: 400, showRegionList: true, mapImage: '', regions: [{ id: 'r1', name: 'Kec. Penajam', desc: 'Ibu kota kabupaten' }, { id: 'r2', name: 'Kec. Waru', desc: '' }, { id: 'r3', name: 'Kec. Babulu', desc: '' }, { id: 'r4', name: 'Kec. Sepaku', desc: 'Kawasan IKN' }], address: 'Jl. Propinsi KM. 09, Penajam, Kab. PPU, Kaltim' } },
  { id: 'default-faq',        type: 'faq_section',   settings: { title: 'Tanya Jawab', subtitle: 'Pertanyaan yang sering diajukan masyarakat', limit: 6, bgColor: '#f9fafb' } },
  { id: 'default-panjar',     type: 'panjar_cta',     settings: { title: 'Estimasi Panjar Biaya Perkara', subtitle: 'Hitung estimasi biaya perkara Anda secara transparan melalui aplikasi resmi Panjar PA Penajam', buttonText: 'Buka Aplikasi Panjar', buttonUrl: 'https://panjar.pa-penajam.go.id', bgColor: '#1b5e20', features: ['Transparan', 'Akurat', 'Online 24 Jam'] } },
  { id: 'default-complaint',  type: 'complaint_cta', settings: { title: 'Sampaikan Pengaduan Anda', subtitle: 'Kami berkomitmen untuk meningkatkan pelayanan. Sampaikan masukan atau pengaduan Anda kepada kami.', buttonText: 'Kirim Pengaduan', buttonLink: '/pengaduan', bgColor: '#1b5e20', showPhone: true } },
  { id: 'default-contact',    type: 'contact_info',  settings: { title: 'Hubungi Kami', subtitle: 'Kami siap melayani Anda dengan sepenuh hati', bgColor: '#ffffff' } },
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
      {s.backgroundImage ? (
        <div className="absolute inset-0 opacity-25 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url('${s.backgroundImage}')` }} role="img" aria-label={lang === 'id' ? 'Gedung Pengadilan Agama Penajam' : 'Penajam Religious Court building'} />
      ) : null}
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

// ── E-Court Ecosystem Links ─────────────────────────────────────────
function ECourtLinksBlock({ settings }) {
  const s = settings || {};
  const { lang } = useLanguage();
  const items = s.items && s.items.length ? s.items : DEFAULT_ECOURT_ITEMS;
  const layout = s.layout || 3;
  const colClass = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-2 lg:grid-cols-4', 6: 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6' }[layout] || 'md:grid-cols-3';

  function resolveIcon(name) {
    const Icon = ICON_MAP[name];
    return Icon ? <Icon className="w-6 h-6" aria-hidden="true" /> : <span className="text-xl" aria-hidden="true">{name || '🔗'}</span>;
  }

  return (
    <section id="layanan-digital" className="py-16 lg:py-20 bg-gray-50" style={{ scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-pa-green mb-3">{s.title || (lang === 'id' ? 'Layanan Digital Mahkamah Agung' : 'Supreme Court Digital Services')}</h2>
          {s.subtitle && <p className="text-gray-500 max-w-2xl mx-auto text-sm">{s.subtitle}</p>}
        </div>
        <div className={`grid grid-cols-1 ${colClass} gap-4 lg:gap-6 max-w-6xl mx-auto`}>
          {items.map(item => {
            const label = lang === 'en' && item.labelEn ? item.labelEn : item.label;
            const desc = lang === 'en' && item.descriptionEn ? item.descriptionEn : item.description;
            const isExt = item.external !== false && (item.url?.startsWith('http') || item.external);
            return (
              <a
                key={item.id}
                href={item.url || '#'}
                target={isExt ? '_blank' : undefined}
                rel={isExt ? 'noopener noreferrer' : undefined}
                className="group bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-pa-green/20 transition-all flex flex-col h-full min-h-[44px]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-pa-green/10 rounded-xl flex items-center justify-center text-pa-green group-hover:bg-pa-green group-hover:text-pa-gold transition-colors">
                    {resolveIcon(item.icon)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {item.badge && <span className="px-2 py-0.5 bg-pa-orange/10 text-pa-orange-dark text-[10px] font-bold rounded-full uppercase">{item.badge}</span>}
                    {isExt && <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-pa-green" aria-hidden="true" />}
                  </div>
                </div>
                <h3 className="font-bold text-pa-green text-sm mb-1 group-hover:text-pa-green-dark transition-colors">{label}</h3>
                {desc && <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 flex-1">{desc}</p>}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Case Flow Stepper ───────────────────────────────────────────────
function CaseFlowBlock({ settings }) {
  const s = settings || {};
  const { lang } = useLanguage();
  const steps = s.steps && s.steps.length ? s.steps : DEFAULT_STEPPER_STEPS;
  const showNumbers = s.showNumbers !== false;

  function resolveIcon(name) {
    const Icon = ICON_MAP[name];
    return Icon ? <Icon className="w-5 h-5" aria-hidden="true" /> : null;
  }

  return (
    <section id="alur" className="py-16 lg:py-20 bg-white" style={{ scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-pa-green mb-3">{s.title || (lang === 'id' ? 'Alur Berperkara' : 'Case Flow')}</h2>
          {s.subtitle && <p className="text-gray-500 max-w-2xl mx-auto text-sm">{s.subtitle}</p>}
        </div>

        {/* Desktop horizontal */}
        <div className="hidden lg:block max-w-6xl mx-auto">
          <div className="relative flex justify-between">
            {/* Connector line */}
            <div className="absolute top-6 left-[8%] right-[8%] h-0.5 bg-pa-green/10" aria-hidden="true" />
            <div className="absolute top-6 left-[8%] h-0.5 bg-pa-gold/30 transition-all" style={{ width: '84%' }} aria-hidden="true" />
            {steps.map((step, idx) => {
              const title = lang === 'en' && step.titleEn ? step.titleEn : step.title;
              const desc = lang === 'en' && step.descEn ? step.descEn : step.desc;
              const isLast = idx === steps.length - 1;
              return (
                <div key={step.id || idx} className="relative flex flex-col items-center text-center flex-1 px-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-white shadow-md z-10 mb-4 ${idx === 0 ? 'bg-pa-orange text-white' : isLast ? 'bg-pa-gold text-white' : 'bg-pa-green text-white'}`}>
                    {showNumbers ? <span className="font-extrabold text-sm">{step.number || idx + 1}</span> : resolveIcon(step.icon) || <span className="font-bold">{step.number || idx + 1}</span>}
                  </div>
                  <h3 className="font-bold text-pa-green text-sm mb-1">{title}</h3>
                  <p className="text-gray-500 text-xs max-w-[160px] leading-relaxed">{desc}</p>
                  {step.link && (
                    <a href={step.link} target={step.link.startsWith('http') ? '_blank' : undefined} rel={step.link.startsWith('http') ? 'noopener noreferrer' : undefined} className="mt-2 text-pa-gold-dark text-[11px] font-semibold hover:underline inline-flex items-center gap-1">
                      {lang === 'id' ? 'Selengkapnya' : 'Details'} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile vertical */}
        <div className="lg:hidden max-w-xl mx-auto relative">
          <div className="absolute left-6 top-2 bottom-2 w-0.5 bg-pa-green/10" aria-hidden="true" />
          <div className="space-y-6">
            {steps.map((step, idx) => {
              const title = lang === 'en' && step.titleEn ? step.titleEn : step.title;
              const desc = lang === 'en' && step.descEn ? step.descEn : step.desc;
              const isLast = idx === steps.length - 1;
              return (
                <div key={step.id || idx} className="relative flex gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-white shadow-md flex-shrink-0 z-10 ${idx === 0 ? 'bg-pa-orange text-white' : isLast ? 'bg-pa-gold text-white' : 'bg-pa-green text-white'}`}>
                    {showNumbers ? <span className="font-extrabold text-sm">{step.number || idx + 1}</span> : resolveIcon(step.icon) || <span className="font-bold">{step.number || idx + 1}</span>}
                  </div>
                  <div className="pt-1">
                    <h3 className="font-bold text-pa-green text-sm">{title}</h3>
                    <p className="text-gray-500 text-xs mt-1 leading-relaxed">{desc}</p>
                    {step.link && (
                      <a href={step.link} target={step.link.startsWith('http') ? '_blank' : undefined} rel={step.link.startsWith('http') ? 'noopener noreferrer' : undefined} className="mt-1 text-pa-gold-dark text-xs font-semibold hover:underline inline-flex items-center gap-1 min-h-[44px]">
                        {lang === 'id' ? 'Selengkapnya' : 'Details'} <ArrowRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Today Agenda ────────────────────────────────────────────────────
function TodayAgendaBlock({ settings, agendaToday }) {
  const s = settings || {};
  const { lang } = useLanguage();
  const limit = s.limit || 6;
  const items = (agendaToday || []).slice(0, limit);
  const todayLabel = new Date().toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const statusColor = (status) => ({ selesai: 'bg-green-100 text-green-700', dijadwalkan: 'bg-blue-100 text-blue-700', ditunda: 'bg-yellow-100 text-yellow-700', dibatalkan: 'bg-red-100 text-red-700' }[status] || 'bg-gray-100 text-gray-700');

  return (
    <section id="agenda-hari-ini" className="py-16 lg:py-20" style={{ background: s.bgColor || '#f9fafb', scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 max-w-5xl mx-auto">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-pa-green mb-2">{s.title || (lang === 'id' ? 'Agenda Sidang Hari Ini' : "Today's Court Schedule")}</h2>
            <p className="text-gray-500 text-sm">{s.subtitle || todayLabel}</p>
          </div>
          {s.showViewAll !== false && (
            <a href="/agenda-sidang" className="inline-flex items-center gap-2 text-pa-green font-semibold text-sm hover:text-pa-gold-dark transition-colors min-h-[44px]">
              {lang === 'id' ? 'Lihat Semua Agenda' : 'View All Schedule'} <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
          )}
        </div>

        <div className="max-w-5xl mx-auto">
          {items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
              <p className="font-semibold text-gray-600 text-sm">{lang === 'id' ? 'Tidak ada agenda sidang hari ini' : 'No court schedule today'}</p>
              <p className="text-gray-400 text-xs mt-1">{lang === 'id' ? 'Silakan cek agenda minggu ini di halaman agenda sidang' : 'Check this week agenda on schedule page'}</p>
              <a href="/agenda-sidang" className="inline-flex mt-4 border border-pa-green text-pa-green hover:bg-pa-green hover:text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors min-h-[44px] items-center">
                {lang === 'id' ? 'Buka Agenda Sidang' : 'Open Schedule'}
              </a>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="hidden md:grid grid-cols-[90px_1fr_140px_120px_100px] gap-4 px-6 py-3 bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                <span>{lang === 'id' ? 'Waktu' : 'Time'}</span>
                <span>{lang === 'id' ? 'Nomor Perkara' : 'Case Number'}</span>
                <span>{lang === 'id' ? 'Ruang' : 'Room'}</span>
                <span>Hakim</span>
                <span>Status</span>
              </div>
              <ul className="divide-y divide-gray-50 list-none p-0 m-0">
                {items.map(item => (
                  <li key={item.id} className="px-5 md:px-6 py-4 hover:bg-gray-50/60 transition-colors">
                    {/* Mobile */}
                    <div className="md:hidden space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-pa-green">{item.waktuSidang || '-'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor(item.status)}`}>{item.status || '-'}</span>
                      </div>
                      <p className="font-bold text-pa-green text-sm">{item.nomorPerkara}</p>
                      <p className="text-gray-500 text-xs">{item.jenisPerkara || ''} • {item.ruangSidang || '-'}</p>
                      {item.hakim && <p className="text-gray-400 text-xs truncate">{item.hakim.split(',')[0]}</p>}
                    </div>
                    {/* Desktop */}
                    <div className="hidden md:grid grid-cols-[90px_1fr_140px_120px_100px] gap-4 items-center">
                      <span className="font-mono text-sm font-semibold text-pa-green">{item.waktuSidang || '-'}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-pa-green text-sm truncate">{item.nomorPerkara}</p>
                        <p className="text-gray-500 text-xs truncate">{item.jenisPerkara || ''}</p>
                      </div>
                      <span className="text-gray-600 text-xs">{item.ruangSidang || '-'}</span>
                      <span className="text-gray-500 text-xs truncate" title={item.hakim}>{item.hakim ? item.hakim.split(' ')[0] + ' ' + (item.hakim.split(' ')[1] || '') : '-'}</span>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-semibold text-center ${statusColor(item.status)}`}>{item.status || '-'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Recent Putusan ─────────────────────────────────────────────────
function RecentPutusanBlock({ settings, putusanList, formatDate }) {
  const s = settings || {};
  const { lang } = useLanguage();
  const limit = s.limit || 4;
  const items = (putusanList || []).slice(0, limit);

  return (
    <section id="putusan-terbaru" className="py-16 lg:py-20 bg-white" style={{ scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 max-w-5xl mx-auto">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-pa-green mb-2">{s.title || (lang === 'id' ? 'Putusan Terbaru' : 'Recent Decisions')}</h2>
            {s.subtitle && <p className="text-gray-500 text-sm">{s.subtitle}</p>}
          </div>
          {s.showViewAll !== false && (
            <a href="/putusan" className="inline-flex items-center gap-2 text-pa-green font-semibold text-sm hover:text-pa-gold-dark transition-colors min-h-[44px]">
              {lang === 'id' ? 'Lihat Semua Putusan' : 'View All Decisions'} <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
          )}
        </div>

        {items.length === 0 ? (
          <div className="max-w-5xl mx-auto bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-10 text-center">
            <Scale className="w-10 h-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
            <p className="font-semibold text-gray-600 text-sm">{lang === 'id' ? 'Belum ada putusan terbaru' : 'No recent decisions'}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 max-w-5xl mx-auto">
            {items.map(item => (
              <article key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-pa-green text-sm leading-snug">{item.nomorPerkara}</h3>
                  {item.tanggalPutusan && (
                    <time dateTime={item.tanggalPutusan} className="text-[11px] text-gray-500 whitespace-nowrap bg-gray-50 px-2 py-1 rounded-full">
                      {formatDate(item.tanggalPutusan)}
                    </time>
                  )}
                </div>
                {item.jenisPerkara && <span className="inline-block px-2 py-0.5 bg-pa-green/10 text-pa-green text-[10px] font-semibold rounded-full mb-2">{item.jenisPerkara}</span>}
                {item.ringkasanPutusan && <p className="text-gray-600 text-xs leading-relaxed line-clamp-3">{item.ringkasanPutusan}</p>}
                {item.hakim && <p className="text-gray-400 text-xs mt-2 truncate">Hakim: {item.hakim}</p>}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Panjar CTA ─────────────────────────────────────────────────────
function PanjarCtaBlock({ settings }) {
  const s = settings || {};
  const { lang } = useLanguage();
  const features = s.features || ['Transparan', 'Akurat', 'Online 24 Jam'];

  return (
    <section id="panjar" className="py-16 lg:py-20" style={{ background: s.bgColor || '#1b5e20', scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <DollarSign className="w-8 h-8 text-pa-gold" aria-hidden="true" />
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-4">{s.title || (lang === 'id' ? 'Estimasi Panjar Biaya Perkara' : 'Case Fee Estimation')}</h2>
          <p className="text-white/80 text-base lg:text-lg max-w-2xl mx-auto mb-6 leading-relaxed">
            {s.subtitle || (lang === 'id' ? 'Hitung estimasi biaya perkara Anda secara transparan melalui aplikasi resmi Panjar PA Penajam' : 'Estimate your case fee transparently via official Panjar app')}
          </p>
          {features.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {features.map(f => (
                <span key={f} className="inline-flex items-center gap-1.5 bg-white/10 border border-white/10 text-white/90 px-3 py-1 rounded-full text-xs font-semibold">
                  <CheckCircle className="w-3.5 h-3.5 text-pa-gold" aria-hidden="true" /> {f}
                </span>
              ))}
            </div>
          )}
          <a
            href={s.buttonUrl || 'https://panjar.pa-penajam.go.id'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-pa-gold hover:bg-pa-gold-dark text-white font-bold px-8 py-4 rounded-xl text-base transition-colors min-h-[52px] shadow-lg"
          >
            {s.buttonText || (lang === 'id' ? 'Buka Aplikasi Panjar' : 'Open Panjar App')} <ExternalLink className="w-4 h-4" aria-hidden="true" />
          </a>
          <p className="text-white/50 text-xs mt-4">{lang === 'id' ? 'Akan membuka di tab baru • Resmi PA Penajam' : 'Opens in new tab • Official PA Penajam'}</p>
        </div>
      </div>
    </section>
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
        <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto list-none p-0">
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
                  {searchResult.map(c => {
                    const parties = c.pemohon && c.termohon
                      ? (c.termohon === '-' ? c.pemohon : `${c.pemohon} vs ${c.termohon}`)
                      : c.pemohon || c.termohon || c.nomorPerkara;
                    return (
                    <li key={c.id}>
                      <article className="bg-white rounded-xl p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-pa-green text-sm">{t('caseSearch.caseNumber')}: {c.nomorPerkara}</h4>
                            <p className="text-gray-600 text-xs mt-1 truncate">{t('caseSearch.parties')}: {parties}</p>
                            {c.jenisPerkara && <p className="text-gray-500 text-[11px] mt-1">{c.jenisPerkara} • {c.tahun}</p>}
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${statusColor(c.status)}`}>{statusLabel(c.status)}</span>
                        </div>
                      </article>
                    </li>
                  );})}
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
  const hasPhone = !!siteSettings.phone;
  const hasEmail = !!siteSettings.email;
  const hasAddress = !!siteSettings.address;

  const items = [
    { icon: MapPin, title: t('contact.address'), content: siteSettings.address || (lang === 'id' ? 'Jl. Propinsi Kab. Penajam Paser Utara, Kaltim' : 'Penajam Paser Utara, East Kalimantan'), href: hasAddress ? `https://maps.google.com/?q=${encodeURIComponent(siteSettings.address)}` : 'https://maps.google.com/?q=Pengadilan+Agama+Penajam', linkLabel: t('contact.mapLink'), show: true },
    { icon: Phone, title: t('contact.phone'), content: siteSettings.phone || '-', href: hasPhone ? `tel:${siteSettings.phone.replace(/[^0-9+]/g, '')}` : null, linkLabel: lang === 'id' ? 'Hubungi via telepon' : 'Call us', show: hasPhone },
    { icon: Mail, title: t('contact.email'), content: siteSettings.email || '-', href: hasEmail ? `mailto:${siteSettings.email}` : null, linkLabel: lang === 'id' ? 'Kirim email' : 'Send email', show: hasEmail },
    { icon: Clock, title: t('contact.operationalHours'), content: t('contact.hours'), href: null, show: true },
  ].filter(i => i.show);

  return (
    <section id="kontak" aria-labelledby="contact-h" className="py-20" style={{ background: s.bgColor || '#ffffff', scrollMarginTop: '80px' }}>
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

function ProfileCardsBlock({ settings, siteSettings }) {
  const s = settings || {};
  const { t, lang } = useLanguage();
  const vision = siteSettings.vision || (lang === 'id' ? '"Terwujudnya Pengadilan Agama Penajam yang Agung"' : '"A Dignified Penajam Religious Court"');
  const mission = siteSettings.mission || (lang === 'id' ? 'Menjaga kemandirian, memberikan pelayanan hukum yang berkeadilan, berkualitas, dan terpercaya.' : 'Maintaining independence, providing just, quality, and trustworthy legal services.');
  const address = siteSettings.address || (lang === 'id' ? 'Jl. Propinsi No. 01, Penajam, Kab. Penajam Paser Utara, Kalimantan Timur' : 'Jl. Propinsi No. 01, Penajam, East Kalimantan');

  const cards = [
    { icon: Award, title: t('profile.vision'), content: vision },
    { icon: CheckCircle, title: t('profile.mission'), content: mission },
    { icon: Building2, title: t('profile.location'), content: address },
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
              <p className="text-gray-600 text-sm leading-relaxed line-clamp-4">{content}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// Static blocks (unchanged structure)
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

// New existing dynamic blocks from old file (gallery, faq, etc)
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


// ============================================================
// 10 NEW BLOCKS - 100% ADMIN EDITABLE, NO HARDCODE
// ============================================================

// Helper to resolve icon name string to component or fallback
function resolveIconNode(name, className = "w-6 h-6") {
  if (!name) return null;
  const Icon = ICON_MAP[name];
  if (Icon) return <Icon className={className} aria-hidden="true" />;
  // emoji or single char fallback
  if (name.length <= 3) return <span className={className} aria-hidden="true">{name}</span>;
  return <span className={className + " text-xs"} aria-hidden="true">{name.slice(0,2)}</span>;
}

function LeadershipGreetingBlock({ settings, siteSettings }) {
  const s = settings || {};
  const { lang } = useLanguage();
  const greeting = lang === 'en' && s.greetingEn ? s.greetingEn : s.greeting;
  const quote = lang === 'en' && s.quoteEn ? s.quoteEn : s.quote;
  const name = lang === 'en' && s.nameEn ? s.nameEn : s.name;
  const position = lang === 'en' && s.positionEn ? s.positionEn : s.position;
  return (
    <section id="sambutan-ketua" className="py-16 lg:py-20" style={{ background: s.bgColor || '#ffffff', scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-pa-green mb-3">{s.title || 'Sambutan Ketua'}</h2>
            {s.subtitle && <p className="text-gray-500 text-sm max-w-2xl mx-auto">{s.subtitle}</p>}
          </div>
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="grid md:grid-cols-[280px_1fr] gap-0">
              <div className="bg-gradient-to-br from-pa-green to-pa-green-mid p-8 flex flex-col items-center text-center">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-white/10 border-4 border-white/20 mb-4 flex items-center justify-center">
                  {s.photoUrl ? <img src={s.photoUrl} alt={name || 'Ketua'} className="w-full h-full object-cover" loading="lazy" /> : <Users className="w-12 h-12 text-white/60" aria-hidden="true" />}
                </div>
                <h3 className="text-white font-bold text-base leading-tight">{name || 'Ketua Pengadilan'}</h3>
                <p className="text-pa-gold text-sm font-semibold mt-1">{position || 'Ketua'}</p>
                {s.showNip !== false && s.nip && <p className="text-white/60 text-xs mt-1 font-mono">{s.nip}</p>}
                {quote && (
                  <div className="mt-6 bg-white/10 rounded-xl p-3 border border-white/10">
                    <p className="text-pa-gold text-xs italic leading-relaxed">“{quote}”</p>
                  </div>
                )}
              </div>
              <div className="p-8">
                {quote && (
                  <div className="mb-6">
                    <div className="text-pa-gold text-5xl leading-none font-serif">“</div>
                    <p className="text-pa-green font-semibold text-lg -mt-4 ml-4 leading-relaxed">{quote}</p>
                  </div>
                )}
                {greeting && <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{greeting}</p>}
                {s.buttonText && s.buttonLink && (
                  <a href={s.buttonLink} className="inline-flex items-center gap-2 mt-6 bg-pa-green hover:bg-pa-green-mid text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors">
                    {s.buttonText} <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LeadersGridBlock({ settings, leadersList }) {
  const s = settings || {};
  const { lang } = useLanguage();
  const cols = s.columns || 4;
  const colClass = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-2 lg:grid-cols-4' }[cols] || 'md:grid-cols-4';
  const category = (s.category || '').toLowerCase().trim();
  let items = leadersList || [];
  if (category) items = items.filter(l => (l.category || '').toLowerCase().includes(category));
  const limit = s.limit || 8;
  items = items.slice(0, limit);

  return (
    <section id="pimpinan" className="py-16 lg:py-20 bg-gray-50" style={{ scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-pa-green mb-3">{s.title || 'Pimpinan & Hakim'}</h2>
          {s.subtitle && <p className="text-gray-500 text-sm max-w-2xl mx-auto">{s.subtitle}</p>}
        </div>
        {items.length === 0 ? (
          <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
            <p className="font-semibold text-gray-600 text-sm">{lang === 'id' ? 'Belum ada data pimpinan' : 'No leaders yet'}</p>
            <p className="text-gray-400 text-xs mt-1">{lang === 'id' ? 'Kelola di Admin > Pimpinan & Hakim' : 'Manage in Admin > Leaders'}</p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${colClass} gap-6 max-w-6xl mx-auto`}>
            {items.map(item => {
              const displayName = lang === 'en' && item.nameEn ? item.nameEn : item.name;
              const displayTitle = lang === 'en' && item.titleEn ? item.titleEn : item.title;
              const displayBio = lang === 'en' && item.bioEn ? item.bioEn : item.bio;
              return (
                <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow text-center">
                  <div className="aspect-[4/3] bg-gray-50 relative overflow-hidden">
                    {item.photoUrl ? <img src={item.photoUrl} alt={displayName} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><Users className="w-12 h-12 text-gray-300" /></div>}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                      <span className="inline-block px-2 py-0.5 bg-pa-gold text-white text-[10px] font-bold rounded-full uppercase">{displayTitle}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-pa-green text-sm leading-tight">{displayName}</h3>
                    <p className="text-pa-gold-dark text-xs font-semibold mt-1">{displayTitle}</p>
                    {item.nip && <p className="text-gray-400 text-[11px] font-mono mt-1">{item.nip}</p>}
                    {displayBio && <p className="text-gray-500 text-xs mt-2 line-clamp-2 leading-relaxed">{displayBio}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function PriorityServicesBlock({ settings }) {
  const s = settings || {};
  const { lang } = useLanguage();
  const items = s.items || [];
  const layout = s.layout || 4;
  const colClass = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-2 lg:grid-cols-4' }[layout] || 'md:grid-cols-4';
  return (
    <section id="layanan-prioritas" className="py-16 lg:py-20 bg-white" style={{ scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-pa-green mb-3">{s.title || 'Akses Keadilan untuk Semua'}</h2>
          {s.subtitle && <p className="text-gray-500 max-w-2xl mx-auto text-sm">{s.subtitle}</p>}
        </div>
        {items.length === 0 ? (
          <div className="max-w-5xl mx-auto bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-8 text-center text-gray-500 text-sm">Belum ada layanan prioritas. Tambahkan di Admin → Pengaturan Beranda → Layanan Prioritas.</div>
        ) : (
          <div className={`grid grid-cols-1 ${colClass} gap-4 max-w-6xl mx-auto`}>
            {items.map(item => {
              const CardContent = (
                <>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 bg-pa-green/10 rounded-xl flex items-center justify-center text-pa-green group-hover:bg-pa-green group-hover:text-pa-gold transition-colors">
                      {resolveIconNode(item.icon, "w-6 h-6")}
                    </div>
                    {item.badge && <span className="px-2 py-0.5 bg-pa-orange/10 text-pa-orange-dark text-[10px] font-bold rounded-full uppercase">{item.badge}</span>}
                  </div>
                  <h3 className="font-bold text-pa-green text-sm mb-1 group-hover:text-pa-green-dark">{item.title}</h3>
                  {item.desc && <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>}
                  {item.link && <span className="inline-flex items-center gap-1 mt-3 text-pa-gold-dark text-xs font-semibold">Selengkapnya <ArrowRight className="w-3 h-3" /></span>}
                </>
              );
              if (item.link) {
                return <a key={item.id} href={item.link} className="group bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-pa-green/20 transition-all flex flex-col h-full">{CardContent}</a>;
              }
              return <div key={item.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col h-full">{CardContent}</div>;
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function MaklumatPTSPBlock({ settings }) {
  const s = settings || {};
  const hours = s.hours || [];
  const ptsp = s.ptspServices || [];
  return (
    <section id="maklumat-ptsp" className="py-16 lg:py-20" style={{ background: s.bgColor || '#f9fafb', scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-pa-green mb-3">{s.title || 'Maklumat Pelayanan & Jam PTSP'}</h2>
          {s.subtitle && <p className="text-gray-500 max-w-2xl mx-auto text-sm">{s.subtitle}</p>}
        </div>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-6">
          {s.showMaklumat !== false && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-pa-green rounded-xl flex items-center justify-center"><Scale className="w-5 h-5 text-pa-gold" aria-hidden="true" /></div>
                <h3 className="font-bold text-pa-green">{s.maklumatTitle || 'Maklumat Pelayanan'}</h3>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line bg-pa-green/5 rounded-xl p-4 border border-pa-green/10">{s.maklumatText || 'Kami berkomitmen memberikan pelayanan terbaik sesuai standar.'}</p>
            </div>
          )}
          {s.showHours !== false && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-pa-gold rounded-xl flex items-center justify-center"><Clock className="w-5 h-5 text-white" aria-hidden="true" /></div>
                <h3 className="font-bold text-pa-green">Jam Pelayanan PTSP</h3>
              </div>
              <div className="space-y-3">
                {hours.map(h => (
                  <div key={h.id} className="flex justify-between items-start gap-4 bg-gray-50 rounded-xl px-4 py-3">
                    <div>
                      <p className="font-semibold text-pa-green text-sm">{h.day}</p>
                      {h.desc && <p className="text-gray-400 text-xs">{h.desc}</p>}
                    </div>
                    <span className="font-bold text-pa-green-mid text-sm whitespace-nowrap bg-white px-2 py-1 rounded-lg border">{h.time}</span>
                  </div>
                ))}
                {hours.length === 0 && <p className="text-gray-400 text-xs text-center py-4">Jam layanan belum diatur di admin.</p>}
              </div>
              {ptsp.length > 0 && (
                <>
                  <h4 className="font-bold text-pa-green text-sm mt-6 mb-3">Layanan PTSP</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {ptsp.map(it => (
                      <div key={it.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                        <div className="text-pa-green">{resolveIconNode(it.icon, "w-4 h-4")}</div>
                        <span className="text-xs font-medium text-gray-700 truncate">{it.title}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function IntegrityStripBlock({ settings }) {
  const s = settings || {};
  const badges = s.badges || [];
  const values = s.values || [];
  return (
    <section id="zona-integritas" className="py-12 lg:py-16" style={{ background: s.bgColor || '#ffffff', scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-extrabold text-pa-green mb-3">{s.title || 'Zona Integritas & Anti Korupsi'}</h2>
          {s.subtitle && <p className="text-gray-500 text-sm max-w-2xl mx-auto">{s.subtitle}</p>}
        </div>
        {s.showBadgeStrip !== false && badges.length > 0 && (
          <div className="flex flex-wrap justify-center gap-4 mb-8 max-w-4xl mx-auto">
            {badges.map(b => (
              <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-3 min-w-[180px]">
                <div className="w-10 h-10 rounded-xl bg-pa-green/10 flex items-center justify-center text-xl flex-shrink-0">{b.icon || '🏅'}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-extrabold text-pa-green text-sm">{b.label}</p>
                    {b.year && <span className="px-1.5 py-0.5 bg-pa-gold/10 text-pa-gold-dark text-[10px] font-bold rounded-full">{b.year}</span>}
                  </div>
                  {b.labelFull && <p className="text-gray-500 text-xs leading-tight">{b.labelFull}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        {values.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-4xl mx-auto">
            {values.map(v => (
              <span key={v} className="px-3 py-1.5 bg-pa-green/5 border border-pa-green/10 text-pa-green text-xs font-semibold rounded-full">{v}</span>
            ))}
          </div>
        )}
        {s.antiCorruptionText && (
          <div className="max-w-3xl mx-auto bg-gradient-to-r from-pa-green to-pa-green-mid rounded-2xl p-4 flex items-center justify-center gap-3 text-center">
            <ShieldCheck className="w-5 h-5 text-pa-gold flex-shrink-0" aria-hidden="true" />
            <p className="text-white font-bold text-sm">{s.antiCorruptionText}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function TransparencyBlock({ settings, documentItems }) {
  const s = settings || {};
  const items = s.items || [];
  const { lang } = useLanguage();
  return (
    <section id="transparansi" className="py-16 lg:py-20" style={{ background: s.bgColor || '#f9fafb', scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-pa-green mb-3">{s.title || 'Transparansi Anggaran & Kinerja'}</h2>
          {s.subtitle && <p className="text-gray-500 text-sm max-w-2xl mx-auto">{s.subtitle}</p>}
        </div>
        {items.length === 0 ? (
          <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center text-gray-500 text-sm">Belum ada item transparansi. Tambahkan di Admin Homepage Builder.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {items.map(item => (
              <a key={item.id} href={item.link || '#'} className="group bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-pa-green/20 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-pa-green/10 rounded-xl flex items-center justify-center text-pa-green group-hover:bg-pa-green group-hover:text-pa-gold transition-colors">
                    {resolveIconNode(item.icon, "w-5 h-5")}
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-pa-green" aria-hidden="true" />
                </div>
                <h3 className="font-bold text-pa-green text-sm mb-1">{item.label}</h3>
                {item.value && <p className="text-pa-gold-dark text-xs font-bold mb-1">{item.value}</p>}
                {item.desc && <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ExternalLinksBlock({ settings }) {
  const s = settings || {};
  const items = s.items || [];
  const layout = s.layout || 4;
  const colClass = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-2 lg:grid-cols-4' }[layout] || 'md:grid-cols-4';
  const { lang } = useLanguage();
  return (
    <section id="pelaporan" className="py-14 lg:py-16" style={{ background: s.bgColor || '#1b5e20', scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-3">{s.title || 'Pusat Pelaporan & Pengawasan'}</h2>
          {s.subtitle && <p className="text-white/70 text-sm max-w-2xl mx-auto">{s.subtitle}</p>}
        </div>
        {items.length === 0 ? (
          <div className="max-w-5xl mx-auto bg-white/10 border border-white/10 rounded-2xl p-6 text-center text-white/60 text-sm">Belum ada tautan pengawasan.</div>
        ) : (
          <div className={`grid grid-cols-1 ${colClass} gap-4 max-w-6xl mx-auto`}>
            {items.map(item => {
              const label = lang === 'en' && item.labelEn ? item.labelEn : item.label;
              return (
                <a key={item.id} href={item.url || '#'} target={item.external !== false ? '_blank' : undefined} rel={item.external !== false ? 'noopener noreferrer' : undefined}
                  className="group bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/15 rounded-2xl p-5 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 text-white text-xl">{item.icon || '🔗'}</div>
                    <ExternalLink className="w-4 h-4 text-white/40 group-hover:text-pa-gold" aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-white text-sm mb-1 group-hover:text-pa-gold transition-colors">{label}</h3>
                  {item.description && <p className="text-white/60 text-xs leading-relaxed line-clamp-2">{item.description}</p>}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function JurisdictionMapBlock({ settings }) {
  const s = settings || {};
  const regions = s.regions || [];
  const height = s.height || 400;
  return (
    <section id="yurisdiksi" className="py-16 lg:py-20 bg-white" style={{ scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-pa-green mb-3">{s.title || 'Wilayah Yurisdiksi & Lokasi'}</h2>
          {s.subtitle && <p className="text-gray-500 text-sm max-w-2xl mx-auto">{s.subtitle}</p>}
        </div>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-gray-50" style={{ height: `${height}px` }}>
            {s.embedUrl ? (
              <iframe src={s.embedUrl} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={s.title || 'Peta'} />
            ) : s.mapImage ? (
              <img src={s.mapImage} alt="Peta Yurisdiksi" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-6">
                <MapPin className="w-12 h-12 mb-3 text-gray-300" aria-hidden="true" />
                <p className="text-sm font-medium">Peta belum diatur</p>
                <p className="text-xs mt-1 text-center">Masukkan Google Maps Embed URL di Admin Homepage Builder &gt; Peta Yurisdiksi</p>
              </div>
            )}
          </div>
          <div className="space-y-4">
            {s.address && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-pa-green rounded-xl flex items-center justify-center flex-shrink-0"><MapPin className="w-5 h-5 text-pa-gold" aria-hidden="true" /></div>
                  <div>
                    <h4 className="font-bold text-pa-green text-sm">Alamat Kantor</h4>
                    <p className="text-gray-600 text-sm leading-relaxed mt-1 whitespace-pre-line">{s.address}</p>
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(s.address)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-pa-gold-dark text-xs font-semibold hover:underline">Buka di Google Maps <ExternalLink className="w-3 h-3" /></a>
                  </div>
                </div>
              </div>
            )}
            {s.showRegionList !== false && regions.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h4 className="font-bold text-pa-green text-sm mb-3">Wilayah Yurisdiksi</h4>
                <p className="text-gray-500 text-xs mb-3">Kabupaten Penajam Paser Utara - 4 Kecamatan</p>
                <div className="space-y-2">
                  {regions.map(r => (
                    <div key={r.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                      <div className="w-8 h-8 bg-pa-green/10 rounded-lg flex items-center justify-center flex-shrink-0"><MapPin className="w-4 h-4 text-pa-green" /></div>
                      <div className="min-w-0">
                        <p className="font-semibold text-pa-green text-sm leading-tight">{r.name}</p>
                        {r.desc && <p className="text-gray-500 text-xs truncate">{r.desc}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function VideoProfileBlock({ settings }) {
  const s = settings || {};
  const videos = s.videos || [];
  const { lang } = useLanguage();
  function normalizeEmbed(url) {
    if (!url) return '';
    // Convert youtube watch to embed if needed
    if (url.includes('youtube.com/watch')) {
      const m = url.match(/[?&]v=([^&]+)/);
      if (m) return `https://www.youtube.com/embed/${m[1]}`;
    }
    if (url.includes('youtu.be/')) {
      const id = url.split('youtu.be/')[1]?.split('?')[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    return url;
  }
  const mainEmbed = normalizeEmbed(s.mainVideoUrl);
  return (
    <section id="video-profil" className="py-16 lg:py-20 bg-gray-50" style={{ scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-pa-green mb-3">{s.title || 'Profil Pengadilan'}</h2>
          {s.subtitle && <p className="text-gray-500 text-sm max-w-2xl mx-auto">{s.subtitle}</p>}
        </div>
        <div className="max-w-5xl mx-auto">
          {mainEmbed ? (
            <div className="rounded-3xl overflow-hidden shadow-lg border border-gray-100 bg-black aspect-video relative">
              <iframe src={mainEmbed} title={s.mainTitle || 'Video Profil'} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
            </div>
          ) : (
            <div className="rounded-3xl bg-white border-2 border-dashed border-gray-200 aspect-video flex flex-col items-center justify-center p-8 text-center">
              <Video className="w-12 h-12 text-gray-300 mb-3" aria-hidden="true" />
              <p className="font-semibold text-gray-600 text-sm">Video profil belum diatur</p>
              <p className="text-gray-400 text-xs mt-1 max-w-md">Masukkan YouTube Embed URL di Admin → Pengaturan Beranda → Video Profil. Gunakan URL embed: https://www.youtube.com/embed/VIDEO_ID</p>
            </div>
          )}
          {videos.length > 0 && (
            <div className="grid md:grid-cols-3 gap-4 mt-6">
              {videos.map(v => {
                const emb = normalizeEmbed(v.url);
                return (
                  <div key={v.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="aspect-video bg-black relative overflow-hidden">
                      {v.thumbnail ? <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover" loading="lazy" /> : emb ? <iframe src={emb} title={v.title} className="w-full h-full" allowFullScreen loading="lazy" /> : <div className="w-full h-full flex items-center justify-center bg-gray-900"><Play className="w-8 h-8 text-white/60" /></div>}
                    </div>
                    <div className="p-4">
                      <h4 className="font-bold text-pa-green text-sm line-clamp-2">{v.title}</h4>
                      {v.url && <a href={v.url.includes('/embed/') ? v.url.replace('/embed/', '/watch?v=') : v.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-pa-gold-dark text-xs font-semibold hover:underline">Tonton <ExternalLink className="w-3 h-3" /></a>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {s.showChannelLink !== false && s.channelUrl && (
            <div className="text-center mt-8">
              <a href={s.channelUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border-2 border-pa-green text-pa-green hover:bg-pa-green hover:text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm">
                <Video className="w-4 h-4" aria-hidden="true" /> {lang==='id' ? 'Kunjungi Kanal YouTube' : 'Visit YouTube Channel'} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AchievementSectionBlock({ settings, achievementsList }) {
  const s = settings || {};
  const { lang } = useLanguage();
  const limit = s.achievementsLimit || 6;
  const achievements = (achievementsList || []).slice(0, limit);
  const showSKM = s.showSKM !== false;
  const showSPAK = s.showSPAK !== false;
  const showAchievements = s.showAchievements !== false;

  return (
    <section id="pencapaian" className="py-16 lg:py-20" style={{ background: s.bgColor || '#ffffff', scrollMarginTop: '80px' }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-pa-green mb-3">{s.title || 'Pencapaian & Kepercayaan Publik'}</h2>
          {s.subtitle && <p className="text-gray-500 text-sm max-w-2xl mx-auto">{s.subtitle}</p>}
        </div>

        <div className="max-w-6xl mx-auto">
          {(showSKM || showSPAK) && (
            <div className="grid md:grid-cols-2 gap-4 mb-10 max-w-3xl mx-auto">
              {showSKM && (
                <div className="bg-gradient-to-br from-pa-green to-pa-green-mid rounded-2xl p-6 text-center text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" aria-hidden="true" />
                  <p className="text-white/60 text-xs font-bold uppercase tracking-widest">{s.skmLabel || 'Indeks Kepuasan Masyarakat'}</p>
                  <p className="text-5xl font-extrabold text-pa-gold mt-2">{s.skmScore || '-'}</p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    {s.skmCategory && <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs font-semibold">{s.skmCategory}</span>}
                    {s.skmYear && <span className="text-white/60 text-xs">{s.skmYear}</span>}
                  </div>
                </div>
              )}
              {showSPAK && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">SPAK / SPAK Mandiri</p>
                  <p className="text-5xl font-extrabold text-pa-green mt-2">{s.spakScore || '-'}</p>
                  <p className="text-gray-500 text-xs mt-2">Survei Persepsi Anti Korupsi</p>
                  <div className="mt-3 flex justify-center gap-1">
                    {[1,2,3,4,5].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-pa-gold" />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {showAchievements && (
            achievements.length === 0 ? (
              <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-10 text-center">
                <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
                <p className="font-semibold text-gray-600 text-sm">{lang === 'id' ? 'Belum ada penghargaan' : 'No achievements yet'}</p>
                <p className="text-gray-400 text-xs mt-1">{lang === 'id' ? 'Kelola di Admin > Penghargaan & Prestasi' : 'Manage in Admin > Achievements'}</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {achievements.map(item => {
                  const title = lang === 'en' && item.titleEn ? item.titleEn : item.title;
                  const desc = lang === 'en' && item.descriptionEn ? item.descriptionEn : item.description;
                  const issuer = lang === 'en' && item.issuerEn ? item.issuerEn : item.issuer;
                  return (
                    <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-pa-gold/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {item.imageUrl ? <img src={item.imageUrl} alt={title} className="w-full h-full object-cover" loading="lazy" /> : <Trophy className="w-6 h-6 text-pa-gold-dark" aria-hidden="true" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-pa-green text-sm leading-snug">{title}</h3>
                            {item.score && <span className="px-2 py-0.5 bg-pa-green/10 text-pa-green text-[10px] font-bold rounded-full">{item.score}</span>}
                          </div>
                          {issuer && <p className="text-gray-500 text-xs mt-1">{issuer} {item.year ? `• ${item.year}` : ''}</p>}
                          {desc && <p className="text-gray-600 text-xs mt-2 line-clamp-2 leading-relaxed">{desc}</p>}
                          {item.category && <span className="inline-block mt-2 px-2 py-0.5 bg-gray-50 border text-gray-500 text-[10px] rounded-full uppercase font-semibold">{item.category}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}

function renderBlock(block, ctx) {

  const { stats, news, announcements, siteSettings, services, galleryItems, faqItems, visitorStats, bannerItems, documentItems,
    agendaToday, putusanList, leadersList, achievementsList,
    onSearch, searchNomor, setSearchNomor, searchTahun, setSearchTahun,
    searchLoading, searchResult, statusColor, statusLabel, formatDate } = ctx;
  const s = block.settings || {};
  switch (block.type) {
    case 'hero_home':      return <HeroHomeBlock key={block.id} settings={s} stats={stats} />;
    case 'ecourt_links':   return <ECourtLinksBlock key={block.id} settings={s} />;
    case 'case_stepper':   return <CaseFlowBlock key={block.id} settings={s} />;
    case 'today_agenda':   return <TodayAgendaBlock key={block.id} settings={s} agendaToday={agendaToday} />;
    case 'recent_putusan': return <RecentPutusanBlock key={block.id} settings={s} putusanList={putusanList} formatDate={formatDate} />;
    case 'panjar_cta':     return <PanjarCtaBlock key={block.id} settings={s} />;
    case 'news_ann':       return <NewsAnnBlock key={block.id} settings={s} news={news} announcements={announcements} formatDate={formatDate} />;
    case 'services_grid':  return <ServicesGridBlock key={block.id} settings={s} services={services} />;
    case 'case_search':    return <CaseSearchBlock key={block.id} settings={s} onSearch={onSearch} searchNomor={searchNomor} setSearchNomor={setSearchNomor} searchTahun={searchTahun} setSearchTahun={setSearchTahun} searchLoading={searchLoading} searchResult={searchResult} statusColor={statusColor} statusLabel={statusLabel} />;
    case 'contact_info':   return <ContactInfoBlock key={block.id} settings={s} siteSettings={siteSettings} />;
    case 'profile_cards':  return <ProfileCardsBlock key={block.id} settings={s} siteSettings={siteSettings} />;
    case 'gallery_grid':   return <GalleryGridBlock key={block.id} settings={s} galleryItems={galleryItems} />;
    case 'faq_section':    return <FAQSectionBlock key={block.id} settings={s} faqItems={faqItems} />;
    case 'complaint_cta':  return <ComplaintCTABlock key={block.id} settings={s} siteSettings={siteSettings} />;
    case 'visitor_stats':  return <VisitorStatsBlock key={block.id} settings={s} visitorStats={visitorStats} />;
    case 'banner_slider':  return <BannerSliderBlock key={block.id} settings={s} bannerItems={bannerItems} />;
    case 'document_list':  return <DocumentListBlock key={block.id} settings={s} documentItems={documentItems} />;
    case 'leadership_greeting': return <LeadershipGreetingBlock key={block.id} settings={s} siteSettings={siteSettings} />;
    case 'leaders_grid':   return <LeadersGridBlock key={block.id} settings={s} leadersList={leadersList} />;
    case 'priority_services': return <PriorityServicesBlock key={block.id} settings={s} />;
    case 'maklumat_ptsp':  return <MaklumatPTSPBlock key={block.id} settings={s} />;
    case 'integrity_strip': return <IntegrityStripBlock key={block.id} settings={s} />;
    case 'transparency':   return <TransparencyBlock key={block.id} settings={s} documentItems={documentItems} />;
    case 'external_links': return <ExternalLinksBlock key={block.id} settings={s} />;
    case 'jurisdiction_map': return <JurisdictionMapBlock key={block.id} settings={s} />;
    case 'video_profile':  return <VideoProfileBlock key={block.id} settings={s} />;
    case 'achievement_section': return <AchievementSectionBlock key={block.id} settings={s} achievementsList={achievementsList} />;
    case 'hero':           return <HeroStaticBlock key={block.id} settings={s} />;
    case 'stats':          return <StatsBlock key={block.id} settings={s} />;
    case 'text':           return <TextBlock key={block.id} settings={s} />;
    case 'image':          return <ImageBlock key={block.id} settings={s} />;
    case 'cardgrid':       return <CardGridBlock key={block.id} settings={s} />;
    case 'cta':            return <CtaBlock key={block.id} settings={s} />;
    case 'gallery':        return <GalleryBlock key={block.id} settings={s} />;
    case 'accordion':      return <AccordionPublicBlock key={block.id} settings={s} />;
    case 'tabs':           return <TabsPublicBlock key={block.id} settings={s} />;
    case 'map':            return <MapPublicBlock key={block.id} settings={s} />;
    case 'countdown':      return <CountdownPublicBlock key={block.id} settings={s} />;
    default:               return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING STATIC BLOCKS (Accordion, Tabs, Map, Countdown) kept from legacy
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
  const [agendaToday, setAgendaToday] = useState([]);
  const [putusanList, setPutusanList] = useState([]);
  const [leadersList, setLeadersList] = useState([]);
  const [achievementsList, setAchievementsList] = useState([]);
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
    const sectionIds = ['beranda', 'zona-integritas', 'sambutan-ketua', 'layanan-prioritas', 'layanan-digital', 'maklumat-ptsp', 'profil', 'pimpinan', 'layanan', 'alur', 'perkara', 'agenda-hari-ini', 'transparansi', 'berita', 'pengumuman', 'putusan-terbaru', 'pelaporan', 'pencapaian', 'galeri', 'video-profil', 'dokumen', 'yurisdiksi', 'faq', 'panjar', 'pengaduan', 'kontak'];
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
    const timer = setTimeout(() => {
      sectionIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }, 100);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [blocks, dataLoading]);

  function getTodayWITA() {
    try {
      return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }

  async function loadAll() {
    try {
      const today = getTodayWITA();
      const [hpRes, newsRes, annRes, svcRes, settingsRes, casesRes, galleryRes, faqRes, statsRes, bannersRes, docsRes, agendaTodayRes, putusanRes, leadersRes, achievementsRes] = await Promise.all([
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
        fetch(`/api/agenda?public=true&dateFrom=${today}&dateTo=${today}&limit=10`).catch(() => ({ ok: false, json: async () => ({ items: [] }) })),
        fetch('/api/putusan?public=true&limit=5').catch(() => ({ ok: false, json: async () => ({ items: [] }) })),
        fetch('/api/leaders?limit=20').catch(() => ({ ok: false, json: async () => ({ items: [] }) })),
        fetch('/api/achievements?limit=20').catch(() => ({ ok: false, json: async () => ({ items: [] }) })),
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
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setVisitorStats(statsData);
      }
      if (agendaTodayRes && agendaTodayRes.ok) {
        const agendaData = await agendaTodayRes.json();
        setAgendaToday(agendaData.items || []);
      }
      if (putusanRes && putusanRes.ok) {
        const putusanData = await putusanRes.json();
        setPutusanList(putusanData.items || []);
      }
      if (leadersRes && leadersRes.ok) {
        const leadersData = await leadersRes.json();
        setLeadersList(leadersData.items || []);
      }
      if (achievementsRes && achievementsRes.ok) {
        const achievementsData = await achievementsRes.json();
        setAchievementsList(achievementsData.items || []);
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
  const statusColor = (s) => ({ selesai: 'bg-green-100 text-green-700', berjalan: 'bg-blue-100 text-blue-700', terdaftar: 'bg-yellow-100 text-yellow-700', dijadwalkan: 'bg-blue-100 text-blue-700', ditunda: 'bg-yellow-100 text-yellow-700', dibatalkan: 'bg-red-100 text-red-700' }[s] || 'bg-gray-100 text-gray-700');
  const statusLabel = (s) => ({ selesai: t('status.done'), berjalan: t('status.ongoing'), terdaftar: t('status.registered') }[s] || s);

  const ctx = { stats, news, announcements, siteSettings, services, galleryItems, faqItems, visitorStats, bannerItems, documentItems, agendaToday, putusanList, leadersList, achievementsList, onSearch: handleSearch, searchNomor, setSearchNomor, searchTahun, setSearchTahun, searchLoading, searchResult, statusColor, statusLabel, formatDate };

  const scrollTo = (id) => {
    setActiveNav(id);
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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

      {/* UNIFIED FOOTER */}
      <SiteFooter siteSettings={siteSettings} />
    </div>
  );
}
