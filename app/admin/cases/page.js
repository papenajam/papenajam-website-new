'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Search, FileSearch, ChevronLeft, ChevronRight } from 'lucide-react';

function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
      {msg}
    </div>
  );
}

const jenisPerkara = ['Cerai Gugat', 'Cerai Talak', 'Penetapan Ahli Waris', 'Itsbat Nikah', 'Hak Asuh Anak', 'Dispensasi Kawin', 'Pembagian Harta Gono Gini', 'Pencegahan Perkawinan', 'Pembatalan Perkawinan', 'Ekonomi Syariah'];
const statusOptions = ['terdaftar', 'berjalan', 'selesai', 'dicabut'];

export default function CasesAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tahunFilter, setTahunFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modal, setModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ nomorPerkara: '', tahun: String(new Date().getFullYear()), jenisPerkara: 'Cerai Gugat', pemohon: '', termohon: '', status: 'terdaftar', jadwalSidang: '', ruangSidang: '', hakim: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: 'success' });

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3000); };
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (search) params.set('search', search);
      if (tahunFilter) params.set('tahun', tahunFilter);
      const res = await fetch(`/api/cases?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotalPages(data.totalPages || 1);
    } catch {} finally { setLoading(false); }
  }, [page, search, tahunFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function openCreate() {
    setForm({ nomorPerkara: '', tahun: String(new Date().getFullYear()), jenisPerkara: 'Cerai Gugat', pemohon: '', termohon: '', status: 'terdaftar', jadwalSidang: '', ruangSidang: '', hakim: '' });
    setModal('create');
  }

  function openEdit(item) {
    setForm({
      nomorPerkara: item.nomorPerkara, tahun: item.tahun, jenisPerkara: item.jenisPerkara,
      pemohon: item.pemohon, termohon: item.termohon || '', status: item.status,
      jadwalSidang: item.jadwalSidang || '', ruangSidang: item.ruangSidang || '', hakim: item.hakim || ''
    });
    setModal({ type: 'edit', id: item.id });
  }

  async function handleSave() {
    if (!form.nomorPerkara || !form.pemohon) { showToast('Nomor perkara dan pemohon wajib diisi', 'error'); return; }
    setSaving(true);
    try {
      const isEdit = modal?.type === 'edit';
      const res = await fetch(isEdit ? `/api/cases/${modal.id}` : '/api/cases', {
        method: isEdit ? 'PUT' : 'POST', headers, body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error();
      showToast(isEdit ? 'Perkara diperbarui' : 'Perkara ditambahkan');
      setModal(null); fetchItems();
    } catch { showToast('Terjadi kesalahan', 'error'); } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    try {
      await fetch(`/api/cases/${id}`, { method: 'DELETE', headers });
      showToast('Perkara dihapus'); fetchItems();
    } catch { showToast('Gagal menghapus', 'error'); }
    setDeleteId(null);
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  const statusColor = (s) => ({
    selesai: 'bg-green-100 text-green-700',
    berjalan: 'bg-blue-100 text-blue-700',
    terdaftar: 'bg-yellow-100 text-yellow-700',
    dicabut: 'bg-red-100 text-red-700',
  }[s] || 'bg-gray-100 text-gray-700');

  return (
    <div>
      <Toast msg={toast.msg} type={toast.type} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Manajemen Perkara</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola data perkara pengadilan</p>
        </div>
        <Button className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Tambah Perkara
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Cari nomor perkara..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
          </div>
          <Input placeholder="Filter tahun" value={tahunFilter} onChange={e => { setTahunFilter(e.target.value); setPage(1); }} className="w-full sm:w-32" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nomor Perkara</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Jenis</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Pemohon</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Jadwal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [1,2,3].map(i => (
                  <tr key={i} className="animate-pulse">
                    {[1,2,3,4,5,6].map(j => <td key={j} className="px-4 py-4"><div className="h-4 bg-gray-200 rounded" /></td>)}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  <FileSearch className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Belum ada data perkara</p>
                </td></tr>
              ) : items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-[#1e3a5f] text-sm">{item.nomorPerkara}</p>
                    <p className="text-gray-400 text-xs">{item.tahun}</p>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell text-sm text-gray-600">{item.jenisPerkara}</td>
                  <td className="px-4 py-4 hidden md:table-cell text-sm text-gray-600 max-w-[160px]">
                    <p className="line-clamp-1">{item.pemohon}</p>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell text-sm text-gray-600">{formatDate(item.jadwalSidang)}</td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${statusColor(item.status)}`}>{item.status}</span>
                  </td>
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Halaman {page} dari {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p-1)}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p+1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!modal} onOpenChange={v => !v && setModal(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{modal?.type === 'edit' ? 'Edit Perkara' : 'Tambah Perkara'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Nomor Perkara <span className="text-red-500">*</span></Label>
                <Input placeholder="0001/Pdt.G/2025/PA.Pnj" value={form.nomorPerkara} onChange={e => setForm(f => ({...f, nomorPerkara: e.target.value}))} />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Tahun</Label>
                <Input value={form.tahun} onChange={e => setForm(f => ({...f, tahun: e.target.value}))} />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Jenis Perkara</Label>
              <select className="w-full p-2 border border-gray-200 rounded-lg text-sm" value={form.jenisPerkara} onChange={e => setForm(f => ({...f, jenisPerkara: e.target.value}))}>
                {jenisPerkara.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Pemohon/Penggugat <span className="text-red-500">*</span></Label>
              <Input placeholder="Nama pemohon" value={form.pemohon} onChange={e => setForm(f => ({...f, pemohon: e.target.value}))} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Termohon/Tergugat</Label>
              <Input placeholder="Nama termohon (atau -)"
 value={form.termohon} onChange={e => setForm(f => ({...f, termohon: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Status</Label>
                <select className="w-full p-2 border border-gray-200 rounded-lg text-sm" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                  {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Jadwal Sidang</Label>
                <Input type="date" value={form.jadwalSidang} onChange={e => setForm(f => ({...f, jadwalSidang: e.target.value}))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Ruang Sidang</Label>
                <Input placeholder="Ruang Sidang I" value={form.ruangSidang} onChange={e => setForm(f => ({...f, ruangSidang: e.target.value}))} />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Hakim</Label>
                <Input placeholder="Nama hakim" value={form.hakim} onChange={e => setForm(f => ({...f, hakim: e.target.value}))} />
              </div>
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
            <AlertDialogTitle>Hapus Perkara?</AlertDialogTitle>
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
