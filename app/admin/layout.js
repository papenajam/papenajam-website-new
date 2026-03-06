'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Scale, LayoutDashboard, Newspaper, Bell, Briefcase, FileSearch,
  Users, Settings, LogOut, Menu, X, ChevronRight, ChevronDown,
  CalendarDays, FileText, Layers, Search, Home
} from 'lucide-react';

const sidebarGroups = [
  {
    label: 'Utama',
    items: [
      { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, roles: ['superadmin','admin','staff','editor'] },
    ]
  },
  {
    label: 'Konten',
    items: [
      { id: 'news', label: 'Berita', path: '/admin/news', icon: Newspaper, roles: ['superadmin','admin','editor'] },
      { id: 'announcements', label: 'Pengumuman', path: '/admin/announcements', icon: Bell, roles: ['superadmin','admin','editor'] },
      { id: 'services', label: 'Layanan', path: '/admin/services', icon: Briefcase, roles: ['superadmin','admin','editor'] },
      { id: 'page-builder', label: 'Page Builder', path: '/admin/page-builder', icon: Layers, roles: ['superadmin','admin','editor'] },
    ]
  },
  {
    label: 'Kepaniteraan',
    items: [
      { id: 'cases', label: 'Perkara', path: '/admin/cases', icon: FileSearch, roles: ['superadmin','admin','staff'] },
      { id: 'agenda-sidang', label: 'Agenda Sidang', path: '/admin/agenda-sidang', icon: CalendarDays, roles: ['superadmin','admin','staff'] },
      { id: 'putusan', label: 'Putusan', path: '/admin/putusan', icon: FileText, roles: ['superadmin','admin','staff'] },
    ]
  },
  {
    label: 'Administrasi',
    items: [
      { id: 'users', label: 'Pengguna', path: '/admin/users', icon: Users, roles: ['superadmin','admin'] },
      { id: 'settings', label: 'Pengaturan', path: '/admin/settings', icon: Settings, roles: ['superadmin','admin'] },
    ]
  },
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

  const currentPage = sidebarGroups.flatMap(g => g.items).find(i => pathname.startsWith(i.path))?.label || 'Admin';
  const role = user?.role || 'admin';

  const roleColor = {
    superadmin: 'bg-purple-500/20 text-purple-300',
    admin: 'bg-blue-500/20 text-blue-300',
    staff: 'bg-green-500/20 text-green-300',
    editor: 'bg-amber-500/20 text-amber-300',
  }[role] || 'bg-white/10 text-white/60';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-[#0f2340] text-white z-50 transform transition-transform duration-300 flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#c9a84c]/20 flex items-center justify-center">
              <Scale className="w-5 h-5 text-[#c9a84c]" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">PA Penajam</p>
              <p className="text-white/40 text-[11px]">Admin Panel v2.0</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto scrollbar-thin">
          {sidebarGroups.map(group => {
            const visibleItems = group.items.filter(item => item.roles.includes(role));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label} className="mb-2 px-2">
                <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest px-3 mb-1">{group.label}</p>
                {visibleItems.map(item => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.path);
                  return (
                    <button
                      key={item.id}
                      onClick={() => { router.push(item.path); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-all text-left group ${
                        active
                          ? 'bg-[#c9a84c] text-[#0f2340] font-semibold'
                          : 'text-white/60 hover:bg-white/8 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm flex-1">{item.label}</span>
                      {active && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/10">
          {user && (
            <div className="flex items-center gap-2.5 mb-2.5 px-2">
              <div className="w-8 h-8 rounded-full bg-[#c9a84c]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-[#c9a84c] font-bold text-sm">{user.name?.[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-white">{user.name}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${roleColor}`}>{role}</span>
              </div>
            </div>
          )}
          <div className="flex gap-1">
            <button
              onClick={() => window.open('/', '_blank')}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-white/50 hover:bg-white/10 hover:text-white rounded-lg transition-colors text-xs"
            >
              <Home className="w-3.5 h-3.5" /> Website
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-red-400/80 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors text-xs"
            >
              <LogOut className="w-3.5 h-3.5" /> Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:ml-64 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div>
              <p className="font-semibold text-[#1e3a5f] text-sm">{currentPage}</p>
              <div className="flex items-center gap-1 text-gray-400 text-xs">
                <span>Admin</span>
                <ChevronRight className="w-3 h-3" />
                <span>{currentPage}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <div className="hidden md:flex items-center gap-2">
                <span className="text-sm text-gray-600">{user.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${roleColor}`}>{role}</span>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
