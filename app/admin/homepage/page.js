'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, Trash2, GripVertical, Eye, Save, Settings2,
  X, Check, Layers, Globe, Upload, Home,
  Newspaper, Bell, Briefcase, Search, Phone, User,
  BarChart2, Zap, Type, Image, LayoutGrid, ImageIcon
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const HOMEPAGE_SLUG = '_homepage';

// ─── Image Upload ──────────────────────────────────────────────────────────
function ImageUploadSmall({ value, onChange, token, placeholder = 'https://...' }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload gagal');
      onChange(data.url);
    } catch (err) { alert('Upload gagal: ' + err.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  return (
    <div className="flex gap-1.5">
      <Input placeholder={placeholder} value={value || ''} onChange={e => onChange(e.target.value)} className="flex-1 text-xs" />
      <label className="cursor-pointer flex items-center justify-center w-8 h-9 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0 relative">
        {uploading ? <div className="w-3.5 h-3.5 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" /> : <Upload className="w-3.5 h-3.5 text-gray-500" />}
        <input ref={fileRef} type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onChange={handleFile} disabled={uploading} />
      </label>
    </div>
  );
}

// ─── Toast ──────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div className={`fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2 ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
      {type === 'error' ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
      {msg}
    </div>
  );
}

// ─── Block Types ─────────────────────────────────────────────────────────────
const BLOCK_TYPES = [
  // Dynamic (pull from DB)
  { type: 'hero_home',      label: 'Hero Beranda',       icon: Home,        desc: 'Banner hero + statistik live',          color: 'bg-blue-50 text-blue-700',   dynamic: true },
  { type: 'news_ann',       label: 'Berita & Pengumuman', icon: Newspaper,   desc: '2 kolom kartu dari database',           color: 'bg-emerald-50 text-emerald-700', dynamic: true },
  { type: 'services_grid',  label: 'Layanan',             icon: Briefcase,   desc: 'Grid layanan dari database',            color: 'bg-violet-50 text-violet-700',  dynamic: true },
  { type: 'case_search',    label: 'Cari Perkara',        icon: Search,      desc: 'Widget pencarian perkara',              color: 'bg-sky-50 text-sky-700',        dynamic: true },
  { type: 'contact_info',   label: 'Kontak',              icon: Phone,       desc: 'Informasi kontak dari pengaturan',      color: 'bg-orange-50 text-orange-700',  dynamic: true },
  { type: 'profile_cards',  label: 'Profil Pengadilan',   icon: User,        desc: 'Visi, Misi, Lokasi',                   color: 'bg-teal-50 text-teal-700',      dynamic: true },
  // Static
  { type: 'hero',           label: 'Hero (Statis)',        icon: Layers,      desc: 'Banner dengan gambar & teks bebas',    color: 'bg-indigo-50 text-indigo-700' },
  { type: 'stats',          label: 'Statistik',            icon: BarChart2,   desc: 'Angka statistik',                      color: 'bg-amber-50 text-amber-700' },
  { type: 'text',           label: 'Teks / HTML',          icon: Type,        desc: 'Blok teks & rich content',             color: 'bg-gray-50 text-gray-700' },
  { type: 'image',          label: 'Gambar',               icon: Image,       desc: 'Gambar dengan keterangan',             color: 'bg-green-50 text-green-700' },
  { type: 'cardgrid',       label: 'Card Grid',            icon: LayoutGrid,  desc: 'Grid kartu manual',                    color: 'bg-purple-50 text-purple-700' },
  { type: 'cta',            label: 'CTA',                  icon: Zap,         desc: 'Call-to-action button',                color: 'bg-red-50 text-red-700' },
  { type: 'gallery',        label: 'Galeri',               icon: Image,       desc: 'Grid foto',                            color: 'bg-pink-50 text-pink-700' },
];

const defaultSettings = {
  hero_home:     { title: 'Pengadilan Agama Penajam', subtitle: 'Memberikan Keadilan yang Cepat, Sederhana, dan Berbiaya Ringan', backgroundImage: '', buttonText: 'Lihat Layanan', buttonLink: '#layanan', button2Text: 'Hubungi Kami', button2Link: '#kontak', showStats: true },
  news_ann:      { title: 'Berita & Pengumuman', newsCount: 4, annCount: 5 },
  services_grid: { title: 'Layanan Kami', subtitle: 'Berbagai layanan tersedia untuk masyarakat' },
  case_search:   { title: 'Informasi Perkara', subtitle: 'Cari informasi perkara Anda dengan mudah' },
  contact_info:  { title: 'Hubungi Kami', subtitle: 'Kami siap melayani Anda', bgColor: '#f9fafb' },
  profile_cards: { title: 'Profil Pengadilan', subtitle: 'Mengenal Pengadilan Agama Penajam lebih dekat' },
  hero:          { title: 'Judul Section', subtitle: 'Sub-judul atau deskripsi.', backgroundImage: '', buttonText: 'Selengkapnya', buttonLink: '#' },
  stats:         { items: [{ id: uuidv4(), number: '500+', label: 'Perkara' }, { id: uuidv4(), number: '20', label: 'Tahun' }, { id: uuidv4(), number: '100%', label: 'Komitmen' }] },
  text:          { content: '<p>Tulis konten Anda di sini.</p>' },
  image:         { src: '', caption: '', alignment: 'center' },
  cardgrid:      { title: 'Layanan Kami', items: [{ id: uuidv4(), icon: '⚖️', title: 'Kartu 1', description: 'Deskripsi.' }, { id: uuidv4(), icon: '📋', title: 'Kartu 2', description: 'Deskripsi.' }, { id: uuidv4(), icon: '🏛️', title: 'Kartu 3', description: 'Deskripsi.' }] },
  cta:           { title: 'Hubungi Kami', subtitle: 'Kami siap membantu.', buttonText: 'Hubungi', buttonLink: '#kontak', bgColor: '#1e3a5f' },
  gallery:       { images: [], columns: 3 },
};

// ─── Block Preview (builder canvas) ──────────────────────────────────────────
function BlockPreview({ block }) {
  const s = block.settings || {};
  const bt = BLOCK_TYPES.find(t => t.type === block.type);

  // Dynamic blocks → placeholder card
  if (bt?.dynamic) {
    const icons = { hero_home: '🏠', news_ann: '📰', services_grid: '⚙️', case_search: '🔍', contact_info: '📞', profile_cards: '🏛️' };
    const labels = { hero_home: 'Hero Beranda + Statistik Live', news_ann: 'Berita & Pengumuman (2 Kolom)', services_grid: 'Layanan dari Database', case_search: 'Widget Pencarian Perkara', contact_info: 'Informasi Kontak', profile_cards: 'Profil — Visi, Misi, Lokasi' };
    return (
      <div className={`rounded-xl p-6 border-2 border-dashed flex items-center gap-4 ${bt.color.replace('text-', 'border-').replace('bg-', 'bg-')}`}>
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${bt.color}`}>
          {icons[block.type]}
        </div>
        <div>
          <p className={`font-bold text-sm ${bt.color.split(' ')[1]}`}>{labels[block.type]}</p>
          {s.title && <p className="text-gray-500 text-xs mt-0.5">Judul: "{s.title}"</p>}
          <p className="text-gray-400 text-xs mt-1 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400"></span>
            Data ditarik otomatis dari database saat halaman ditampilkan
          </p>
        </div>
      </div>
    );
  }

  // Static blocks
  switch (block.type) {
    case 'hero':
      return (
        <div className="relative rounded-xl overflow-hidden min-h-[160px] flex items-center justify-center" style={{ background: s.backgroundImage ? `linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)), url(${s.backgroundImage}) center/cover` : '#1e3a5f' }}>
          <div className="text-center text-white p-6">
            <h1 className="text-xl md:text-2xl font-extrabold mb-2">{s.title || 'Judul'}</h1>
            <p className="text-white/80 text-sm mb-3">{s.subtitle}</p>
            {s.buttonText && <span className="bg-[#c9a84c] text-white px-4 py-1.5 rounded-lg text-sm font-bold inline-block">{s.buttonText}</span>}
          </div>
        </div>
      );
    case 'text':
      return <div className="prose prose-sm max-w-none p-4 bg-white rounded-xl border" dangerouslySetInnerHTML={{ __html: s.content || '' }} />;
    case 'image':
      return (
        <div className={`flex flex-col items-${s.alignment || 'center'} gap-2 p-4`}>
          {s.src ? <img src={s.src} alt={s.caption} className="max-w-full rounded-xl max-h-52 object-cover" /> : <div className="w-full h-28 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm"><ImageIcon className="w-6 h-6" /></div>}
          {s.caption && <p className="text-gray-500 text-xs italic">{s.caption}</p>}
        </div>
      );
    case 'cardgrid':
      return (
        <div className="p-4 bg-gray-50 rounded-xl">
          {s.title && <h2 className="text-base font-bold text-[#1e3a5f] text-center mb-3">{s.title}</h2>}
          <div className="grid grid-cols-3 gap-3">
            {(s.items || []).map(item => (
              <div key={item.id} className="bg-white p-3 rounded-xl shadow-sm text-center">
                <div className="text-xl mb-1">{item.icon}</div>
                <h3 className="font-bold text-[#1e3a5f] text-xs mb-0.5">{item.title}</h3>
                <p className="text-gray-500 text-xs">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case 'stats':
      return (
        <div className="grid grid-cols-3 gap-3 p-4 bg-[#1e3a5f] rounded-xl">
          {(s.items || []).map(item => (
            <div key={item.id} className="text-center">
              <div className="text-xl font-extrabold text-[#c9a84c]">{item.number}</div>
              <div className="text-white/70 text-xs">{item.label}</div>
            </div>
          ))}
        </div>
      );
    case 'cta':
      return (
        <div className="p-8 rounded-xl text-center text-white" style={{ background: s.bgColor || '#1e3a5f' }}>
          <h2 className="text-lg font-bold mb-2">{s.title}</h2>
          <p className="text-white/80 mb-3 text-sm">{s.subtitle}</p>
          {s.buttonText && <span className="bg-[#c9a84c] text-white px-4 py-1.5 rounded-lg text-sm font-bold inline-block">{s.buttonText}</span>}
        </div>
      );
    case 'gallery':
      return (
        <div className="p-4">
          {(s.images || []).length === 0 ? (
            <div className="h-20 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm">Belum ada foto</div>
          ) : (
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${s.columns || 3}, 1fr)` }}>
              {s.images.map((img, i) => <img key={i} src={img} alt="" className="w-full h-20 object-cover rounded-lg" />)}
            </div>
          )}
        </div>
      );
    default:
      return <div className="p-4 bg-gray-100 rounded-xl text-gray-500 text-sm text-center">Blok tidak dikenal</div>;
  }
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel({ block, onChange, token }) {
  const s = block.settings || {};
  const upd = (k, v) => onChange({ ...block, settings: { ...s, [k]: v } });
  const updItem = (key, i, field, val) => {
    const arr = [...(s[key] || [])]; arr[i] = { ...arr[i], [field]: val };
    onChange({ ...block, settings: { ...s, [key]: arr } });
  };
  const addItem = (key, def) => onChange({ ...block, settings: { ...s, [key]: [...(s[key] || []), { id: uuidv4(), ...def }] } });
  const removeItem = (key, i) => { const arr = [...(s[key] || [])]; arr.splice(i, 1); onChange({ ...block, settings: { ...s, [key]: arr } }); };

  switch (block.type) {
    // ── Dynamic Blocks ──
    case 'hero_home': return (
      <div className="space-y-3">
        <div><Label className="text-xs font-semibold mb-1 block">Judul Utama</Label><Input value={s.title || ''} onChange={e => upd('title', e.target.value)} /></div>
        <div><Label className="text-xs font-semibold mb-1 block">Sub-judul / Tagline</Label><textarea className="w-full p-2 border rounded-lg text-sm h-20 resize-none" value={s.subtitle || ''} onChange={e => upd('subtitle', e.target.value)} /></div>
        <div>
          <Label className="text-xs font-semibold mb-1 block">Gambar Latar</Label>
          <ImageUploadSmall value={s.backgroundImage || ''} onChange={v => upd('backgroundImage', v)} token={token} />
          {s.backgroundImage && <img src={s.backgroundImage} alt="" className="mt-1.5 w-full h-14 object-cover rounded-lg opacity-80" onError={e => e.target.style.display='none'} />}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs font-semibold mb-1 block">Teks Tombol 1</Label><Input value={s.buttonText || ''} onChange={e => upd('buttonText', e.target.value)} /></div>
          <div><Label className="text-xs font-semibold mb-1 block">Link Tombol 1</Label><Input value={s.buttonLink || ''} onChange={e => upd('buttonLink', e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs font-semibold mb-1 block">Teks Tombol 2</Label><Input value={s.button2Text || ''} onChange={e => upd('button2Text', e.target.value)} /></div>
          <div><Label className="text-xs font-semibold mb-1 block">Link Tombol 2</Label><Input value={s.button2Link || ''} onChange={e => upd('button2Link', e.target.value)} /></div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={s.showStats !== false} onChange={e => upd('showStats', e.target.checked)} className="w-4 h-4 accent-[#1e3a5f]" />
          <span className="text-xs font-semibold">Tampilkan Statistik Perkara (Live)</span>
        </label>
      </div>
    );
    case 'news_ann': return (
      <div className="space-y-3">
        <div><Label className="text-xs font-semibold mb-1 block">Judul Section</Label><Input value={s.title || ''} onChange={e => upd('title', e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs font-semibold mb-1 block">Jumlah Berita</Label><Input type="number" min={1} max={8} value={s.newsCount || 4} onChange={e => upd('newsCount', +e.target.value)} /></div>
          <div><Label className="text-xs font-semibold mb-1 block">Jumlah Pengumuman</Label><Input type="number" min={1} max={10} value={s.annCount || 5} onChange={e => upd('annCount', +e.target.value)} /></div>
        </div>
        <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg p-2">✅ Data ditarik otomatis dari database. Tidak perlu input manual.</p>
      </div>
    );
    case 'services_grid': return (
      <div className="space-y-3">
        <div><Label className="text-xs font-semibold mb-1 block">Judul Section</Label><Input value={s.title || ''} onChange={e => upd('title', e.target.value)} /></div>
        <div><Label className="text-xs font-semibold mb-1 block">Sub-judul</Label><Input value={s.subtitle || ''} onChange={e => upd('subtitle', e.target.value)} /></div>
        <p className="text-xs text-violet-600 bg-violet-50 rounded-lg p-2">✅ Layanan diambil otomatis dari menu Layanan di admin.</p>
      </div>
    );
    case 'case_search': return (
      <div className="space-y-3">
        <div><Label className="text-xs font-semibold mb-1 block">Judul Section</Label><Input value={s.title || ''} onChange={e => upd('title', e.target.value)} /></div>
        <div><Label className="text-xs font-semibold mb-1 block">Sub-judul</Label><Input value={s.subtitle || ''} onChange={e => upd('subtitle', e.target.value)} /></div>
        <p className="text-xs text-sky-600 bg-sky-50 rounded-lg p-2">✅ Formulir pencarian aktif terhubung ke database perkara.</p>
      </div>
    );
    case 'contact_info': return (
      <div className="space-y-3">
        <div><Label className="text-xs font-semibold mb-1 block">Judul Section</Label><Input value={s.title || ''} onChange={e => upd('title', e.target.value)} /></div>
        <div><Label className="text-xs font-semibold mb-1 block">Sub-judul</Label><Input value={s.subtitle || ''} onChange={e => upd('subtitle', e.target.value)} /></div>
        <div><Label className="text-xs font-semibold mb-1 block">Warna Latar</Label><Input type="color" value={s.bgColor || '#f9fafb'} onChange={e => upd('bgColor', e.target.value)} className="h-10 px-2" /></div>
        <p className="text-xs text-orange-600 bg-orange-50 rounded-lg p-2">✅ Informasi kontak diambil dari Pengaturan &gt; Info Kontak.</p>
      </div>
    );
    case 'profile_cards': return (
      <div className="space-y-3">
        <div><Label className="text-xs font-semibold mb-1 block">Judul Section</Label><Input value={s.title || ''} onChange={e => upd('title', e.target.value)} /></div>
        <div><Label className="text-xs font-semibold mb-1 block">Sub-judul</Label><Input value={s.subtitle || ''} onChange={e => upd('subtitle', e.target.value)} /></div>
        <p className="text-xs text-teal-600 bg-teal-50 rounded-lg p-2">✅ Menampilkan Visi, Misi, dan Lokasi pengadilan.</p>
      </div>
    );
    // ── Static Blocks ──
    case 'hero':
      return (
        <div className="space-y-3">
          <div><Label className="text-xs font-semibold mb-1 block">Judul</Label><Input value={s.title || ''} onChange={e => upd('title', e.target.value)} /></div>
          <div><Label className="text-xs font-semibold mb-1 block">Sub-judul</Label><textarea className="w-full p-2 border rounded-lg text-sm h-20 resize-none" value={s.subtitle || ''} onChange={e => upd('subtitle', e.target.value)} /></div>
          <div>
            <Label className="text-xs font-semibold mb-1 block">Gambar Latar</Label>
            <ImageUploadSmall value={s.backgroundImage || ''} onChange={v => upd('backgroundImage', v)} token={token} />
            {s.backgroundImage && <img src={s.backgroundImage} alt="" className="mt-1.5 w-full h-14 object-cover rounded-lg" onError={e => e.target.style.display='none'} />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs font-semibold mb-1 block">Teks Tombol</Label><Input value={s.buttonText || ''} onChange={e => upd('buttonText', e.target.value)} /></div>
            <div><Label className="text-xs font-semibold mb-1 block">Link</Label><Input value={s.buttonLink || ''} onChange={e => upd('buttonLink', e.target.value)} /></div>
          </div>
        </div>
      );
    case 'text':
      return (
        <div>
          <Label className="text-xs font-semibold mb-1 block">Konten HTML</Label>
          <textarea className="w-full p-2 border rounded-lg text-sm h-48 resize-none font-mono" value={s.content || ''} onChange={e => upd('content', e.target.value)} placeholder="<p>Konten HTML...</p>" />
          <p className="text-xs text-gray-400 mt-1">Tag: h1-h6, p, strong, em, ul, ol, li, a</p>
        </div>
      );
    case 'image':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold mb-1 block">Gambar</Label>
            <ImageUploadSmall value={s.src || ''} onChange={v => upd('src', v)} token={token} />
            {s.src && <img src={s.src} alt="" className="mt-1.5 w-full h-16 object-cover rounded-lg" onError={e => e.target.style.display='none'} />}
          </div>
          <div><Label className="text-xs font-semibold mb-1 block">Keterangan</Label><Input value={s.caption || ''} onChange={e => upd('caption', e.target.value)} /></div>
          <div>
            <Label className="text-xs font-semibold mb-1 block">Perataan</Label>
            <div className="flex gap-2">
              {['left','center','right'].map(a => (
                <button key={a} onClick={() => upd('alignment', a)} className={`flex-1 py-1.5 rounded text-xs font-medium border ${s.alignment === a ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'border-gray-200 text-gray-600'}`}>{a}</button>
              ))}
            </div>
          </div>
        </div>
      );
    case 'cardgrid':
      return (
        <div className="space-y-3">
          <div><Label className="text-xs font-semibold mb-1 block">Judul</Label><Input value={s.title || ''} onChange={e => upd('title', e.target.value)} /></div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">Kartu</Label>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addItem('items', { icon: '⭐', title: 'Kartu Baru', description: 'Deskripsi.' })}>
                <Plus className="w-3 h-3 mr-1" /> Tambah
              </Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(s.items || []).map((item, i) => (
                <div key={item.id} className="bg-gray-50 p-2 rounded-lg space-y-1.5">
                  <div className="flex gap-2">
                    <Input value={item.icon || ''} onChange={e => updItem('items', i, 'icon', e.target.value)} className="w-16 text-center" />
                    <Input value={item.title || ''} onChange={e => updItem('items', i, 'title', e.target.value)} placeholder="Judul" className="flex-1" />
                    <button onClick={() => removeItem('items', i)} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <Input value={item.description || ''} onChange={e => updItem('items', i, 'description', e.target.value)} placeholder="Deskripsi" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case 'stats':
      return (
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-semibold">Statistik</Label>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addItem('items', { number: '0', label: 'Label' })}>
              <Plus className="w-3 h-3 mr-1" /> Tambah
            </Button>
          </div>
          <div className="space-y-2">
            {(s.items || []).map((item, i) => (
              <div key={item.id} className="flex gap-2 items-center">
                <Input value={item.number || ''} onChange={e => updItem('items', i, 'number', e.target.value)} placeholder="Angka" className="w-20" />
                <Input value={item.label || ''} onChange={e => updItem('items', i, 'label', e.target.value)} placeholder="Label" className="flex-1" />
                <button onClick={() => removeItem('items', i)} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      );
    case 'cta':
      return (
        <div className="space-y-3">
          <div><Label className="text-xs font-semibold mb-1 block">Judul</Label><Input value={s.title || ''} onChange={e => upd('title', e.target.value)} /></div>
          <div><Label className="text-xs font-semibold mb-1 block">Sub-judul</Label><Input value={s.subtitle || ''} onChange={e => upd('subtitle', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs font-semibold mb-1 block">Teks Tombol</Label><Input value={s.buttonText || ''} onChange={e => upd('buttonText', e.target.value)} /></div>
            <div><Label className="text-xs font-semibold mb-1 block">Link</Label><Input value={s.buttonLink || ''} onChange={e => upd('buttonLink', e.target.value)} /></div>
          </div>
          <div><Label className="text-xs font-semibold mb-1 block">Warna Latar</Label><Input type="color" value={s.bgColor || '#1e3a5f'} onChange={e => upd('bgColor', e.target.value)} className="h-10 px-2" /></div>
        </div>
      );
    case 'gallery':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold mb-1 block">Jumlah Kolom</Label>
            <div className="flex gap-2">{[2,3,4].map(n => (
              <button key={n} onClick={() => upd('columns', n)} className={`flex-1 py-1.5 rounded text-xs font-medium border ${s.columns === n ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'border-gray-200 text-gray-600'}`}>{n} Kolom</button>
            ))}</div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">Gambar</Label>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => upd('images', [...(s.images || []), ''])}>
                <Plus className="w-3 h-3 mr-1" /> Tambah
              </Button>
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {(s.images || []).map((img, i) => (
                <div key={i} className="flex gap-2">
                  <ImageUploadSmall value={img} onChange={v => { const arr=[...(s.images||[])]; arr[i]=v; upd('images',arr); }} token={token} />
                  <button onClick={() => { const arr=[...(s.images||[])]; arr.splice(i,1); upd('images',arr); }} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {!(s.images || []).length && <p className="text-xs text-gray-400 text-center py-2">Belum ada gambar.</p>}
            </div>
          </div>
        </div>
      );
    default: return null;
  }
}

// ─── Sortable Block ───────────────────────────────────────────────────────────
function SortableBlock({ block, isSelected, onSelect, onDelete, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const bt = BLOCK_TYPES.find(t => t.type === block.type);
  return (
    <div ref={setNodeRef} style={style} className={`group relative border-2 rounded-2xl transition-all ${isSelected ? 'border-[#c9a84c] shadow-md' : 'border-transparent hover:border-gray-200'} ${isDragging ? 'bg-white shadow-xl' : ''}`}>
      <div className={`absolute -top-8 left-0 right-0 flex items-center gap-1 z-10 ${ isSelected ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'} transition-opacity`}>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-sm px-2 py-1">
          <button {...attributes} {...listeners} className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing p-0.5"><GripVertical className="w-3.5 h-3.5" /></button>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${bt?.color || 'bg-gray-100 text-gray-600'}`}>{bt?.label}</span>
          {bt?.dynamic && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">LIVE</span>}
          <button onClick={() => onSelect(block.id)} className="text-gray-400 hover:text-[#1e3a5f] p-0.5"><Settings2 className="w-3.5 h-3.5" /></button>
          <button onClick={() => onDelete(block.id)} className="text-gray-400 hover:text-red-500 p-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div onClick={() => onSelect(block.id)} className="cursor-pointer">{children}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HomepageBuilderAdmin() {
  const [blocks, setBlocks] = useState([]);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageId, setPageId] = useState(null);
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const [hasPage, setHasPage] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3000); };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => { loadHomepage(); }, []);

  async function loadHomepage() {
    setLoading(true);
    try {
      // Try to fetch existing _homepage page
      const res = await fetch(`/api/pages/slug/${HOMEPAGE_SLUG}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setBlocks(data.blocks || []);
        setPageId(data.id);
        setHasPage(true);
      } else {
        setHasPage(false);
      }
    } catch {}
    finally { setLoading(false); }
  }

  async function initHomepage() {
    // Create default homepage with recommended blocks
    const defaultBlocks = [
      { id: uuidv4(), type: 'hero_home', settings: { ...defaultSettings.hero_home } },
      { id: uuidv4(), type: 'services_grid', settings: { ...defaultSettings.services_grid } },
      { id: uuidv4(), type: 'news_ann', settings: { ...defaultSettings.news_ann } },
      { id: uuidv4(), type: 'case_search', settings: { ...defaultSettings.case_search } },
      { id: uuidv4(), type: 'contact_info', settings: { ...defaultSettings.contact_info } },
    ];
    try {
      const res = await fetch('/api/pages', { method: 'POST', headers, body: JSON.stringify({ title: 'Beranda', slug: HOMEPAGE_SLUG, blocks: defaultBlocks, status: 'published' }) });
      if (!res.ok) throw new Error('Gagal membuat homepage');
      const data = await res.json();
      setBlocks(defaultBlocks);
      setPageId(data.id);
      setHasPage(true);
      showToast('Homepage berhasil dibuat dengan layout default');
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function savePage() {
    if (!pageId) return;
    setSaving(true);
    try {
      await fetch(`/api/pages/${pageId}`, { method: 'PUT', headers, body: JSON.stringify({ title: 'Beranda', slug: HOMEPAGE_SLUG, blocks, status: 'published' }) });
      showToast('Beranda berhasil disimpan & dipublikasi!');
    } catch { showToast('Gagal menyimpan', 'error'); }
    finally { setSaving(false); }
  }

  function addBlock(type) {
    const newBlock = { id: uuidv4(), type, settings: { ...(defaultSettings[type] || {}) } };
    if (newBlock.settings.items) newBlock.settings.items = newBlock.settings.items.map(i => ({ ...i, id: uuidv4() }));
    setBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  }

  function updateBlock(updated) { setBlocks(prev => prev.map(b => b.id === updated.id ? updated : b)); }
  function deleteBlock(id) { setBlocks(prev => prev.filter(b => b.id !== id)); if (selectedBlockId === id) setSelectedBlockId(null); }
  function handleDragStart(e) { setActiveId(e.active.id); }
  function handleDragEnd(e) {
    const { active, over } = e; setActiveId(null);
    if (active.id !== over?.id) {
      setBlocks(items => {
        const oi = items.findIndex(i => i.id === active.id);
        const ni = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oi, ni);
      });
    }
  }

  const selectedBlock = blocks.find(b => b.id === selectedBlockId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center"><div className="w-10 h-10 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-gray-500">Memuat homepage builder...</p></div>
      </div>
    );
  }

  // First time setup
  if (!hasPage) {
    return (
      <div>
        <Toast msg={toast.msg} type={toast.type} />
        <div className="max-w-2xl mx-auto mt-16 text-center">
          <div className="w-20 h-20 bg-[#1e3a5f]/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Home className="w-10 h-10 text-[#1e3a5f]" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#1e3a5f] mb-3">Homepage Builder</h1>
          <p className="text-gray-500 mb-2">Halaman beranda belum dikonfigurasi.</p>
          <p className="text-gray-400 text-sm mb-8">Klik tombol di bawah untuk membuat beranda dengan layout default yang sudah disertakan blok Hero, Layanan, Berita, Pencarian Perkara, dan Kontak.</p>
          <Button className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white px-8 py-3 text-base rounded-xl" onClick={initHomepage}>
            <Plus className="w-5 h-5 mr-2" /> Buat Homepage dengan Layout Default
          </Button>
          <p className="text-gray-400 text-xs mt-4">Atau kunjungi halaman beranda saat ini <a href="/" target="_blank" className="text-[#c9a84c] underline">di sini →</a></p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col -m-4 md:-m-6">
      <Toast msg={toast.msg} type={toast.type} />

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#1e3a5f] rounded-lg flex items-center justify-center">
            <Home className="w-3.5 h-3.5 text-[#c9a84c]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#1e3a5f] leading-none">Homepage Builder</p>
            <p className="text-[10px] text-gray-400 leading-none mt-0.5">/ (beranda utama)</p>
          </div>
        </div>
        <div className="flex-1" />
        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">✅ Dipublikasi otomatis</span>
        <Button variant="outline" size="sm" onClick={() => setPreview(!preview)}>
          <Eye className="w-4 h-4 mr-1" /> {preview ? 'Edit' : 'Preview'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.open('/', '_blank')}>
          <Globe className="w-4 h-4 mr-1" /> Lihat
        </Button>
        <Button size="sm" className="bg-[#c9a84c] hover:bg-[#b8962f] text-white" onClick={savePage} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> {saving ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Palette LEFT */}
        {!preview && (
          <div className="w-60 bg-white border-r border-gray-100 flex flex-col flex-shrink-0 overflow-y-auto">
            <div className="sticky top-0 bg-white p-3 border-b border-gray-100 z-10">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tambah Blok</p>
            </div>
            {/* Dynamic */}
            <div className="px-2 pt-2">
              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest px-2 mb-1">⚡ Dinamis (Live DB)</p>
              <div className="space-y-1">
                {BLOCK_TYPES.filter(bt => bt.dynamic).map(bt => {
                  const Icon = bt.icon;
                  return (
                    <button key={bt.type} onClick={() => addBlock(bt.type)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left group">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${bt.color}`}><Icon className="w-3.5 h-3.5" /></div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{bt.label}</p>
                        <p className="text-[10px] text-gray-400 leading-tight">{bt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Static */}
            <div className="px-2 pt-3 pb-2">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-1">📄 Statis</p>
              <div className="space-y-1">
                {BLOCK_TYPES.filter(bt => !bt.dynamic).map(bt => {
                  const Icon = bt.icon;
                  return (
                    <button key={bt.type} onClick={() => addBlock(bt.type)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left group">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${bt.color}`}><Icon className="w-3.5 h-3.5" /></div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{bt.label}</p>
                        <p className="text-[10px] text-gray-400 leading-tight">{bt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Canvas CENTER */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
          <div className="max-w-3xl mx-auto space-y-3">
            {blocks.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-16 text-center bg-white">
                <Home className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="font-medium text-gray-500">Homepage Kosong</p>
                <p className="text-sm text-gray-400 mt-1">Klik blok di panel kiri untuk menambahkan konten</p>
              </div>
            ) : preview ? (
              <div className="space-y-4 bg-white rounded-2xl overflow-hidden shadow-sm p-4">
                {blocks.map(block => <BlockPreview key={block.id} block={block} />)}
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-6 pt-6">
                    {blocks.map(block => (
                      <SortableBlock key={block.id} block={block} isSelected={selectedBlockId === block.id} onSelect={setSelectedBlockId} onDelete={deleteBlock}>
                        <BlockPreview block={block} />
                      </SortableBlock>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Settings RIGHT */}
        {!preview && selectedBlock && (
          <div className="w-72 bg-white border-l border-gray-100 flex flex-col flex-shrink-0 overflow-y-auto">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5" />
                {BLOCK_TYPES.find(t => t.type === selectedBlock.type)?.label}
              </p>
              <button onClick={() => setSelectedBlockId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4"><SettingsPanel block={selectedBlock} onChange={updateBlock} token={token} /></div>
          </div>
        )}
        {!preview && !selectedBlock && blocks.length > 0 && (
          <div className="w-64 bg-white border-l border-gray-100 flex items-center justify-center flex-shrink-0">
            <div className="text-center p-6 text-gray-400">
              <Settings2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Klik blok untuk mengedit pengaturannya</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
