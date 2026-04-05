'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2, Save, X, Upload, FileText, Download, Eye, EyeOff } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

function Toast({ msg, type }) {
  if (!msg) return null;
  return <div className={`fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2 ${type==='error'?'bg-red-500':'bg-green-500'}`}>{type==='error'?'✕':'✓'} {msg}</div>;
}

const CATEGORIES = ['Maklumat','Standar Pelayanan','Persyaratan','Biaya','Peraturan','Formulir','Laporan','Lainnya'];

export default function DocumentsAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const [filterCat, setFilterCat] = useState('');
  const fileRef = useRef(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast({msg:'',type:'success'}),3000); };

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/documents?limit=100', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setItems(data.items || []);
    } catch { } finally { setLoading(false); }
  }

  async function uploadFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/upload', { method:'POST', headers: { Authorization:`Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm(p=>({...p, fileUrl: data.url, fileType: data.url.split('.').pop().toLowerCase(), fileName: file.name, fileSize: (file.size/1024).toFixed(0)+' KB'}));
    } catch(e) { showToast('Upload gagal: '+e.message,'error'); }
    finally { setUploading(false); if(fileRef.current) fileRef.current.value=''; }
  }

  function openAdd() { setForm({ id:uuidv4(), title:'', titleEn:'', description:'', category:'Maklumat', fileUrl:'', fileType:'pdf', isActive:true, order:items.length }); setModal('add'); }
  function openEdit(item) { setForm({...item}); setModal('edit'); }

  async function handleSave() {
    if (!form.title) { showToast('Judul wajib diisi','error'); return; }
    setSaving(true);
    try {
      if (modal==='add') await fetch('/api/documents', { method:'POST', headers, body:JSON.stringify(form) });
      else await fetch(`/api/documents/${form.id}`, { method:'PUT', headers, body:JSON.stringify(form) });
      showToast(modal==='add'?'Dokumen ditambahkan':'Dokumen diperbarui');
      setModal(null); loadData();
    } catch { showToast('Gagal menyimpan','error'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('Hapus dokumen ini?')) return;
    await fetch(`/api/documents/${id}`, { method:'DELETE', headers });
    showToast('Dokumen dihapus'); loadData();
  }

  const filtered = filterCat ? items.filter(i=>i.category===filterCat) : items;
  const allCats = [...new Set(items.map(i=>i.category).filter(Boolean))];

  const fileTypeIcon = (type) => type==='pdf'?'📄':'📋';

  return (
    <div>
      <Toast msg={toast.msg} type={toast.type} />
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-[#1e3a5f]">{modal==='add'?'Tambah Dokumen':'Edit Dokumen'}</h2>
              <button onClick={()=>setModal(null)}><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">Judul (ID) *</Label><Input value={form.title||''} onChange={e=>setForm(p=>({...p,title:e.target.value}))} /></div>
                <div><Label className="text-xs font-semibold mb-1 block">Judul (EN)</Label><Input value={form.titleEn||''} onChange={e=>setForm(p=>({...p,titleEn:e.target.value}))} /></div>
              </div>
              <div><Label className="text-xs font-semibold mb-1 block">Deskripsi</Label><textarea className="w-full p-2 border rounded-lg text-sm h-20 resize-none" value={form.description||''} onChange={e=>setForm(p=>({...p,description:e.target.value}))} /></div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">File Dokumen</Label>
                <div className="flex gap-2">
                  <Input value={form.fileUrl||''} onChange={e=>setForm(p=>({...p,fileUrl:e.target.value}))} placeholder="URL file atau upload..." className="flex-1" />
                  <label className="cursor-pointer flex items-center justify-center w-10 h-9 border rounded-lg hover:bg-gray-50 relative flex-shrink-0">
                    {uploading?<div className="w-4 h-4 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin"/>:<Upload className="w-4 h-4 text-gray-500"/>}
                    <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="absolute inset-0 opacity-0 cursor-pointer" onChange={uploadFile} disabled={uploading}/>
                  </label>
                </div>
                {form.fileName&&<p className="text-xs text-gray-500 mt-1">{form.fileName} ({form.fileSize})</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Kategori</Label>
                  <select value={form.category||''} onChange={e=>setForm(p=>({...p,category:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">
                    {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><Label className="text-xs font-semibold mb-1 block">Urutan</Label><Input type="number" value={form.order||0} onChange={e=>setForm(p=>({...p,order:+e.target.value}))} /></div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive!==false} onChange={e=>setForm(p=>({...p,isActive:e.target.checked}))} className="w-4 h-4 accent-[#1e3a5f]"/>
                <span className="text-sm">Tampilkan di publik</span>
              </label>
            </div>
            <div className="p-5 border-t flex gap-3 justify-end">
              <Button variant="outline" onClick={()=>setModal(null)}>Batal</Button>
              <Button className="bg-[#c9a84c] hover:bg-[#b8962f] text-white" onClick={handleSave} disabled={saving}><Save className="w-4 h-4 mr-1"/>{saving?'Menyimpan...':'Simpan'}</Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1e3a5f]">Dokumen Publik</h1>
          <p className="text-gray-500 text-sm mt-1">{items.length} dokumen</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={()=>window.open('/dokumen','_blank')}><Eye className="w-4 h-4 mr-1"/>Lihat Publik</Button>
          <Button className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white" onClick={openAdd}><Plus className="w-4 h-4 mr-1"/>Tambah Dokumen</Button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={()=>setFilterCat('')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${!filterCat?'bg-[#1e3a5f] text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Semua</button>
        {allCats.map(c=><button key={c} onClick={()=>setFilterCat(c)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filterCat===c?'bg-[#1e3a5f] text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c}</button>)}
      </div>

      {loading?<div className="space-y-3">{[...Array(5)].map((_,i)=><div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"/>)}</div>:(
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b"><tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Dokumen</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Kategori</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Unduhan</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Aksi</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(item=>(
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{fileTypeIcon(item.fileType)}</span>
                      <div><p className="font-medium text-[#1e3a5f] text-sm">{item.title}</p><p className="text-xs text-gray-400">{item.description?.substring(0,60)}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="px-2 py-1 bg-[#1e3a5f]/10 text-[#1e3a5f] text-xs rounded-full font-medium">{item.category}</span></td>
                  <td className="px-4 py-3 text-center"><span className="flex items-center justify-center gap-1 text-sm text-gray-600"><Download className="w-3.5 h-3.5"/>{item.downloadCount||0}</span></td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.isActive?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{item.isActive?'Aktif':'Tersembunyi'}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {item.fileUrl&&<a href={item.fileUrl} target="_blank" rel="noopener" className="p-1.5 text-gray-400 hover:text-[#1e3a5f] rounded-lg"><Download className="w-3.5 h-3.5"/></a>}
                      <button onClick={()=>openEdit(item)} className="p-1.5 text-gray-400 hover:text-[#1e3a5f] rounded-lg"><Edit2 className="w-3.5 h-3.5"/></button>
                      <button onClick={()=>handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length===0&&<tr><td colSpan={5} className="py-12 text-center text-gray-400"><FileText className="w-8 h-8 mx-auto mb-2 opacity-30"/><p>Belum ada dokumen</p></td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
