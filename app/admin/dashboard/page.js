'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Newspaper, Bell, Briefcase, FileSearch, Users, TrendingUp, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({});
  const [recentNews, setRecentNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.push('/admin/login'); return; }
    fetchData(token);
  }, []);

  async function fetchData(token) {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [statsRes, newsRes] = await Promise.all([
        fetch('/api/stats', { headers }),
        fetch('/api/news?limit=5', { headers }),
      ]);
      const [statsData, newsData] = await Promise.all([statsRes.json(), newsRes.json()]);
      setStats(statsData);
      setRecentNews(newsData.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    { label: 'Total Berita', value: stats.totalNews, icon: Newspaper, color: 'bg-blue-50 text-blue-700 border-blue-100', path: '/admin/news' },
    { label: 'Total Pengumuman', value: stats.totalAnnouncements, icon: Bell, color: 'bg-amber-50 text-amber-700 border-amber-100', path: '/admin/announcements' },
    { label: 'Total Layanan', value: stats.totalServices, icon: Briefcase, color: 'bg-green-50 text-green-700 border-green-100', path: '/admin/services' },
    { label: 'Total Perkara', value: stats.totalCases, icon: FileSearch, color: 'bg-purple-50 text-purple-700 border-purple-100', path: '/admin/cases' },
    { label: 'Total Pengguna', value: stats.totalUsers, icon: Users, color: 'bg-red-50 text-red-700 border-red-100', path: '/admin/users' },
    { label: 'Perkara Tahun Ini', value: stats.casesThisYear, icon: TrendingUp, color: 'bg-indigo-50 text-indigo-700 border-indigo-100', path: '/admin/cases' },
    { label: 'Perkara Selesai', value: stats.casesDone, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-700 border-emerald-100', path: '/admin/cases' },
    { label: 'Perkara Berjalan', value: stats.casesOngoing, icon: Clock, color: 'bg-orange-50 text-orange-700 border-orange-100', path: '/admin/cases' },
  ];

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Selamat datang di panel administrasi Pengadilan Agama Penajam</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <Card key={i} className={`border cursor-pointer hover:shadow-md transition-shadow ${card.color}`} onClick={() => router.push(card.path)}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-white/50 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 opacity-50" />
                </div>
                <div className="text-2xl font-extrabold mb-0.5">
                  {loading ? <div className="h-7 w-12 bg-current opacity-20 rounded animate-pulse" /> : (card.value ?? 0)}
                </div>
                <p className="text-xs font-medium opacity-80">{card.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent News */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-[#1e3a5f]">Berita Terbaru</h2>
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/news')}>Kelola Berita</Button>
        </div>
        <div className="divide-y divide-gray-50">
          {loading ? (
            [1,2,3].map(i => (
              <div key={i} className="p-4 flex gap-4 animate-pulse">
                <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))
          ) : recentNews.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Newspaper className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Belum ada berita</p>
            </div>
          ) : (
            recentNews.map(item => (
              <div key={item.id} className="p-4 flex gap-4 hover:bg-gray-50 transition-colors">
                <img
                  src={item.image || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=200&q=60'}
                  alt={item.title}
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1e3a5f] text-sm line-clamp-1">{item.title}</p>
                  <p className="text-gray-400 text-xs mt-1">{formatDate(item.publishDate || item.createdAt)}</p>
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${item.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {item.isPublished ? 'Dipublikasi' : 'Draft'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
