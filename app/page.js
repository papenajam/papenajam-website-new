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
  ArrowRight, ExternalLink, Globe, Award
} from 'lucide-react';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1667849921481-9e13c239ee3d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwyfHxnb3Zlcm5tZW50JTIwY291cnQlMjBidWlsZGluZ3xlbnwwfHx8fDE3NzI4MDA1MDd8MA&ixlib=rb-4.1.0&q=85&w=1400';

const iconMap = {
  FileText, Calendar, DollarSign, Package, Shield, Monitor, Users, Stamp,
  Scale, Building2, BookOpen, Globe, Award
};

export default function LandingPage() {
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
      // Seed first
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
      // Stats from cases
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
    { id: 'beranda', label: 'Beranda', href: null },
    { id: 'profil', label: 'Profil', href: null },
    { id: 'layanan', label: 'Layanan', href: null },
    { id: 'perkara', label: 'Informasi Perkara', href: null },
    { id: 'berita', label: 'Berita', href: null },
    { id: 'pengumuman', label: 'Pengumuman', href: null },
    { id: 'kontak', label: 'Kontak', href: null },
  ];

  const externalLinks = [
    { label: 'Agenda Sidang', href: '/agenda-sidang' },
    { label: 'Putusan', href: '/putusan' },
    { label: 'Pencarian Perkara', href: '/pencarian-perkara' },
  ];

  const scrollTo = (id) => {
    setActiveNav(id);
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const statusColor = (status) => {
    if (status === 'selesai') return 'bg-green-100 text-green-700';
    if (status === 'berjalan') return 'bg-blue-100 text-blue-700';
    if (status === 'terdaftar') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="min-h-screen font-sans bg-white">
      {/* NAVBAR */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md' : 'bg-transparent'}`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8e] flex items-center justify-center shadow-md">
                <Scale className={`w-5 h-5 lg:w-6 lg:h-6 ${scrolled ? 'text-[#c9a84c]' : 'text-[#c9a84c]'}`} />
              </div>
              <div>
                <p className={`font-bold text-sm lg:text-base leading-tight ${scrolled ? 'text-[#1e3a5f]' : 'text-white'}`}>
                  Pengadilan Agama
                </p>
                <p className={`font-extrabold text-base lg:text-lg leading-tight ${scrolled ? 'text-[#c9a84c]' : 'text-[#c9a84c]'}`}>
                  Penajam
                </p>
              </div>
            </div>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map(link => (
                <button
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-all ${
                    activeNav === link.id
                      ? 'text-[#c9a84c] bg-[#c9a84c]/10'
                      : scrolled ? 'text-[#1e3a5f] hover:text-[#c9a84c]' : 'text-white/90 hover:text-white'
                  }`}
                >
                  {link.label}
                </button>
              ))}
              <div className="relative group ml-1">
                <button className={`px-3 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-1 ${scrolled ? 'text-[#1e3a5f] hover:text-[#c9a84c]' : 'text-white/90 hover:text-white'}`}>
                  Layanan Digital ▾
                </button>
                <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  {externalLinks.map(link => (
                    <a key={link.href} href={link.href} className="block px-4 py-2 text-sm text-[#1e3a5f] hover:bg-gray-50 hover:text-[#c9a84c] transition-colors">
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                className="ml-2 bg-[#c9a84c] hover:bg-[#b8962f] text-white text-sm font-semibold"
                onClick={() => window.location.href = '/admin/login'}
              >
                Admin
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className={`lg:hidden p-2 ${scrolled ? 'text-[#1e3a5f]' : 'text-white'}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-200 shadow-lg">
            <div className="container mx-auto px-4 py-3 space-y-1">
              {navLinks.map(link => (
                <button
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  className="w-full text-left px-4 py-3 text-[#1e3a5f] font-medium hover:bg-gray-50 rounded-md"
                >
                  {link.label}
                </button>
              ))}
              <div className="pt-2 pb-1">
                <Button
                  className="w-full bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white"
                  onClick={() => window.location.href = '/admin/login'}
                >
                  Masuk Admin
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section id="beranda" className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_IMAGE} alt="Pengadilan Agama Penajam" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1e3a5f]/80 via-[#1e3a5f]/70 to-[#1e3a5f]/90" />
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#c9a84c] via-[#f5d98a] to-[#c9a84c]" />

        <div className="relative z-10 container mx-auto px-4 text-center py-32">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[#c9a84c]/20 border border-[#c9a84c]/50 text-[#f5d98a] px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Award className="w-4 h-4" />
            Mahkamah Agung Republik Indonesia
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-4 leading-tight">
            {settings.hero_title || 'Pengadilan Agama Penajam'}
          </h1>
          <p className="text-[#f5d98a] text-lg font-semibold mb-4">
            {settings.court_subtitle || 'Kelas I B'} &bull; Kabupaten Penajam Paser Utara
          </p>
          <p className="text-white/85 text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            {settings.hero_subtitle || 'Memberikan Keadilan yang Cepat, Sederhana, dan Berbiaya Ringan untuk Masyarakat Kabupaten Penajam Paser Utara'}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-[#c9a84c] hover:bg-[#b8962f] text-white font-bold px-8 py-3 text-base shadow-lg"
              onClick={() => scrollTo('layanan')}
            >
              <Scale className="w-5 h-5 mr-2" /> Lihat Layanan
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-white text-white hover:bg-white hover:text-[#1e3a5f] font-bold px-8 py-3 text-base"
              onClick={() => scrollTo('perkara')}
            >
              <Search className="w-5 h-5 mr-2" /> Informasi Perkara
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="mt-16 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            {[
              { label: 'Perkara Tahun Ini', value: stats.casesThisYear || '—' },
              { label: 'Perkara Selesai', value: stats.casesDone || '—' },
              { label: 'Perkara Berjalan', value: stats.casesOngoing || '—' },
            ].map((s, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
                <div className="text-2xl md:text-3xl font-extrabold text-[#c9a84c]">{s.value}</div>
                <div className="text-white/80 text-xs mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-white/70 rounded-full" />
          </div>
        </div>
      </section>

      {/* PROFIL */}
      <section id="profil" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 text-[#c9a84c] font-semibold text-sm uppercase tracking-wider mb-3">
              <div className="w-8 h-0.5 bg-[#c9a84c]" />
              Tentang Kami
              <div className="w-8 h-0.5 bg-[#c9a84c]" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f]">Profil Pengadilan</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Sejarah */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center mb-5">
                <BookOpen className="w-6 h-6 text-[#1e3a5f]" />
              </div>
              <h3 className="text-xl font-bold text-[#1e3a5f] mb-4">Sejarah Singkat</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {settings.history || 'Pengadilan Agama Penajam didirikan berdasarkan Keputusan Presiden Republik Indonesia sebagai bagian dari sistem peradilan agama di Indonesia. Berlokasi di Kabupaten Penajam Paser Utara, Kalimantan Timur, pengadilan ini bertugas memeriksa, memutus, dan menyelesaikan perkara perdata agama.'}
              </p>
            </div>

            {/* Visi Misi */}
            <div className="bg-[#1e3a5f] rounded-2xl p-8 shadow-sm text-white">
              <div className="w-12 h-12 bg-[#c9a84c]/20 rounded-xl flex items-center justify-center mb-5">
                <Award className="w-6 h-6 text-[#c9a84c]" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-[#c9a84c]">Visi & Misi</h3>
              <div className="mb-4">
                <p className="text-xs text-white/60 uppercase tracking-wider mb-2 font-semibold">Visi</p>
                <p className="text-sm leading-relaxed text-white/90">
                  {settings.vision || 'Terwujudnya Pengadilan Agama Penajam yang Agung'}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/60 uppercase tracking-wider mb-2 font-semibold">Misi</p>
                <ul className="text-sm text-white/85 space-y-1.5">
                  {(settings.mission || '1. Menjaga kemandirian badan peradilan\n2. Memberikan pelayanan hukum yang berkeadilan\n3. Meningkatkan kualitas kepemimpinan badan peradilan\n4. Meningkatkan kredibilitas dan transparansi badan peradilan')
                    .split('\n').map((m, i) => (
                      <li key={i} className="flex gap-2">
                        <ChevronRight className="w-4 h-4 text-[#c9a84c] flex-shrink-0 mt-0.5" />
                        <span>{m.replace(/^\d+\.\s*/, '')}</span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>

            {/* Struktur Organisasi */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-[#c9a84c]/10 rounded-xl flex items-center justify-center mb-5">
                <Users className="w-6 h-6 text-[#c9a84c]" />
              </div>
              <h3 className="text-xl font-bold text-[#1e3a5f] mb-4">Struktur Organisasi</h3>
              <div className="space-y-3">
                {[
                  { jabatan: 'Ketua', nama: 'Dr. H. Ahmad Fauzi, S.H., M.H.' },
                  { jabatan: 'Wakil Ketua', nama: 'Hj. Siti Maryam, S.H.I., M.H.' },
                  { jabatan: 'Hakim', nama: 'H. Ridwan Syah, S.H.I.' },
                  { jabatan: 'Panitera', nama: 'Drs. Muhammad Nasir' },
                  { jabatan: 'Sekretaris', nama: 'Ir. Wahyu Tri Hartono' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                    <div className="w-8 h-8 bg-[#1e3a5f]/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-[#1e3a5f] text-xs font-bold">{i+1}</span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{s.jabatan}</p>
                      <p className="text-sm font-semibold text-[#1e3a5f]">{s.nama}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LAYANAN */}
      <section id="layanan" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 text-[#c9a84c] font-semibold text-sm uppercase tracking-wider mb-3">
              <div className="w-8 h-0.5 bg-[#c9a84c]" />
              Pelayanan Publik
              <div className="w-8 h-0.5 bg-[#c9a84c]" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f]">Layanan Pengadilan</h2>
            <p className="text-gray-500 mt-3 max-w-lg mx-auto">Kami berkomitmen memberikan pelayanan terbaik dan transparan kepada masyarakat pencari keadilan</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {(services.length > 0 ? services : [
              { id: '1', title: 'Pendaftaran Perkara', description: 'Layanan pendaftaran perkara perceraian, waris, hibah, dan lainnya.', icon: 'FileText' },
              { id: '2', title: 'Informasi Jadwal Sidang', description: 'Cek jadwal sidang perkara Anda secara online.', icon: 'Calendar' },
              { id: '3', title: 'Informasi Biaya Perkara', description: 'Transparansi biaya perkara sesuai ketentuan yang berlaku.', icon: 'DollarSign' },
              { id: '4', title: 'Pengambilan Produk', description: 'Layanan pengambilan salinan putusan dan akta cerai.', icon: 'Package' },
              { id: '5', title: 'Pos Bantuan Hukum', description: 'Bantuan hukum gratis bagi masyarakat tidak mampu.', icon: 'Shield' },
              { id: '6', title: 'Layanan e-Court', description: 'Pendaftaran dan persidangan secara elektronik.', icon: 'Monitor' },
              { id: '7', title: 'Mediasi', description: 'Penyelesaian sengketa secara damai melalui mediator.', icon: 'Users' },
              { id: '8', title: 'Legalisir Dokumen', description: 'Legalisir salinan putusan dan dokumen pengadilan.', icon: 'Stamp' },
            ]).map((svc, i) => {
              const IconComp = iconMap[svc.icon] || Scale;
              const colors = [
                'bg-blue-50 text-blue-700',
                'bg-green-50 text-green-700',
                'bg-amber-50 text-amber-700',
                'bg-purple-50 text-purple-700',
                'bg-red-50 text-red-700',
                'bg-teal-50 text-teal-700',
                'bg-indigo-50 text-indigo-700',
                'bg-orange-50 text-orange-700',
              ];
              return (
                <div key={svc.id} className="group bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${colors[i % colors.length]}`}>
                    <IconComp className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-[#1e3a5f] mb-2 group-hover:text-[#c9a84c] transition-colors">{svc.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{svc.description}</p>
                  <div className="mt-4 flex items-center text-[#1e3a5f] text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    Selengkapnya <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* INFORMASI PERKARA */}
      <section id="perkara" className="py-20 bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8e]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 text-[#c9a84c] font-semibold text-sm uppercase tracking-wider mb-3">
              <div className="w-8 h-0.5 bg-[#c9a84c]" />
              Pencarian Perkara
              <div className="w-8 h-0.5 bg-[#c9a84c]" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white">Informasi Perkara</h2>
            <p className="text-white/70 mt-3 max-w-lg mx-auto">Masukkan nomor perkara atau tahun untuk mencari informasi perkara Anda</p>
          </div>

          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSearch} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-white/80 text-sm font-medium mb-2 block">Nomor Perkara</label>
                  <Input
                    placeholder="Contoh: 0001/Pdt.G"
                    value={searchNomor}
                    onChange={e => setSearchNomor(e.target.value)}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/40 focus:bg-white/30"
                  />
                </div>
                <div>
                  <label className="text-white/80 text-sm font-medium mb-2 block">Tahun</label>
                  <Input
                    placeholder="Contoh: 2025"
                    value={searchTahun}
                    onChange={e => setSearchTahun(e.target.value)}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/40 focus:bg-white/30"
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-[#c9a84c] hover:bg-[#b8962f] text-white font-bold py-3"
                disabled={searchLoading}
              >
                {searchLoading ? (
                  <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Mencari...</span>
                ) : (
                  <span className="flex items-center gap-2"><Search className="w-4 h-4" /> Cari Perkara</span>
                )}
              </Button>
            </form>

            {searchResult !== null && (
              <div className="mt-6 bg-white rounded-2xl overflow-hidden shadow-lg">
                {searchResult.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">Perkara tidak ditemukan</p>
                    <p className="text-sm mt-1">Coba dengan nomor atau tahun yang berbeda</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {searchResult.map((c) => (
                      <div key={c.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-bold text-[#1e3a5f] text-sm">{c.nomorPerkara}</p>
                            <p className="text-gray-600 text-sm mt-1">{c.jenisPerkara}</p>
                            <p className="text-gray-500 text-xs mt-1">Pemohon: {c.pemohon}</p>
                            {c.jadwalSidang && (
                              <p className="text-gray-400 text-xs mt-1">Jadwal: {formatDate(c.jadwalSidang)}</p>
                            )}
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusColor(c.status)}`}>
                            {c.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* STATISTIK */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Total Perkara 2025', value: stats.casesThisYear || 0, icon: Scale, color: 'bg-blue-50 text-blue-700' },
              { label: 'Perkara Selesai', value: stats.casesDone || 0, icon: CheckCircle, color: 'bg-green-50 text-green-700' },
              { label: 'Perkara Berjalan', value: stats.casesOngoing || 0, icon: Clock, color: 'bg-amber-50 text-amber-700' },
              { label: 'Total Layanan', value: services.length || 8, icon: TrendingUp, color: 'bg-purple-50 text-purple-700' },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="text-center p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${stat.color}`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#1e3a5f] mb-1">{stat.value}</div>
                  <div className="text-gray-500 text-sm">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* BERITA */}
      <section id="berita" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="inline-flex items-center gap-2 text-[#c9a84c] font-semibold text-sm uppercase tracking-wider mb-3">
                <div className="w-8 h-0.5 bg-[#c9a84c]" />
                Terkini
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f]">Berita Terbaru</h2>
            </div>
            <button className="hidden md:flex items-center gap-2 text-[#1e3a5f] font-semibold hover:text-[#c9a84c] transition-colors text-sm">
              Lihat Semua <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                  <div className="h-48 bg-gray-200" />
                  <div className="p-6 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-6 bg-gray-200 rounded" />
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {news.slice(0, 3).map((article, i) => (
                <div key={article.id} className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${i === 0 ? 'md:col-span-1 row-span-1' : ''}`}>
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={article.image || `https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&q=80`}
                      alt={article.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="bg-[#c9a84c] text-white text-xs px-2 py-1 rounded-md font-semibold">
                        {article.category || 'Berita'}
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(article.publishDate || article.createdAt)}
                    </p>
                    <h3 className="font-bold text-[#1e3a5f] mb-2 line-clamp-2 hover:text-[#c9a84c] transition-colors cursor-pointer leading-snug">
                      {article.title}
                    </h3>
                    <p className="text-gray-500 text-sm line-clamp-2 leading-relaxed">{article.content}</p>
                    <div className="mt-4 flex items-center text-[#1e3a5f] text-sm font-semibold hover:text-[#c9a84c] cursor-pointer transition-colors">
                      Baca Selengkapnya <ChevronRight className="w-4 h-4 ml-1" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* More news */}
          {news.length > 3 && (
            <div className="mt-6 grid md:grid-cols-2 gap-4">
              {news.slice(3, 5).map(article => (
                <div key={article.id} className="bg-white rounded-xl p-4 flex gap-4 hover:shadow-md transition-shadow">
                  <img
                    src={article.image || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=200&q=80'}
                    alt={article.title}
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                  />
                  <div>
                    <p className="text-gray-400 text-xs mb-1">{formatDate(article.publishDate || article.createdAt)}</p>
                    <h4 className="font-semibold text-[#1e3a5f] text-sm line-clamp-2 leading-snug">{article.title}</h4>
                    <p className="text-gray-500 text-xs mt-1 line-clamp-2">{article.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* PENGUMUMAN */}
      <section id="pengumuman" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 text-[#c9a84c] font-semibold text-sm uppercase tracking-wider mb-3">
              <div className="w-8 h-0.5 bg-[#c9a84c]" />
              Informasi Penting
              <div className="w-8 h-0.5 bg-[#c9a84c]" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f]">Pengumuman</h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {(announcements.length > 0 ? announcements : [
              { id: '1', title: 'Jadwal Sidang Bulan Juni 2025', content: 'Jadwal sidang untuk bulan Juni 2025 telah tersedia. Silakan cek melalui aplikasi SIPP.', publishDate: '2025-06-01' },
              { id: '2', title: 'Perubahan Jam Operasional Pelayanan', content: 'Pelayanan dibuka Senin-Jumat pukul 08.00-16.00 WITA.', publishDate: '2025-05-28' },
            ]).map((ann, i) => (
              <div key={ann.id} className="group bg-white border border-gray-100 rounded-xl p-6 hover:shadow-md transition-all hover:border-[#1e3a5f]/20 cursor-pointer">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#1e3a5f] transition-colors">
                    <ClipboardList className="w-5 h-5 text-[#1e3a5f] group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-bold text-[#1e3a5f] group-hover:text-[#c9a84c] transition-colors">{ann.title}</h3>
                      <span className="text-gray-400 text-xs whitespace-nowrap flex-shrink-0">{formatDate(ann.publishDate || ann.createdAt)}</span>
                    </div>
                    <p className="text-gray-500 text-sm mt-2 leading-relaxed line-clamp-2">{ann.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KONTAK */}
      <section id="kontak" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 text-[#c9a84c] font-semibold text-sm uppercase tracking-wider mb-3">
              <div className="w-8 h-0.5 bg-[#c9a84c]" />
              Hubungi Kami
              <div className="w-8 h-0.5 bg-[#c9a84c]" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f]">Kontak Kami</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="space-y-5">
              {[
                { icon: MapPin, label: 'Alamat', value: settings.address || 'Jl. Propinsi Km. 9 Kel. Nipah-Nipah, Kec. Penajam, Kab. Penajam Paser Utara, Kalimantan Timur 76141' },
                { icon: Phone, label: 'Telepon', value: settings.phone || '(0542) 7211234' },
                { icon: Mail, label: 'Email', value: settings.email || 'pa.penajam@gmail.com' },
                { icon: Globe, label: 'Website', value: settings.website || 'pa-penajam.go.id' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="flex gap-4 p-5 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-[#1e3a5f]" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{item.label}</p>
                      <p className="text-[#1e3a5f] font-medium mt-0.5 text-sm">{item.value}</p>
                    </div>
                  </div>
                );
              })}

              <div className="p-5 bg-[#1e3a5f] rounded-xl text-white">
                <p className="font-semibold mb-2">Jam Operasional</p>
                <div className="space-y-1 text-sm text-white/80">
                  <p>Senin - Kamis: 08.00 - 16.00 WITA</p>
                  <p>Jumat: 08.00 - 11.30 &amp; 13.30 - 16.00 WITA</p>
                  <p className="text-white/50">Sabtu, Minggu, dan Hari Libur Nasional: Tutup</p>
                </div>
              </div>
            </div>

            {/* Map placeholder */}
            <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-200 min-h-64 bg-gray-200 flex items-center justify-center relative">
              <div className="text-center text-gray-400">
                <MapPin className="w-12 h-12 mx-auto mb-3" />
                <p className="font-medium text-gray-600">Pengadilan Agama Penajam</p>
                <p className="text-sm">Jl. Propinsi Km. 9, Penajam Paser Utara</p>
                <p className="text-sm mt-1">Kalimantan Timur</p>
                <a
                  href="https://maps.google.com?q=Pengadilan+Agama+Penajam"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2d5a8e] transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> Buka di Google Maps
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#1e3a5f] text-white pt-16 pb-8">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 pb-10 border-b border-white/10">
            {/* About */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#c9a84c]/20 flex items-center justify-center">
                  <Scale className="w-5 h-5 text-[#c9a84c]" />
                </div>
                <div>
                  <p className="font-bold text-lg">Pengadilan Agama Penajam</p>
                  <p className="text-white/60 text-xs">Kelas I B</p>
                </div>
              </div>
              <p className="text-white/60 text-sm leading-relaxed mb-5 max-w-sm">
                Memberikan pelayanan keadilan yang cepat, sederhana, dan berbiaya ringan bagi masyarakat Kabupaten Penajam Paser Utara.
              </p>
              <div className="flex gap-3">
                {[Facebook, Twitter, Instagram, Youtube].map((Icon, i) => (
                  <div key={i} className="w-9 h-9 bg-white/10 hover:bg-[#c9a84c] rounded-lg flex items-center justify-center cursor-pointer transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bold mb-4 text-[#c9a84c]">Tautan Cepat</h4>
              <ul className="space-y-2">
                {navLinks.map(link => (
                  <li key={link.id}>
                    <button
                      onClick={() => scrollTo(link.id)}
                      className="text-white/60 hover:text-white text-sm flex items-center gap-2 transition-colors"
                    >
                      <ChevronRight className="w-3 h-3" /> {link.label}
                    </button>
                  </li>
                ))}
                {externalLinks.map(link => (
                  <li key={link.href}>
                    <a href={link.href} className="text-white/60 hover:text-white text-sm flex items-center gap-2 transition-colors">
                      <ChevronRight className="w-3 h-3" /> {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tautan Penting */}
            <div>
              <h4 className="font-bold mb-4 text-[#c9a84c]">Tautan Penting</h4>
              <ul className="space-y-2">
                {[
                  { label: 'Mahkamah Agung RI', url: 'https://mahkamahagung.go.id' },
                  { label: 'Ditjen Badilkum', url: '#' },
                  { label: 'e-Court MA', url: 'https://ecourt.mahkamahagung.go.id' },
                  { label: 'SIPP MA', url: '#' },
                  { label: 'e-Litigasi', url: '#' },
                ].map((link, i) => (
                  <li key={i}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/60 hover:text-white text-sm flex items-center gap-2 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-white/40 text-sm">
            <p>© {new Date().getFullYear()} Pengadilan Agama Penajam. Hak Cipta Dilindungi.</p>
            <p>Direktorat Jenderal Badan Peradilan Agama — Mahkamah Agung RI</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
