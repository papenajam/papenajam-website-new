'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Search, CalendarDays, ChevronLeft, ChevronRight, Filter, Calendar, List, Clock } from 'lucide-react';

function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2 ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
      {msg}
    </div>
  );
}

const statusColors = {
  dijadwalkan: 'bg-blue-100 text-blue-700',
  selesai: 'bg-green-100 text-green-700',
  ditunda: 'bg-yellow-100 text-yellow-700',
  dibatalkan: 'bg-red-100 text-red-700',
};

const statusOptions = ['dijadwalkan','selesai','ditunda','dibatalkan'];
const jenisList = ['Cerai Gugat','Cerai Talak','Penetapan Ahli Waris','Itsbat Nikah','Hak Asuh Anak','Dispensasi Kawin','Pembagian Harta Gono Gini','Ekonomi Syariah'];

// Calendar view component
function CalendarView({ items, onEdit }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const agendaByDate = {};
  items.forEach(item => {
    const d = item.tanggalSidang?.split('T')[0];
    if (d) {
      if (!agendaByDate[d]) agendaByDate[d] = [];
      agendaByDate[d].push(item);
    }
  });

  const days = [];
  for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const today = new Date();
  const isToday = (d) => d && year === today.getFullYear() && month === today.getMonth() && d === today.getDate();
  const getDate = (d) => `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <button onClick={() => setCurrentMonth(new Date(year, month-1))} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="font-bold text-[#1e3a5f]">
          {currentMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
        </h3>
        <button onClick={() => setCurrentMonth(new Date(year, month+1))} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-7 mb-2">
          {['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            const dateStr = d ? getDate(d) : null;
            const hasAgenda = dateStr && agendaByDate[dateStr];
            return (
              <div
                key={i}
                className={`min-h-[60px] p-1 rounded-lg text-xs ${d ? 'hover:bg-gray-50 cursor-pointer' : ''} ${isToday(d) ? 'bg-[#1e3a5f]/5 ring-1 ring-[#1e3a5f]/30' : ''}`}
              >
                {d && (
                  <>
                    <span className={`font-semibold ${isToday(d) ? 'text-[#1e3a5f]' : 'text-gray-600'}`}>{d}</span>
                    {hasAgenda && (
                      <div className="mt-0.5 space-y-0.5">
                        {agendaByDate[dateStr].slice(0,2).map(a => (
                          <div
                            key={a.id}
                            onClick={() => onEdit(a)}
                            className={`text-[9px] px-1 py-0.5 rounded truncate cursor-pointer ${statusColors[a.status] || 'bg-gray-100'}`}
                          >
                            {a.waktuSidang} {a.nomorPerkara}
                          </div>
                        ))}
                        {agendaByDate[dateStr].length > 2 && (
                          <div className="text-[9px] text-gray-400">+{agendaByDate[dateStr].length - 2} lagi</div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AgendaSidangAdmin() {
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'calendar'
  const [modal, setModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({
    nomorPerkara: '', jenisPerkara: 'Cerai Gugat', tanggalSidang: '', waktuSidang: '',
    ruangSidang: '', hakim: '', panitera: '', status: 'dijadwalkan', keterangan: ''
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: 'success' });

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3000); };
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (search) params.set('search', search);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/agenda?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotalPages(data.totalPages || 1);
    } catch {} finally { setLoading(false); }
  }, [page, search, dateFrom, dateTo, statusFilter]);

  const fetchAllForCalendar = useCallback(async () => {
    const res = await fetch('/api/agenda?limit=200');
    const data = await res.json();
    setAllItems(data.items || []);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { if (viewMode === 'calendar') fetchAllForCalendar(); }, [viewMode, fetchAllForCalendar]);

  function openCreate() {
    const today = new Date().toISOString().split('T')[0];
    setForm({ nomorPerkara: '', jenisPerkara: 'Cerai Gugat', tanggalSidang: today, waktuSidang: '08:30', ruangSidang: 'Ruang Sidang I', hakim: '', panitera: 'Drs. Muhammad Nasir', status: 'dijadwalkan', keterangan: '' });
    setModal('create');
  }

  function openEdit(item) {
    setForm({
      nomorPerkara: item.nomorPerkara, jenisPerkara: item.jenisPerkara, tanggalSidang: item.tanggalSidang || '',
      waktuSidang: item.waktuSidang || '', ruangSidang: item.ruangSidang || '', hakim: item.hakim || '',
      panitera: item.panitera || '', status: item.status || 'dijadwalkan', keterangan: item.keterangan || ''
    });
    setModal({ type: 'edit', id: item.id });
  }

  async function handleSave() {
    if (!form.nomorPerkara || !form.tanggalSidang) { showToast('Nomor perkara dan tanggal wajib diisi', 'error'); return; }
    setSaving(true);
    try {
      const isEdit = modal?.type === 'edit';
      const res = await fetch(isEdit ? `/api/agenda/${modal.id}` : '/api/agenda', {
        method: isEdit ? 'PUT' : 'POST', headers: authHeaders, body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error();
      showToast(isEdit ? 'Agenda diperbarui' : 'Agenda ditambahkan');
      setModal(null); fetchItems(); fetchAllForCalendar();
    } catch { showToast('Terjadi kesalahan', 'error'); } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    try {
      await fetch(`/api/agenda/${id}`, { method: 'DELETE', headers: authHeaders });
      showToast('Agenda dihapus'); fetchItems(); fetchAllForCalendar();
    } catch { showToast('Gagal menghapus', 'error'); }
    setDeleteId(null);
  }

  const formatDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  return (
    <div>
      <Toast msg={toast.msg} type={toast.type} />
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Agenda Sidang</h1>
          <p className="text-gray-500 text-sm mt-0.5">Kelola jadwal persidangan</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'table' ? 'bg-white shadow text-[#1e3a5f]' : 'text-gray-500'}`}>
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('calendar')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'calendar' ? 'bg-white shadow text-[#1e3a5f]' : 'text-gray-500'}`}>
              <Calendar className="w-4 h-4" />
            </button>
          </div>
          <Button className="bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Tambah Agenda
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative col-span-2 md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Cari nomor perkara..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
          </div>
          <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} placeholder="Dari tanggal" />
          <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} placeholder="Sampai tanggal" />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="border border-gray-200 rounded-lg px-3 text-sm h-10">
            <option value="">Semua Status</option>
            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <CalendarView items={allItems} onEdit={openEdit} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nomor Perkara</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Tanggal & Waktu</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Ruang</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Hakim</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  [1,2,3,4].map(i => (
                    <tr key={i} className="animate-pulse">
                      {[1,2,3,4,5,6].map(j => <td key={j} className="px-4 py-4"><div className="h-4 bg-gray-200 rounded" /></td>)}
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Belum ada agenda sidang</p>
                  </td></tr>
                ) : items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-[#1e3a5f] text-sm">{item.nomorPerkara}</p>
                      <p className="text-gray-400 text-xs">{item.jenisPerkara}</p>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <p className="text-sm font-medium text-gray-700">{formatDate(item.tanggalSidang)}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" />{item.waktuSidang}</p>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell text-sm text-gray-600">{item.ruangSidang}</td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <p className="text-xs text-gray-600 max-w-[150px] line-clamp-2">{item.hakim}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[item.status] || 'bg-gray-100 text-gray-700'}`}>
                        {item.status}
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
      )}

      {/* Modal */}
      <Dialog open={!!modal} onOpenChange={v => !v && setModal(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{modal?.type === 'edit' ? 'Edit Agenda Sidang' : 'Tambah Agenda Sidang'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Nomor Perkara <span className="text-red-500">*</span></Label>
              <Input placeholder="0001/Pdt.G/2025/PA.Pnj" value={form.nomorPerkara} onChange={e => setForm(f => ({...f, nomorPerkara: e.target.value}))} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Jenis Perkara</Label>
              <select className="w-full p-2 border border-gray-200 rounded-lg text-sm" value={form.jenisPerkara} onChange={e => setForm(f => ({...f, jenisPerkara: e.target.value}))}>
                {jenisList.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Tanggal Sidang <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.tanggalSidang} onChange={e => setForm(f => ({...f, tanggalSidang: e.target.value}))} />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Waktu Sidang</Label>
                <Input type="time" value={form.waktuSidang} onChange={e => setForm(f => ({...f, waktuSidang: e.target.value}))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Ruang Sidang</Label>
                <select className="w-full p-2 border border-gray-200 rounded-lg text-sm" value={form.ruangSidang} onChange={e => setForm(f => ({...f, ruangSidang: e.target.value}))}>
                  <option value="Ruang Sidang I">Ruang Sidang I</option>
                  <option value="Ruang Sidang II">Ruang Sidang II</option>
                  <option value="Ruang Mediasi">Ruang Mediasi</option>
                  <option value="Ruang Sidang Utama">Ruang Sidang Utama</option>
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Status</Label>
                <select className="w-full p-2 border border-gray-200 rounded-lg text-sm" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                  {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Hakim</Label>
              <Input placeholder="Nama hakim" value={form.hakim} onChange={e => setForm(f => ({...f, hakim: e.target.value}))} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Panitera</Label>
              <Input placeholder="Nama panitera" value={form.panitera} onChange={e => setForm(f => ({...f, panitera: e.target.value}))} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Keterangan</Label>
              <textarea className="w-full min-h-[70px] p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 resize-none" value={form.keterangan} onChange={e => setForm(f => ({...f, keterangan: e.target.value}))} />
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
          <AlertDialogHeader><AlertDialogTitle>Hapus Agenda Sidang?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={() => handleDelete(deleteId)}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
