'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, Trash2, GripVertical, Eye, Save, ArrowLeft, Settings2,
  Type, Image, LayoutGrid, BarChart2, Zap, AlignLeft, X, Check,
  ChevronDown, ChevronUp, Layers, Globe, FileText
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div className={`fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2 ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
      {type === 'error' ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
      {msg}
    </div>
  );
}

const BLOCK_TYPES = [
  { type: 'hero', label: 'Hero', icon: Layers, desc: 'Banner hero dengan gambar latar', color: 'bg-blue-50 text-blue-700' },
  { type: 'text', label: 'Teks', icon: Type, desc: 'Blok teks bebas / rich content', color: 'bg-gray-50 text-gray-700' },
  { type: 'image', label: 'Gambar', icon: Image, desc: 'Gambar dengan keterangan', color: 'bg-green-50 text-green-700' },
  { type: 'cardgrid', label: 'Card Grid', icon: LayoutGrid, desc: 'Grid kartu informasi', color: 'bg-purple-50 text-purple-700' },
  { type: 'stats', label: 'Statistik', icon: BarChart2, desc: 'Angka statistik menarik', color: 'bg-amber-50 text-amber-700' },
  { type: 'cta', label: 'CTA', icon: Zap, desc: 'Call-to-action button', color: 'bg-red-50 text-red-700' },
  { type: 'gallery', label: 'Galeri', icon: Image, desc: 'Grid galeri foto', color: 'bg-teal-50 text-teal-700' },
];

const defaultSettings = {
  hero: { title: 'Judul Halaman', subtitle: 'Sub-judul atau deskripsi singkat halaman ini.', backgroundImage: '', buttonText: 'Selengkapnya', buttonLink: '#' },
  text: { content: '<p>Tulis konten Anda di sini. Klik untuk mengedit.</p>' },
  image: { src: '', caption: '', alignment: 'center' },
  cardgrid: { title: 'Layanan Kami', items: [{ id: uuidv4(), icon: '⚖️', title: 'Layanan 1', description: 'Deskripsi layanan pertama.' },{ id: uuidv4(), icon: '📋', title: 'Layanan 2', description: 'Deskripsi layanan kedua.' },{ id: uuidv4(), icon: '🏛️', title: 'Layanan 3', description: 'Deskripsi layanan ketiga.' }] },
  stats: { items: [{ id: uuidv4(), number: '500+', label: 'Perkara' },{ id: uuidv4(), number: '20', label: 'Tahun' },{ id: uuidv4(), number: '100%', label: 'Komitmen' }] },
  cta: { title: 'Hubungi Kami', subtitle: 'Kami siap membantu Anda.', buttonText: 'Hubungi Sekarang', buttonLink: '/kontak', bgColor: '#1e3a5f' },
  gallery: { images: [], columns: 3 },
};

// Block renderer for preview
function BlockPreview({ block }) {
  const s = block.settings || {};
  switch (block.type) {
    case 'hero':
      return (
        <div className="relative rounded-xl overflow-hidden min-h-[200px] flex items-center justify-center" style={{ background: s.backgroundImage ? `linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)), url(${s.backgroundImage}) center/cover` : '#1e3a5f' }}>
          <div className="text-center text-white p-8">
            <h1 className="text-2xl md:text-3xl font-extrabold mb-2">{s.title || 'Judul'}</h1>
            <p className="text-white/80 mb-4">{s.subtitle}</p>
            {s.buttonText && <span className="bg-[#c9a84c] text-white px-5 py-2 rounded-lg text-sm font-bold inline-block">{s.buttonText}</span>}
          </div>
        </div>
      );
    case 'text':
      return (
        <div className="prose prose-sm max-w-none p-4 bg-white rounded-xl border border-gray-100" dangerouslySetInnerHTML={{ __html: s.content || '' }} />
      );
    case 'image':
      return (
        <div className={`flex flex-col items-${s.alignment || 'center'} gap-2 p-4`}>
          {s.src ? <img src={s.src} alt={s.caption} className="max-w-full rounded-xl max-h-60 object-cover" /> : <div className="w-full h-32 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm">Belum ada gambar</div>}
          {s.caption && <p className="text-gray-500 text-xs italic">{s.caption}</p>}
        </div>
      );
    case 'cardgrid':
      return (
        <div className="p-4 bg-gray-50 rounded-xl">
          {s.title && <h2 className="text-lg font-bold text-[#1e3a5f] text-center mb-4">{s.title}</h2>}
          <div className="grid grid-cols-3 gap-3">
            {(s.items || []).map(item => (
              <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm text-center">
                <div className="text-2xl mb-2">{item.icon}</div>
                <h3 className="font-bold text-[#1e3a5f] text-sm mb-1">{item.title}</h3>
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
              <div className="text-2xl font-extrabold text-[#c9a84c]">{item.number}</div>
              <div className="text-white/70 text-xs">{item.label}</div>
            </div>
          ))}
        </div>
      );
    case 'cta':
      return (
        <div className="p-8 rounded-xl text-center text-white" style={{ background: s.bgColor || '#1e3a5f' }}>
          <h2 className="text-xl font-bold mb-2">{s.title}</h2>
          <p className="text-white/80 mb-4 text-sm">{s.subtitle}</p>
          {s.buttonText && <span className="bg-[#c9a84c] text-white px-5 py-2 rounded-lg text-sm font-bold inline-block">{s.buttonText}</span>}
        </div>
      );
    case 'gallery':
      return (
        <div className="p-4">
          {(s.images || []).length === 0 ? (
            <div className="h-24 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm">Belum ada foto di galeri</div>
          ) : (
            <div className={`grid grid-cols-${s.columns || 3} gap-2`}>
              {s.images.map((img, i) => <img key={i} src={img} alt="" className="w-full h-24 object-cover rounded-lg" />)}
            </div>
          )}
        </div>
      );
    default:
      return <div className="p-4 bg-gray-100 rounded-xl text-gray-500 text-sm text-center">Blok tidak dikenal</div>;
  }
}

// Settings panel per block type
function BlockSettingsPanel({ block, onChange }) {
  const s = block.settings || {};
  const upd = (key, val) => onChange({ ...block, settings: { ...s, [key]: val } });
  const updItem = (key, i, field, val) => {
    const arr = [...(s[key] || [])];
    arr[i] = { ...arr[i], [field]: val };
    onChange({ ...block, settings: { ...s, [key]: arr } });
  };
  const addItem = (key, def) => onChange({ ...block, settings: { ...s, [key]: [...(s[key] || []), { id: uuidv4(), ...def }] } });
  const removeItem = (key, i) => { const arr = [...(s[key] || [])]; arr.splice(i, 1); onChange({ ...block, settings: { ...s, [key]: arr } }); };

  switch (block.type) {
    case 'hero':
      return (
        <div className="space-y-3">
          <div><Label className="text-xs font-semibold mb-1 block">Judul</Label><Input value={s.title || ''} onChange={e => upd('title', e.target.value)} /></div>
          <div><Label className="text-xs font-semibold mb-1 block">Sub-judul</Label><textarea className="w-full p-2 border border-gray-200 rounded-lg text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20" value={s.subtitle || ''} onChange={e => upd('subtitle', e.target.value)} /></div>
          <div><Label className="text-xs font-semibold mb-1 block">URL Gambar Latar</Label><Input placeholder="https://..." value={s.backgroundImage || ''} onChange={e => upd('backgroundImage', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs font-semibold mb-1 block">Teks Button</Label><Input value={s.buttonText || ''} onChange={e => upd('buttonText', e.target.value)} /></div>
            <div><Label className="text-xs font-semibold mb-1 block">Link Button</Label><Input value={s.buttonLink || ''} onChange={e => upd('buttonLink', e.target.value)} /></div>
          </div>
        </div>
      );
    case 'text':
      return (
        <div>
          <Label className="text-xs font-semibold mb-1 block">Konten HTML</Label>
          <textarea
            className="w-full p-2 border border-gray-200 rounded-lg text-sm h-48 resize-none font-mono focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
            value={s.content || ''}
            onChange={e => upd('content', e.target.value)}
            placeholder="<p>Konten HTML di sini...</p>"
          />
          <p className="text-xs text-gray-400 mt-1">Gunakan tag HTML: h1-h6, p, strong, em, ul, ol, li, a</p>
        </div>
      );
    case 'image':
      return (
        <div className="space-y-3">
          <div><Label className="text-xs font-semibold mb-1 block">URL Gambar</Label><Input placeholder="https://..." value={s.src || ''} onChange={e => upd('src', e.target.value)} /></div>
          <div><Label className="text-xs font-semibold mb-1 block">Keterangan</Label><Input value={s.caption || ''} onChange={e => upd('caption', e.target.value)} /></div>
          <div>
            <Label className="text-xs font-semibold mb-1 block">Perataan</Label>
            <div className="flex gap-2">
              {['left','center','right'].map(a => (
                <button key={a} onClick={() => upd('alignment', a)} className={`flex-1 py-1.5 rounded text-xs font-medium border ${s.alignment === a ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{a}</button>
              ))}
            </div>
          </div>
        </div>
      );
    case 'cardgrid':
      return (
        <div className="space-y-3">
          <div><Label className="text-xs font-semibold mb-1 block">Judul Section</Label><Input value={s.title || ''} onChange={e => upd('title', e.target.value)} /></div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">Kartu</Label>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addItem('items', { icon: '⭐', title: 'Kartu Baru', description: 'Deskripsi kartu.' })}>
                <Plus className="w-3 h-3 mr-1" /> Tambah
              </Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(s.items || []).map((item, i) => (
                <div key={item.id} className="bg-gray-50 p-2 rounded-lg space-y-1.5">
                  <div className="flex gap-2">
                    <Input value={item.icon || ''} onChange={e => updItem('items', i, 'icon', e.target.value)} className="w-16 text-center" />
                    <Input value={item.title || ''} onChange={e => updItem('items', i, 'title', e.target.value)} placeholder="Judul" className="flex-1" />
                    <button onClick={() => removeItem('items', i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
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
                <button onClick={() => removeItem('items', i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
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
            <div><Label className="text-xs font-semibold mb-1 block">Teks Button</Label><Input value={s.buttonText || ''} onChange={e => upd('buttonText', e.target.value)} /></div>
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
            <div className="flex gap-2">
              {[2,3,4].map(n => (
                <button key={n} onClick={() => upd('columns', n)} className={`flex-1 py-1.5 rounded text-xs font-medium border ${s.columns === n ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'border-gray-200 text-gray-600'}`}>{n} Kolom</button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">URL Gambar</Label>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => upd('images', [...(s.images || []), ''])}>
                <Plus className="w-3 h-3 mr-1" /> Tambah
              </Button>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {(s.images || []).map((img, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={img} onChange={e => { const arr=[...(s.images||[])]; arr[i]=e.target.value; upd('images',arr); }} placeholder="https://..." className="flex-1 text-xs" />
                  <button onClick={() => removeItem('images', i)} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

// Sortable block item
function SortableBlock({ block, isSelected, onSelect, onDelete, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const btype = BLOCK_TYPES.find(t => t.type === block.type);

  return (
    <div ref={setNodeRef} style={style} className={`group relative border-2 rounded-xl transition-all ${isSelected ? 'border-[#c9a84c] shadow-md' : 'border-transparent hover:border-gray-200'} ${isDragging ? 'bg-white shadow-xl' : ''}`}>
      {/* Block toolbar */}
      <div className={`absolute -top-8 left-0 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${isSelected ? 'opacity-100 pointer-events-auto' : 'group-hover:pointer-events-auto'}`}>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-sm px-2 py-1 pointer-events-auto">
          <button {...attributes} {...listeners} className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing p-0.5">
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${btype?.color || 'bg-gray-100 text-gray-600'}`}>{btype?.label}</span>
          <button onClick={() => onSelect(block.id)} className="text-gray-400 hover:text-[#1e3a5f] p-0.5">
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(block.id)} className="text-gray-400 hover:text-red-500 p-0.5">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div onClick={() => onSelect(block.id)} className="cursor-pointer">
        {children}
      </div>
    </div>
  );
}

export default function PageBuilderAdmin() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'builder'
  const [pageMeta, setPageMeta] = useState({ title: '', slug: '', status: 'draft' });
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const [creating, setCreating] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3000); };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => { fetchPages(); }, []);

  async function fetchPages() {
    setLoading(true);
    try {
      const res = await fetch('/api/pages', { headers });
      const data = await res.json();
      setPages(data.items || []);
    } catch {} finally { setLoading(false); }
  }

  function openBuilder(page) {
    setSelectedPage(page);
    setBlocks(page.blocks || []);
    setPageMeta({ title: page.title, slug: page.slug, status: page.status || 'draft' });
    setSelectedBlockId(null);
    setView('builder');
    setPreview(false);
  }

  async function createNewPage() {
    const slug = `halaman-${Date.now()}`;
    try {
      const res = await fetch('/api/pages', { method: 'POST', headers, body: JSON.stringify({ title: 'Halaman Baru', slug, blocks: [], status: 'draft' }) });
      const data = await res.json();
      await fetchPages();
      openBuilder(data);
      showToast('Halaman baru dibuat');
    } catch { showToast('Gagal membuat halaman', 'error'); }
  }

  async function savePage() {
    if (!selectedPage) return;
    setSaving(true);
    try {
      await fetch(`/api/pages/${selectedPage.id}`, { method: 'PUT', headers, body: JSON.stringify({ ...pageMeta, blocks }) });
      showToast('Halaman berhasil disimpan');
      fetchPages();
    } catch { showToast('Gagal menyimpan', 'error'); }
    finally { setSaving(false); }
  }

  async function deletePage(id) {
    if (!confirm('Hapus halaman ini?')) return;
    try {
      await fetch(`/api/pages/${id}`, { method: 'DELETE', headers });
      showToast('Halaman dihapus');
      fetchPages();
    } catch { showToast('Gagal menghapus', 'error'); }
  }

  function addBlock(type) {
    const newBlock = { id: uuidv4(), type, settings: { ...(defaultSettings[type] || {}) } };
    // Deep clone items arrays
    if (newBlock.settings.items) newBlock.settings.items = newBlock.settings.items.map(i => ({...i, id: uuidv4()}));
    setBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  }

  function updateBlock(updated) { setBlocks(prev => prev.map(b => b.id === updated.id ? updated : b)); }
  function deleteBlock(id) { setBlocks(prev => prev.filter(b => b.id !== id)); if (selectedBlockId === id) setSelectedBlockId(null); }

  function handleDragStart(e) { setActiveId(e.active.id); }
  function handleDragEnd(e) {
    const { active, over } = e;
    setActiveId(null);
    if (active.id !== over?.id) {
      setBlocks(items => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  const selectedBlock = blocks.find(b => b.id === selectedBlockId);

  // Page list view
  if (view === 'list') {
    return (
      <div>
        <Toast msg={toast.msg} type={toast.type} />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Page Builder</h1>
            <p className="text-gray-500 text-sm mt-0.5">Kelola halaman statis website</p>
          </div>
          <Button className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white" onClick={createNewPage}>
            <Plus className="w-4 h-4 mr-2" /> Halaman Baru
          </Button>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border p-6 animate-pulse h-32" />)}
          </div>
        ) : pages.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
            <Layers className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="text-gray-500 font-medium">Belum ada halaman</p>
            <p className="text-gray-400 text-sm mb-4">Buat halaman pertama Anda dengan drag & drop builder</p>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white" onClick={createNewPage}>
              <Plus className="w-4 h-4 mr-2" /> Buat Halaman
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {pages.map(page => (
              <div key={page.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-[#1e3a5f]" />
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${page.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {page.status === 'published' ? 'Dipublikasi' : 'Draft'}
                  </span>
                </div>
                <h3 className="font-bold text-[#1e3a5f] mb-1">{page.title}</h3>
                <p className="text-gray-500 text-xs mb-1">/{page.slug}</p>
                <p className="text-gray-400 text-xs mb-4">{(page.blocks || []).length} blok</p>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white text-xs h-8" onClick={() => openBuilder(page)}>
                    <Settings2 className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  {page.status === 'published' && (
                    <Button variant="outline" className="h-8 text-xs" onClick={() => window.open(`/halaman/${page.slug}`, '_blank')}>
                      <Globe className="w-3 h-3" />
                    </Button>
                  )}
                  <Button variant="outline" className="h-8 text-xs text-red-500 border-red-200 hover:bg-red-50" onClick={() => deletePage(page.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Builder view
  return (
    <div className="h-[calc(100vh-120px)] flex flex-col -m-4 md:-m-6">
      <Toast msg={toast.msg} type={toast.type} />

      {/* Builder toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={() => setView('list')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Kembali
        </Button>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <Input value={pageMeta.title} onChange={e => setPageMeta(m => ({...m, title: e.target.value}))} className="max-w-48 h-8 text-sm" placeholder="Judul halaman" />
          <div className="flex items-center gap-1 text-gray-400 text-sm">
            <span>/</span>
            <Input value={pageMeta.slug} onChange={e => setPageMeta(m => ({...m, slug: e.target.value}))} className="max-w-36 h-8 text-sm" placeholder="slug" />
          </div>
          <select
            value={pageMeta.status}
            onChange={e => setPageMeta(m => ({...m, status: e.target.value}))}
            className="h-8 border border-gray-200 rounded-lg px-2 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="published">Dipublikasi</option>
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPreview(!preview)}>
          <Eye className="w-4 h-4 mr-1" /> {preview ? 'Edit' : 'Preview'}
        </Button>
        <Button size="sm" className="bg-[#c9a84c] hover:bg-[#b8962f] text-white" onClick={savePage} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> {saving ? 'Simpan...' : 'Simpan'}
        </Button>
      </div>

      {/* Builder content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Block palette - LEFT */}
        {!preview && (
          <div className="w-56 bg-white border-r border-gray-100 flex flex-col flex-shrink-0 overflow-y-auto">
            <div className="p-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Blok Tersedia</p>
            </div>
            <div className="p-2 space-y-1">
              {BLOCK_TYPES.map(bt => {
                const Icon = bt.icon;
                return (
                  <button
                    key={bt.type}
                    onClick={() => addBlock(bt.type)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${bt.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">{bt.label}</p>
                      <p className="text-[10px] text-gray-400 leading-tight">{bt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Canvas - CENTER */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
          <div className="max-w-3xl mx-auto space-y-3">
            {blocks.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-16 text-center bg-white">
                <Layers className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="font-medium text-gray-500">Halaman Kosong</p>
                <p className="text-sm text-gray-400 mt-1">Klik blok di panel kiri untuk menambahkan konten</p>
              </div>
            ) : (
              preview ? (
                <div className="space-y-4 bg-white rounded-2xl overflow-hidden shadow-sm p-6">
                  {blocks.map(block => <BlockPreview key={block.id} block={block} />)}
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-6 pt-6">
                      {blocks.map(block => (
                        <SortableBlock
                          key={block.id}
                          block={block}
                          isSelected={selectedBlockId === block.id}
                          onSelect={setSelectedBlockId}
                          onDelete={deleteBlock}
                        >
                          <BlockPreview block={block} />
                        </SortableBlock>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )
            )}
          </div>
        </div>

        {/* Settings panel - RIGHT */}
        {!preview && selectedBlock && (
          <div className="w-72 bg-white border-l border-gray-100 flex flex-col flex-shrink-0 overflow-y-auto">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5" />
                Pengaturan {BLOCK_TYPES.find(t => t.type === selectedBlock.type)?.label}
              </p>
              <button onClick={() => setSelectedBlockId(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <BlockSettingsPanel block={selectedBlock} onChange={updateBlock} />
            </div>
          </div>
        )}

        {/* Prompt to select block */}
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
