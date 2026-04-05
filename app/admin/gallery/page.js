'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2, Save, X, Check, Upload, ImageIcon, Eye, EyeOff } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

function Toast({ msg, type }) {
  if (!msg) return null;
  return <div className={`fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2 ${type==='error'?'bg-red-500':'bg-green-500'}`}><span>{type==='error'?'✕':'✓'}</span>{msg}</div>;
}

function ImageUpload({ value, onChange, token }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef(null);
  async function handleFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChange(data.url);
    } catch(e) { alert('Upload gagal: '+e.message); }
    finally { setUploading(false); if(ref.current) ref.current.value=''; }
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={value||''} onChange={e=>onChange(e.target.value)} placeholder="URL gambar atau upload..." className="flex-1" />
        <label className="cursor-pointer flex items-center justify-center w-10 h-9 border rounded-lg hover:bg-gray-50 relative flex-shrink-0">
          {uploading ? <div className="w-4 h-4 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4 text-gray-500" />}
          <input ref={ref} type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFile} disabled={uploading} />
        </label>
      </div>
      {value && <img src={value} alt="" className="w-full h-32 object-cover rounded-lg" onError={e=>e.target.style.display='none'} />}
    </div>
  );
}

export default function GalleryAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | item
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const [filterCat, setFilterCat] = useState('');
  const [categories, setCategories] = useState([]);
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast({msg:'',type:'success'}),3000); };

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/gallery/all', { headers });
      const data = await res.json();
      setItems(data.items || []);
      const cats = [...new Set((data.items||[]).map(i=>i.category).filter(Boolean))];
      setCategories(cats);
    } catch(e) { showToast('Gagal memuat: '+e.message,'error'); }
    finally { setLoading(false); }
  }

  function openAdd() { setForm({ id: uuidv4(), title:'', titleEn:'', description:'', category:'Kegiatan', imageUrl:'', isActive:true, order:items.length }); setModal('add'); }
  function openEdit(item) { setForm({...item}); setModal('edit'); }

  async function handleSave() {
    if (!form.title) { showToast('Judul wajib diisi','error'); return; }
    if (!form.imageUrl) { showToast('Gambar wajib diisi','error'); return; }
    setSaving(true);
    try {
      if (modal==='add') {
        const res = await fetch('/api/gallery', { method:'POST', headers, body: JSON.stringify(form) });
        if (!res.ok) throw new Error();
        showToast('Foto berhasil ditambahkan');
      } else {
        await fetch(`/api/gallery/${form.id}`, { method:'PUT', headers, body: JSON.stringify(form) });
        showToast('Foto berhasil diperbarui');
      }
      setModal(null); await loadData();
    } catch { showToast('Gagal menyimpan','error'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('Hapus foto ini?')) return;
    await fetch(`/api/gallery/${id}`, { method:'DELETE', headers });
    showToast('Foto dihapus'); loadData();
  }

  async function toggleActive(item) {
    await fetch(`/api/gallery/${item.id}`, { method:'PUT', headers, body: JSON.stringify({...item, isActive:!item.isActive}) });
    loadData();
  }

  const filtered = filterCat ? items.filter(i=>i.category===filterCat) : items;

  return (
    <div>
      <Toast msg={toast.msg} type={toast.type} />
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-[#1e3a5f]">{modal==='add'?'Tambah Foto':'Edit Foto'}</h2>
              <button onClick={()=>setModal(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><Label className="text-xs font-semibold mb-1 block">Gambar *</Label><ImageUpload value={form.imageUrl||''} onChange={v=>setForm(p=>({...p,imageUrl:v}))} token={token} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">Judul (ID) *</Label><Input value={form.title||''} onChange={e=>setForm(p=>({...p,title:e.target.value}))} /></div>
                <div><Label className="text-xs font-semibold mb-1 block">Judul (EN)</Label><Input value={form.titleEn||''} onChange={e=>setForm(p=>({...p,titleEn:e.target.value}))} /></div>
              </div>
              <div><Label className="text-xs font-semibold mb-1 block">Deskripsi</Label><Input value={form.description||''} onChange={e=>setForm(p=>({...p,description:e.target.value}))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">Kategori</Label><Input value={form.category||''} onChange={e=>setForm(p=>({...p,category:e.target.value}))} placeholder="Kegiatan, Gedung..." /></div>
                <div><Label className="text-xs font-semibold mb-1 block">Urutan</Label><Input type="number" value={form.order||0} onChange={e=>setForm(p=>({...p,order:+e.target.value}))} /></div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive!==false} onChange={e=>setForm(p=>({...p,isActive:e.target.checked}))} className="w-4 h-4 accent-[#1e3a5f]" />
                <span className="text-sm">Tampilkan di publik</span>
              </label>
            </div>
            <div className="p-5 border-t flex gap-3 justify-end">
              <Button variant="outline" onClick={()=>setModal(null)}>Batal</Button>
              <Button className="bg-[#c9a84c] hover:bg-[#b8962f] text-white" onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-1" />{saving?'Menyimpan...':'Simpan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1e3a5f]">Galeri Foto</h1>
          <p className="text-gray-500 text-sm mt-1">{items.length} foto</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={()=>window.open('/galeri','_blank')}><Eye className="w-4 h-4 mr-1" />Lihat Publik</Button>
          <Button className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white" onClick={openAdd}><Plus className="w-4 h-4 mr-1" />Tambah Foto</Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={()=>setFilterCat('')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!filterCat?'bg-[#1e3a5f] text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Semua</button>
        {categories.map(c=><button key={c} onClick={()=>setFilterCat(c)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterCat===c?'bg-[#1e3a5f] text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c}</button>)}
      </div>

      {loading ? <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(8)].map((_,i)=><div key={i} className="aspect-square bg-gray-100 rounded-xl animate-pulse" />)}</div> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {filtered.map(item=>(
            <div key={item.id} className={`group relative rounded-xl overflow-hidden border-2 ${item.isActive?'border-transparent':'border-red-200'}`}>
              <img src={item.imageUrl} alt={item.title} className="w-full aspect-square object-cover" onError={e=>{e.target.parentElement.style.background='#f3f4f6';e.target.style.display='none'}} />
              {!item.isActive && <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center"><span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">Tersembunyi</span></div>}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                <div className="flex justify-end gap-1">
                  <button onClick={()=>toggleActive(item)} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center">{item.isActive?<EyeOff className="w-3.5 h-3.5 text-white"/>:<Eye className="w-3.5 h-3.5 text-white"/>}</button>
                  <button onClick={()=>openEdit(item)} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center"><Edit2 className="w-3.5 h-3.5 text-white"/></button>
                  <button onClick={()=>handleDelete(item.id)} className="w-7 h-7 rounded-full bg-red-500/60 hover:bg-red-500 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5 text-white"/></button>
                </div>
                <div><p className="text-white text-xs font-semibold line-clamp-2">{item.title}</p>{item.category&&<span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-full">{item.category}</span>}</div>
              </div>
            </div>
          ))}
          {filtered.length===0&&<div className="col-span-4 py-16 text-center text-gray-400"><ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>Belum ada foto</p></div>}
        </div>
      )}
    </div>
  );
}
