'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Newspaper, Bell, Briefcase, FileSearch, Users, TrendingUp, CheckCircle,
  Clock, ArrowRight, CalendarDays, FileText, Scale, Activity, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const PIE_COLORS = ['#1b5e20','#d4a017','#2e7d32','#e8b84b','#3b6fa0','#d4a843'];

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({});
  const [recentNews, setRecentNews] = useState([]);
  const [todayAgenda, setTodayAgenda] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.push('/admin/login'); return; }
    fetchData(token);
  }, []);

  async function fetchData(token) {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const today = new Date().toISOString().split('T')[0];
      const [statsRes, newsRes, agendaRes] = await Promise.all([
        fetch('/api/stats', { headers }),
        fetch('/api/news?limit=5'),
        fetch(`/api/agenda?dateFrom=${today}&dateTo=${today}&limit=10`),
      ]);
      const [statsData, newsData, agendaData] = await Promise.all([statsRes.json(), newsRes.json(), agendaRes.json()]);
      setStats(statsData);
      setRecentNews(newsData.items || []);
      setTodayAgenda(agendaData.items || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const statCards = [
    { label: 'Total Berita', value: stats.totalNews, icon: Newspaper, color: 'text-blue-600', bg: 'bg-blue-50', path: '/admin/news' },
    { label: 'Total Perkara', value: stats.totalCases, icon: FileSearch, color: 'text-purple-600', bg: 'bg-purple-50', path: '/admin/cases' },
    { label: 'Agenda Sidang', value: stats.totalAgenda, icon: CalendarDays, color: 'text-green-600', bg: 'bg-green-50', path: '/admin/agenda-sidang' },
    { label: 'Total Putusan', value: stats.totalPutusan, icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50', path: '/admin/putusan' },
    { label: 'Perkara Bulan Ini', value: stats.casesThisMonth, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50', path: '/admin/cases' },
    { label: 'Sidang Hari Ini', value: stats.todayAgenda, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', path: '/admin/agenda-sidang' },
    { label: 'Perkara Selesai', value: stats.casesDone, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', path: '/admin/cases' },
    { label: 'Total Pengguna', value: stats.totalUsers, icon: Users, color: 'text-red-600', bg: 'bg-red-50', path: '/admin/users' },
  ];

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  const statusColor = (s) => ({
    dijadwalkan: 'bg-blue-100 text-blue-700', selesai: 'bg-green-100 text-green-700',
    ditunda: 'bg-yellow-100 text-yellow-700', dibatalkan: 'bg-red-100 text-red-700',
  }[s] || 'bg-gray-100 text-gray-700');

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1b5e20]">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Button className="bg-[#1b5e20] hover:bg-[#2e7d32] text-white" onClick={() => router.push('/admin/agenda-sidang')}>
          <CalendarDays className="w-4 h-4 mr-2" /> Tambah Agenda
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5"
              onClick={() => router.push(card.path)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300" />
              </div>
              <div className={`text-2xl font-extrabold mb-0.5 ${card.color}`}>
                {loading ? <div className="h-7 w-10 bg-gray-200 rounded animate-pulse" /> : (card.value ?? 0)}
              </div>
              <p className="text-xs text-gray-500 font-medium">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-bold text-[#1b5e20] mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#d4a017]" /> Perkara per Bulan
          </h3>
          {loading || !stats.monthlyData ? (
            <div className="h-40 bg-gray-50 rounded-lg animate-pulse flex items-center justify-center">
              <span className="text-gray-300 text-sm">Memuat...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v) => [v, 'Perkara']}
                />
                <Bar dataKey="count" fill="#1b5e20" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-bold text-[#1b5e20] mb-4 flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#d4a017]" /> Perkara berdasarkan Jenis
          </h3>
          {loading || !stats.caseTypes || stats.caseTypes.length === 0 ? (
            <div className="h-40 bg-gray-50 rounded-lg animate-pulse flex items-center justify-center">
              <span className="text-gray-300 text-sm">Memuat...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={stats.caseTypes}
                  cx="45%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  dataKey="value"
                  nameKey="name"
                >
                  {stats.caseTypes.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Today's Agenda */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-50">
            <h3 className="font-bold text-[#1b5e20] flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#d4a017]" /> Jadwal Sidang Hari Ini
            </h3>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => router.push('/admin/agenda-sidang')}>
              Semua Agenda
            </Button>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              [1,2].map(i => (
                <div key={i} className="p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              ))
            ) : todayAgenda.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Tidak ada jadwal sidang hari ini</p>
              </div>
            ) : todayAgenda.map(item => (
              <div key={item.id} className="p-4 flex items-start gap-3">
                <div className="w-12 h-12 bg-[#1b5e20]/5 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-[#1b5e20] font-bold text-sm">{item.waktuSidang?.slice(0,5)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1b5e20] text-sm line-clamp-1">{item.nomorPerkara}</p>
                  <p className="text-gray-500 text-xs">{item.jenisPerkara} &bull; {item.ruangSidang}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor(item.status)}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent News */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-50">
            <h3 className="font-bold text-[#1b5e20] flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-[#d4a017]" /> Berita Terbaru
            </h3>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => router.push('/admin/news')}>
              Kelola Berita
            </Button>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} className="p-4 flex gap-3 animate-pulse">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 rounded" /><div className="h-3 bg-gray-200 rounded w-2/3" /></div>
                </div>
              ))
            ) : recentNews.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Belum ada berita</p>
              </div>
            ) : recentNews.map(item => (
              <div key={item.id} className="p-4 flex gap-3">
                <img
                  src={item.image || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=100&q=60'}
                  alt={item.title} className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1b5e20] text-sm line-clamp-1">{item.title}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{formatDate(item.publishDate || item.createdAt)}</p>
                </div>
                <span className={`self-start px-2 py-0.5 rounded-full text-[10px] font-semibold ${item.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {item.isPublished ? 'Publik' : 'Draft'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
