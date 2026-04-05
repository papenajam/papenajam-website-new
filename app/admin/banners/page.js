'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2, Save, X, Eye, EyeOff, Upload, ImageIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

function Toast({msg,type}){if(!msg)return null;return<div className={`fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${type==='error'?'bg-red-500':'bg-green-500'}`}>{msg}</div>;}

export default function BannersAdmin(){
  const[items,setItems]=useState([]);
  const[loading,setLoading]=useState(true);
  const[modal,setModal]=useState(null);
  const[form,setForm]=useState({});
  const[saving,setSaving]=useState(false);
  const[uploading,setUploading]=useState(false);
  const[toast,setToast]=useState({msg:'',type:'success'});
  const fileRef=useRef(null);
  const token=typeof window!=='undefined'?localStorage.getItem('admin_token'):'';
  const headers={'Content-Type':'application/json',Authorization:`Bearer ${token}`};
  const showToast=(msg,type='success')=>{setToast({msg,type});setTimeout(()=>setToast({msg:'',type:'success'}),3000);};

  useEffect(()=>{loadData();},[]);
  async function loadData(){
    setLoading(true);
    try{const d=await(await fetch('/api/banners/all',{headers})).json();setItems(d.items||[]);}
    catch{}finally{setLoading(false);}
  }

  async function uploadImg(e){
    const file=e.target.files?.[0];if(!file)return;
    setUploading(true);
    try{
      const fd=new FormData();fd.append('file',file);
      const res=await fetch('/api/upload',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error);
      setForm(p=>({...p,imageUrl:data.url}));
    }catch(e){showToast('Upload gagal','error');}finally{setUploading(false);if(fileRef.current)fileRef.current.value='';}
  }

  function openAdd(){setForm({id:uuidv4(),title:'',subtitle:'',buttonText:'',buttonUrl:'',imageUrl:'',bgColor:'#1b5e20',textColor:'#ffffff',isActive:true,order:items.length,startDate:'',endDate:''});setModal('add');}
  function openEdit(item){setForm({...item});setModal('edit');}

  async function handleSave(){
    if(!form.title){showToast('Judul wajib diisi','error');return;}
    setSaving(true);
    try{
      if(modal==='add')await fetch('/api/banners',{method:'POST',headers,body:JSON.stringify(form)});
      else await fetch(`/api/banners/${form.id}`,{method:'PUT',headers,body:JSON.stringify(form)});
      showToast(modal==='add'?'Banner ditambahkan':'Banner diperbarui');
      setModal(null);loadData();
    }catch{showToast('Gagal','error');}finally{setSaving(false);}
  }

  async function handleDelete(id){
    if(!confirm('Hapus banner ini?'))return;
    await fetch(`/api/banners/${id}`,{method:'DELETE',headers});
    showToast('Banner dihapus');loadData();
  }

  async function toggleActive(item){
    await fetch(`/api/banners/${item.id}`,{method:'PUT',headers,body:JSON.stringify({...item,isActive:!item.isActive})});
    loadData();
  }

  return(
    <div>
      <Toast msg={toast.msg} type={toast.type}/>
      {modal&&(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-[#1b5e20]">{modal==='add'?'Tambah Banner':'Edit Banner'}</h2>
              <button onClick={()=>setModal(null)}><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Gambar Latar</Label>
                <div className="flex gap-2">
                  <Input value={form.imageUrl||''} onChange={e=>setForm(p=>({...p,imageUrl:e.target.value}))} placeholder="URL gambar..." className="flex-1"/>
                  <label className="cursor-pointer flex items-center justify-center w-10 h-9 border rounded-lg hover:bg-gray-50 relative flex-shrink-0">
                    {uploading?<div className="w-4 h-4 border-2 border-[#1b5e20] border-t-transparent rounded-full animate-spin"/>:<Upload className="w-4 h-4 text-gray-500"/>}
                    <input ref={fileRef} type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={uploadImg} disabled={uploading}/>
                  </label>
                </div>
                {form.imageUrl&&<img src={form.imageUrl} alt="" className="mt-2 w-full h-28 object-cover rounded-lg" onError={e=>e.target.style.display='none'}/>}
              </div>
              <div><Label className="text-xs font-semibold mb-1 block">Judul *</Label><Input value={form.title||''} onChange={e=>setForm(p=>({...p,title:e.target.value}))}/></div>
              <div><Label className="text-xs font-semibold mb-1 block">Sub-judul</Label><Input value={form.subtitle||''} onChange={e=>setForm(p=>({...p,subtitle:e.target.value}))}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">Teks Tombol</Label><Input value={form.buttonText||''} onChange={e=>setForm(p=>({...p,buttonText:e.target.value}))}/></div>
                <div><Label className="text-xs font-semibold mb-1 block">Link Tombol</Label><Input value={form.buttonUrl||''} onChange={e=>setForm(p=>({...p,buttonUrl:e.target.value}))}/></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">Warna BG</Label><Input type="color" value={form.bgColor||'#1b5e20'} onChange={e=>setForm(p=>({...p,bgColor:e.target.value}))} className="h-10 px-2"/></div>
                <div><Label className="text-xs font-semibold mb-1 block">Warna Teks</Label><Input type="color" value={form.textColor||'#ffffff'} onChange={e=>setForm(p=>({...p,textColor:e.target.value}))} className="h-10 px-2"/></div>
                <div><Label className="text-xs font-semibold mb-1 block">Urutan</Label><Input type="number" value={form.order||0} onChange={e=>setForm(p=>({...p,order:+e.target.value}))}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">Tanggal Mulai</Label><Input type="date" value={form.startDate||''} onChange={e=>setForm(p=>({...p,startDate:e.target.value}))}/></div>
                <div><Label className="text-xs font-semibold mb-1 block">Tanggal Akhir</Label><Input type="date" value={form.endDate||''} onChange={e=>setForm(p=>({...p,endDate:e.target.value}))}/></div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive!==false} onChange={e=>setForm(p=>({...p,isActive:e.target.checked}))} className="w-4 h-4 accent-[#1b5e20]"/>
                <span className="text-sm">Aktifkan banner</span>
              </label>
            </div>
            <div className="p-5 border-t flex gap-3 justify-end">
              <Button variant="outline" onClick={()=>setModal(null)}>Batal</Button>
              <Button className="bg-[#d4a017] hover:bg-[#b88010] text-white" onClick={handleSave} disabled={saving}><Save className="w-4 h-4 mr-1"/>{saving?'Menyimpan...':'Simpan'}</Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-extrabold text-[#1b5e20]">Banner & Slider</h1><p className="text-gray-500 text-sm mt-1">{items.length} banner</p></div>
        <Button className="bg-[#1b5e20] hover:bg-[#2e7d32] text-white" onClick={openAdd}><Plus className="w-4 h-4 mr-1"/>Tambah Banner</Button>
      </div>

      {loading?<div className="space-y-4">{[...Array(3)].map((_,i)=><div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse"/>)}</div>:(
        <div className="space-y-4">
          {items.sort((a,b)=>a.order-b.order).map(item=>(
            <div key={item.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${!item.isActive?'opacity-60 border-red-200':'border-gray-100'}`}>
              <div className="flex gap-4 p-4">
                <div className="w-40 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100" style={{background:item.bgColor||'#1b5e20'}}>
                  {item.imageUrl?<img src={item.imageUrl} alt="" className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-6 h-6 text-white/40"/></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-[#1b5e20]">{item.title}</p>
                      <p className="text-gray-500 text-sm">{item.subtitle}</p>
                      {item.buttonText&&<a href={item.buttonUrl||'#'} className="text-xs text-[#d4a017] font-semibold mt-1 inline-block">{item.buttonText} →</a>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={()=>toggleActive(item)} className="p-1.5 text-gray-400 hover:text-[#1b5e20] rounded-lg">{item.isActive?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button>
                      <button onClick={()=>openEdit(item)} className="p-1.5 text-gray-400 hover:text-[#1b5e20] rounded-lg"><Edit2 className="w-4 h-4"/></button>
                      <button onClick={()=>handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.isActive?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{item.isActive?'Aktif':'Nonaktif'}</span>
                    {item.startDate&&<span className="text-xs text-gray-400">{item.startDate} - {item.endDate||'∞'}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {items.length===0&&<div className="py-16 text-center text-gray-400"><ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>Belum ada banner</p></div>}
        </div>
      )}
    </div>
  );
}
