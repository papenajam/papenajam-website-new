'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Download, Search, ArrowLeft, Eye, Calendar, Scale } from 'lucide-react';
import Link from 'next/link';

export default function PutusanPublic() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10, public: 'true' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/putusan?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {} finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const formatDate = (d) => d ? new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1b5e20] text-white">
        <div className="container mx-auto px-4 py-8">
          <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#d4a017]/20 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#d4a017]" />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold">Database Putusan</h1>
          </div>
          <p className="text-white/60">Kumpulan putusan Pengadilan Agama Penajam yang dapat diakses publik</p>
        </div>
      </div>
      <div className="h-1 bg-gradient-to-r from-[#d4a017] via-[#f5d98a] to-[#d4a017]" />

      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Cari nomor perkara atau jenis perkara..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
        </div>

        {!loading && <p className="text-sm text-gray-500 mb-4">Ditemukan {total} putusan</p>}

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl p-5 animate-pulse h-24" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center shadow-sm border border-gray-100">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="text-gray-500 font-medium">Tidak ada putusan ditemukan</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#1b5e20]/5 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Scale className="w-5 h-5 text-[#1b5e20]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold text-[#1b5e20] text-lg">{item.nomorPerkara}</p>
                        <p className="text-gray-600 text-sm">{item.jenisPerkara}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.filePutusan && (
                          <a
                            href={item.filePutusan}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 bg-[#1b5e20] hover:bg-[#2e7d32] text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> Unduh PDF
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-gray-500 text-xs">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Diputus: {formatDate(item.tanggalPutusan)}</span>
                      {item.hakim && <span>Hakim: {item.hakim.split(',')[0]}</span>}
                    </div>
                    {item.ringkasanPutusan && (
                      <p className="mt-3 text-gray-600 text-sm leading-relaxed line-clamp-3 bg-gray-50 p-3 rounded-lg">
                        {item.ringkasanPutusan}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p-1)}>Sebelumnya</Button>
            <span className="flex items-center px-4 text-sm text-gray-600">Halaman {page} dari {totalPages}</span>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p+1)}>Selanjutnya</Button>
          </div>
        )}
      </div>

      <footer className="bg-[#1b5e20] text-white/50 text-center py-6 text-sm mt-12">
        © {new Date().getFullYear()} Pengadilan Agama Penajam — Mahkamah Agung RI
      </footer>
    </div>
  );
}
