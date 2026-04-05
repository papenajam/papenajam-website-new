'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Star, MessageSquare, BarChart2, Trash2 } from 'lucide-react';

function Toast({msg,type}){if(!msg)return null;return<div className={`fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${type==='error'?'bg-red-500':'bg-green-500'}`}>{msg}</div>;}

export default function SurveysAdmin() {
  const [config, setConfig] = useState({ id:'main', isActive:true, title:'Survei Kepuasan', subtitle:'Bantu kami meningkatkan pelayanan', thankYouMessage:'Terima kasih atas masukan Anda!' });
  const [responses, setResponses] = useState([]);
  const [stats, setStats] = useState({ averageRating:0, totalResponses:0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg:'', type:'success' });
  const [tab, setTab] = useState('config');
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const headers = { 'Content-Type':'application/json', Authorization:`Bearer ${token}` };
  const showToast=(msg,type='success')=>{setToast({msg,type});setTimeout(()=>setToast({msg:'',type:'success'}),3000);};

  useEffect(() => { loadAll(); }, []);
  async function loadAll() {
    setLoading(true);
    try {
      const [cfgRes, respRes] = await Promise.all([
        fetch('/api/surveys/config'),
        fetch('/api/surveys', { headers }),
      ]);
      const [cfg, resp] = await Promise.all([cfgRes.json(), respRes.json()]);
      if (cfg && cfg.title) setConfig(prev => ({...prev,...cfg}));
      setResponses(resp.items || []);
      setStats({ averageRating: resp.averageRating||0, totalResponses: resp.totalResponses||0 });
    } catch { } finally { setLoading(false); }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      await fetch('/api/surveys/config', { method:'PUT', headers, body:JSON.stringify(config) });
      showToast('Konfigurasi survei disimpan');
    } catch { showToast('Gagal','error'); } finally { setSaving(false); }
  }

  async function deleteResponse(id) {
    // No delete API for responses, just filter locally
    setResponses(prev => prev.filter(r => r.id !== id));
  }

  const ratingColors = { 1:'text-red-500', 2:'text-orange-500', 3:'text-yellow-500', 4:'text-blue-500', 5:'text-green-500' };
  const ratingCounts = [1,2,3,4,5].map(r => ({ r, count: responses.filter(x=>x.rating===r).length }));
  const formatDate = d => d ? new Date(d).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '';

  return (
    <div>
      <Toast msg={toast.msg} type={toast.type} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1b5e20]">Survei Kepuasan</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola survei kepuasan pelayanan</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-[#d4a017]/10 rounded-2xl px-4 py-2 text-center">
            <div className="flex items-center gap-1 text-[#d4a017]">{'★'.repeat(Math.round(stats.averageRating))}<span className="font-extrabold text-lg ml-1">{stats.averageRating}</span></div>
            <p className="text-xs text-gray-500">{stats.totalResponses} respons</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {[{v:'config',l:'Konfigurasi'},{v:'responses',l:`Respons (${stats.totalResponses})`},{v:'stats',l:'Statistik'}].map(t=>
          <button key={t.v} onClick={()=>setTab(t.v)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===t.v?'bg-white text-[#1b5e20] shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{t.l}</button>
        )}
      </div>

      {loading ? <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" /> : (
        <>
          {tab==='config'&&(
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-xl">
              <div className="space-y-4">
                <div><Label className="text-xs font-semibold mb-1 block">Judul Survei</Label><Input value={config.title||''} onChange={e=>setConfig(p=>({...p,title:e.target.value}))}/></div>
                <div><Label className="text-xs font-semibold mb-1 block">Sub-judul</Label><Input value={config.subtitle||''} onChange={e=>setConfig(p=>({...p,subtitle:e.target.value}))}/></div>
                <div><Label className="text-xs font-semibold mb-1 block">Pesan Terima Kasih</Label><Input value={config.thankYouMessage||''} onChange={e=>setConfig(p=>({...p,thankYouMessage:e.target.value}))}/></div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={config.isActive!==false} onChange={e=>setConfig(p=>({...p,isActive:e.target.checked}))} className="w-4 h-4 accent-[#1b5e20]"/>
                  <span className="text-sm font-medium">Tampilkan widget survei di homepage</span>
                </label>
                <Button className="bg-[#d4a017] hover:bg-[#b88010] text-white w-full" onClick={saveConfig} disabled={saving}><Save className="w-4 h-4 mr-1"/>{saving?'Menyimpan...':'Simpan Konfigurasi'}</Button>
              </div>
            </div>
          )}

          {tab==='responses'&&(
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {responses.length===0?(
                <div className="py-16 text-center text-gray-400"><MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>Belum ada respons</p></div>
              ):(
                <table className="w-full">
                  <thead className="bg-gray-50 border-b"><tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Rating</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Komentar</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Tanggal</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {responses.map(r=>(
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {[1,2,3,4,5].map(s=><Star key={s} className={`w-4 h-4 ${s<=r.rating?'fill-[#d4a017] text-[#d4a017]':'text-gray-200'}`}/>)}
                            <span className="ml-1 font-bold text-sm">{r.rating}/5</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{r.comment||<span className="text-gray-300 italic">Tidak ada komentar</span>}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{formatDate(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab==='stats'&&(
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-bold text-[#1b5e20] mb-4 flex items-center gap-2"><BarChart2 className="w-5 h-5"/>Distribusi Rating</h2>
                {ratingCounts.reverse().map(({r,count})=>(
                  <div key={r} className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-1 w-20 flex-shrink-0">
                      {[...Array(r)].map((_,i)=><Star key={i} className="w-3.5 h-3.5 fill-[#d4a017] text-[#d4a017]"/>)}
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div className="bg-[#d4a017] h-full rounded-full transition-all" style={{ width: stats.totalResponses>0 ? `${(count/stats.totalResponses)*100}%` : '0%' }}/>
                    </div>
                    <span className="text-sm font-semibold text-gray-600 w-12 text-right">{count} ({stats.totalResponses>0?Math.round((count/stats.totalResponses)*100):0}%)</span>
                  </div>
                ))}
                <div className="mt-6 pt-4 border-t text-center">
                  <p className="text-4xl font-extrabold text-[#d4a017]">{stats.averageRating}</p>
                  <div className="flex justify-center gap-1 my-2">{[1,2,3,4,5].map(s=><Star key={s} className={`w-5 h-5 ${s<=Math.round(stats.averageRating)?'fill-[#d4a017] text-[#d4a017]':'text-gray-200'}`}/>)}</div>
                  <p className="text-gray-500 text-sm">Dari {stats.totalResponses} respons</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
