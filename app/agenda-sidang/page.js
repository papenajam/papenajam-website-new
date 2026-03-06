'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarDays, Clock, MapPin, ArrowLeft, Search, Filter, Home } from 'lucide-react';
import Link from 'next/link';

const statusColors = {
  dijadwalkan: 'bg-blue-100 text-blue-700 border-blue-200',
  selesai: 'bg-green-100 text-green-700 border-green-200',
  ditunda: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  dibatalkan: 'bg-red-100 text-red-700 border-red-200',
};

export default function AgendaSidangPublic() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15, public: 'true' });
      if (search) params.set('search', search);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`/api/agenda?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {} finally { setLoading(false); }
  }, [page, search, dateFrom, dateTo]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const formatDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '-';
  const formatDateShort = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  // Group by date
  const grouped = {};
  items.forEach(item => {
    const d = item.tanggalSidang?.split('T')[0] || item.tanggalSidang || 'Unknown';
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(item);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1e3a5f] text-white">
        <div className="container mx-auto px-4 py-8">
          <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#c9a84c]/20 rounded-xl flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-[#c9a84c]" />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold">Agenda Sidang</h1>
          </div>
          <p className="text-white/60">Jadwal persidangan Pengadilan Agama Penajam</p>
        </div>
      </div>

      {/* Gold line */}
      <div className="h-1 bg-gradient-to-r from-[#c9a84c] via-[#f5d98a] to-[#c9a84c]" />

      <div className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Cari nomor perkara..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <div>
              <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
            </div>
            <div>
              <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
            </div>
          </div>
        </div>

        {/* Results info */}
        {!loading && (
          <p className="text-sm text-gray-500 mb-4">Menampilkan {items.length} dari {total} jadwal sidang</p>
        )}

        {/* Results */}
        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-xl p-5 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-40 mb-4" />
                <div className="space-y-3">
                  {[1,2].map(j => <div key={j} className="h-16 bg-gray-100 rounded-lg" />)}
                </div>
              </div>
            ))}
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center shadow-sm border border-gray-100">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="text-gray-500 font-medium">Tidak ada jadwal sidang pada periode ini</p>
            <p className="text-gray-400 text-sm mt-1">Coba ubah rentang tanggal pencarian</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b)).map(([date, agendas]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-[#1e3a5f] text-white px-3 py-1.5 rounded-lg text-sm font-bold">
                    {formatDateShort(date)}
                  </div>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">{agendas.length} sidang</span>
                </div>
                <div className="space-y-3">
                  {agendas.map(item => (
                    <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center justify-center w-14 h-14 bg-[#1e3a5f]/5 rounded-xl flex-shrink-0">
                            <span className="text-[#1e3a5f] font-bold text-lg leading-none">{item.waktuSidang?.slice(0,5)}</span>
                            <span className="text-[#1e3a5f]/50 text-[10px]">WITA</span>
                          </div>
                          <div>
                            <p className="font-bold text-[#1e3a5f] text-base">{item.nomorPerkara}</p>
                            <p className="text-gray-600 text-sm">{item.jenisPerkara}</p>
                            <div className="flex items-center gap-3 mt-2 text-gray-400 text-xs">
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.ruangSidang}</span>
                              {item.hakim && <span className="flex items-center gap-1">Hakim: {item.hakim.split(',')[0]}</span>}
                            </div>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap flex-shrink-0 ${statusColors[item.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {item.status}
                        </span>
                      </div>
                      {item.keterangan && (
                        <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-500 italic">
                          Keterangan: {item.keterangan}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p-1)}>Sebelumnya</Button>
            <span className="flex items-center px-4 text-sm text-gray-600">Halaman {page} dari {totalPages}</span>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p+1)}>Selanjutnya</Button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-[#1e3a5f] text-white/50 text-center py-6 text-sm mt-12">
        © {new Date().getFullYear()} Pengadilan Agama Penajam — Mahkamah Agung RI
      </footer>
    </div>
  );
}
