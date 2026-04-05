'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Search, Upload, Check, Loader2,
  Image as ImageIcon, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * MediaPickerModal — reusable component
 * Props:
 *   isOpen    {boolean}  — whether modal is visible
 *   onClose   {fn}       — called when user dismisses
 *   onSelect  {fn(url, mediaItem)} — called when user confirms selection
 *   token     {string}   — admin JWT token for API calls
 *   accept    {string}   — 'image' (default) | 'all' | 'pdf'
 */
export default function MediaPickerModal({ isOpen, onClose, onSelect, token, accept = 'image' }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const searchTimer = useRef(null);

  const load = useCallback(async (pg = 1, srch = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, limit: 24, sortField: 'createdAt', sortDir: 'desc' });
      if (srch) params.set('search', srch);
      if (accept === 'image') params.set('type', 'image');
      else if (accept === 'pdf') params.set('type', 'pdf');
      const res = await fetch(`/api/media?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
      setPage(pg);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, accept]);

  // Reset and load when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelected(null);
      setSearch('');
      setPage(1);
      load(1, '');
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(1, search), 350);
    return () => clearTimeout(searchTimer.current);
  }, [search, isOpen]);

  // Upload new file
  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (res.ok) {
        setSearch('');
        await load(1, '');
      }
    } catch {}
    finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function confirmSelect() {
    if (selected) {
      onSelect(selected.url, selected);
      onClose();
    }
  }

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-[#1b5e20]">Pilih dari Media Library</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {total > 0 ? `${total} file tersedia` : 'Belum ada file'} · Klik gambar, lalu klik &ldquo;Gunakan Gambar&rdquo;
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ─── Toolbar ─── */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama file atau judul..."
              className="pl-9 h-9 text-sm"
            />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={accept === 'image' ? 'image/*' : accept === 'pdf' ? '.pdf' : '*'}
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="gap-1.5 flex-shrink-0 text-[#1b5e20] border-[#1b5e20]/30 hover:bg-[#1b5e20]/5"
          >
            {uploading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Mengunggah...' : 'Unggah Baru'}
          </Button>
        </div>

        {/* ─── Image Grid ─── */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="aspect-square bg-gray-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ImageIcon className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-semibold">
                {search ? 'Tidak ada gambar cocok' : 'Media Library masih kosong'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {search
                  ? 'Coba kata kunci lain'
                  : 'Klik "Unggah Baru" untuk menambahkan gambar pertama'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(s => s?.id === item.id ? null : item)}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-150 hover:shadow-md group focus:outline-none ${
                    selected?.id === item.id
                      ? 'border-[#1b5e20] shadow-lg ring-2 ring-[#1b5e20]/20 scale-[0.97]'
                      : 'border-transparent hover:border-[#1b5e20]/40'
                  }`}
                >
                  <img
                    src={item.url}
                    alt={item.alt || item.title || ''}
                    className="w-full h-full object-cover bg-gray-100"
                    loading="lazy"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-all" />
                  {/* Name tooltip on hover */}
                  <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform bg-gradient-to-t from-black/80 to-transparent pt-4 pb-1.5 px-1.5">
                    <p className="text-white text-[9px] leading-tight truncate">
                      {item.title || item.originalName}
                    </p>
                  </div>
                  {/* Selected checkmark */}
                  {selected?.id === item.id && (
                    <div className="absolute inset-0 bg-[#1b5e20]/15 flex items-center justify-center">
                      <div className="w-9 h-9 rounded-full bg-[#1b5e20] shadow-xl flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── Pagination ─── */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 py-3 border-t border-gray-50 bg-gray-50/30">
            <button
              onClick={() => load(page - 1, search)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-500">
              Halaman {page} dari {totalPages}
            </span>
            <button
              onClick={() => load(page + 1, search)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ─── Footer bar: selected preview + confirm ─── */}
        <div className="border-t border-gray-100 bg-white px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Selected preview */}
            {selected ? (
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <img
                  src={selected.url}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover border border-gray-200 flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1b5e20] truncate">
                    {selected.title || selected.originalName}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{selected.url}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 flex-1">
                ← Klik gambar untuk memilih
              </p>
            )}

            {/* Buttons */}
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" onClick={onClose} className="min-w-[80px]">
                Batal
              </Button>
              <Button
                onClick={confirmSelect}
                disabled={!selected}
                className="bg-[#1b5e20] hover:bg-[#2e7d32] text-white gap-2 min-w-[160px]"
              >
                <Check className="w-4 h-4" />
                Gunakan Gambar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
