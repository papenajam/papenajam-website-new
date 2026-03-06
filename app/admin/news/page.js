'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Search, Eye, EyeOff, ChevronLeft, ChevronRight, Newspaper, Upload, X, ImageIcon } from 'lucide-react';

function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2 ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
      {msg}
    </div>
  );
}

// Reusable image upload component
function ImageUploadInput({ value, onChange, token, label = 'Gambar' }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Hanya file gambar (JPG, PNG, GIF, WebP) yang diperbolehkan');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran file maksimal 5MB');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload gagal');
      onChange(data.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      <Label className="text-sm font-medium mb-1.5 block">{label}</Label>
      {value ? (
        <div className="relative mt-1">
          <img src={value} alt="preview" className="w-full h-36 object-cover rounded-lg border border-gray-200" onError={e => e.target.style.display='none'} />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-2 right-2 bg-white rounded-full p-1 shadow border border-gray-200 hover:bg-red-50 text-red-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <p className="text-xs text-gray-400 mt-1 truncate">{value}</p>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-200 rounded-xl hover:border-[#1e3a5f]/30 transition-colors">
          <label className="cursor-pointer flex flex-col items-center gap-1.5 p-4 text-gray-400 hover:text-[#1e3a5f] transition-colors">
            <ImageIcon className="w-7 h-7" />
            <span className="text-sm font-medium">{uploading ? 'Mengupload...' : 'Upload gambar'}</span>
            <span className="text-xs">JPG, PNG, GIF, WebP — Maks 5MB</span>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
          </label>
        </div>
      )}
      <p className="text-xs text-gray-400 mt-1">— atau —</p>
      <Input
        placeholder="Masukkan URL gambar langsung..."
        value={value && !value.startsWith('/uploads') ? value : ''}
        onChange={e => onChange(e.target.value)}
        className="mt-1 text-sm"
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function NewsAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modal, setModal] = useState(null); // null | 'create' | 'edit'
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', image: '', category: '', publishDate: '', isPublished: true });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: 'success' });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3000);
  };

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/news?page=${page}&limit=8&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotalPages(data.totalPages || 1);
    } catch { } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function openCreate() {
    setForm({ title: '', content: '', image: '', category: '', publishDate: new Date().toISOString().split('T')[0], isPublished: true });
    setModal('create');
  }

  function openEdit(item) {
    setForm({ title: item.title, content: item.content, image: item.image || '', category: item.category || '', publishDate: item.publishDate || '', isPublished: item.isPublished ?? true });
    setModal({ type: 'edit', id: item.id });
  }

  async function handleSave() {
    if (!form.title || !form.content) { showToast('Judul dan konten wajib diisi', 'error'); return; }
    setSaving(true);
    try {
      const isEdit = modal?.type === 'edit';
      const url = isEdit ? `/api/news/${modal.id}` : '/api/news';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify({ ...form, author: 'Admin' }) });
      if (!res.ok) throw new Error('Gagal');
      showToast(isEdit ? 'Berita berhasil diperbarui' : 'Berita berhasil ditambahkan');
      setModal(null);
      fetchItems();
    } catch { showToast('Terjadi kesalahan', 'error'); } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    try {
      await fetch(`/api/news/${id}`, { method: 'DELETE', headers });
      showToast('Berita berhasil dihapus');
      fetchItems();
    } catch { showToast('Gagal menghapus', 'error'); }
    setDeleteId(null);
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  return (
    <div>
      <Toast msg={toast.msg} type={toast.type} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Manajemen Berita</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola artikel berita pengadilan</p>
        </div>
        <Button className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Tambah Berita
        </Button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Cari berita..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Berita</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Kategori</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Tanggal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [1,2,3,4].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-4"><div className="flex gap-3"><div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0" /><div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 rounded w-3/4" /><div className="h-3 bg-gray-200 rounded w-1/2" /></div></div></td>
                    <td className="px-4 py-4 hidden md:table-cell"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                    <td className="px-4 py-4 hidden md:table-cell"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                    <td className="px-4 py-4"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
                    <td className="px-4 py-4"><div className="h-8 bg-gray-200 rounded w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    <Newspaper className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Belum ada berita</p>
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.image || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=100&q=60'}
                          alt={item.title}
                          className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                        />
                        <div>
                          <p className="font-semibold text-[#1e3a5f] text-sm line-clamp-1">{item.title}</p>
                          <p className="text-gray-400 text-xs line-clamp-1">{item.content?.substring(0,60)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-sm text-gray-600">{item.category || '-'}</span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-sm text-gray-600">{formatDate(item.publishDate || item.createdAt)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${item.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {item.isPublished ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {item.isPublished ? 'Publik' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                          <Pencil className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50 border-red-200" onClick={() => setDeleteId(item.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Halaman {page} dari {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p+1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={!!modal} onOpenChange={v => !v && setModal(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modal?.type === 'edit' ? 'Edit Berita' : 'Tambah Berita'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Judul <span className="text-red-500">*</span></Label>
              <Input placeholder="Judul berita" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Konten <span className="text-red-500">*</span></Label>
              <textarea
                className="w-full min-h-[120px] p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 resize-none"
                placeholder="Isi berita..."
                value={form.content}
                onChange={e => setForm(f => ({...f, content: e.target.value}))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Kategori</Label>
              <Input placeholder="Contoh: Kegiatan" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Tanggal Publikasi</Label>
              <Input type="date" value={form.publishDate} onChange={e => setForm(f => ({...f, publishDate: e.target.value}))} />
            </div>
            </div>
            <div>
              <ImageUploadInput
                value={form.image}
                onChange={v => setForm(f => ({...f, image: v}))}
                token={token}
                label="Gambar Berita"
              />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="isPublished" checked={form.isPublished} onChange={e => setForm(f => ({...f, isPublished: e.target.checked}))} className="w-4 h-4 accent-[#1e3a5f]" />
              <Label htmlFor="isPublished" className="text-sm cursor-pointer">Publikasikan langsung</Label>
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

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Berita?</AlertDialogTitle>
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
