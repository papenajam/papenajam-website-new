'use client';
import { useState, useEffect } from 'react';
import { TrendingUp, Eye, Globe, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AnalyticsAdmin() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { loadData(); }, [days]);
  async function loadData() {
    setLoading(true);
    try {
      const d = await (await fetch(`/api/analytics?days=${days}`, { headers })).json();
      setData(d);
    } catch { } finally { setLoading(false); }
  }

  const maxViews = data?.dailyData?.length ? Math.max(...data.dailyData.map(d => d.views), 1) : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1b5e20]">Statistik Pengunjung</h1>
          <p className="text-gray-500 text-sm mt-1">Analisis kunjungan website</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${ days === d ? 'bg-[#1b5e20] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200' }`}>
              {d} Hari
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4 mb-6">{[1,2,3].map(i=><div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse"/>)}</div>
      ) : data ? (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><Eye className="w-5 h-5 text-blue-600"/></div>
                <p className="text-sm font-semibold text-gray-500">Total Kunjungan</p>
              </div>
              <p className="text-3xl font-extrabold text-[#1b5e20]">{data.total.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">{days} hari terakhir</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-emerald-600"/></div>
                <p className="text-sm font-semibold text-gray-500">Rata-rata/Hari</p>
              </div>
              <p className="text-3xl font-extrabold text-[#1b5e20]">{data.dailyData.length ? Math.round(data.total / data.dailyData.length).toLocaleString() : 0}</p>
              <p className="text-xs text-gray-400 mt-1">Kunjungan per hari</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center"><Globe className="w-5 h-5 text-violet-600"/></div>
                <p className="text-sm font-semibold text-gray-500">Halaman Terpopuler</p>
              </div>
              <p className="text-lg font-extrabold text-[#1b5e20] truncate">{data.topPages[0]?.path || '-'}</p>
              <p className="text-xs text-gray-400 mt-1">{data.topPages[0]?.views || 0} kunjungan</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <h2 className="font-bold text-[#1b5e20] mb-4 flex items-center gap-2"><BarChart2 className="w-5 h-5"/>Tren Kunjungan Harian</h2>
            {data.dailyData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400">
                <div className="text-center"><BarChart2 className="w-12 h-12 mx-auto mb-2 opacity-20"/><p>Belum ada data kunjungan</p><p className="text-xs mt-1">Data akan muncul setelah ada kunjungan ke website</p></div>
              </div>
            ) : (
              <div className="flex items-end gap-1 h-48 overflow-x-auto pb-2">
                {data.dailyData.slice(-30).map(d => (
                  <div key={d.date} className="flex flex-col items-center gap-1 min-w-[28px] flex-1">
                    <div className="w-full rounded-t-md bg-[#1b5e20] transition-all" style={{ height: `${(d.views / maxViews) * 160}px`, minHeight: d.views > 0 ? 4 : 0 }} title={`${d.date}: ${d.views} kunjungan`} />
                    <span className="text-[9px] text-gray-400 -rotate-45 origin-center">{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top pages */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-[#1b5e20] mb-4">Halaman Paling Banyak Dikunjungi</h2>
            {data.topPages.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Belum ada data</p>
            ) : (
              <div className="space-y-3">
                {data.topPages.map((p, i) => (
                  <div key={p.path} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#1b5e20] text-white text-xs flex items-center justify-center font-bold flex-shrink-0">{i+1}</span>
                    <span className="flex-1 text-sm text-gray-700 truncate font-mono">{p.path}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-24 bg-gray-100 rounded-full h-2">
                        <div className="bg-[#d4a017] h-2 rounded-full" style={{ width: `${(p.views / data.topPages[0].views) * 100}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-[#1b5e20] w-12 text-right">{p.views.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="py-16 text-center text-gray-400"><p>Gagal memuat data analitik</p></div>
      )}
    </div>
  );
}
