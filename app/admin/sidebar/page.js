'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus, Trash2, Edit2, Save, X, GripVertical, Eye, EyeOff,
  Check, Settings2, LayoutDashboard
} from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { v4 as uuidv4 } from 'uuid';

function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div className={`fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2 ${
      type === 'error' ? 'bg-red-500' : 'bg-green-500'
    }`}>
      {type === 'error' ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
      {msg}
    </div>
  );
}

const WIDGET_TYPES = [
  { type: 'faq',        label: 'FAQ Cepat',          icon: '❓', color: '#1b5e20',  desc: 'Tampilkan FAQ accordion dari database' },
  { type: 'stats',      label: 'Statistik',           icon: '📊', color: '#d4a017',  desc: 'Statistik perkara & pengunjung' },
  { type: 'contact',    label: 'Kontak',              icon: '📞', color: '#2e7d32',  desc: 'Nomor telepon, email, jam operasional' },
  { type: 'quicklinks', label: 'Tautan Cepat',        icon: '🔗', color: '#7c3aed',  desc: 'Daftar tautan kustom' },
  { type: 'complaint',  label: 'Pengaduan',           icon: '📩', color: '#dc2626',  desc: 'Tombol & info pengaduan' },
  { type: 'social',     label: 'Media Sosial',        icon: '🌐', color: '#0891b2',  desc: 'Ikon media sosial dari pengaturan' },
  { type: 'hours',      label: 'Jam Operasional',     icon: '🕐', color: '#d97706',  desc: 'Jadwal pelayanan & status buka/tutup' },
];

const DEFAULT_SETTINGS = {
  faq:        { title: 'Pertanyaan Umum', titleEn: 'Common Questions', limit: 4, showAll: true },
  stats:      { title: 'Statistik', titleEn: 'Statistics', showVisitors: true, showCases: true, days: 30 },
  contact:    { title: 'Hubungi Kami', titleEn: 'Contact Us', showPhone: true, showEmail: true, showHours: true, showAddress: false },
  quicklinks: { title: 'Tautan Cepat', titleEn: 'Quick Links', links: [
    { id: uuidv4(), label: 'Agenda Sidang', labelEn: 'Court Schedule', url: '/agenda-sidang', icon: '📅', external: false },
    { id: uuidv4(), label: 'Putusan', labelEn: 'Court Decisions', url: '/putusan', icon: '📄', external: false },
    { id: uuidv4(), label: 'Pencarian Perkara', labelEn: 'Case Search', url: '/pencarian-perkara', icon: '🔍', external: false },
  ]},
  complaint:  { title: 'Pengaduan', titleEn: 'Complaints', description: 'Sampaikan pengaduan atau masukan Anda', descriptionEn: 'Submit your complaint or feedback', buttonText: 'Kirim Pengaduan', buttonTextEn: 'Submit Complaint' },
  social:     { title: 'Media Sosial', titleEn: 'Social Media' },
  hours:      { title: 'Jam Pelayanan', titleEn: 'Service Hours', schedule: [
    { days: 'Senin - Kamis', hours: '08:00 - 16:00 WITA' },
    { days: 'Jumat', hours: '08:00 - 11:00 WITA' },
    { days: 'Sabtu - Minggu', hours: 'Tutup' },
  ]},
};

// ─── Settings Panel per type ───────────────────────────────────────────────────
function WidgetSettingsPanel({ widget, onChange }) {
  const s = widget.settings || {};
  const upd = (k, v) => onChange({ ...widget, settings: { ...s, [k]: v } });

  switch (widget.type) {
    case 'faq': return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs font-semibold mb-1 block">Judul (ID)</Label><Input value={s.title || ''} onChange={e => upd('title', e.target.value)} /></div>
          <div><Label className="text-xs font-semibold mb-1 block">Judul (EN)</Label><Input value={s.titleEn || ''} onChange={e => upd('titleEn', e.target.value)} /></div>
        </div>
        <div><Label className="text-xs font-semibold mb-1 block">Jumlah FAQ ditampilkan</Label><Input type="number" min={1} max={10} value={s.limit || 4} onChange={e => upd('limit', +e.target.value)} /></div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={s.showAll !== false} onChange={e => upd('showAll', e.target.checked)} className="w-4 h-4 accent-[#1b5e20]" />
          <span className="text-xs">Tampilkan link "Lihat Semua FAQ"</span>
        </label>
        <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded-lg">✅ Data dari menu FAQ di admin</p>
      </div>
    );
    case 'stats': return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs font-semibold mb-1 block">Judul (ID)</Label><Input value={s.title || ''} onChange={e => upd('title', e.target.value)} /></div>
          <div><Label className="text-xs font-semibold mb-1 block">Judul (EN)</Label><Input value={s.titleEn || ''} onChange={e => upd('titleEn', e.target.value)} /></div>
        </div>
        <div>
          <Label className="text-xs font-semibold mb-1 block">Periode statistik pengunjung</Label>
          <div className="flex gap-2">{[7,14,30,90].map(n=>
            <button key={n} onClick={()=>upd('days',n)} className={`flex-1 py-1.5 rounded text-xs font-medium border ${s.days===n?'bg-[#1b5e20] text-white border-[#1b5e20]':'border-gray-200 text-gray-600'}`}>{n}H</button>
          )}</div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={s.showVisitors !== false} onChange={e => upd('showVisitors', e.target.checked)} className="w-4 h-4 accent-[#1b5e20]" />
          <span className="text-xs">Tampilkan statistik pengunjung</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={s.showCases !== false} onChange={e => upd('showCases', e.target.checked)} className="w-4 h-4 accent-[#1b5e20]" />
          <span className="text-xs">Tampilkan statistik perkara</span>
        </label>
      </div>
    );
    case 'contact': return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs font-semibold mb-1 block">Judul (ID)</Label><Input value={s.title || ''} onChange={e => upd('title', e.target.value)} /></div>
          <div><Label className="text-xs font-semibold mb-1 block">Judul (EN)</Label><Input value={s.titleEn || ''} onChange={e => upd('titleEn', e.target.value)} /></div>
        </div>
        {[{k:'showPhone',l:'Tampilkan Telepon'},{k:'showEmail',l:'Tampilkan Email'},{k:'showHours',l:'Tampilkan Jam Operasional'},{k:'showAddress',l:'Tampilkan Alamat'}].map(({k,l})=>(
          <label key={k} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={s[k] !== false} onChange={e => upd(k, e.target.checked)} className="w-4 h-4 accent-[#1b5e20]" />
            <span className="text-xs">{l}</span>
          </label>
        ))}
        <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded-lg">✅ Data kontak dari Pengaturan → Kontak</p>
      </div>
    );
    case 'quicklinks': return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs font-semibold mb-1 block">Judul (ID)</Label><Input value={s.title || ''} onChange={e => upd('title', e.target.value)} /></div>
          <div><Label className="text-xs font-semibold mb-1 block">Judul (EN)</Label><Input value={s.titleEn || ''} onChange={e => upd('titleEn', e.target.value)} /></div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-semibold">Tautan</Label>
            <button onClick={() => upd('links', [...(s.links||[]), {id:uuidv4(),label:'Tautan Baru',labelEn:'New Link',url:'#',icon:'🔗',external:false}])}
              className="text-xs text-[#1b5e20] font-semibold hover:underline">+ Tambah</button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {(s.links||[]).map((link,i) => (
              <div key={link.id||i} className="bg-gray-50 p-2 rounded-lg space-y-1.5">
                <div className="flex gap-2">
                  <Input value={link.icon||''} onChange={e=>{const l=[...(s.links||[])];l[i]={...l[i],icon:e.target.value};upd('links',l);}} className="w-12 text-center" placeholder="🔗" />
                  <Input value={link.label||''} onChange={e=>{const l=[...(s.links||[])];l[i]={...l[i],label:e.target.value};upd('links',l);}} placeholder="Label (ID)" className="flex-1" />
                  <button onClick={()=>{const l=[...(s.links||[])];l.splice(i,1);upd('links',l);}} className="text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
                <Input value={link.url||''} onChange={e=>{const l=[...(s.links||[])];l[i]={...l[i],url:e.target.value};upd('links',l);}} placeholder="URL: /halaman atau https://..." />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
    case 'complaint': return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs font-semibold mb-1 block">Judul (ID)</Label><Input value={s.title||''} onChange={e=>upd('title',e.target.value)} /></div>
          <div><Label className="text-xs font-semibold mb-1 block">Judul (EN)</Label><Input value={s.titleEn||''} onChange={e=>upd('titleEn',e.target.value)} /></div>
        </div>
        <div><Label className="text-xs font-semibold mb-1 block">Deskripsi</Label><Input value={s.description||''} onChange={e=>upd('description',e.target.value)} /></div>
        <div><Label className="text-xs font-semibold mb-1 block">Teks Tombol</Label><Input value={s.buttonText||''} onChange={e=>upd('buttonText',e.target.value)} /></div>
      </div>
    );
    case 'social': return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs font-semibold mb-1 block">Judul (ID)</Label><Input value={s.title||''} onChange={e=>upd('title',e.target.value)} /></div>
          <div><Label className="text-xs font-semibold mb-1 block">Judul (EN)</Label><Input value={s.titleEn||''} onChange={e=>upd('titleEn',e.target.value)} /></div>
        </div>
        <p className="text-xs text-cyan-600 bg-cyan-50 p-2 rounded-lg">✅ Media sosial dari Pengaturan → Media Sosial</p>
      </div>
    );
    case 'hours': return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs font-semibold mb-1 block">Judul (ID)</Label><Input value={s.title||''} onChange={e=>upd('title',e.target.value)} /></div>
          <div><Label className="text-xs font-semibold mb-1 block">Judul (EN)</Label><Input value={s.titleEn||''} onChange={e=>upd('titleEn',e.target.value)} /></div>
        </div>
        <div>
          <Label className="text-xs font-semibold mb-2 block">Jadwal</Label>
          {(s.schedule||[]).map((item,i)=>(
            <div key={i} className="flex gap-2 mb-2">
              <Input value={item.days||''} onChange={e=>{const sc=[...(s.schedule||[])];sc[i]={...sc[i],days:e.target.value};upd('schedule',sc);}} placeholder="Hari" className="flex-1" />
              <Input value={item.hours||''} onChange={e=>{const sc=[...(s.schedule||[])];sc[i]={...sc[i],hours:e.target.value};upd('schedule',sc);}} placeholder="Jam" className="w-36" />
            </div>
          ))}
        </div>
      </div>
    );
    default: return <p className="text-xs text-gray-400 p-3">Tidak ada pengaturan untuk tipe ini.</p>;
  }
}

// ─── Sortable Widget Row ───────────────────────────────────────────────────────
function SortableWidget({ widget, isSelected, onSelect, onToggle, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const wt = WIDGET_TYPES.find(t => t.type === widget.type);
  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all bg-white mb-2 ${
        isSelected ? 'border-[#d4a017] shadow-md' : 'border-gray-100 hover:border-gray-200 shadow-sm'
      } ${isDragging ? 'shadow-xl' : ''}`}
    >
      <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing p-1 flex-shrink-0">
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: (widget.color || '#1b5e20') + '20' }}>
        {widget.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm ${!widget.isActive ? 'text-gray-400' : 'text-[#1b5e20]'}`}>{widget.label}</p>
        <p className="text-xs text-gray-400">{wt?.desc}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => onToggle(widget.id)} className="p-1.5 text-gray-400 hover:text-[#1b5e20] rounded-lg transition-colors">
          {widget.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button onClick={() => onSelect(widget.id)} className={`p-1.5 rounded-lg transition-colors ${ isSelected ? 'bg-[#d4a017] text-white' : 'text-gray-400 hover:text-[#1b5e20]' }`}>
          <Settings2 className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(widget.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SidebarAdmin() {
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: 'success' });

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3000); };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const d = await (await fetch('/api/sidebar-widgets/all', { headers })).json();
      setWidgets((d.items || []).sort((a, b) => a.order - b.order));
    } catch { } finally { setLoading(false); }
  }

  async function saveAll() {
    setSaving(true);
    try {
      const res = await fetch('/api/sidebar-widgets/bulk', { method: 'PUT', headers, body: JSON.stringify({ items: widgets }) });
      if (!res.ok) throw new Error();
      showToast('Sidebar widgets berhasil disimpan!');
    } catch { showToast('Gagal menyimpan', 'error'); } finally { setSaving(false); }
  }

  function addWidget(type) {
    const wt = WIDGET_TYPES.find(t => t.type === type);
    if (!wt) return;
    const newWidget = {
      id: uuidv4(), type, label: wt.label, labelEn: wt.label, icon: wt.icon,
      color: wt.color, isActive: true, order: widgets.length,
      settings: { ...(DEFAULT_SETTINGS[type] || {}) },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    if (newWidget.settings.links) newWidget.settings.links = newWidget.settings.links.map(l => ({ ...l, id: uuidv4() }));
    setWidgets(prev => [...prev, newWidget]);
    setSelectedId(newWidget.id);
    setShowAddModal(false);
    showToast(`Widget "${wt.label}" ditambahkan. Klik Simpan untuk menyimpan.`);
  }

  function updateWidget(updated) {
    setWidgets(prev => prev.map(w => w.id === updated.id ? updated : w));
  }

  function toggleWidget(id) {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, isActive: !w.isActive } : w));
  }

  function deleteWidget(id) {
    setWidgets(prev => prev.filter(w => w.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = widgets.findIndex(w => w.id === active.id);
    const newIdx = widgets.findIndex(w => w.id === over.id);
    setWidgets(arrayMove(widgets, oldIdx, newIdx).map((w, i) => ({ ...w, order: i })));
  }

  const selectedWidget = widgets.find(w => w.id === selectedId);

  return (
    <div>
      <Toast msg={toast.msg} type={toast.type} />

      {/* Add Widget Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-[#1b5e20] text-lg">Tambah Widget</h2>
              <button onClick={() => setShowAddModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              {WIDGET_TYPES.map(wt => (
                <button key={wt.type} onClick={() => addWidget(wt.type)}
                  className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-100 hover:border-[#d4a017] hover:shadow-md transition-all text-left">
                  <span className="text-2xl w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: wt.color + '20' }}>{wt.icon}</span>
                  <div>
                    <p className="font-semibold text-[#1b5e20] text-sm">{wt.label}</p>
                    <p className="text-xs text-gray-400 leading-tight">{wt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1b5e20]">Sidebar Melayang</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola widget tab melayang di sisi kanan halaman</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open('/', '_blank')}><Eye className="w-4 h-4 mr-1" />Preview</Button>
          <Button variant="outline" onClick={() => setShowAddModal(true)}><Plus className="w-4 h-4 mr-1" />Tambah Widget</Button>
          <Button className="bg-[#d4a017] hover:bg-[#b88010] text-white" onClick={saveAll} disabled={saving}>
            <Save className="w-4 h-4 mr-1" />{saving ? 'Menyimpan...' : 'Simpan Semua'}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Widget List */}
        <div className="lg:col-span-2">
          {/* Preview Sidebar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Preview Sidebar</p>
            <div className="flex items-center justify-end gap-2">
              <div className="text-xs text-gray-400 mr-2">← Halaman website</div>
              <div className="flex flex-col gap-1.5">
                {widgets.filter(w => w.isActive).map(w => (
                  <div key={w.id} className="w-12 h-16 rounded-l-xl border border-r-0 flex flex-col items-center justify-center gap-1"
                    style={{ background: w.color + '15', borderColor: w.color + '40' }}>
                    <span className="text-lg">{w.icon}</span>
                    <span className="text-[8px] font-bold" style={{ color: w.color }}>{w.label.substring(0,6)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-[#1b5e20] flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" /> Widget ({widgets.length})
              </p>
              <p className="text-xs text-gray-400">Geser untuk mengatur urutan</p>
            </div>

            {loading ? (
              <div className="space-y-3">{[...Array(3)].map((_,i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
            ) : widgets.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-400 text-sm">Belum ada widget. Klik "Tambah Widget" untuk memulai.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={widgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
                  {widgets.map(widget => (
                    <SortableWidget
                      key={widget.id}
                      widget={widget}
                      isSelected={selectedId === widget.id}
                      onSelect={setSelectedId}
                      onToggle={toggleWidget}
                      onDelete={deleteWidget}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Settings Panel */}
        <div>
          {selectedWidget ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm sticky top-4">
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{selectedWidget.icon}</span>
                  <div>
                    <p className="font-bold text-[#1b5e20] text-sm">{selectedWidget.label}</p>
                    <p className="text-xs text-gray-400">{WIDGET_TYPES.find(t => t.type === selectedWidget.type)?.desc}</p>
                  </div>
                </div>
              </div>

              {/* Color & Icon */}
              <div className="p-4 border-b border-gray-100 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label className="text-xs font-semibold mb-1 block">Label (ID)</Label>
                    <Input value={selectedWidget.label} onChange={e => updateWidget({ ...selectedWidget, label: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-1 block">Ikon</Label>
                    <Input value={selectedWidget.icon} onChange={e => updateWidget({ ...selectedWidget, icon: e.target.value })} className="text-center text-lg" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label className="text-xs font-semibold mb-1 block">Label (EN)</Label>
                    <Input value={selectedWidget.labelEn || ''} onChange={e => updateWidget({ ...selectedWidget, labelEn: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-1 block">Warna</Label>
                    <Input type="color" value={selectedWidget.color || '#1b5e20'} onChange={e => updateWidget({ ...selectedWidget, color: e.target.value })} className="h-9 px-2" />
                  </div>
                </div>
              </div>

              {/* Type-specific settings */}
              <div className="p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Pengaturan Konten</p>
                <WidgetSettingsPanel widget={selectedWidget} onChange={updateWidget} />
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <Settings2 className="w-10 h-10 mx-auto mb-3 text-gray-200" />
              <p className="text-sm text-gray-400">Klik ikon ⚙️ pada widget untuk mengatur pengaturannya</p>
            </div>
          )}

          {/* Panduan */}
          <div className="mt-4 bg-[#1b5e20] rounded-2xl p-4 text-white">
            <h3 className="font-bold text-[#d4a017] text-sm mb-2">💡 Cara Kerja</h3>
            <ul className="space-y-1.5 text-xs text-white/70">
              <li>• Tab melayang tampil di kanan semua halaman</li>
              <li>• Klik tab untuk membuka panel widget</li>
              <li>• Geser widget untuk mengatur urutan tab</li>
              <li>• Klik 👁️ untuk sembunyikan/tampilkan</li>
              <li>• Klik <strong>Simpan Semua</strong> setelah selesai</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
