'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Briefcase } from 'lucide-react';

function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
      {msg}
    </div>
  );
}

export default function ServicesAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', icon: 'FileText', order: 1, isActive: true });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: 'success' });

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3000); };
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      setItems(data.items || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function openCreate() {
    setForm({ title: '', description: '', icon: 'FileText', order: (items.length + 1), isActive: true });
    setModal('create');
  }

  function openEdit(item) {
    setForm({ title: item.title, description: item.description, icon: item.icon || 'FileText', order: item.order || 1, isActive: item.isActive ?? true });
    setModal({ type: 'edit', id: item.id });
  }

  async function handleSave() {
    if (!form.title || !form.description) { showToast('Judul dan deskripsi wajib diisi', 'error'); return; }
    setSaving(true);
    try {
      const isEdit = modal?.type === 'edit';
      const res = await fetch(isEdit ? `/api/services/${modal.id}` : '/api/services', {
        method: isEdit ? 'PUT' : 'POST', headers, body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error();
      showToast(isEdit ? 'Layanan diperbarui' : 'Layanan ditambahkan');
      setModal(null); fetchItems();
    } catch { showToast('Terjadi kesalahan', 'error'); } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    try {
      await fetch(`/api/services/${id}`, { method: 'DELETE', headers });
      showToast('Layanan dihapus'); fetchItems();
    } catch { showToast('Gagal menghapus', 'error'); }
    setDeleteId(null);
  }

  const iconOptions = ['FileText', 'Calendar', 'DollarSign', 'Package', 'Shield', 'Monitor', 'Users', 'Stamp', 'Scale', 'Building2', 'BookOpen'];

  return (
    <div>
      <Toast msg={toast.msg} type={toast.type} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1b5e20]">Manajemen Layanan</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola layanan pengadilan</p>
        </div>
        <Button className="bg-[#1b5e20] hover:bg-[#2e7d32] text-white" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Tambah Layanan
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          [1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 rounded-xl mb-4" />
              <div className="h-4 bg-gray-200 rounded mb-2" />
              <div className="h-3 bg-gray-200 rounded w-3/4" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-400">
            <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Belum ada layanan</p>
          </div>
        ) : items.map(item => (
          <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-[#1b5e20]/10 rounded-xl flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-[#1b5e20]" />
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {item.isActive ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
            <h3 className="font-bold text-[#1b5e20] text-sm mb-1">{item.title}</h3>
            <p className="text-gray-500 text-xs line-clamp-2 mb-4">{item.description}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => openEdit(item)}>
                <Pencil className="w-3 h-3 mr-1" /> Edit
              </Button>
              <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50 border-red-200" onClick={() => setDeleteId(item.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!modal} onOpenChange={v => !v && setModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{modal?.type === 'edit' ? 'Edit Layanan' : 'Tambah Layanan'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Nama Layanan <span className="text-red-500">*</span></Label>
              <Input placeholder="Nama layanan" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Deskripsi <span className="text-red-500">*</span></Label>
              <textarea
                className="w-full min-h-[80px] p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1b5e20]/30 resize-none"
                placeholder="Deskripsi layanan..."
                value={form.description}
                onChange={e => setForm(f => ({...f, description: e.target.value}))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Icon</Label>
                <select className="w-full p-2 border border-gray-200 rounded-lg text-sm" value={form.icon} onChange={e => setForm(f => ({...f, icon: e.target.value}))}>
                  {iconOptions.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Urutan</Label>
                <Input type="number" value={form.order} onChange={e => setForm(f => ({...f, order: parseInt(e.target.value)}))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="svcActive" checked={form.isActive} onChange={e => setForm(f => ({...f, isActive: e.target.checked}))} className="w-4 h-4 accent-[#1b5e20]" />
              <Label htmlFor="svcActive" className="text-sm cursor-pointer">Aktifkan layanan</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Batal</Button>
            <Button className="bg-[#1b5e20] hover:bg-[#2e7d32] text-white" onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Layanan?</AlertDialogTitle>
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
