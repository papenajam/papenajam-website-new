'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Users, Upload, Search } from 'lucide-react';

function Toast({ msg, type }) {
  if (!msg) return null;
  return <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>{msg}</div>;
}

function ImageUpload({ value, onChange, token }) {
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
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input placeholder="https://... atau upload" value={value || ''} onChange={e => onChange(e.target.value)} className="flex-1 text-sm" />
        <label className="cursor-pointer flex items-center justify-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-xs font-medium relative">
          {uploading ? 'Upload...' : <><Upload className="w-3.5 h-3.5 mr-1" /> Upload</>}
          <input ref={fileRef} type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFile} disabled={uploading} />
        </label>
      </div>
      {value && <img src={value} alt="" className="w-20 h-20 object-cover rounded-xl border" onError={e=>e.target.style.display='none'} />}
    </div>
  );
}

const CATEGORY_OPTIONS = [
  { value: '', label: 'Semua Kategori' },
  { value: 'ketua', label: 'Ketua' },
  { value: 'wakil', label: 'Wakil Ketua' },
  { value: 'hakim', label: 'Hakim' },
  { value: 'panitera', label: 'Panitera' },
  { value: 'sekretaris', label: 'Sekretaris' },
  { value: 'panitera_muda', label: 'Panitera Muda' },
  { value: 'kasubag', label: 'Kasubag' },
  { value: 'staff', label: 'Staff' },
  { value: 'pejabat', label: 'Pejabat Lain' },
];

const TITLE_OPTIONS = ['Ketua','Wakil Ketua','Hakim','Panitera','Sekretaris','Panitera Muda Gugatan','Panitera Muda Permohonan','Panitera Muda Hukum','Kasubag Umum & Keuangan','Kasubag Kepegawaian','Kasubag PTIP','Jurusita','Staff','Pejabat Lain'];

export default function LeadersAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ name: '', nameEn: '', title: 'Hakim', titleEn: '', nip: '', photoUrl: '', bio: '', bioEn: '', category: 'hakim', quote: '', quoteEn: '', order: 1, isActive: true });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');

  const showToast = (msg, type='success') => { setToast({ msg, type }); setTimeout(()=>setToast({ msg:'', type:'success'}), 3000); };
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leaders/all', { headers });
      const data = await res.json();
      setItems(data.items || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(()=>{ fetchItems(); }, [fetchItems]);

  const filtered = items.filter(it => {
    const q = search.toLowerCase();
    const matchSearch = !q || it.name.toLowerCase().includes(q) || (it.title||'').toLowerCase().includes(q) || (it.nip||'').includes(q);
    const matchCat = !filterCat || (it.category||'') === filterCat;
    return matchSearch && matchCat;
  });

  function openCreate() {
    setForm({ name: '', nameEn: '', title: 'Hakim', titleEn: '', nip: '', photoUrl: '', bio: '', bioEn: '', category: 'hakim', quote: '', quoteEn: '', order: items.length+1, isActive: true });
    setModal('create');
  }
  function openEdit(item) {
    setForm({ name: item.name||'', nameEn: item.nameEn||'', title: item.title||'Hakim', titleEn: item.titleEn||'', nip: item.nip||'', photoUrl: item.photoUrl||'', bio: item.bio||'', bioEn: item.bioEn||'', category: item.category||'hakim', quote: item.quote||'', quoteEn: item.quoteEn||'', order: item.order||1, isActive: item.isActive ?? true });
    setModal({ type:'edit', id: item.id });
  }
  async function handleSave() {
    if (!form.name || !form.title) { showToast('Nama dan Jabatan wajib diisi','error'); return; }
    setSaving(true);
    try {
      const isEdit = modal?.type==='edit';
      const res = await fetch(isEdit ? `/api/leaders/${modal.id}` : '/api/leaders', { method: isEdit?'PUT':'POST', headers, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Gagal'); }
      showToast(isEdit ? 'Data pimpinan diperbarui' : 'Pimpinan ditambahkan');
      setModal(null); fetchItems();
    } catch (e) { showToast(e.message || 'Terjadi kesalahan','error'); } finally { setSaving(false); }
  }
  async function handleDelete(id) {
    try { await fetch(`/api/leaders/${id}`, { method:'DELETE', headers }); showToast('Data dihapus'); fetchItems(); } catch { showToast('Gagal menghapus','error'); }
    setDeleteId(null);
  }

  return (
    <div>
      <Toast msg={toast.msg} type={toast.type} />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1b5e20]">Pimpinan & Hakim</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola data pimpinan, hakim, dan pejabat - tampil di homepage block Pimpinan & Hakim & Sambutan Ketua</p>
        </div>
        <Button className="bg-[#1b5e20] hover:bg-[#2e7d32] text-white" onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Tambah Pimpinan</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Cari nama, jabatan, NIP..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-w-[160px]">
          {CATEGORY_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="text-xs text-gray-500 flex items-center px-2">{filtered.length} data • Total {items.length}</div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          [1,2,3,4].map(i=><div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse"><div className="w-16 h-16 bg-gray-200 rounded-full mb-4" /><div className="h-4 bg-gray-200 rounded mb-2" /><div className="h-3 bg-gray-200 rounded w-3/4" /></div>)
        ) : filtered.length===0 ? (
          <div className="col-span-full py-12 text-center text-gray-400"><Users className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>Belum ada data pimpinan</p><p className="text-xs mt-1">Klik Tambah Pimpinan untuk menambah data Ketua, Wakil, Hakim, dll</p></div>
        ) : filtered.map(item=>(
          <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border">
                {item.photoUrl ? <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" /> : <Users className="w-6 h-6 text-gray-400" />}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${item.category==='ketua' ? 'bg-amber-100 text-amber-700' : item.category==='wakil' ? 'bg-blue-100 text-blue-700' : item.category==='hakim' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{item.category||'pejabat'}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{item.isActive ? 'Aktif' : 'Nonaktif'}</span>
              </div>
            </div>
            <h3 className="font-bold text-[#1b5e20] text-sm leading-tight">{item.name}</h3>
            <p className="text-[#d4a017] text-xs font-semibold mt-1">{item.title}</p>
            {item.nip && <p className="text-gray-400 text-[11px] font-mono mt-1">{item.nip}</p>}
            {item.quote && <p className="text-gray-600 text-xs italic mt-2 line-clamp-2">"{item.quote}"</p>}
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={()=>openEdit(item)}><Pencil className="w-3 h-3 mr-1" /> Edit</Button>
              <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50 border-red-200" onClick={()=>setDeleteId(item.id)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!modal} onOpenChange={v=>!v && setModal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{modal?.type==='edit' ? 'Edit Pimpinan' : 'Tambah Pimpinan'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Nama Lengkap <span className="text-red-500">*</span></Label>
                <Input placeholder="Dr. H. Nama Lengkap, S.H., M.H." value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))} />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Nama EN (opsional)</Label>
                <Input placeholder="English name" value={form.nameEn} onChange={e=>setForm(f=>({...f, nameEn:e.target.value}))} />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Jabatan <span className="text-red-500">*</span></Label>
                <select className="w-full p-2 border border-gray-200 rounded-lg text-sm" value={form.title} onChange={e=>setForm(f=>({...f, title:e.target.value}))}>
                  {TITLE_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Kategori</Label>
                <select className="w-full p-2 border border-gray-200 rounded-lg text-sm" value={form.category} onChange={e=>setForm(f=>({...f, category:e.target.value}))}>
                  {CATEGORY_OPTIONS.filter(o=>o.value).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">NIP</Label>
                <Input placeholder="19XXXXXXXXX" value={form.nip} onChange={e=>setForm(f=>({...f, nip:e.target.value}))} />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Urutan</Label>
                <Input type="number" min={1} value={form.order} onChange={e=>setForm(f=>({...f, order: parseInt(e.target.value)||1}))} />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Foto</Label>
              <ImageUpload value={form.photoUrl} onChange={v=>setForm(f=>({...f, photoUrl:v}))} token={token} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Bio ID</Label>
              <textarea className="w-full min-h-[60px] p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1b5e20]/30 resize-none" placeholder="Riwayat singkat, pendidikan..." value={form.bio} onChange={e=>setForm(f=>({...f, bio:e.target.value}))} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Sambutan / Quote ID</Label>
              <textarea className="w-full min-h-[60px] p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1b5e20]/30 resize-none" placeholder="Quote atau sambutan yang akan tampil di homepage..." value={form.quote} onChange={e=>setForm(f=>({...f, quote:e.target.value}))} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Bi-lingual EN (opsional)</Label>
              <div className="grid md:grid-cols-2 gap-3">
                <Input placeholder="Title EN" value={form.titleEn} onChange={e=>setForm(f=>({...f, titleEn:e.target.value}))} />
                <Input placeholder="Bio EN" value={form.bioEn} onChange={e=>setForm(f=>({...f, bioEn:e.target.value}))} />
                <Input placeholder="Quote EN" value={form.quoteEn} onChange={e=>setForm(f=>({...f, quoteEn:e.target.value}))} className="md:col-span-2" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="leadActive" checked={form.isActive} onChange={e=>setForm(f=>({...f, isActive:e.target.checked}))} className="w-4 h-4 accent-[#1b5e20]" />
              <Label htmlFor="leadActive" className="text-sm cursor-pointer">Aktif & tampilkan di homepage</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setModal(null)}>Batal</Button>
            <Button className="bg-[#1b5e20] hover:bg-[#2e7d32] text-white" onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v=>!v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Pimpinan?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan. Data pimpinan akan dihapus permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={()=>handleDelete(deleteId)}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
