'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronRight,
  Save, Eye, EyeOff, ExternalLink, Hash, FileText, X,
  Settings2, Check, Globe, Link2, AlignLeft, Menu
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

const LINK_TYPES = [
  { value: 'section', label: 'Section Beranda', icon: Hash, desc: 'Scroll ke bagian di homepage (misal #beranda)' },
  { value: 'page', label: 'Halaman Internal', icon: FileText, desc: 'Link ke halaman di website ini' },
  { value: 'external', label: 'Link Eksternal', icon: Globe, desc: 'Link ke website lain' },
];

const SECTION_IDS = [
  { value: '#beranda', label: 'Beranda (Hero)' },
  { value: '#profil', label: 'Profil Pengadilan' },
  { value: '#layanan', label: 'Layanan' },
  { value: '#perkara', label: 'Informasi Perkara' },
  { value: '#berita', label: 'Berita & Pengumuman' },
  { value: '#kontak', label: 'Kontak' },
];

const ICON_OPTS = ['🏠','🏛️','⚖️','📋','📅','💰','📄','🛡️','💻','🔍','📰','📞','ℹ️','👥','📌','🗂️','📊','🌐','📧','🏢','🎯','✅','🔔','💼'];

// ─── Item Edit Modal ───────────────────────────────────────────
function ItemEditPanel({ item, pages, onSave, onClose }) {
  const [form, setForm] = useState({ ...item });
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  function handleSave() {
    if (!form.label.trim()) { alert('Label menu tidak boleh kosong'); return; }
    if (!form.url.trim()) { alert('URL/Link tidak boleh kosong'); return; }
    onSave(form);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-[#1e3a5f] text-lg">Edit Item Menu</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Tipe link */}
          <div>
            <Label className="text-xs font-semibold mb-2 block">Tipe Link</Label>
            <div className="grid grid-cols-3 gap-2">
              {LINK_TYPES.map(lt => {
                const Icon = lt.icon;
                return (
                  <button key={lt.value} onClick={() => upd('type', lt.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all ${
                      form.type === lt.value ? 'border-[#1e3a5f] bg-[#1e3a5f]/5 text-[#1e3a5f]' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    <Icon className="w-4 h-4" />
                    {lt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Label */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Label (Indonesia)</Label>
              <Input value={form.label || ''} onChange={e => upd('label', e.target.value)} placeholder="Beranda" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Label (English)</Label>
              <Input value={form.labelEn || ''} onChange={e => upd('labelEn', e.target.value)} placeholder="Home" />
            </div>
          </div>

          {/* URL */}
          <div>
            <Label className="text-xs font-semibold mb-1 block">URL / Link</Label>
            {form.type === 'section' ? (
              <select value={form.url || ''} onChange={e => upd('url', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20">
                <option value="">-- Pilih section --</option>
                {SECTION_IDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            ) : form.type === 'page' ? (
              <select value={form.url || ''} onChange={e => upd('url', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20">
                <option value="">-- Pilih halaman --</option>
                <option value="/agenda-sidang">Agenda Sidang</option>
                <option value="/putusan">Putusan</option>
                <option value="/pencarian-perkara">Pencarian Perkara</option>
                <option value="/berita">Semua Berita</option>
                <option value="/pengumuman">Semua Pengumuman</option>
                <option value="/accessibility">Aksesibilitas</option>
                {pages.map(p => <option key={p.id} value={`/p/${p.slug}`}>{p.title} (/p/{p.slug})</option>)}
              </select>
            ) : (
              <Input value={form.url || ''} onChange={e => upd('url', e.target.value)}
                placeholder="https://contoh.com" />
            )}
            {form.type === 'external' && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={form.target === '_blank'} onChange={e => upd('target', e.target.checked ? '_blank' : '_self')}
                  className="w-4 h-4 accent-[#1e3a5f]" />
                <span className="text-xs text-gray-600">Buka di tab baru</span>
              </label>
            )}
          </div>

          {/* Ikon */}
          <div>
            <Label className="text-xs font-semibold mb-1 block">Ikon (Emoji)</Label>
            <div className="flex gap-2 flex-wrap">
              {ICON_OPTS.map(ico => (
                <button key={ico} onClick={() => upd('icon', ico)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg border-2 transition-all ${
                    form.icon === ico ? 'border-[#1e3a5f] bg-[#1e3a5f]/5' : 'border-gray-200 hover:border-gray-300'
                  }`}>{ico}</button>
              ))}
              <Input value={form.icon || ''} onChange={e => upd('icon', e.target.value)}
                placeholder="Custom" className="w-20 text-center" />
            </div>
          </div>

          {/* Deskripsi (untuk mega menu) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Deskripsi (ID)</Label>
              <Input value={form.description || ''} onChange={e => upd('description', e.target.value)} placeholder="Deskripsi singkat..." />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Deskripsi (EN)</Label>
              <Input value={form.descriptionEn || ''} onChange={e => upd('descriptionEn', e.target.value)} placeholder="Short description..." />
            </div>
          </div>

          {/* Aktif */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isActive !== false} onChange={e => upd('isActive', e.target.checked)}
              className="w-4 h-4 accent-[#1e3a5f]" />
            <span className="text-sm font-medium">Tampilkan di menu</span>
          </label>
        </div>
        <div className="p-5 border-t flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button className="bg-[#c9a84c] hover:bg-[#b8962f] text-white" onClick={handleSave}>
            <Check className="w-4 h-4 mr-1" /> Simpan Item
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Sortable Row ───────────────────────────────────────────────
function SortableRow({ item, depth = 0, onEdit, onDelete, onToggle, onAddChild }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const typeIcon = { section: <Hash className="w-3 h-3" />, page: <FileText className="w-3 h-3" />, external: <Globe className="w-3 h-3" /> };
  const typeBg = { section: 'bg-blue-100 text-blue-700', page: 'bg-violet-100 text-violet-700', external: 'bg-amber-100 text-amber-700' };

  return (
    <div ref={setNodeRef} style={style} className={`${depth > 0 ? 'ml-8 border-l-2 border-[#c9a84c]/30 pl-3' : ''}`}>
      <div className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
        isDragging ? 'bg-white shadow-lg border-[#c9a84c]' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
      } mb-1.5`}>
        <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing p-1 flex-shrink-0">
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="text-xl w-7 text-center flex-shrink-0">{item.icon || '•'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-sm ${!item.isActive ? 'text-gray-400 line-through' : 'text-[#1e3a5f]'}`}>{item.label}</span>
            {item.labelEn && <span className="text-gray-400 text-xs">/ {item.labelEn}</span>}
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${typeBg[item.type] || 'bg-gray-100 text-gray-600'}`}>
              {typeIcon[item.type]} {item.type}
            </span>
            {item.type === 'external' && item.target === '_blank' && <ExternalLink className="w-3 h-3 text-gray-400" />}
          </div>
          <p className="text-xs text-gray-400 truncate">{item.url}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {depth === 0 && (
            <button onClick={() => onAddChild(item.id)}
              title="Tambah sub-menu"
              className="p-1.5 text-gray-400 hover:text-[#1e3a5f] hover:bg-[#1e3a5f]/5 rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => onToggle(item.id)}
            title={item.isActive ? 'Sembunyikan' : 'Tampilkan'}
            className="p-1.5 text-gray-400 hover:text-[#1e3a5f] hover:bg-[#1e3a5f]/5 rounded-lg transition-colors">
            {item.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => onEdit(item)}
            className="p-1.5 text-gray-400 hover:text-[#1e3a5f] hover:bg-[#1e3a5f]/5 rounded-lg transition-colors">
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(item.id)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────
export default function MenuAdmin() {
  const [items, setItems] = useState([]);  // flat list semua items
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const [activeParent, setActiveParent] = useState(null); // parent saat add child

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3000); };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [menuRes, pagesRes] = await Promise.all([
        fetch('/api/menus/all', { headers }),
        fetch('/api/pages', { headers }),
      ]);
      const [menuData, pagesData] = await Promise.all([menuRes.json(), pagesRes.json()]);
      setItems((menuData.items || []).sort((a, b) => a.order - b.order));
      setPages((pagesData.items || []).filter(p => p.slug !== '_homepage' && p.status === 'published'));
    } catch (e) { showToast('Gagal memuat data: ' + e.message, 'error'); }
    finally { setLoading(false); }
  }

  // Pisahkan top-level dan children
  const topItems = items.filter(i => !i.parentId).sort((a, b) => a.order - b.order);
  const getChildren = (parentId) => items.filter(i => i.parentId === parentId).sort((a, b) => a.order - b.order);

  async function saveAll() {
    setSaving(true);
    try {
      const res = await fetch('/api/menus/bulk', { method: 'PUT', headers, body: JSON.stringify({ items }) });
      if (!res.ok) throw new Error('Gagal menyimpan');
      showToast('Menu berhasil disimpan!');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  function addTopItem() {
    const newItem = {
      id: uuidv4(), label: 'Menu Baru', labelEn: 'New Menu', url: '#beranda', type: 'section',
      icon: '📌', order: topItems.length, isActive: true, parentId: null,
      description: '', descriptionEn: '', target: '_self',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    setItems(prev => [...prev, newItem]);
    setEditItem(newItem);
  }

  function addChildItem(parentId) {
    const parent = items.find(i => i.id === parentId);
    const siblings = getChildren(parentId);
    const newItem = {
      id: uuidv4(), label: 'Sub-menu Baru', labelEn: 'New Submenu', url: '#beranda', type: 'section',
      icon: '•', order: siblings.length, isActive: true, parentId,
      description: '', descriptionEn: '', target: '_self',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    setItems(prev => [...prev, newItem]);
    setEditItem(newItem);
  }

  function saveEditItem(updated) {
    setItems(prev => prev.map(i => i.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : i));
    setEditItem(null);
    showToast('Item diperbarui. Jangan lupa klik Simpan.');
  }

  function deleteItem(id) {
    // Hapus item dan semua sub-menu-nya
    setItems(prev => prev.filter(i => i.id !== id && i.parentId !== id));
  }

  function toggleItem(id) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, isActive: !i.isActive } : i));
  }

  function handleDragEndTop(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = topItems.findIndex(i => i.id === active.id);
    const newIdx = topItems.findIndex(i => i.id === over.id);
    const reordered = arrayMove(topItems, oldIdx, newIdx).map((item, idx) => ({ ...item, order: idx }));
    // Update dalam flat list
    setItems(prev => {
      const children = prev.filter(i => i.parentId);
      return [...reordered, ...children];
    });
  }

  function handleDragEndChild(parentId, event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const siblings = getChildren(parentId);
    const oldIdx = siblings.findIndex(i => i.id === active.id);
    const newIdx = siblings.findIndex(i => i.id === over.id);
    const reordered = arrayMove(siblings, oldIdx, newIdx).map((item, idx) => ({ ...item, order: idx }));
    setItems(prev => {
      const others = prev.filter(i => i.parentId !== parentId);
      return [...others, ...reordered];
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Memuat pengaturan menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Toast msg={toast.msg} type={toast.type} />
      {editItem && (
        <ItemEditPanel
          item={editItem}
          pages={pages}
          onSave={saveEditItem}
          onClose={() => setEditItem(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1e3a5f]">Pengaturan Menu Navigasi</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola item menu, sub-menu, dan urutannya</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open('/', '_blank')}>
            <Eye className="w-4 h-4 mr-1" /> Preview
          </Button>
          <Button className="bg-[#c9a84c] hover:bg-[#b8962f] text-white" onClick={saveAll} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? 'Menyimpan...' : 'Simpan Semua'}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* LEFT: Menu tree */}
        <div className="lg:col-span-2 space-y-4">
          {/* Top-level items */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#1e3a5f] rounded-lg flex items-center justify-center">
                  <Menu className="w-4 h-4 text-[#c9a84c]" />
                </div>
                <div>
                  <p className="font-bold text-[#1e3a5f] text-sm">Menu Utama</p>
                  <p className="text-gray-400 text-xs">{topItems.length} item</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={addTopItem} className="h-8 text-xs">
                <Plus className="w-3 h-3 mr-1" /> Tambah Menu
              </Button>
            </div>

            {topItems.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                <Menu className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                <p className="text-gray-400 text-sm">Belum ada item menu. Klik "Tambah Menu" untuk memulai.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndTop}>
                <SortableContext items={topItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1">
                    {topItems.map(item => (
                      <div key={item.id}>
                        <SortableRow
                          item={item}
                          depth={0}
                          onEdit={setEditItem}
                          onDelete={deleteItem}
                          onToggle={toggleItem}
                          onAddChild={addChildItem}
                        />
                        {/* Sub-menu (children) */}
                        {getChildren(item.id).length > 0 && (
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEndChild(item.id, e)}>
                            <SortableContext items={getChildren(item.id).map(i => i.id)} strategy={verticalListSortingStrategy}>
                              <div className="ml-8 mt-1 mb-2 space-y-1">
                                {getChildren(item.id).map(child => (
                                  <SortableRow
                                    key={child.id}
                                    item={child}
                                    depth={1}
                                    onEdit={setEditItem}
                                    onDelete={deleteItem}
                                    onToggle={toggleItem}
                                    onAddChild={() => {}}
                                  />
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>
                        )}
                        {/* Tombol tambah sub-menu langsung */}
                        <button
                          onClick={() => addChildItem(item.id)}
                          className="ml-8 mb-2 flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#1e3a5f] transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Tambah sub-menu untuk "{item.label}"
                        </button>
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* RIGHT: Panduan */}
        <div className="space-y-4">
          <div className="bg-[#1e3a5f] rounded-2xl p-5 text-white">
            <h3 className="font-bold text-sm mb-3 text-[#c9a84c]">📖 Panduan Mega Menu</h3>
            <ul className="space-y-2 text-xs text-white/80">
              <li className="flex gap-2"><span className="text-[#c9a84c] font-bold">1.</span> Tambahkan item menu utama (level 1)</li>
              <li className="flex gap-2"><span className="text-[#c9a84c] font-bold">2.</span> Klik <strong>+</strong> pada item utama untuk menambah sub-menu</li>
              <li className="flex gap-2"><span className="text-[#c9a84c] font-bold">3.</span> Sub-menu tampil sebagai <strong>mega menu</strong> dropdown</li>
              <li className="flex gap-2"><span className="text-[#c9a84c] font-bold">4.</span> Isi deskripsi sub-menu agar terlihat di mega menu</li>
              <li className="flex gap-2"><span className="text-[#c9a84c] font-bold">5.</span> Geser (drag) untuk mengubah urutan</li>
              <li className="flex gap-2"><span className="text-[#c9a84c] font-bold">6.</span> Klik <strong>Simpan Semua</strong> setelah selesai</li>
            </ul>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-[#1e3a5f] text-sm mb-3">🔗 Tipe Link</h3>
            <div className="space-y-3">
              {LINK_TYPES.map(lt => {
                const Icon = lt.icon;
                return (
                  <div key={lt.value} className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">{lt.label}</p>
                      <p className="text-xs text-gray-400">{lt.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs text-amber-700 font-semibold mb-1">⚠️ Catatan</p>
            <p className="text-xs text-amber-600">Perubahan menu tidak akan tersimpan sampai Anda klik tombol <strong>"Simpan Semua"</strong>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
