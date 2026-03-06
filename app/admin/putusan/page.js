'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Search, FileText, ChevronLeft, ChevronRight, Upload, Download, Eye, EyeOff, X, Check } from 'lucide-react';

function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2 ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
      {type === 'error' ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
      {msg}
    </div>
  );
}

const jenisList = ['Cerai Gugat','Cerai Talak','Penetapan Ahli Waris','Itsbat Nikah','Hak Asuh Anak','Dispensasi Kawin','Pembagian Harta Gono Gini','Ekonomi Syariah'];

export default function PutusanAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modal, setModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({
    nomorPerkara: '', jenisPerkara: 'Cerai Gugat', tanggalPutusan: '',
    ringkasanPutusan: '', filePutusan: '', hakim: '', statusPublish: false
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: 'success' });

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3000); };
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (search) params.set('search', search);
      const res = await fetch(`/api/putusan?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotalPages(data.totalPages || 1);
    } catch {} finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function openCreate() {
    setForm({ nomorPerkara: '', jenisPerkara: 'Cerai Gugat', tanggalPutusan: new Date().toISOString().split('T')[0], ringkasanPutusan: '', filePutusan: '', hakim: '', statusPublish: false });
    setModal('create');
  }

  function openEdit(item) {
    setForm({
      nomorPerkara: item.nomorPerkara, jenisPerkara: item.jenisPerkara, tanggalPutusan: item.tanggalPutusan || '',
      ringkasanPutusan: item.ringkasanPutusan || '', filePutusan: item.filePutusan || '', hakim: item.hakim || '',
      statusPublish: item.statusPublish || false
    });
    setModal({ type: 'edit', id: item.id });
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.pdf')) { showToast('Hanya file PDF yang diperbolehkan', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('Ukuran file maksimal 10MB', 'error'); return; }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm(f => ({...f, filePutusan: data.url}));
      showToast('File berhasil diupload');
    } catch (err) { showToast('Gagal upload: ' + err.message, 'error'); }
    finally { setUploading(false); e.target.value = ''; }
  }

  async function handleSave() {
    if (!form.nomorPerkara) { showToast('Nomor perkara wajib diisi', 'error'); return; }
    setSaving(true);
    try {
      const isEdit = modal?.type === 'edit';
      const res = await fetch(isEdit ? `/api/putusan/${modal.id}` : '/api/putusan', {
        method: isEdit ? 'PUT' : 'POST', headers: authHeaders, body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error();
      showToast(isEdit ? 'Putusan diperbarui' : 'Putusan ditambahkan');
      setModal(null); fetchItems();
    } catch { showToast('Terjadi kesalahan', 'error'); } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    try {
      await fetch(`/api/putusan/${id}`, { method: 'DELETE', headers: authHeaders });
      showToast('Putusan dihapus'); fetchItems();
    } catch { showToast('Gagal menghapus', 'error'); }
    setDeleteId(null);
  }

  const formatDate = (d) => d ? new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  return (
    <div>
      <Toast msg={toast.msg} type={toast.type} />
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Manajemen Putusan</h1>
          <p className="text-gray-500 text-sm mt-0.5">Upload dan kelola dokumen putusan pengadilan</p>
        </div>
        <Button className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Tambah Putusan
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Cari nomor atau jenis perkara..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Perkara</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Tanggal Putusan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Hakim</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Dokumen</th>
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
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Belum ada dokumen putusan</p>
                </td></tr>
              ) : items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-[#1e3a5f] text-sm">{item.nomorPerkara}</p>
                    <p className="text-gray-400 text-xs">{item.jenisPerkara}</p>
                    {item.ringkasanPutusan && (
                      <p className="text-gray-500 text-xs mt-0.5 line-clamp-1 max-w-[200px]">{item.ringkasanPutusan}</p>
                    )}
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell text-sm text-gray-600">{formatDate(item.tanggalPutusan)}</td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <p className="text-xs text-gray-600 max-w-[150px] line-clamp-2">{item.hakim || '-'}</p>
                  </td>
                  <td className="px-4 py-4">
                    {item.filePutusan ? (
                      <a
                        href={item.filePutusan}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[#1e3a5f] hover:text-[#c9a84c] text-xs font-medium transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Unduh PDF
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Tidak ada file</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${item.statusPublish ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {item.statusPublish ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {item.statusPublish ? 'Publik' : 'Privat'}
                    </span>
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

      {/* Modal */}
      <Dialog open={!!modal} onOpenChange={v => !v && setModal(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{modal?.type === 'edit' ? 'Edit Putusan' : 'Tambah Putusan'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Nomor Perkara <span className="text-red-500">*</span></Label>
              <Input placeholder="0001/Pdt.G/2025/PA.Pnj" value={form.nomorPerkara} onChange={e => setForm(f => ({...f, nomorPerkara: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Jenis Perkara</Label>
                <select className="w-full p-2 border border-gray-200 rounded-lg text-sm" value={form.jenisPerkara} onChange={e => setForm(f => ({...f, jenisPerkara: e.target.value}))}>
                  {jenisList.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Tanggal Putusan</Label>
                <Input type="date" value={form.tanggalPutusan} onChange={e => setForm(f => ({...f, tanggalPutusan: e.target.value}))} />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Hakim</Label>
              <Input placeholder="Nama hakim" value={form.hakim} onChange={e => setForm(f => ({...f, hakim: e.target.value}))} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Ringkasan Putusan</Label>
              <textarea
                className="w-full min-h-[100px] p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 resize-none"
                placeholder="Isi ringkasan putusan..."
                value={form.ringkasanPutusan}
                onChange={e => setForm(f => ({...f, ringkasanPutusan: e.target.value}))}
              />
            </div>

            {/* PDF Upload */}
            <div>
              <Label className="text-sm font-medium mb-1.5 block">File Putusan (PDF)</Label>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-[#1e3a5f]/30 transition-colors">
                {form.filePutusan ? (
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-[#1e3a5f]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1e3a5f] truncate">{form.filePutusan.split('/').pop()}</p>
                      <a href={form.filePutusan} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Lihat file</a>
                    </div>
                    <button onClick={() => setForm(f => ({...f, filePutusan: ''}))} className="text-red-400 hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center gap-2 text-gray-400 hover:text-[#1e3a5f] transition-colors">
                    <Upload className="w-8 h-8" />
                    <span className="text-sm font-medium">{uploading ? 'Mengupload...' : 'Klik untuk upload PDF'}</span>
                    <span className="text-xs">Maksimal 10MB</span>
                    <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                )}
              </div>
              {/* Also allow URL input */}
              <div className="mt-2">
                <Label className="text-xs text-gray-400 mb-1 block">Atau masukkan URL file:</Label>
                <Input placeholder="https://..." value={form.filePutusan.startsWith('/') ? '' : form.filePutusan} onChange={e => setForm(f => ({...f, filePutusan: e.target.value}))} className="text-sm" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" id="statusPublish" checked={form.statusPublish} onChange={e => setForm(f => ({...f, statusPublish: e.target.checked}))} className="w-4 h-4 accent-[#1e3a5f]" />
              <Label htmlFor="statusPublish" className="text-sm cursor-pointer">Publikasikan ke website</Label>
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
          <AlertDialogHeader><AlertDialogTitle>Hapus Putusan?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={() => handleDelete(deleteId)}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
