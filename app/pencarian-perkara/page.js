'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Scale, ArrowLeft, Calendar, CheckCircle, Clock, FileText, AlertCircle } from 'lucide-react';
import Link from 'next/link';

const statusColors = {
  selesai: 'bg-green-100 text-green-700 border-green-200',
  berjalan: 'bg-blue-100 text-blue-700 border-blue-200',
  terdaftar: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  dicabut: 'bg-red-100 text-red-700 border-red-200',
};

const statusIcons = {
  selesai: CheckCircle, berjalan: Clock, terdaftar: FileText, dicabut: AlertCircle
};

export default function PencarianPerkara() {
  const [nomorPerkara, setNomorPerkara] = useState('');
  const [namaPihak, setNamaPihak] = useState('');
  const [tahun, setTahun] = useState('');
  const [jenisPerkara, setJenisPerkara] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e, pg = 1) {
    if (e) e.preventDefault();
    if (!nomorPerkara && !namaPihak && !tahun && !jenisPerkara) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, limit: 10 });
      if (nomorPerkara) params.set('search', nomorPerkara);
      if (tahun) params.set('tahun', tahun);
      if (namaPihak) params.set('namaPihak', namaPihak);
      if (jenisPerkara) params.set('jenis', jenisPerkara);
      const res = await fetch(`/api/cases?${params}`);
      const data = await res.json();
      setResults(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
      setPage(pg);
      setSearched(true);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }

  const formatDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';

  const jenisList = ['Cerai Gugat','Cerai Talak','Penetapan Ahli Waris','Itsbat Nikah','Hak Asuh Anak','Dispensasi Kawin','Pembagian Harta Gono Gini','Ekonomi Syariah'];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1e3a5f] text-white">
        <div className="container mx-auto px-4 py-8">
          <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#c9a84c]/20 rounded-xl flex items-center justify-center">
              <Search className="w-5 h-5 text-[#c9a84c]" />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold">Pencarian Perkara</h1>
          </div>
          <p className="text-white/60">Cari informasi perkara di Pengadilan Agama Penajam</p>
        </div>
      </div>
      <div className="h-1 bg-gradient-to-r from-[#c9a84c] via-[#f5d98a] to-[#c9a84c]" />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Search Form */}
        <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="font-bold text-[#1e3a5f] mb-4 flex items-center gap-2">
            <Search className="w-5 h-5" /> Form Pencarian Perkara
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Nomor Perkara</Label>
              <Input
                placeholder="Contoh: 0001/Pdt.G"
                value={nomorPerkara}
                onChange={e => setNomorPerkara(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Nama Pihak (Pemohon/Termohon)</Label>
              <Input
                placeholder="Nama pemohon atau termohon"
                value={namaPihak}
                onChange={e => setNamaPihak(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Tahun Perkara</Label>
              <Input
                placeholder="Contoh: 2025"
                value={tahun}
                onChange={e => setTahun(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Jenis Perkara</Label>
              <select className="w-full p-2 border border-gray-200 rounded-lg text-sm h-10" value={jenisPerkara} onChange={e => setJenisPerkara(e.target.value)}>
                <option value="">Semua Jenis</option>
                {jenisList.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
          </div>
          <Button type="submit" className="w-full bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white font-bold py-3" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2 justify-center">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Mencari...
              </span>
            ) : (
              <span className="flex items-center gap-2 justify-center">
                <Search className="w-4 h-4" /> Cari Perkara
              </span>
            )}
          </Button>
        </form>

        {/* Results */}
        {searched && results !== null && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                {results.length === 0 ? 'Tidak ada perkara ditemukan' : `Ditemukan ${total} perkara`}
              </p>
            </div>

            {results.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                <Scale className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="text-gray-500 font-medium">Perkara tidak ditemukan</p>
                <p className="text-sm text-gray-400 mt-1">Coba dengan kata kunci yang berbeda</p>
              </div>
            ) : (
              <div className="space-y-4">
                {results.map(item => {
                  const StatusIcon = statusIcons[item.status] || Scale;
                  return (
                    <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-[#1e3a5f] text-lg">{item.nomorPerkara}</p>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${statusColors[item.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                              {item.status}
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm mb-3">{item.jenisPerkara}</p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div className="bg-gray-50 rounded-lg p-2.5">
                              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Pemohon/Penggugat</p>
                              <p className="text-gray-700 font-medium">{item.pemohon}</p>
                            </div>
                            {item.termohon && item.termohon !== '-' && (
                              <div className="bg-gray-50 rounded-lg p-2.5">
                                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Termohon/Tergugat</p>
                                <p className="text-gray-700 font-medium">{item.termohon}</p>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-4 mt-3 text-gray-400 text-xs">
                            {item.jadwalSidang && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Jadwal: {formatDate(item.jadwalSidang)}
                              </span>
                            )}
                            {item.ruangSidang && item.ruangSidang !== '-' && (
                              <span>{item.ruangSidang}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button variant="outline" disabled={page <= 1} onClick={() => handleSearch(null, page-1)}>Sebelumnya</Button>
                <span className="flex items-center px-4 text-sm text-gray-600">Halaman {page} dari {totalPages}</span>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => handleSearch(null, page+1)}>Selanjutnya</Button>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="bg-[#1e3a5f] text-white/50 text-center py-6 text-sm mt-12">
        © {new Date().getFullYear()} Pengadilan Agama Penajam — Mahkamah Agung RI
      </footer>
    </div>
  );
}
