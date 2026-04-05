'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2, Save, X, HelpCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

function Toast({ msg, type }) {
  if (!msg) return null;
  return <div className={`fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${type==='error'?'bg-red-500':'bg-green-500'}`}>{type==='error'?'✕':'✓'} {msg}</div>;
}

const CATEGORIES = ['Umum','Biaya','Proses','e-Court','Layanan','Persyaratan','Lainnya'];

export default function FAQAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast({msg:'',type:'success'}),3000); };

  useEffect(()=>{ loadData(); },[]);
  async function loadData() {
    setLoading(true);
    try { const d = await (await fetch('/api/faq/all',{headers})).json(); setItems(d.items||[]); }
    catch{} finally{ setLoading(false); }
  }

  function openAdd() { setForm({id:uuidv4(),question:'',questionEn:'',answer:'',answerEn:'',category:'Umum',isActive:true,order:items.length}); setModal('add'); }
  function openEdit(item) { setForm({...item}); setModal('edit'); }

  async function handleSave() {
    if(!form.question||!form.answer){showToast('Pertanyaan dan jawaban wajib diisi','error');return;}
    setSaving(true);
    try {
      if(modal==='add') await fetch('/api/faq',{method:'POST',headers,body:JSON.stringify(form)});
      else await fetch(`/api/faq/${form.id}`,{method:'PUT',headers,body:JSON.stringify(form)});
      showToast(modal==='add'?'FAQ ditambahkan':'FAQ diperbarui');
      setModal(null); loadData();
    }catch{showToast('Gagal','error');} finally{setSaving(false);}
  }

  async function handleDelete(id){
    if(!confirm('Hapus FAQ ini?'))return;
    await fetch(`/api/faq/${id}`,{method:'DELETE',headers});
    showToast('FAQ dihapus'); loadData();
  }

  async function move(item, dir) {
    const sorted=[...items].sort((a,b)=>a.order-b.order);
    const idx=sorted.findIndex(i=>i.id===item.id);
    const swap=dir==='up'?sorted[idx-1]:sorted[idx+1];
    if(!swap)return;
    await Promise.all([
      fetch(`/api/faq/${item.id}`,{method:'PUT',headers,body:JSON.stringify({...item,order:swap.order})}),
      fetch(`/api/faq/${swap.id}`,{method:'PUT',headers,body:JSON.stringify({...swap,order:item.order})}),
    ]);
    loadData();
  }

  const sorted=[...items].sort((a,b)=>a.order-b.order);

  return(
    <div>
      <Toast msg={toast.msg} type={toast.type}/>
      {modal&&(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-[#1b5e20]">{modal==='add'?'Tambah FAQ':'Edit FAQ'}</h2>
              <button onClick={()=>setModal(null)}><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">Pertanyaan (ID) *</Label><textarea className="w-full p-2 border rounded-lg text-sm h-20 resize-none" value={form.question||''} onChange={e=>setForm(p=>({...p,question:e.target.value}))}/></div>
                <div><Label className="text-xs font-semibold mb-1 block">Pertanyaan (EN)</Label><textarea className="w-full p-2 border rounded-lg text-sm h-20 resize-none" value={form.questionEn||''} onChange={e=>setForm(p=>({...p,questionEn:e.target.value}))}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">Jawaban (ID) *</Label><textarea className="w-full p-2 border rounded-lg text-sm h-32 resize-none" value={form.answer||''} onChange={e=>setForm(p=>({...p,answer:e.target.value}))}/></div>
                <div><Label className="text-xs font-semibold mb-1 block">Jawaban (EN)</Label><textarea className="w-full p-2 border rounded-lg text-sm h-32 resize-none" value={form.answerEn||''} onChange={e=>setForm(p=>({...p,answerEn:e.target.value}))}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">Kategori</Label><select value={form.category||''} onChange={e=>setForm(p=>({...p,category:e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                <div><Label className="text-xs font-semibold mb-1 block">Urutan</Label><Input type="number" value={form.order||0} onChange={e=>setForm(p=>({...p,order:+e.target.value}))}/></div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive!==false} onChange={e=>setForm(p=>({...p,isActive:e.target.checked}))} className="w-4 h-4 accent-[#1b5e20]"/>
                <span className="text-sm">Tampilkan di publik</span>
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
        <div><h1 className="text-2xl font-extrabold text-[#1b5e20]">FAQ</h1><p className="text-gray-500 text-sm mt-1">{items.length} pertanyaan</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={()=>window.open('/faq','_blank')}>Lihat Publik</Button>
          <Button className="bg-[#1b5e20] hover:bg-[#2e7d32] text-white" onClick={openAdd}><Plus className="w-4 h-4 mr-1"/>Tambah FAQ</Button>
        </div>
      </div>

      {loading?<div className="space-y-3">{[...Array(5)].map((_,i)=><div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse"/>)}</div>:(
        <div className="space-y-3">
          {sorted.map((item,idx)=>(
            <div key={item.id} className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 ${!item.isActive?'opacity-60':''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-[#1b5e20]/10 text-[#1b5e20] text-xs rounded-full font-medium">{item.category}</span>
                    {!item.isActive&&<span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">Tersembunyi</span>}
                  </div>
                  <p className="font-semibold text-[#1b5e20] text-sm">{item.question}</p>
                  <p className="text-gray-500 text-xs mt-1 line-clamp-2">{item.answer}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={()=>move(item,'up')} disabled={idx===0} className="p-1.5 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronUp className="w-4 h-4"/></button>
                  <button onClick={()=>move(item,'down')} disabled={idx===sorted.length-1} className="p-1.5 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronDown className="w-4 h-4"/></button>
                  <button onClick={()=>openEdit(item)} className="p-1.5 text-gray-400 hover:text-[#1b5e20]"><Edit2 className="w-4 h-4"/></button>
                  <button onClick={()=>handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
            </div>
          ))}
          {sorted.length===0&&<div className="py-16 text-center text-gray-400"><HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>Belum ada FAQ</p></div>}
        </div>
      )}
    </div>
  );
}
