'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Save } from 'lucide-react';

function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
      {msg}
    </div>
  );
}

export default function SettingsAdmin() {
  const [settings, setSettings] = useState({
    court_name: '', court_subtitle: '', hero_title: '', hero_subtitle: '',
    address: '', phone: '', email: '', website: '', vision: '', mission: '', history: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: 'success' });

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3000); };
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        setSettings(prev => ({ ...prev, ...data }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
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

  const sections = [
    {
      title: 'Informasi Pengadilan',
      fields: [
        { key: 'court_name', label: 'Nama Pengadilan', type: 'text' },
        { key: 'court_subtitle', label: 'Sub-judul (Kelas)', type: 'text' },
      ]
    },
    {
      title: 'Hero Section',
      fields: [
        { key: 'hero_title', label: 'Judul Hero', type: 'text' },
        { key: 'hero_subtitle', label: 'Sub-judul Hero', type: 'textarea' },
      ]
    },
    {
      title: 'Kontak',
      fields: [
        { key: 'address', label: 'Alamat', type: 'textarea' },
        { key: 'phone', label: 'Nomor Telepon', type: 'text' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'website', label: 'Website', type: 'text' },
      ]
    },
    {
      title: 'Profil Pengadilan',
      fields: [
        { key: 'vision', label: 'Visi', type: 'textarea' },
        { key: 'mission', label: 'Misi (satu per baris)', type: 'textarea' },
        { key: 'history', label: 'Sejarah Singkat', type: 'textarea' },
      ]
    },
  ];

  return (
    <div>
      <Toast msg={toast.msg} type={toast.type} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Pengaturan</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola informasi dan konten website</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-40 mb-4" />
              <div className="space-y-3">
                <div className="h-10 bg-gray-200 rounded" />
                <div className="h-10 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {sections.map(section => (
            <div key={section.title} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="font-bold text-[#1e3a5f]">{section.title}</h2>
              </div>
              <div className="p-6 space-y-4">
                {section.fields.map(field => (
                  <div key={field.key}>
                    <Label className="text-sm font-medium mb-1.5 block">{field.label}</Label>
                    {field.type === 'textarea' ? (
                      <textarea
                        className="w-full min-h-[100px] p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 resize-none"
                        value={settings[field.key] || ''}
                        onChange={e => setSettings(s => ({...s, [field.key]: e.target.value}))}
                      />
                    ) : (
                      <Input
                        type={field.type}
                        value={settings[field.key] || ''}
                        onChange={e => setSettings(s => ({...s, [field.key]: e.target.value}))}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <Button type="submit" className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white px-8" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
