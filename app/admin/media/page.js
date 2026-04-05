'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, Search, Grid3X3, List, Copy, Trash2, Check, X,
  Image as ImageIcon, FileText, File, ChevronLeft, ChevronRight,
  Loader2, Edit2, Save, Film, FolderOpen, RefreshCw, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function TypeBadge({ type, ext }) {
  const colors = {
    image: 'bg-blue-100 text-blue-700',
    pdf: 'bg-red-100 text-red-700',
    video: 'bg-purple-100 text-purple-700',
    file: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${colors[type] || colors.file}`}>
      {ext?.toUpperCase() || type}
    </span>
  );
}

function FileIcon({ type, className = 'w-8 h-8' }) {
  if (type === 'image') return <ImageIcon className={`${className} text-blue-400`} />;
  if (type === 'pdf') return <FileText className={`${className} text-red-400`} />;
  if (type === 'video') return <Film className={`${className} text-purple-400`} />;
  return <File className={`${className} text-gray-400`} />;
}

const TYPE_FILTERS = [
  { id: '', label: 'Semua' },
  { id: 'image', label: '🖼️ Gambar' },
  { id: 'pdf', label: '📄 PDF' },
  { id: 'video', label: '🎬 Video' },
  { id: 'file', label: '📁 Lainnya' },
];

const SORT_OPTIONS = [
  { id: 'createdAt_desc', label: 'Terbaru' },
  { id: 'createdAt_asc', label: 'Terlama' },
  { id: 'originalName_asc', label: 'Nama A–Z' },
  { id: 'size_desc', label: 'Terbesar' },
  { id: 'size_asc', label: 'Terkecil' },
];

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function MediaLibraryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sort, setSort] = useState('createdAt_desc');
  const [viewMode, setViewMode] = useState('grid');
  const [selected, setSelected] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [editingAlt, setEditingAlt] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', alt: '' });
  const [savingField, setSavingField] = useState(null);

  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState({ msg: '', type: 'success' });

  const fileInputRef = useRef(null);
  const searchTimer = useRef(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const authHeaders = { Authorization: `Bearer ${token}` };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type }), 3000);
  };

  const [sortField, sortDir] = sort.split('_');

  // ─── Load data ───────────────────────────────────────────────────────────
  const loadData = useCallback(async (resetPage = false) => {
    setLoading(true);
    try {
      const p = resetPage ? 1 : page;
      const params = new URLSearchParams({ page: p, limit: 28, sortField, sortDir });
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      const res = await fetch(`/api/media?${params}`, { headers: authHeaders });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      if (resetPage) setPage(1);
    } catch {
      showToast('Gagal memuat media', 'error');
    } finally { setLoading(false); }
  }, [page, search, typeFilter, sort]);

  useEffect(() => { loadData(); }, [page, sort, typeFilter]);

  // Debounced search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadData(true), 400);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // ─── Upload handler ──────────────────────────────────────────────────────
  async function handleUpload(files) {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setUploading(true);
    setUploadQueue(fileArray.map(f => ({ name: f.name, status: 'pending' })));

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setUploadQueue(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'uploading' } : p));
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch('/api/upload', { method: 'POST', headers: authHeaders, body: fd });
        if (res.ok) {
          setUploadQueue(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'done' } : p));
        } else {
          setUploadQueue(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'error' } : p));
        }
      } catch {
        setUploadQueue(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'error' } : p));
      }
    }

    setUploading(false);
    const doneCount = fileArray.length;
    setTimeout(() => {
      setUploadQueue([]);
      loadData(true);
      showToast(`${doneCount} file berhasil diunggah`);
    }, 900);
  }

  // ─── Drag & Drop ─────────────────────────────────────────────────────────
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); handleUpload(e.dataTransfer.files); };

  // ─── Select item ─────────────────────────────────────────────────────────
  function selectItem(item) {
    if (selected?.id === item.id) { setSelected(null); return; }
    setSelected(item);
    setEditForm({ title: item.title || '', alt: item.alt || '' });
    setEditingTitle(false);
    setEditingAlt(false);
    setCopied(false);
  }

  // ─── Save metadata ───────────────────────────────────────────────────────
  async function saveField(field) {
    if (!selected) return;
    setSavingField(field);
    try {
      const res = await fetch(`/api/media/${selected.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: editForm[field] }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelected(updated);
        setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
        if (field === 'title') setEditingTitle(false);
        if (field === 'alt') setEditingAlt(false);
        showToast('Berhasil disimpan');
      }
    } catch { showToast('Gagal menyimpan', 'error'); }
    finally { setSavingField(null); }
  }

  // ─── Copy URL ────────────────────────────────────────────────────────────
  async function copyUrl(url) {
    const fullUrl = url.startsWith('http') ? url : (typeof window !== 'undefined' ? window.location.origin : '') + url;
    try { await navigator.clipboard.writeText(fullUrl); } catch {
      const el = document.createElement('textarea');
      el.value = fullUrl; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    showToast('URL berhasil disalin ke clipboard!');
  }

  // ─── Delete ──────────────────────────────────────────────────────────────
  async function handleDelete(id, e) {
    e?.stopPropagation();
    if (!confirm('Hapus file ini? Tindakan ini tidak dapat dibatalkan.')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/media/${id}`, { method: 'DELETE', headers: authHeaders });
      setItems(prev => prev.filter(i => i.id !== id));
      setTotal(prev => prev - 1);
      if (selected?.id === id) setSelected(null);
      showToast('File berhasil dihapus');
    } catch { showToast('Gagal menghapus', 'error'); }
    finally { setDeletingId(null); }
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      className={`relative transition-all ${isDragging ? 'outline-4 outline-dashed outline-[#1b5e20] rounded-2xl' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Toast */}
      {toast.msg && (
        <div className={`fixed bottom-5 right-5 z-[9999] px-4 py-3 rounded-xl shadow-xl text-white text-sm font-semibold flex items-center gap-2 ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-[#1b5e20]'
        }`}>
          {toast.type === 'error' ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[9000] bg-[#1b5e20]/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-3xl px-16 py-12 text-center shadow-2xl border-4 border-dashed border-[#1b5e20]">
            <Upload className="w-20 h-20 mx-auto mb-4 text-[#1b5e20]" />
            <p className="text-2xl font-extrabold text-[#1b5e20]">Lepas untuk Mengunggah</p>
            <p className="text-gray-400 mt-2">File akan langsung ditambahkan ke Media Library</p>
          </div>
        </div>
      )}

      {/* Upload queue */}
      {uploadQueue.length > 0 && (
        <div className="mb-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-[#1b5e20]">
              {uploading ? 'Mengunggah...' : 'Selesai!'} ({uploadQueue.filter(q => q.status === 'done').length}/{uploadQueue.length})
            </p>
            {!uploading && (
              <button onClick={() => setUploadQueue([])} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {uploadQueue.map((q, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm">
                {q.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-[#1b5e20] flex-shrink-0" />}
                {q.status === 'done' && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
                {q.status === 'error' && <X className="w-4 h-4 text-red-500 flex-shrink-0" />}
                {q.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />}
                <span className={`truncate ${q.status === 'error' ? 'text-red-500' : q.status === 'done' ? 'text-green-600' : 'text-gray-600'}`}>
                  {q.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1b5e20]">Media Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total > 0 ? `${total} file tersimpan` : 'Belum ada file'}
            {typeFilter && ` · Filter: ${TYPE_FILTERS.find(t => t.id === typeFilter)?.label}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData()} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4,.mov,.zip"
            className="hidden"
            onChange={e => { handleUpload(e.target.files); e.target.value = ''; }}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#1b5e20] hover:bg-[#2e7d32] text-white gap-2"
            disabled={uploading}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Unggah File
          </Button>
        </div>
      </div>

      {/* ─── Toolbar ─── */}
      <div className="flex flex-col lg:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama file atau judul..." className="pl-9" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type filter */}
          <div className="flex gap-1">
            {TYPE_FILTERS.map(f => (
              <button key={f.id} onClick={() => { setTypeFilter(f.id); setPage(1); }}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  typeFilter === f.id ? 'bg-[#1b5e20] text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}>{f.label}</button>
            ))}
          </div>
          {/* Sort */}
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white text-gray-600 cursor-pointer">
            {SORT_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {/* View toggle */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setViewMode('grid')} title="Grid View"
              className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#1b5e20]' : 'text-gray-400 hover:text-gray-600'}`}>
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')} title="List View"
              className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[#1b5e20]' : 'text-gray-400 hover:text-gray-600'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className={`flex gap-5 ${selected ? 'items-start' : ''}`}>
        {/* Main grid/list */}
        <div className={`flex-1 min-w-0 transition-all duration-300`}>

          {loading ? (
            <div className={viewMode === 'grid'
              ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3'
              : 'space-y-2'}>
              {[...Array(14)].map((_, i) => (
                <div key={i} className={`bg-gray-100 animate-pulse rounded-xl ${viewMode === 'grid' ? 'aspect-square' : 'h-14'}`} />
              ))}
            </div>
          ) : items.length === 0 ? (
            /* Empty state */
            <div className="py-28 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
              <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-bold text-gray-400">
                {search || typeFilter ? 'Tidak ada file yang cocok' : 'Media Library masih kosong'}
              </p>
              <p className="text-sm text-gray-400 mt-1 mb-5">
                {search || typeFilter ? 'Coba ubah filter atau kata pencarian' : 'Seret & lepas file ke sini atau klik tombol "Unggah File"'}
              </p>
              {!search && !typeFilter && (
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="gap-2 border-[#1b5e20] text-[#1b5e20] hover:bg-[#1b5e20] hover:text-white">
                  <Upload className="w-4 h-4" /> Unggah File Pertama
                </Button>
              )}
            </div>

          ) : viewMode === 'grid' ? (
            /* ─── GRID VIEW ─── */
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => selectItem(item)}
                  className={`group relative rounded-xl overflow-hidden border-2 transition-all duration-200 hover:shadow-lg aspect-square bg-gray-50 text-left ${
                    selected?.id === item.id
                      ? 'border-[#1b5e20] shadow-lg ring-2 ring-[#1b5e20]/20'
                      : 'border-transparent hover:border-[#1b5e20]/40'
                  }`}
                >
                  {item.type === 'image' ? (
                    <img
                      src={item.url} alt={item.alt || item.title || ''}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={e => { e.target.style.display = 'none'; e.target.nextSibling?.classList.remove('hidden'); }}
                    />
                  ) : null}
                  {/* Fallback / non-image */}
                  <div className={`w-full h-full flex flex-col items-center justify-center gap-1 p-2 ${item.type === 'image' ? 'hidden' : ''}`}>
                    <FileIcon type={item.type} className="w-10 h-10" />
                    <span className="text-[9px] uppercase font-bold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">{item.ext}</span>
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                    <p className="text-white text-[10px] font-medium leading-tight line-clamp-2">{item.title || item.originalName}</p>
                  </div>

                  {/* Selected badge */}
                  {selected?.id === item.id && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#1b5e20] shadow flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

          ) : (
            /* ─── LIST VIEW ─── */
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="w-14 px-4 py-3"></th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">File</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Tipe</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Ukuran</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Diunggah</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Oleh</th>
                    <th className="w-20 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map(item => (
                    <tr
                      key={item.id}
                      onClick={() => selectItem(item)}
                      className={`cursor-pointer transition-colors ${
                        selected?.id === item.id ? 'bg-[#1b5e20]/5' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        {item.type === 'image' ? (
                          <img src={item.url} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <FileIcon type={item.type} className="w-5 h-5" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-sm font-semibold text-[#1b5e20] truncate max-w-[180px]">{item.title || item.originalName}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[180px]">{item.originalName}</p>
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell"><TypeBadge type={item.type} ext={item.ext} /></td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 hidden md:table-cell">{formatSize(item.size)}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 hidden lg:table-cell">
                        {new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 hidden lg:table-cell truncate max-w-[100px]">{item.uploadedBy}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={e => { e.stopPropagation(); copyUrl(item.url); }}
                            className="p-1.5 text-gray-400 hover:text-[#1b5e20] hover:bg-[#1b5e20]/5 rounded-lg transition-colors" title="Salin URL">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={e => handleDelete(item.id, e)} disabled={deletingId === item.id}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
                            {deletingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-6">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="gap-1">
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let p;
                  if (totalPages <= 7) p = i + 1;
                  else if (page <= 4) p = i + 1;
                  else if (page >= totalPages - 3) p = totalPages - 6 + i;
                  else p = page - 3 + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                        p === page ? 'bg-[#1b5e20] text-white' : 'text-gray-500 hover:bg-gray-100'
                      }`}>{p}</button>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="gap-1">
                Berikutnya <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* ─── DETAIL PANEL ─── */}
        {selected && (
          <div className="w-72 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-4 max-h-[calc(100vh-100px)] overflow-y-auto">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="font-bold text-[#1b5e20] text-sm">Detail File</p>
              <button onClick={() => setSelected(null)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview */}
            <div className="p-4 border-b border-gray-50 bg-[#1b5e20]/5">
              {selected.type === 'image' ? (
                <img src={selected.url} alt={selected.alt || selected.title || ''}
                  className="w-full max-h-44 object-contain rounded-xl bg-white/80 shadow-sm" />
              ) : (
                <div className="w-full h-32 bg-white rounded-xl shadow-sm flex flex-col items-center justify-center gap-2">
                  <FileIcon type={selected.type} className="w-14 h-14" />
                  <TypeBadge type={selected.type} ext={selected.ext} />
                </div>
              )}
            </div>

            <div className="p-4 space-y-4">

              {/* Judul */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Judul</Label>
                  {!editingTitle && (
                    <button onClick={() => setEditingTitle(true)} className="text-[#1b5e20] hover:text-[#2e7d32] p-0.5">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {editingTitle ? (
                  <div className="flex gap-1.5">
                    <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                      className="h-8 text-xs flex-1" onKeyDown={e => e.key === 'Enter' && saveField('title')} autoFocus />
                    <button onClick={() => saveField('title')} disabled={savingField === 'title'}
                      className="p-2 bg-[#1b5e20] text-white rounded-lg hover:bg-[#2e7d32] transition-colors">
                      {savingField === 'title' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    </button>
                    <button onClick={() => setEditingTitle(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg border border-gray-200">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-gray-800 leading-snug">{selected.title || selected.originalName}</p>
                )}
              </div>

              {/* Alt Text (images only) */}
              {selected.type === 'image' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Alt Text</Label>
                      <p className="text-[10px] text-gray-400">Deskripsi untuk SEO & aksesibilitas</p>
                    </div>
                    {!editingAlt && (
                      <button onClick={() => setEditingAlt(true)} className="text-[#1b5e20] hover:text-[#2e7d32] p-0.5">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {editingAlt ? (
                    <div className="flex flex-col gap-1.5">
                      <textarea value={editForm.alt} onChange={e => setEditForm(f => ({ ...f, alt: e.target.value }))}
                        className="w-full h-16 text-xs p-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#1b5e20]/30"
                        placeholder="Contoh: Gedung Pengadilan Agama Penajam tampak depan" autoFocus />
                      <div className="flex gap-1.5">
                        <button onClick={() => saveField('alt')} disabled={savingField === 'alt'}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#1b5e20] text-white rounded-lg hover:bg-[#2e7d32] text-xs font-semibold">
                          {savingField === 'alt' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Simpan
                        </button>
                        <button onClick={() => setEditingAlt(false)}
                          className="flex-1 py-1.5 text-gray-500 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold">
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic bg-gray-50 rounded-lg px-3 py-2 leading-relaxed min-h-[36px]">
                      {selected.alt || <span className="text-gray-300">Belum diatur</span>}
                    </p>
                  )}
                </div>
              )}

              {/* File info */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-xs">
                <InfoRow label="Nama File" value={selected.originalName} mono />
                <InfoRow label="Tipe" value={<TypeBadge type={selected.type} ext={selected.ext} />} />
                {selected.size && <InfoRow label="Ukuran" value={formatSize(selected.size)} />}
                {selected.width && <InfoRow label="Dimensi" value={`${selected.width} × ${selected.height} px`} />}
                <InfoRow label="Diunggah" value={new Date(selected.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} />
                {selected.uploadedBy && <InfoRow label="Oleh" value={selected.uploadedBy} />}
              </div>

              {/* URL field + Copy */}
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">URL File</Label>
                <div className="flex gap-1.5">
                  <input readOnly value={selected.url}
                    className="flex-1 text-[10px] p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 truncate cursor-pointer"
                    onClick={e => e.target.select()} />
                  <button onClick={() => copyUrl(selected.url)}
                    className={`p-2 rounded-lg transition-all flex-shrink-0 ${
                      copied ? 'bg-green-500 text-white' : 'bg-[#1b5e20] hover:bg-[#2e7d32] text-white'
                    }`} title={copied ? 'Tersalin!' : 'Salin URL'}>
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {copied && <p className="text-[10px] text-green-600 mt-1 font-medium">✓ URL disalin ke clipboard!</p>}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <a href={selected.url} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-[#1b5e20] border border-[#1b5e20]/30 rounded-xl hover:bg-[#1b5e20]/5 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> Buka
                </a>
                <button onClick={() => handleDelete(selected.id)} disabled={deletingId === selected.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50">
                  {deletingId === selected.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Hapus
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-gray-400 flex-shrink-0">{label}:</span>
      <span className={`font-medium text-gray-700 text-right ${mono ? 'font-mono text-[10px]' : ''} ${typeof value === 'string' ? 'truncate max-w-[150px]' : ''}`}>
        {value}
      </span>
    </div>
  );
}
