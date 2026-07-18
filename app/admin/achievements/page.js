'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Award, Upload, Search } from 'lucide-react';

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
    finally { setUploading(false); if (fileRef.current) fileRef.current.value=''; }
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input placeholder="https://... atau upload" value={value||''} onChange={e=>onChange(e.target.value)} className="flex-1 text-sm" />
        <label className="cursor-pointer flex items-center justify-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-xs font-medium relative">
          {uploading ? 'Upload...' : <><Upload className="w-3.5 h-3.5 mr-1" /> Upload</>}
          <input ref={fileRef} type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFile} disabled={uploading} />
        </label>
      </div>
      {value && <img src={value} alt="" className="w-24 h-16 object-cover rounded-lg border" onError={e=>e.target.style.display='none'} />}
    </div>
  );
}

const CATEGORY_OPTIONS = [
  { value: '', label: 'Semua Kategori' },
  { value: 'penghargaan', label: 'Penghargaan' },
  { value: 'predikat_wbk', label: 'Predikat WBK' },
  { value: 'predikat_wbbm', label: 'Predikat WBBM' },
  { value: 'skm', label: 'SKM - Kepuasan Masyarakat' },
  { value: 'spak', label: 'SPAK - Anti Korupsi' },
  { value: 'apm', label: 'APM - Akreditasi' },
  { value: 'inovasi', label: 'Inovasi' },
  { value: 'sertifikat', label: 'Sertifikat' },
  { value: 'lain', label: 'Lainnya' },
];

export default function AchievementsAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ title:'', titleEn:'', description:'', descriptionEn:'', year:'', issuer:'', issuerEn:'', imageUrl:'', category:'penghargaan', score:'', order:1, isActive:true });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg:'', type:'success' });
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');

  const showToast = (msg, type='success') => { setToast({ msg, type }); setTimeout(()=>setToast({ msg:'', type:'success'}),3000); };
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const headers = { 'Content-Type':'application/json', Authorization:`Bearer ${token}` };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/achievements/all', { headers });
      const data = await res.json();
      setItems(data.items||[]);
    } catch {} finally { setLoading(false); }
  }, []);
  useEffect(()=>{ fetchItems(); }, [fetchItems]);

  const filtered = items.filter(it=>{
    const q = search.toLowerCase();
    const matchSearch = !q || it.title.toLowerCase().includes(q) || (it.issuer||'').toLowerCase().includes(q) || (it.year||'').includes(q);
    const matchCat = !filterCat || (it.category||'')===filterCat;
    return matchSearch && matchCat;
  });

  function openCreate() {
    setForm({ title:'', titleEn:'', description:'', descriptionEn:'', year:String(new Date().getFullYear()), issuer:'', issuerEn:'', imageUrl:'', category:'penghargaan', score:'', order:items.length+1, isActive:true });
    setModal('create');
  }
  function openEdit(item) {
    setForm({ title:item.title||'', titleEn:item.titleEn||'', description:item.description||'', descriptionEn:item.descriptionEn||'', year:item.year||'', issuer:item.issuer||'', issuerEn:item.issuerEn||'', imageUrl:item.imageUrl||'', category:item.category||'penghargaan', score:item.score||'', order:item.order||1, isActive:item.isActive ?? true });
    setModal({ type:'edit', id:item.id });
  }
  async function handleSave() {
    if (!form.title) { showToast('Judul wajib diisi','error'); return; }
    setSaving(true);
    try {
      const isEdit = modal?.type==='edit';
      const res = await fetch(isEdit ? `/api/achievements/${modal.id}` : '/api/achievements', { method:isEdit?'PUT':'POST', headers, body:JSON.stringify(form) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error||'Gagal'); }
      showToast(isEdit ? 'Penghargaan diperbarui' : 'Penghargaan ditambahkan');
      setModal(null); fetchItems();
    } catch (e){ showToast(e.message||'Kesalahan','error'); } finally { setSaving(false); }
  }
  async function handleDelete(id) {
    try { await fetch(`/api/achievements/${id}`, { method:'DELETE', headers }); showToast('Data dihapus'); fetchItems(); } catch { showToast('Gagal menghapus','error'); }
    setDeleteId(null);
  }

  return (
    <div>
      <Toast msg={toast.msg} type={toast.type} />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1b5e20]">Penghargaan & Prestasi</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola penghargaan, predikat WBK/WBBM, SKM, SPAK, APM - tampil di block Pencapaian & SKM homepage</p>
        </div>
        <Button className="bg-[#1b5e20] hover:bg-[#2e7d32] text-white" onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Tambah Penghargaan</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Cari judul, pemberi, tahun..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-w-[180px]">
          {CATEGORY_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="text-xs text-gray-500 flex items-center px-2">{filtered.length} data</div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          [1,2,3].map(i=><div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse"><div className="w-12 h-12 bg-gray-200 rounded-xl mb-4" /><div className="h-4 bg-gray-200 rounded mb-2" /></div>)
        ) : filtered.length===0 ? (
          <div className="col-span-full py-12 text-center text-gray-400"><Award className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>Belum ada penghargaan</p><p className="text-xs mt-1">Contoh: WBK 2023, APM A Excellent 2024, SKM 98.2 Sangat Baik</p></div>
        ) : filtered.map(item=>(
          <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center overflow-hidden border">
                {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" /> : <Award className="w-6 h-6 text-amber-600" />}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold uppercase">{item.category||'lain'}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{item.isActive ? 'Aktif' : 'Nonaktif'}</span>
              </div>
            </div>
            <h3 className="font-bold text-[#1b5e20] text-sm leading-tight">{item.title}</h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {item.year && <span className="px-2 py-0.5 bg-gray-50 border text-gray-600 text-[11px] rounded-full">{item.year}</span>}
              {item.score && <span className="px-2 py-0.5 bg-[#1b5e20]/10 text-[#1b5e20] text-[11px] font-bold rounded-full">{item.score}</span>}
            </div>
            {item.issuer && <p className="text-gray-500 text-xs mt-2">{item.issuer}</p>}
            {item.description && <p className="text-gray-600 text-xs mt-1 line-clamp-2">{item.description}</p>}
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={()=>openEdit(item)}><Pencil className="w-3 h-3 mr-1" /> Edit</Button>
              <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50 border-red-200" onClick={()=>setDeleteId(item.id)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!modal} onOpenChange={v=>!v && setModal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{modal?.type==='edit' ? 'Edit Penghargaan' : 'Tambah Penghargaan'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Judul <span className="text-red-500">*</span></Label>
              <Input placeholder="Contoh: Wilayah Bebas Korupsi (WBK) 2023" value={form.title} onChange={e=>setForm(f=>({...f, title:e.target.value}))} />
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Tahun</Label>
                <Input placeholder="2024" value={form.year} onChange={e=>setForm(f=>({...f, year:e.target.value}))} />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Kategori</Label>
                <select className="w-full p-2 border border-gray-200 rounded-lg text-sm" value={form.category} onChange={e=>setForm(f=>({...f, category:e.target.value}))}>
                  {CATEGORY_OPTIONS.filter(o=>o.value).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Skor / Predikat</Label>
                <Input placeholder="98.2, A, WBK 2023" value={form.score} onChange={e=>setForm(f=>({...f, score:e.target.value}))} />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label className="text-sm font-medium mb-1.5 block">Pemberi / Issuer ID</Label><Input placeholder="Kemenpan RB, MA RI, Badilag" value={form.issuer} onChange={e=>setForm(f=>({...f, issuer:e.target.value}))} /></div>
              <div><Label className="text-sm font-medium mb-1.5 block">Urutan</Label><Input type="number" value={form.order} onChange={e=>setForm(f=>({...f, order:parseInt(e.target.value)||1}))} /></div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Foto Piagam / Piala</Label>
              <ImageUpload value={form.imageUrl} onChange={v=>setForm(f=>({...f, imageUrl:v}))} token={token} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Deskripsi ID</Label>
              <textarea className="w-full min-h-[70px] p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1b5e20]/30 resize-none" placeholder="Deskripsi singkat pencapaian..." value={form.description} onChange={e=>setForm(f=>({...f, description:e.target.value}))} />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label className="text-sm font-medium mb-1.5 block">Judul EN (opsional)</Label><Input value={form.titleEn} onChange={e=>setForm(f=>({...f, titleEn:e.target.value}))} /></div>
              <div><Label className="text-sm font-medium mb-1.5 block">Pemberi EN</Label><Input value={form.issuerEn} onChange={e=>setForm(f=>({...f, issuerEn:e.target.value}))} /></div>
              <div className="md:col-span-2"><Label className="text-sm font-medium mb-1.5 block">Deskripsi EN</Label><Input value={form.descriptionEn} onChange={e=>setForm(f=>({...f, descriptionEn:e.target.value}))} /></div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="achActive" checked={form.isActive} onChange={e=>setForm(f=>({...f, isActive:e.target.checked}))} className="w-4 h-4 accent-[#1b5e20]" />
              <Label htmlFor="achActive" className="text-sm cursor-pointer">Aktif & tampilkan di homepage</Label>
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
            <AlertDialogTitle>Hapus Penghargaan?</AlertDialogTitle>
            <AlertDialogDescription>Data akan dihapus permanen dan tidak tampil lagi di homepage.</AlertDialogDescription>
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
