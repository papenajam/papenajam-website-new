'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Scale, LayoutDashboard, Newspaper, Bell, Briefcase, FileSearch,
  Users, Settings, LogOut, Menu, X, ChevronRight
} from 'lucide-react';

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { id: 'news', label: 'Berita', path: '/admin/news', icon: Newspaper },
  { id: 'announcements', label: 'Pengumuman', path: '/admin/announcements', icon: Bell },
  { id: 'services', label: 'Layanan', path: '/admin/services', icon: Briefcase },
  { id: 'cases', label: 'Perkara', path: '/admin/cases', icon: FileSearch },
  { id: 'users', label: 'Pengguna', path: '/admin/users', icon: Users },
  { id: 'settings', label: 'Pengaturan', path: '/admin/settings', icon: Settings },
];

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (pathname === '/admin/login' || pathname === '/admin') return;
    const token = localStorage.getItem('admin_token');
    const userData = localStorage.getItem('admin_user');
    if (!token) { router.push('/admin/login'); return; }
    if (userData) setUser(JSON.parse(userData));
    // Verify token
    fetch('/api/auth/verify', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) { localStorage.clear(); router.push('/admin/login'); } })
      .catch(() => { localStorage.clear(); router.push('/admin/login'); });
  }, [pathname, router]);

  function handleLogout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.push('/admin/login');
  }

  if (pathname === '/admin/login' || pathname === '/admin') {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-[#1e3a5f] text-white z-50 transform transition-transform duration-300 flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#c9a84c]/20 flex items-center justify-center">
              <Scale className="w-5 h-5 text-[#c9a84c]" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">PA Penajam</p>
              <p className="text-white/50 text-xs">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <p className="text-white/30 text-xs font-semibold uppercase tracking-wider px-3 mb-2 mt-1">Menu Utama</p>
          {sidebarItems.map(item => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.path);
            return (
              <button
                key={item.id}
                onClick={() => { router.push(item.path); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all text-left ${
                  active
                    ? 'bg-[#c9a84c] text-white font-semibold shadow-md'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{item.label}</span>
                {active && <ChevronRight className="w-4 h-4 ml-auto" />}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-white/10">
          {user && (
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-[#c9a84c]/20 flex items-center justify-center">
                <span className="text-[#c9a84c] font-bold text-sm">{user.name?.[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{user.name}</p>
                <p className="text-white/50 text-xs truncate">{user.role}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" /> Keluar
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div>
              <p className="font-semibold text-[#1e3a5f] text-sm">
                {sidebarItems.find(i => pathname.startsWith(i.path))?.label || 'Admin'}
              </p>
              <p className="text-gray-400 text-xs">Pengadilan Agama Penajam</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open('/', '_blank')}
              className="text-sm text-[#1e3a5f] hover:text-[#c9a84c] font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
            >
              Lihat Website
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
