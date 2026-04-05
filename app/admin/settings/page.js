'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Settings, Globe, Share2, Search as SearchIcon, Image, MessageCircle, LayoutTemplate, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

function Toast({ msg, type }) {
  if (!msg) return null;
  return <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>{msg}</div>;
}

const DEFAULT_FOOTER_LINKS = [
  { label: 'Beranda', labelEn: 'Home', href: '/' },
  { label: 'Agenda Sidang', labelEn: 'Court Schedule', href: '/agenda-sidang' },
  { label: 'Putusan', labelEn: 'Court Decisions', href: '/putusan' },
  { label: 'Pencarian Perkara', labelEn: 'Case Search', href: '/pencarian-perkara' },
  { label: 'Galeri Foto', labelEn: 'Photo Gallery', href: '/galeri' },
  { label: 'Dokumen Publik', labelEn: 'Public Documents', href: '/dokumen' },
  { label: 'FAQ', labelEn: 'FAQ', href: '/faq' },
  { label: 'Pengaduan', labelEn: 'Complaints', href: '/pengaduan' },
  { label: 'Aksesibilitas', labelEn: 'Accessibility', href: '/accessibility' },
];

const TABS = [
  { id: 'general', label: 'Umum', icon: Settings },
  { id: 'contact', label: 'Kontak', icon: Globe },
  { id: 'social', label: 'Media Sosial', icon: Share2 },
  { id: 'seo', label: 'SEO', icon: SearchIcon },
  { id: 'appearance', label: 'Tampilan', icon: Image },
  { id: 'footer', label: 'Footer', icon: LayoutTemplate },
];

export default function SettingsAdmin() {
  const [settings, setSettings] = useState({
    // General
    court_name: '', court_subtitle: '', vision: '', mission: '', history: '',
    // Contact
    address: '', phone: '', email: '', website: '',
    // Social
    whatsapp: '', facebook: '', instagram: '', twitter: '', youtube: '',
    // SEO
    seo_title: '', seo_description: '', seo_keywords: '',
    // Appearance
    footer_description: '', footer_copyright: '', analytics_enabled: 'true', survey_popup_enabled: 'false',
    // Footer
    footer_links: JSON.stringify(DEFAULT_FOOTER_LINKS),
    footer_hours: 'Sen–Kam: 08.00–16.00 WITA\nJum: 08.00–11.00 WITA',
    footer_links_title: 'Tautan Cepat',
    footer_links_title_en: 'Quick Links',
    footer_contact_title: 'Kontak Kami',
    footer_contact_title_en: 'Contact Us',
  });
  const [footerLinks, setFooterLinks] = useState(DEFAULT_FOOTER_LINKS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const [tab, setTab] = useState('general');

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3000); };
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      setSettings(prev => ({ ...prev, ...data }));
      // Parse footer links
      if (data.footer_links) {
        try { setFooterLinks(JSON.parse(data.footer_links)); } catch {}
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Sync footerLinks → settings.footer_links whenever footerLinks changes
  useEffect(() => {
    setSettings(s => ({ ...s, footer_links: JSON.stringify(footerLinks) }));
  }, [footerLinks]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...settings, footer_links: JSON.stringify(footerLinks) };
      const res = await fetch('/api/settings', { method: 'PUT', headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      showToast('Pengaturan berhasil disimpan');
    } catch { showToast('Gagal menyimpan', 'error'); } finally { setSaving(false); }
  }

  const upd = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  // Footer link helpers
  function addLink() {
    setFooterLinks(prev => [...prev, { label: '', labelEn: '', href: '' }]);
  }
  function removeLink(idx) {
    setFooterLinks(prev => prev.filter((_, i) => i !== idx));
  }
  function updateLink(idx, field, val) {
    setFooterLinks(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  }
  function moveLink(idx, dir) {
    setFooterLinks(prev => {
      const arr = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= arr.length) return arr;
      [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
      return arr;
    });
  }

  const Field = ({ k, label, type = 'text', placeholder = '' }) => (
    <div>
      <Label className="text-sm font-medium mb-1.5 block">{label}</Label>
      {type === 'textarea' ? (
        <textarea className="w-full min-h-[100px] p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1b5e20]/30 resize-none" value={settings[k] || ''} onChange={e => upd(k, e.target.value)} placeholder={placeholder} />
      ) : (
        <Input type={type} value={settings[k] || ''} onChange={e => upd(k, e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );

  const footerTab = (
    <div className="space-y-6">
      {/* Info */}
      <div className="bg-[#1b5e20]/5 border border-[#1b5e20]/20 rounded-xl p-4 flex items-start gap-3">
        <LayoutTemplate className="w-5 h-5 text-[#1b5e20] flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-[#1b5e20] text-sm">Footer Dinamis 100%</p>
          <p className="text-gray-600 text-xs mt-1">Semua konten footer dikontrol dari sini — tautan cepat, jam operasional, dan judul kolom. Teks deskripsi & kontak dapat diatur di tab <strong>Tampilan</strong> dan <strong>Kontak</strong>.</p>
        </div>
      </div>

      {/* Jam Operasional */}
      <div>
        <Label className="text-sm font-semibold mb-1.5 block">Jam Operasional</Label>
        <textarea
          className="w-full min-h-[80px] p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1b5e20]/30 resize-none font-mono"
          value={settings.footer_hours || ''}
          onChange={e => upd('footer_hours', e.target.value)}
          placeholder={'Sen–Kam: 08.00–16.00 WITA\nJum: 08.00–11.00 WITA'}
        />
        <p className="text-xs text-gray-400 mt-1">Gunakan baris baru untuk memisahkan hari</p>
      </div>

      {/* Judul Kolom */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-semibold mb-1.5 block">Judul Kolom Tautan (ID)</Label>
          <Input value={settings.footer_links_title || ''} onChange={e => upd('footer_links_title', e.target.value)} placeholder="Tautan Cepat" />
        </div>
        <div>
          <Label className="text-sm font-semibold mb-1.5 block">Judul Kolom Tautan (EN)</Label>
          <Input value={settings.footer_links_title_en || ''} onChange={e => upd('footer_links_title_en', e.target.value)} placeholder="Quick Links" />
        </div>
        <div>
          <Label className="text-sm font-semibold mb-1.5 block">Judul Kolom Kontak (ID)</Label>
          <Input value={settings.footer_contact_title || ''} onChange={e => upd('footer_contact_title', e.target.value)} placeholder="Kontak Kami" />
        </div>
        <div>
          <Label className="text-sm font-semibold mb-1.5 block">Judul Kolom Kontak (EN)</Label>
          <Input value={settings.footer_contact_title_en || ''} onChange={e => upd('footer_contact_title_en', e.target.value)} placeholder="Contact Us" />
        </div>
      </div>

      {/* Tautan Cepat Editor */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <Label className="text-sm font-semibold block">Tautan Cepat di Footer</Label>
            <p className="text-xs text-gray-400 mt-0.5">{footerLinks.length} tautan dikonfigurasi</p>
          </div>
          <Button type="button" onClick={addLink} size="sm" className="bg-[#1b5e20] hover:bg-[#2e7d32] text-white gap-1.5">
            <Plus className="w-4 h-4" /> Tambah Tautan
          </Button>
        </div>

        <div className="space-y-2">
          {footerLinks.map((link, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
              {/* Reorder */}
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button type="button" onClick={() => moveLink(idx, -1)} disabled={idx === 0}
                  className="p-0.5 text-gray-400 hover:text-[#1b5e20] disabled:opacity-30 transition-colors">
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => moveLink(idx, 1)} disabled={idx === footerLinks.length - 1}
                  className="p-0.5 text-gray-400 hover:text-[#1b5e20] disabled:opacity-30 transition-colors">
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Number badge */}
              <span className="w-6 h-6 rounded-full bg-[#1b5e20]/10 text-[#1b5e20] text-xs font-bold flex items-center justify-center flex-shrink-0">
                {idx + 1}
              </span>

              {/* Fields */}
              <div className="flex-1 grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1 font-medium">Label (ID)</p>
                  <Input
                    value={link.label}
                    onChange={e => updateLink(idx, 'label', e.target.value)}
                    placeholder="Beranda"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1 font-medium">Label (EN)</p>
                  <Input
                    value={link.labelEn || ''}
                    onChange={e => updateLink(idx, 'labelEn', e.target.value)}
                    placeholder="Home"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1 font-medium">URL / Href</p>
                  <Input
                    value={link.href}
                    onChange={e => updateLink(idx, 'href', e.target.value)}
                    placeholder="/beranda atau https://..."
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Delete */}
              <button type="button" onClick={() => removeLink(idx)}
                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {footerLinks.length === 0 && (
            <div className="py-10 text-center border-2 border-dashed border-gray-200 rounded-xl">
              <LayoutTemplate className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-gray-400 text-sm">Belum ada tautan. Klik "Tambah Tautan" untuk menambahkan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const tabContent = {
    general: (
      <div className="space-y-5">
        <Field k="court_name" label="Nama Pengadilan" placeholder="Pengadilan Agama Penajam" />
        <Field k="court_subtitle" label="Sub-judul (Kelas)" placeholder="Kelas I B" />
        <Field k="vision" label="Visi" type="textarea" />
        <Field k="mission" label="Misi (satu per baris)" type="textarea" />
        <Field k="history" label="Sejarah Singkat" type="textarea" />
      </div>
    ),
    contact: (
      <div className="space-y-5">
        <Field k="address" label="Alamat Lengkap" type="textarea" />
        <div className="grid grid-cols-2 gap-4">
          <Field k="phone" label="Nomor Telepon" placeholder="(0542) 7211234" />
          <Field k="email" label="Email" type="email" placeholder="pa.penajam@gmail.com" />
        </div>
        <Field k="website" label="URL Website" placeholder="pa-penajam.go.id" />
      </div>
    ),
    social: (
      <div className="space-y-5">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <MessageCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-800 text-sm">WhatsApp Widget</p>
            <p className="text-green-600 text-xs mt-1">Isi nomor WhatsApp untuk menampilkan tombol chat WA di website. Kosongkan untuk menonaktifkan.</p>
          </div>
        </div>
        <Field k="whatsapp" label="Nomor WhatsApp (tanpa +62 atau awali dengan 0)" placeholder="08123456789" />
        <Field k="facebook" label="URL Facebook" placeholder="https://facebook.com/pengadilan-agama-penajam" />
        <Field k="instagram" label="URL Instagram" placeholder="https://instagram.com/pa_penajam" />
        <Field k="twitter" label="URL Twitter / X" placeholder="https://twitter.com/pa_penajam" />
        <Field k="youtube" label="URL YouTube" placeholder="https://youtube.com/@pa_penajam" />
      </div>
    ),
    seo: (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="font-semibold text-blue-800 text-sm">Pengaturan SEO Default</p>
          <p className="text-blue-600 text-xs mt-1">Pengaturan ini digunakan sebagai default untuk semua halaman. Setiap halaman dapat memiliki pengaturan SEO sendiri.</p>
        </div>
        <Field k="seo_title" label="Judul Default (SEO Title)" placeholder="Pengadilan Agama Penajam" />
        <Field k="seo_description" label="Deskripsi Default (Meta Description)" type="textarea" placeholder="Website resmi Pengadilan Agama Penajam..." />
        <Field k="seo_keywords" label="Kata Kunci (dipisah koma)" placeholder="pengadilan agama, penajam, perceraian..." />
      </div>
    ),
    appearance: (
      <div className="space-y-5">
        <Field k="footer_description" label="Deskripsi Footer" type="textarea" placeholder="Pengadilan Agama Penajam adalah lembaga..." />
        <Field k="footer_copyright" label="Teks Copyright" placeholder="Pengadilan Agama Penajam. Hak Cipta Dilindungi." />
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <Label className="text-sm font-semibold text-[#1b5e20]">Pengaturan Fitur</Label>
          <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-xl hover:bg-gray-100">
            <input type="checkbox" checked={settings.analytics_enabled === 'true'} onChange={e => upd('analytics_enabled', e.target.checked ? 'true' : 'false')} className="w-4 h-4 accent-[#1b5e20]" />
            <div>
              <p className="font-medium text-sm">Aktifkan Pelacakan Analitik</p>
              <p className="text-xs text-gray-500">Lacak kunjungan halaman website untuk statistik</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-xl hover:bg-gray-100">
            <input type="checkbox" checked={settings.survey_popup_enabled === 'true'} onChange={e => upd('survey_popup_enabled', e.target.checked ? 'true' : 'false')} className="w-4 h-4 accent-[#1b5e20]" />
            <div>
              <p className="font-medium text-sm">Widget Survei Kepuasan</p>
              <p className="text-xs text-gray-500">Tampilkan widget survei di semua halaman publik</p>
            </div>
          </label>
        </div>
      </div>
    ),
    footer: footerTab,
  };

  return (
    <div>
      <Toast msg={toast.msg} type={toast.type} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1b5e20]">Pengaturan Website</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola semua konfigurasi website dari sini</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${ tab === t.id ? 'bg-white text-[#1b5e20] shadow-sm' : 'text-gray-500 hover:text-gray-700' }`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border p-6 h-20 animate-pulse" />)}</div>
      ) : (
        <form onSubmit={handleSave}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            {tabContent[tab]}
          </div>
          <div className="flex justify-end mt-4">
            <Button type="submit" className="bg-[#1b5e20] hover:bg-[#2e7d32] text-white px-8" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
