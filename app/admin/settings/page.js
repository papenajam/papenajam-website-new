'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Settings, Globe, Share2, Search as SearchIcon, Image, MessageCircle } from 'lucide-react';

function Toast({ msg, type }) {
  if (!msg) return null;
  return <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>{msg}</div>;
}

const TABS = [
  { id: 'general', label: 'Umum', icon: Settings },
  { id: 'contact', label: 'Kontak', icon: Globe },
  { id: 'social', label: 'Media Sosial', icon: Share2 },
  { id: 'seo', label: 'SEO', icon: SearchIcon },
  { id: 'appearance', label: 'Tampilan', icon: Image },
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
  });
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
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', { method: 'PUT', headers, body: JSON.stringify(settings) });
      if (!res.ok) throw new Error();
      showToast('Pengaturan berhasil disimpan');
    } catch { showToast('Gagal menyimpan', 'error'); } finally { setSaving(false); }
  }

  const upd = (k, v) => setSettings(s => ({ ...s, [k]: v }));

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
