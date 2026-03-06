'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';

function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
      {msg}
    </div>
  );
}

export default function UsersAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: 'success' });

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3000); };
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users', { headers });
      const data = await res.json();
      setItems(data.items || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function openCreate() {
    setForm({ name: '', email: '', password: '', role: 'admin' });
    setModal('create');
  }

  function openEdit(item) {
    setForm({ name: item.name, email: item.email, password: '', role: item.role });
    setModal({ type: 'edit', id: item.id });
  }

  async function handleSave() {
    if (!form.name || !form.email) { showToast('Nama dan email wajib diisi', 'error'); return; }
    if (modal === 'create' && !form.password) { showToast('Password wajib diisi untuk pengguna baru', 'error'); return; }
    setSaving(true);
    try {
      const isEdit = modal?.type === 'edit';
      const body = { ...form };
      if (isEdit && !body.password) delete body.password;
      const res = await fetch(isEdit ? `/api/users/${modal.id}` : '/api/users', {
        method: isEdit ? 'PUT' : 'POST', headers, body: JSON.stringify(body)
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      showToast(isEdit ? 'Pengguna diperbarui' : 'Pengguna ditambahkan');
      setModal(null); fetchItems();
    } catch (err) { showToast(err.message || 'Terjadi kesalahan', 'error'); } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    try {
      await fetch(`/api/users/${id}`, { method: 'DELETE', headers });
      showToast('Pengguna dihapus'); fetchItems();
    } catch { showToast('Gagal menghapus', 'error'); }
    setDeleteId(null);
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  const roleColor = (r) => r === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700';

  return (
    <div>
      <Toast msg={toast.msg} type={toast.type} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Manajemen Pengguna</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola akun admin pengadilan</p>
        </div>
        <Button className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Tambah Pengguna
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pengguna</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Tanggal Bergabung</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              [1,2].map(i => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-4"><div className="flex gap-3 items-center"><div className="w-10 h-10 bg-gray-200 rounded-full" /><div className="space-y-2"><div className="h-4 bg-gray-200 rounded w-32" /><div className="h-3 bg-gray-200 rounded w-24" /></div></div></td>
                  <td className="px-4 py-4 hidden md:table-cell"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
                  <td className="px-4 py-4 hidden md:table-cell"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                  <td className="px-4 py-4"><div className="h-8 bg-gray-200 rounded w-20 ml-auto" /></td>
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Belum ada pengguna</p>
              </td></tr>
            ) : items.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#1e3a5f] font-bold text-sm">{item.name?.[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-[#1e3a5f] text-sm">{item.name}</p>
                      <p className="text-gray-400 text-xs">{item.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 hidden md:table-cell">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${roleColor(item.role)}`}>{item.role}</span>
                </td>
                <td className="px-4 py-4 hidden md:table-cell text-sm text-gray-600">{formatDate(item.createdAt)}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(item)}><Pencil className="w-3 h-3 mr-1" /> Edit</Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50 border-red-200" onClick={() => setDeleteId(item.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!modal} onOpenChange={v => !v && setModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{modal?.type === 'edit' ? 'Edit Pengguna' : 'Tambah Pengguna'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Nama Lengkap <span className="text-red-500">*</span></Label>
              <Input placeholder="Nama lengkap" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Email <span className="text-red-500">*</span></Label>
              <Input type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                Password {modal?.type === 'edit' && <span className="text-gray-400 font-normal">(kosongkan jika tidak diubah)</span>}
                {modal === 'create' && <span className="text-red-500"> *</span>}
              </Label>
              <Input type="password" placeholder="Password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Role</Label>
              <select className="w-full p-2 border border-gray-200 rounded-lg text-sm" value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}>
                <option value="admin">Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Batal</Button>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white" onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pengguna?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={() => handleDelete(deleteId)}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
