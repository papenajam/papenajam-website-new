'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, X, Save, Trash2, Eye, ChevronRight } from 'lucide-react';

function Toast({msg,type}){if(!msg)return null;return<div className={`fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${type==='error'?'bg-red-500':'bg-green-500'}`}>{msg}</div>;}

const STATUS_OPTS=[{v:'baru',l:'Baru',c:'bg-blue-100 text-blue-700'},{v:'diproses',l:'Diproses',c:'bg-yellow-100 text-yellow-700'},{v:'selesai',l:'Selesai',c:'bg-green-100 text-green-700'},{v:'ditolak',l:'Ditolak',c:'bg-red-100 text-red-700'}];

export default function ComplaintsAdmin(){
  const[items,setItems]=useState([]);
  const[loading,setLoading]=useState(true);
  const[detail,setDetail]=useState(null);
  const[notes,setNotes]=useState('');
  const[status,setStatus]=useState('');
  const[saving,setSaving]=useState(false);
  const[toast,setToast]=useState({msg:'',type:'success'});
  const[filter,setFilter]=useState('');
  const[page,setPage]=useState(1);
  const[total,setTotal]=useState(0);
  const token=typeof window!=='undefined'?localStorage.getItem('admin_token'):'';
  const headers={'Content-Type':'application/json',Authorization:`Bearer ${token}`};
  const showToast=(msg,type='success')=>{setToast({msg,type});setTimeout(()=>setToast({msg:'',type:'success'}),3000);};

  useEffect(()=>{loadData();},[filter,page]);
  async function loadData(){
    setLoading(true);
    try{
      const params=new URLSearchParams({page,limit:20});
      if(filter)params.set('status',filter);
      const d=await(await fetch(`/api/complaints?${params}`,{headers})).json();
      setItems(d.items||[]);setTotal(d.total||0);
    }catch{}finally{setLoading(false);}
  }

  function openDetail(item){setDetail(item);setNotes(item.adminNotes||'');setStatus(item.status||'baru');}

  async function saveDetail(){
    setSaving(true);
    try{
      await fetch(`/api/complaints/${detail.id}`,{method:'PUT',headers,body:JSON.stringify({...detail,status,adminNotes:notes})});
      showToast('Pengaduan diperbarui');setDetail(null);loadData();
    }catch{showToast('Gagal','error');}finally{setSaving(false);}
  }

  async function handleDelete(id){
    if(!confirm('Hapus pengaduan ini?'))return;
    await fetch(`/api/complaints/${id}`,{method:'DELETE',headers});
    showToast('Dihapus');loadData();
  }

  const formatDate=d=>d?new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
  const statusObj=(v)=>STATUS_OPTS.find(s=>s.v===v)||STATUS_OPTS[0];

  const newCount=items.filter(i=>i.status==='baru').length;

  return(
    <div>
      <Toast msg={toast.msg} type={toast.type}/>
      {detail&&(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-[#1e3a5f]">Detail Pengaduan</h2>
              <button onClick={()=>setDetail(null)}><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Nama:</span> <strong>{detail.name}</strong></div>
                  <div><span className="text-gray-500">Email:</span> {detail.email||'-'}</div>
                  <div><span className="text-gray-500">Telepon:</span> {detail.phone||'-'}</div>
                  <div><span className="text-gray-500">Kategori:</span> {detail.category||'-'}</div>
                </div>
                <div><span className="text-gray-500 text-sm">Tanggal:</span> <span className="text-sm">{formatDate(detail.createdAt)}</span></div>
              </div>
              {detail.subject&&<div><Label className="text-xs font-semibold mb-1 block">Subjek</Label><p className="font-semibold text-[#1e3a5f]">{detail.subject}</p></div>}
              <div><Label className="text-xs font-semibold mb-1 block">Pesan</Label><div className="bg-blue-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap">{detail.message}</div></div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Status</Label>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTS.map(s=><button key={s.v} onClick={()=>setStatus(s.v)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${status===s.v?s.c+' ring-2 ring-offset-1 ring-current':s.c+'/30 text-gray-600 hover:'+s.c}`}>{s.l}</button>)}
                </div>
              </div>
              <div><Label className="text-xs font-semibold mb-1 block">Catatan Admin</Label><textarea className="w-full p-3 border rounded-xl text-sm h-24 resize-none" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Tambahkan catatan tindak lanjut..."/></div>
            </div>
            <div className="p-5 border-t flex gap-3 justify-end">
              <Button variant="outline" onClick={()=>setDetail(null)}>Tutup</Button>
              <Button className="bg-[#c9a84c] hover:bg-[#b8962f] text-white" onClick={saveDetail} disabled={saving}><Save className="w-4 h-4 mr-1"/>{saving?'Menyimpan...':'Simpan'}</Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1e3a5f] flex items-center gap-2">Manajemen Pengaduan {newCount>0&&<span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">{newCount} Baru</span>}</h1>
          <p className="text-gray-500 text-sm mt-1">{total} pengaduan</p>
        </div>
        <Button variant="outline" size="sm" onClick={()=>window.open('/pengaduan','_blank')}>Lihat Form Publik</Button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={()=>{setFilter('');setPage(1);}} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${!filter?'bg-[#1e3a5f] text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Semua</button>
        {STATUS_OPTS.map(s=><button key={s.v} onClick={()=>{setFilter(s.v);setPage(1);}} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filter===s.v?'bg-[#1e3a5f] text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{s.l}</button>)}
      </div>

      {loading?<div className="space-y-3">{[...Array(5)].map((_,i)=><div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse"/>)}</div>:(
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {items.length===0?(
            <div className="py-16 text-center text-gray-400"><MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>Belum ada pengaduan</p></div>
          ):(
            <table className="w-full">
              <thead className="bg-gray-50 border-b"><tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Pengirim</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">Pesan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden sm:table-cell">Tanggal</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Aksi</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(item=>{
                  const st=statusObj(item.status);
                  return(
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#1e3a5f] text-sm">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.email||item.phone||''}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {item.subject&&<p className="text-xs font-semibold text-gray-700 mb-0.5">{item.subject}</p>}
                        <p className="text-sm text-gray-500 line-clamp-2">{item.message?.substring(0,80)}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 hidden sm:table-cell">{formatDate(item.createdAt)}</td>
                      <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${st.c}`}>{st.l}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={()=>openDetail(item)} className="p-1.5 text-gray-400 hover:text-[#1e3a5f] rounded-lg"><Eye className="w-4 h-4"/></button>
                          <button onClick={()=>handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
