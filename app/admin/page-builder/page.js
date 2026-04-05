'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, Trash2, GripVertical, Eye, Save, ArrowLeft, Settings2,
  Type, Image, LayoutGrid, BarChart2, Zap, AlignLeft, X, Check,
  ChevronDown, ChevronUp, Layers, Globe, FileText, Upload, ImageIcon
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Reusable compact image upload input for page builder settings
function ImageUploadSmall({ value, onChange, token, placeholder = 'https://...' }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
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
      alert('Upload gagal: ' + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="flex gap-1.5">
      <Input
        placeholder={placeholder}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="flex-1 text-xs"
      />
      <label className="cursor-pointer flex items-center justify-center w-8 h-9 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0 relative">
        {uploading ? (
          <div className="w-3.5 h-3.5 border-2 border-[#1b5e20] border-t-transparent rounded-full animate-spin" />
        ) : (
          <Upload className="w-3.5 h-3.5 text-gray-500" />
        )}
        <input ref={fileRef} type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onChange={handleFile} disabled={uploading} />
      </label>
    </div>
  );
}

function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div className={`fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2 ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
      {type === 'error' ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
      {msg}
    </div>
  );
}

const BLOCK_TYPES = [
  { type: 'hero',     label: 'Hero',       icon: Layers,     desc: 'Banner hero dengan gambar latar',  color: 'bg-blue-50 text-blue-700'   },
  { type: 'text',     label: 'Teks',       icon: Type,       desc: 'Blok teks bebas / rich content',   color: 'bg-gray-50 text-gray-700'   },
  { type: 'image',    label: 'Gambar',     icon: Image,      desc: 'Gambar dengan keterangan',          color: 'bg-green-50 text-green-700' },
  { type: 'cardgrid', label: 'Card Grid',  icon: LayoutGrid, desc: 'Grid kartu informasi',              color: 'bg-purple-50 text-purple-700'},
  { type: 'stats',    label: 'Statistik',  icon: BarChart2,  desc: 'Angka statistik menarik',           color: 'bg-amber-50 text-amber-700' },
  { type: 'cta',      label: 'CTA',        icon: Zap,        desc: 'Call-to-action button',             color: 'bg-red-50 text-red-700'     },
  { type: 'gallery',  label: 'Galeri',     icon: Image,      desc: 'Grid galeri foto',                  color: 'bg-teal-50 text-teal-700'   },
];

// ─── Template Definitions ─────────────────────────────────────────────────────
const PAGE_TEMPLATES = [
  {
    id: 'blank',
    name: 'Halaman Kosong',
    desc: 'Mulai dari nol tanpa blok apapun',
    icon: '📄',
    color: 'bg-gray-50 border-gray-200',
    category: 'Dasar',
    blocks: [],
  },
  {
    id: 'profil-lembaga',
    name: 'Profil Lembaga',
    desc: 'Halaman profil lengkap dengan visi, misi, dan statistik',
    icon: '🏛️',
    color: 'bg-green-50 border-green-200',
    category: 'Informasi',
    blocks: [
      { type: 'hero', settings: { title: 'Profil Pengadilan Agama Penajam', subtitle: 'Lembaga peradilan yang bertugas memberikan keadilan bagi masyarakat Muslim di Kabupaten Penajam Paser Utara', backgroundImage: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1400&q=80', buttonText: 'Lihat Layanan', buttonLink: '/#layanan' } },
      { type: 'text', settings: { content: '<h2>Tentang Kami</h2><p>Pengadilan Agama Penajam adalah pengadilan tingkat pertama yang bertugas memeriksa, memutus, dan menyelesaikan perkara di bidang perkawinan, kewarisan, wasiat, hibah, wakaf, zakat, infaq, shadaqah, dan ekonomi syariah untuk masyarakat Muslim di Kabupaten Penajam Paser Utara.</p><p>Berdiri sejak tahun 1985, Pengadilan Agama Penajam telah melayani ribuan masyarakat dengan menjunjung tinggi prinsip keadilan, kepastian hukum, dan kemanfaatan.</p>' } },
      { type: 'cardgrid', settings: { title: 'Nilai-Nilai Kami', items: [{ id: 'v1', icon: '⚖️', title: 'Keadilan', description: 'Memberikan putusan yang adil dan tidak memihak' }, { id: 'v2', icon: '🔍', title: 'Transparansi', description: 'Pelayanan terbuka dan dapat diakses publik' }, { id: 'v3', icon: '🤝', title: 'Integritas', description: 'Menjunjung tinggi kejujuran dalam setiap tindakan' }] } },
      { type: 'stats', settings: { items: [{ id: 's1', number: '500+', label: 'Perkara Diselesaikan' }, { id: 's2', number: '8', label: 'Hakim Profesional' }, { id: 's3', number: '20+', label: 'Tahun Pengalaman' }, { id: 's4', number: '15.000+', label: 'Masyarakat Dilayani' }] } },
      { type: 'text', settings: { content: '<h2>Visi</h2><p><em>"Terwujudnya Pengadilan Agama Penajam yang Agung"</em></p><h2>Misi</h2><ul><li>Menjaga kemandirian badan peradilan</li><li>Memberikan pelayanan hukum yang berkeadilan kepada pencari keadilan</li><li>Meningkatkan kualitas kepemimpinan badan peradilan</li><li>Meningkatkan kredibilitas dan transparansi badan peradilan</li></ul>' } },
      { type: 'cta', settings: { title: 'Siap Melayani Anda', subtitle: 'Hubungi kami untuk informasi lebih lanjut atau kunjungi langsung kantor kami', buttonText: 'Hubungi Kami', buttonLink: '/#kontak', bgColor: '#1b5e20' } },
    ],
  },
  {
    id: 'layanan-detail',
    name: 'Halaman Layanan',
    desc: 'Menampilkan detail layanan dengan kartu dan prosedur',
    icon: '⚙️',
    color: 'bg-blue-50 border-blue-200',
    category: 'Layanan',
    blocks: [
      { type: 'hero', settings: { title: 'Layanan Kami', subtitle: 'Berbagai layanan kepaniteraan tersedia untuk masyarakat Kabupaten Penajam Paser Utara', backgroundImage: '', buttonText: 'Daftar Sekarang', buttonLink: '/pengaduan' } },
      { type: 'cardgrid', settings: { title: 'Jenis Layanan', items: [{ id: 'l1', icon: '📋', title: 'Pendaftaran Perkara', description: 'Pendaftaran perkara cerai gugat, cerai talak, waris, dan lainnya' }, { id: 'l2', icon: '📅', title: 'Jadwal Sidang', description: 'Informasi jadwal sidang yang transparan dan akuntabel' }, { id: 'l3', icon: '💰', title: 'Biaya Perkara', description: 'Estimasi biaya panjar perkara sesuai ketentuan' }, { id: 'l4', icon: '📦', title: 'Pengambilan Produk', description: 'Salinan putusan, akta cerai, dan produk pengadilan lainnya' }, { id: 'l5', icon: '🛡️', title: 'Pos Bantuan Hukum', description: 'Layanan konsultasi hukum gratis bagi masyarakat tidak mampu' }, { id: 'l6', icon: '💻', title: 'e-Court', description: 'Pendaftaran dan persidangan secara elektronik' }] } },
      { type: 'text', settings: { content: '<h2>Prosedur Pendaftaran Perkara</h2><ol><li><strong>Datang ke Meja Pendaftaran</strong> — Serahkan berkas persyaratan lengkap ke petugas meja I</li><li><strong>Pembayaran Panjar Biaya</strong> — Bayar panjar biaya perkara sesuai estimasi yang diberikan</li><li><strong>Penomoran Perkara</strong> — Perkara dicatat dan diberi nomor register</li><li><strong>Penetapan Majelis Hakim</strong> — Ketua Pengadilan menetapkan majelis hakim</li><li><strong>Pelaksanaan Sidang</strong> — Proses persidangan sesuai jadwal yang ditetapkan</li></ol>' } },
      { type: 'cta', settings: { title: 'Butuh Bantuan?', subtitle: 'Konsultasikan kebutuhan hukum Anda dengan petugas kami atau kunjungi Pos Bantuan Hukum', buttonText: 'Hubungi Kami', buttonLink: '/pengaduan', bgColor: '#1b5e20' } },
    ],
  },
  {
    id: 'persyaratan-perkara',
    name: 'Persyaratan Perkara',
    desc: 'Daftar persyaratan pendaftaran berbagai jenis perkara',
    icon: '📋',
    color: 'bg-amber-50 border-amber-200',
    category: 'Layanan',
    blocks: [
      { type: 'hero', settings: { title: 'Persyaratan Pendaftaran Perkara', subtitle: 'Siapkan dokumen-dokumen berikut sebelum mendaftar perkara di Pengadilan Agama Penajam', backgroundImage: '', buttonText: 'Unduh Formulir', buttonLink: '/dokumen' } },
      { type: 'text', settings: { content: '<h2>Cerai Gugat</h2><p>Persyaratan yang harus disiapkan:</p><ul><li>Surat Gugatan (6 rangkap)</li><li>Fotokopi KTP Penggugat (2 lembar)</li><li>Fotokopi KTP Tergugat (2 lembar)</li><li>Fotokopi Buku Nikah / Akta Perkawinan (2 lembar)</li><li>Fotokopi Kartu Keluarga (2 lembar)</li><li>Akta Kelahiran anak (bila ada, 2 lembar)</li><li>Materai Rp 10.000 (2 lembar)</li></ul><h2>Cerai Talak</h2><ul><li>Surat Permohonan (6 rangkap)</li><li>Fotokopi KTP Pemohon (2 lembar)</li><li>Fotokopi KTP Termohon (2 lembar)</li><li>Fotokopi Buku Nikah / Akta Perkawinan (2 lembar)</li><li>Fotokopi Kartu Keluarga (2 lembar)</li><li>Materai Rp 10.000 (2 lembar)</li></ul>' } },
      { type: 'text', settings: { content: '<h2>Itsbat Nikah</h2><ul><li>Surat Permohonan (6 rangkap)</li><li>Fotokopi KTP Pemohon I dan II</li><li>Surat Keterangan Nikah dari Kepala Desa/Lurah</li><li>Fotokopi Kartu Keluarga</li><li>Materai Rp 10.000</li></ul><h2>Penetapan Ahli Waris</h2><ul><li>Surat Permohonan (6 rangkap)</li><li>Fotokopi KTP seluruh Pemohon</li><li>Surat Kematian pewaris dari Kelurahan/Desa</li><li>Fotokopi Buku Nikah/Akta Perkawinan</li><li>Fotokopi Kartu Keluarga</li><li>Materai Rp 10.000</li></ul>' } },
      { type: 'cta', settings: { title: 'Perlu Bantuan Melengkapi Berkas?', subtitle: 'Datang ke Pos Bantuan Hukum (Posbakum) kami untuk mendapatkan bimbingan gratis', buttonText: 'Kunjungi Posbakum', buttonLink: '/pengaduan', bgColor: '#1b5e20' } },
    ],
  },
  {
    id: 'sejarah-lembaga',
    name: 'Sejarah Lembaga',
    desc: 'Halaman sejarah dan perkembangan lembaga',
    icon: '📜',
    color: 'bg-amber-50 border-amber-200',
    category: 'Informasi',
    blocks: [
      { type: 'hero', settings: { title: 'Sejarah Pengadilan Agama Penajam', subtitle: 'Perjalanan panjang mengabdi dan memberikan keadilan bagi masyarakat', backgroundImage: '', buttonText: 'Profil Lengkap', buttonLink: '/p/profil-lembaga' } },
      { type: 'text', settings: { content: '<h2>Latar Belakang Pendirian</h2><p>Pengadilan Agama Penajam didirikan berdasarkan Keputusan Presiden Republik Indonesia sebagai bagian dari sistem peradilan agama di Indonesia yang bernaung di bawah Mahkamah Agung Republik Indonesia.</p><p>Keberadaan Pengadilan Agama di Kabupaten Penajam Paser Utara merupakan wujud nyata komitmen negara dalam memberikan akses keadilan bagi seluruh lapisan masyarakat, khususnya masyarakat Muslim yang membutuhkan penyelesaian sengketa berdasarkan hukum Islam.</p>' } },
      { type: 'stats', settings: { items: [{ id: 'h1', number: '1985', label: 'Tahun Berdiri' }, { id: 'h2', number: '40+', label: 'Tahun Mengabdi' }, { id: 'h3', number: '10.000+', label: 'Perkara Diselesaikan' }] } },
      { type: 'text', settings: { content: '<h2>Perkembangan & Pencapaian</h2><p>Selama lebih dari empat dekade, Pengadilan Agama Penajam terus berkembang baik dari sisi sumber daya manusia, infrastruktur, maupun kualitas layanan. Beberapa pencapaian penting antara lain:</p><ul><li>Implementasi e-Court untuk pendaftaran perkara secara elektronik</li><li>Raih predikat WBK (Wilayah Bebas dari Korupsi) dari Kemenpan RB</li><li>Program sidang keliling untuk menjangkau masyarakat terpencil</li><li>Kerjasama dengan berbagai lembaga untuk layanan Posbakum</li></ul>' } },
      { type: 'image', settings: { src: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&q=80', caption: 'Gedung Pengadilan Agama Penajam', alignment: 'center' } },
    ],
  },
  {
    id: 'struktur-organisasi',
    name: 'Struktur Organisasi',
    desc: 'Halaman susunan pejabat dan struktur organisasi',
    icon: '👥',
    color: 'bg-violet-50 border-violet-200',
    category: 'Informasi',
    blocks: [
      { type: 'hero', settings: { title: 'Struktur Organisasi', subtitle: 'Susunan pejabat dan pegawai Pengadilan Agama Penajam', backgroundImage: '', buttonText: 'Profil Lembaga', buttonLink: '/p/profil-lembaga' } },
      { type: 'cardgrid', settings: { title: 'Pimpinan', items: [{ id: 'p1', icon: '👨‍⚖️', title: 'Ketua Pengadilan', description: 'Bertanggung jawab atas jalannya organisasi dan teknis peradilan' }, { id: 'p2', icon: '👩‍⚖️', title: 'Wakil Ketua', description: 'Membantu Ketua dalam melaksanakan tugas dan fungsi pengadilan' }, { id: 'p3', icon: '⚖️', title: 'Hakim', description: 'Memeriksa dan memutus perkara yang diajukan oleh para pihak' }] } },
      { type: 'cardgrid', settings: { title: 'Kepaniteraan & Kesekretariatan', items: [{ id: 'k1', icon: '📋', title: 'Panitera', description: 'Bertanggung jawab atas administrasi perkara' }, { id: 'k2', icon: '📁', title: 'Sekretaris', description: 'Bertanggung jawab atas administrasi umum dan keuangan' }, { id: 'k3', icon: '🗄️', title: 'Panitera Muda', description: 'Membantu Panitera dalam administrasi perkara' }] } },
      { type: 'text', settings: { content: '<h2>Tugas dan Fungsi</h2><p>Pengadilan Agama Penajam sebagai salah satu pelaksana kekuasaan kehakiman bagi masyarakat pencari keadilan yang beragama Islam mempunyai tugas dan kewenangan sebagaimana diatur dalam Pasal 49 UU No. 3 Tahun 2006 tentang Peradilan Agama, yakni memeriksa, memutus, dan menyelesaikan perkara di bidang:</p><ul><li>Perkawinan</li><li>Waris</li><li>Wasiat</li><li>Hibah</li><li>Wakaf</li><li>Zakat, Infaq, dan Shadaqah</li><li>Ekonomi Syariah</li></ul>' } },
    ],
  },
  {
    id: 'program-kerja',
    name: 'Program Kerja',
    desc: 'Rencana dan program kerja tahunan lembaga',
    icon: '🎯',
    color: 'bg-orange-50 border-orange-200',
    category: 'Informasi',
    blocks: [
      { type: 'hero', settings: { title: `Program Kerja ${new Date().getFullYear()}`, subtitle: 'Rencana strategis dan program unggulan Pengadilan Agama Penajam', backgroundImage: '', buttonText: 'Unduh Laporan', buttonLink: '/dokumen' } },
      { type: 'cardgrid', settings: { title: 'Program Unggulan', items: [{ id: 'pr1', icon: '⚡', title: 'Peningkatan Kualitas Putusan', description: 'Pelatihan dan pengembangan SDM hakim untuk kualitas putusan yang lebih baik' }, { id: 'pr2', icon: '💻', title: 'Digitalisasi Layanan', description: 'Implementasi penuh e-Court dan sistem informasi perkara berbasis digital' }, { id: 'pr3', icon: '🤝', title: 'Sidang Keliling', description: 'Menjangkau masyarakat di wilayah terpencil yang sulit mengakses pengadilan' }, { id: 'pr4', icon: '📚', title: 'Penyuluhan Hukum', description: 'Sosialisasi hukum kepada masyarakat di seluruh kecamatan' }] } },
      { type: 'stats', settings: { items: [{ id: 'pk1', number: '95%', label: 'Target Penyelesaian' }, { id: 'pk2', number: '4', label: 'Kali Sidang Keliling' }, { id: 'pk3', number: '12', label: 'Program Penyuluhan' }] } },
      { type: 'text', settings: { content: '<h2>Rencana Strategis</h2><p>Dalam rangka mewujudkan pengadilan yang agung, Pengadilan Agama Penajam menetapkan beberapa sasaran strategis:</p><ol><li><strong>Meningkatnya penyelesaian perkara</strong> — Target penyelesaian perkara tepat waktu mencapai 95%</li><li><strong>Meningkatnya akseptabilitas putusan hakim</strong> — Upaya kasasi/banding kurang dari 5%</li><li><strong>Meningkatnya efektifitas pengelolaan penyelesaian perkara</strong> — Implementasi SIPP 100%</li><li><strong>Meningkatnya aksesibilitas masyarakat terhadap peradilan</strong> — Minimal 4 kegiatan sidang keliling</li></ol>' } },
      { type: 'cta', settings: { title: 'Informasi Lebih Lanjut', subtitle: 'Hubungi bagian kesekretariatan untuk informasi program kerja dan laporan kinerja', buttonText: 'Hubungi Kami', buttonLink: '/pengaduan', bgColor: '#1b5e20' } },
    ],
  },
  {
    id: 'artikel-berita',
    name: 'Artikel / Berita',
    desc: 'Template artikel atau berita dengan gambar dan konten',
    icon: '📰',
    color: 'bg-cyan-50 border-cyan-200',
    category: 'Konten',
    blocks: [
      { type: 'hero', settings: { title: 'Judul Artikel atau Berita', subtitle: 'Keterangan singkat tentang isi artikel ini', backgroundImage: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1400&q=80', buttonText: 'Kembali ke Berita', buttonLink: '/#berita' } },
      { type: 'text', settings: { content: '<p><strong>Penajam, 2024</strong> — Tulis paragraf pembuka artikel Anda di sini. Paragraf ini sebaiknya menjawab pertanyaan siapa, apa, kapan, di mana, mengapa, dan bagaimana.</p><p>Lanjutkan dengan paragraf isi yang lebih detail. Anda bisa menambahkan kutipan, data, atau penjelasan lebih mendalam di sini.</p><blockquote>"Kutipan atau pernyataan penting bisa ditempatkan di sini." — Nama Narasumber</blockquote><p>Tutup artikel dengan kesimpulan atau informasi kontak untuk pertanyaan lebih lanjut.</p>' } },
      { type: 'image', settings: { src: 'https://images.unsplash.com/photo-1575505586569-646b2ca898fc?w=1200&q=80', caption: 'Keterangan foto: deskripsi singkat tentang foto ini', alignment: 'center' } },
      { type: 'text', settings: { content: '<h3>Informasi Lebih Lanjut</h3><p>Untuk informasi lebih lanjut mengenai kegiatan ini, masyarakat dapat menghubungi Humas Pengadilan Agama Penajam melalui:</p><ul><li>Telepon: (0542) 7211234</li><li>Email: pa.penajam@gmail.com</li><li>Atau langsung datang ke kantor pada jam kerja</li></ul>' } },
      { type: 'cta', settings: { title: 'Tetap Terhubung', subtitle: 'Ikuti perkembangan kegiatan kami melalui media sosial dan website resmi', buttonText: 'Lihat Berita Lainnya', buttonLink: '/#berita', bgColor: '#1b5e20' } },
    ],
  },
  {
    id: 'maklumat-layanan',
    name: 'Maklumat Pelayanan',
    desc: 'Halaman maklumat standar pelayanan publik',
    icon: '📢',
    color: 'bg-rose-50 border-rose-200',
    category: 'Layanan',
    blocks: [
      { type: 'hero', settings: { title: 'Maklumat Pelayanan', subtitle: 'Pengadilan Agama Penajam berkomitmen memberikan pelayanan terbaik kepada masyarakat', backgroundImage: '', buttonText: 'Lihat Standar Layanan', buttonLink: '/dokumen' } },
      { type: 'text', settings: { content: '<h2>Maklumat Pelayanan Pengadilan Agama Penajam</h2><p>Dengan ini, kami menyatakan sanggup menyelenggarakan pelayanan sesuai standar pelayanan yang telah ditetapkan dan apabila tidak menepati janji ini, kami siap menerima sanksi sesuai peraturan perundang-undangan yang berlaku.</p><h3>Standar Pelayanan Kami:</h3><ul><li>✅ Melayani dengan <strong>ramah, sopan, dan santun</strong></li><li>✅ Memberikan informasi dengan <strong>jelas dan benar</strong></li><li>✅ Menyelesaikan perkara secara <strong>tepat waktu</strong></li><li>✅ Tidak memungut biaya di luar ketentuan</li><li>✅ Memberikan pelayanan tanpa <strong>diskriminasi</strong></li></ul>' } },
      { type: 'cardgrid', settings: { title: 'Komitmen Pelayanan', items: [{ id: 'm1', icon: '🤝', title: 'Ramah & Sopan', description: 'Melayani dengan sikap yang ramah, sopan, dan penuh empati' }, { id: 'm2', icon: '⏱️', title: 'Tepat Waktu', description: 'Menyelesaikan perkara sesuai dengan standar waktu yang ditetapkan' }, { id: 'm3', icon: '💰', title: 'Biaya Sesuai Ketentuan', description: 'Tidak memungut biaya apapun di luar yang telah ditetapkan' }] } },
      { type: 'text', settings: { content: '<h2>Saluran Pengaduan</h2><p>Apabila pelayanan kami tidak sesuai dengan standar, Anda dapat menyampaikan pengaduan melalui:</p><ul><li>📞 <strong>Telepon:</strong> (0542) 7211234</li><li>✉️ <strong>Email:</strong> pa.penajam@gmail.com</li><li>📱 <strong>Form Pengaduan Online:</strong> melalui website ini</li><li>📮 <strong>Kotak Saran:</strong> tersedia di lobi pengadilan</li></ul>' } },
      { type: 'cta', settings: { title: 'Sampaikan Masukan Anda', subtitle: 'Masukan dan saran Anda sangat berharga bagi peningkatan pelayanan kami', buttonText: 'Kirim Pengaduan', buttonLink: '/pengaduan', bgColor: '#1b5e20' } },
    ],
  },
  {
    id: 'landing-promo',
    name: 'Landing Page Promosi',
    desc: 'Halaman promosi layanan dengan tampilan menarik',
    icon: '🚀',
    color: 'bg-indigo-50 border-indigo-200',
    category: 'Konten',
    blocks: [
      { type: 'hero', settings: { title: 'Layanan e-Court Tersedia!', subtitle: 'Daftarkan perkara Anda secara online, kapan saja dan di mana saja tanpa harus antri', backgroundImage: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1400&q=80', buttonText: 'Daftar e-Court Sekarang', buttonLink: 'https://ecourt.mahkamahagung.go.id' } },
      { type: 'cardgrid', settings: { title: 'Keunggulan e-Court', items: [{ id: 'e1', icon: '🏠', title: 'Dari Rumah', description: 'Daftar perkara tanpa perlu datang ke pengadilan' }, { id: 'e2', icon: '⚡', title: 'Cepat & Mudah', description: 'Proses pendaftaran online yang simpel dan efisien' }, { id: 'e3', icon: '💳', title: 'Bayar Online', description: 'Pembayaran panjar biaya perkara melalui virtual account bank' }, { id: 'e4', icon: '📱', title: 'Akses Mobile', description: 'Dapat diakses melalui smartphone kapanpun dan dimanapun' }] } },
      { type: 'stats', settings: { items: [{ id: 'es1', number: '24/7', label: 'Layanan Tersedia' }, { id: 'es2', number: '5 Menit', label: 'Waktu Pendaftaran' }, { id: 'es3', number: '0', label: 'Biaya Tambahan' }] } },
      { type: 'text', settings: { content: '<h2>Cara Daftar e-Court</h2><ol><li>Kunjungi <a href="https://ecourt.mahkamahagung.go.id" target="_blank">ecourt.mahkamahagung.go.id</a></li><li>Buat akun pengguna terdaftar (advokat) atau pengguna lain (perorangan)</li><li>Pilih pengadilan tujuan dan isi data perkara</li><li>Upload berkas pendaftaran</li><li>Lakukan pembayaran panjar biaya melalui virtual account</li><li>Tunggu konfirmasi dari pengadilan</li></ol>' } },
      { type: 'cta', settings: { title: 'Butuh Panduan?', subtitle: 'Hubungi petugas meja informasi kami untuk bantuan pendaftaran e-Court', buttonText: 'Hubungi Kami', buttonLink: '/pengaduan', bgColor: '#1b5e20' } },
    ],
  },
];

const defaultSettings = {
  hero: { title: 'Judul Halaman', subtitle: 'Sub-judul atau deskripsi singkat halaman ini.', backgroundImage: '', buttonText: 'Selengkapnya', buttonLink: '#' },
  text: { content: '<p>Tulis konten Anda di sini. Klik untuk mengedit.</p>' },
  image: { src: '', caption: '', alignment: 'center' },
  cardgrid: { title: 'Layanan Kami', items: [{ id: uuidv4(), icon: '⚖️', title: 'Layanan 1', description: 'Deskripsi layanan pertama.' },{ id: uuidv4(), icon: '📋', title: 'Layanan 2', description: 'Deskripsi layanan kedua.' },{ id: uuidv4(), icon: '🏛️', title: 'Layanan 3', description: 'Deskripsi layanan ketiga.' }] },
  stats: { items: [{ id: uuidv4(), number: '500+', label: 'Perkara' },{ id: uuidv4(), number: '20', label: 'Tahun' },{ id: uuidv4(), number: '100%', label: 'Komitmen' }] },
  cta: { title: 'Hubungi Kami', subtitle: 'Kami siap membantu Anda.', buttonText: 'Hubungi Sekarang', buttonLink: '/kontak', bgColor: '#1b5e20' },
  gallery: { images: [], columns: 3 },
};

// Block renderer for preview
function BlockPreview({ block }) {
  const s = block.settings || {};
  switch (block.type) {
    case 'hero':
      return (
        <div className="relative rounded-xl overflow-hidden min-h-[200px] flex items-center justify-center" style={{ background: s.backgroundImage ? `linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)), url(${s.backgroundImage}) center/cover` : '#1b5e20' }}>
          <div className="text-center text-white p-8">
            <h1 className="text-2xl md:text-3xl font-extrabold mb-2">{s.title || 'Judul'}</h1>
            <p className="text-white/80 mb-4">{s.subtitle}</p>
            {s.buttonText && <span className="bg-[#d4a017] text-white px-5 py-2 rounded-lg text-sm font-bold inline-block">{s.buttonText}</span>}
          </div>
        </div>
      );
    case 'text':
      return (
        <div className="prose prose-sm max-w-none p-4 bg-white rounded-xl border border-gray-100" dangerouslySetInnerHTML={{ __html: s.content || '' }} />
      );
    case 'image':
      return (
        <div className={`flex flex-col items-${s.alignment || 'center'} gap-2 p-4`}>
          {s.src ? <img src={s.src} alt={s.caption} className="max-w-full rounded-xl max-h-60 object-cover" /> : <div className="w-full h-32 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm">Belum ada gambar</div>}
          {s.caption && <p className="text-gray-500 text-xs italic">{s.caption}</p>}
        </div>
      );
    case 'cardgrid':
      return (
        <div className="p-4 bg-gray-50 rounded-xl">
          {s.title && <h2 className="text-lg font-bold text-[#1b5e20] text-center mb-4">{s.title}</h2>}
          <div className="grid grid-cols-3 gap-3">
            {(s.items || []).map(item => (
              <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm text-center">
                <div className="text-2xl mb-2">{item.icon}</div>
                <h3 className="font-bold text-[#1b5e20] text-sm mb-1">{item.title}</h3>
                <p className="text-gray-500 text-xs">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case 'stats':
      return (
        <div className="grid grid-cols-3 gap-3 p-4 bg-[#1b5e20] rounded-xl">
          {(s.items || []).map(item => (
            <div key={item.id} className="text-center">
              <div className="text-2xl font-extrabold text-[#d4a017]">{item.number}</div>
              <div className="text-white/70 text-xs">{item.label}</div>
            </div>
          ))}
        </div>
      );
    case 'cta':
      return (
        <div className="p-8 rounded-xl text-center text-white" style={{ background: s.bgColor || '#1b5e20' }}>
          <h2 className="text-xl font-bold mb-2">{s.title}</h2>
          <p className="text-white/80 mb-4 text-sm">{s.subtitle}</p>
          {s.buttonText && <span className="bg-[#d4a017] text-white px-5 py-2 rounded-lg text-sm font-bold inline-block">{s.buttonText}</span>}
        </div>
      );
    case 'gallery':
      return (
        <div className="p-4">
          {(s.images || []).length === 0 ? (
            <div className="h-24 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm">Belum ada foto di galeri</div>
          ) : (
            <div className={`grid grid-cols-${s.columns || 3} gap-2`}>
              {s.images.map((img, i) => <img key={i} src={img} alt="" className="w-full h-24 object-cover rounded-lg" />)}
            </div>
          )}
        </div>
      );
    default:
      return <div className="p-4 bg-gray-100 rounded-xl text-gray-500 text-sm text-center">Blok tidak dikenal</div>;
  }
}

// Settings panel per block type
function BlockSettingsPanel({ block, onChange, token }) {
  const s = block.settings || {};
  const upd = (key, val) => onChange({ ...block, settings: { ...s, [key]: val } });
  const updItem = (key, i, field, val) => {
    const arr = [...(s[key] || [])];
    arr[i] = { ...arr[i], [field]: val };
    onChange({ ...block, settings: { ...s, [key]: arr } });
  };
  const addItem = (key, def) => onChange({ ...block, settings: { ...s, [key]: [...(s[key] || []), { id: uuidv4(), ...def }] } });
  const removeItem = (key, i) => { const arr = [...(s[key] || [])]; arr.splice(i, 1); onChange({ ...block, settings: { ...s, [key]: arr } }); };

  switch (block.type) {
    case 'hero':
      return (
        <div className="space-y-3">
          <div><Label className="text-xs font-semibold mb-1 block">Judul</Label><Input value={s.title || ''} onChange={e => upd('title', e.target.value)} /></div>
          <div><Label className="text-xs font-semibold mb-1 block">Sub-judul</Label><textarea className="w-full p-2 border border-gray-200 rounded-lg text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-[#1b5e20]/20" value={s.subtitle || ''} onChange={e => upd('subtitle', e.target.value)} /></div>
          <div>
            <Label className="text-xs font-semibold mb-1 block">Gambar Latar <span className="font-normal text-gray-400">(URL atau Upload)</span></Label>
            <ImageUploadSmall value={s.backgroundImage || ''} onChange={v => upd('backgroundImage', v)} token={token} placeholder="https://... atau upload" />
            {s.backgroundImage && <img src={s.backgroundImage} alt="bg preview" className="mt-1.5 w-full h-16 object-cover rounded-lg opacity-80" onError={e=>e.target.style.display='none'} />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs font-semibold mb-1 block">Teks Button</Label><Input value={s.buttonText || ''} onChange={e => upd('buttonText', e.target.value)} /></div>
            <div><Label className="text-xs font-semibold mb-1 block">Link Button</Label><Input value={s.buttonLink || ''} onChange={e => upd('buttonLink', e.target.value)} /></div>
          </div>
        </div>
      );
    case 'text':
      return (
        <div>
          <Label className="text-xs font-semibold mb-1 block">Konten HTML</Label>
          <textarea
            className="w-full p-2 border border-gray-200 rounded-lg text-sm h-48 resize-none font-mono focus:outline-none focus:ring-2 focus:ring-[#1b5e20]/20"
            value={s.content || ''}
            onChange={e => upd('content', e.target.value)}
            placeholder="<p>Konten HTML di sini...</p>"
          />
          <p className="text-xs text-gray-400 mt-1">Gunakan tag HTML: h1-h6, p, strong, em, ul, ol, li, a</p>
        </div>
      );
    case 'image':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold mb-1 block">Gambar <span className="font-normal text-gray-400">(URL atau Upload)</span></Label>
            <ImageUploadSmall value={s.src || ''} onChange={v => upd('src', v)} token={token} placeholder="https://... atau upload" />
            {s.src && <img src={s.src} alt="preview" className="mt-1.5 w-full h-20 object-cover rounded-lg" onError={e=>e.target.style.display='none'} />}
          </div>
          <div><Label className="text-xs font-semibold mb-1 block">Keterangan</Label><Input value={s.caption || ''} onChange={e => upd('caption', e.target.value)} /></div>
          <div>
            <Label className="text-xs font-semibold mb-1 block">Perataan</Label>
            <div className="flex gap-2">
              {['left','center','right'].map(a => (
                <button key={a} onClick={() => upd('alignment', a)} className={`flex-1 py-1.5 rounded text-xs font-medium border ${s.alignment === a ? 'bg-[#1b5e20] text-white border-[#1b5e20]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{a}</button>
              ))}
            </div>
          </div>
        </div>
      );
    case 'cardgrid':
      return (
        <div className="space-y-3">
          <div><Label className="text-xs font-semibold mb-1 block">Judul Section</Label><Input value={s.title || ''} onChange={e => upd('title', e.target.value)} /></div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">Kartu</Label>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addItem('items', { icon: '⭐', title: 'Kartu Baru', description: 'Deskripsi kartu.' })}>
                <Plus className="w-3 h-3 mr-1" /> Tambah
              </Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(s.items || []).map((item, i) => (
                <div key={item.id} className="bg-gray-50 p-2 rounded-lg space-y-1.5">
                  <div className="flex gap-2">
                    <Input value={item.icon || ''} onChange={e => updItem('items', i, 'icon', e.target.value)} className="w-16 text-center" />
                    <Input value={item.title || ''} onChange={e => updItem('items', i, 'title', e.target.value)} placeholder="Judul" className="flex-1" />
                    <button onClick={() => removeItem('items', i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <Input value={item.description || ''} onChange={e => updItem('items', i, 'description', e.target.value)} placeholder="Deskripsi" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case 'stats':
      return (
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-semibold">Statistik</Label>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addItem('items', { number: '0', label: 'Label' })}>
              <Plus className="w-3 h-3 mr-1" /> Tambah
            </Button>
          </div>
          <div className="space-y-2">
            {(s.items || []).map((item, i) => (
              <div key={item.id} className="flex gap-2 items-center">
                <Input value={item.number || ''} onChange={e => updItem('items', i, 'number', e.target.value)} placeholder="Angka" className="w-20" />
                <Input value={item.label || ''} onChange={e => updItem('items', i, 'label', e.target.value)} placeholder="Label" className="flex-1" />
                <button onClick={() => removeItem('items', i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      );
    case 'cta':
      return (
        <div className="space-y-3">
          <div><Label className="text-xs font-semibold mb-1 block">Judul</Label><Input value={s.title || ''} onChange={e => upd('title', e.target.value)} /></div>
          <div><Label className="text-xs font-semibold mb-1 block">Sub-judul</Label><Input value={s.subtitle || ''} onChange={e => upd('subtitle', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs font-semibold mb-1 block">Teks Button</Label><Input value={s.buttonText || ''} onChange={e => upd('buttonText', e.target.value)} /></div>
            <div><Label className="text-xs font-semibold mb-1 block">Link</Label><Input value={s.buttonLink || ''} onChange={e => upd('buttonLink', e.target.value)} /></div>
          </div>
          <div><Label className="text-xs font-semibold mb-1 block">Warna Latar</Label><Input type="color" value={s.bgColor || '#1b5e20'} onChange={e => upd('bgColor', e.target.value)} className="h-10 px-2" /></div>
        </div>
      );
    case 'gallery':
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold mb-1 block">Jumlah Kolom</Label>
            <div className="flex gap-2">
              {[2,3,4].map(n => (
                <button key={n} onClick={() => upd('columns', n)} className={`flex-1 py-1.5 rounded text-xs font-medium border ${s.columns === n ? 'bg-[#1b5e20] text-white border-[#1b5e20]' : 'border-gray-200 text-gray-600'}`}>{n} Kolom</button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">Gambar Galeri</Label>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => upd('images', [...(s.images || []), ''])}>
                <Plus className="w-3 h-3 mr-1" /> Tambah URL
              </Button>
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {(s.images || []).map((img, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex gap-2 items-center">
                    <ImageUploadSmall
                      value={img}
                      onChange={v => { const arr=[...(s.images||[])]; arr[i]=v; upd('images',arr); }}
                      token={token}
                      placeholder="https://..."
                    />
                    <button onClick={() => { const arr=[...(s.images||[])]; arr.splice(i,1); upd('images',arr); }} className="text-red-400 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  {img && <img src={img} alt="" className="w-full h-12 object-cover rounded" onError={e=>e.target.style.display='none'} />}
                </div>
              ))}
              {(s.images || []).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">Belum ada gambar. Tambahkan URL atau upload.</p>
              )}
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

// Sortable block item
function SortableBlock({ block, isSelected, onSelect, onDelete, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const btype = BLOCK_TYPES.find(t => t.type === block.type);

  return (
    <div ref={setNodeRef} style={style} className={`group relative border-2 rounded-xl transition-all ${isSelected ? 'border-[#d4a017] shadow-md' : 'border-transparent hover:border-gray-200'} ${isDragging ? 'bg-white shadow-xl' : ''}`}>
      {/* Block toolbar */}
      <div className={`absolute -top-8 left-0 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${isSelected ? 'opacity-100 pointer-events-auto' : 'group-hover:pointer-events-auto'}`}>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-sm px-2 py-1 pointer-events-auto">
          <button {...attributes} {...listeners} className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing p-0.5">
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${btype?.color || 'bg-gray-100 text-gray-600'}`}>{btype?.label}</span>
          <button onClick={() => onSelect(block.id)} className="text-gray-400 hover:text-[#1b5e20] p-0.5">
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(block.id)} className="text-gray-400 hover:text-red-500 p-0.5">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div onClick={() => onSelect(block.id)} className="cursor-pointer">
        {children}
      </div>
    </div>
  );
}

export default function PageBuilderAdmin() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'builder'
  const [pageMeta, setPageMeta] = useState({ title: '', slug: '', status: 'draft' });
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const [creating, setCreating] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateCategory, setTemplateCategory] = useState('Semua');

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3000); };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => { fetchPages(); }, []);

  async function fetchPages() {
    setLoading(true);
    try {
      const res = await fetch('/api/pages', { headers });
      const data = await res.json();
      setPages(data.items || []);
    } catch {} finally { setLoading(false); }
  }

  function openBuilder(page) {
    setSelectedPage(page);
    setBlocks(page.blocks || []);
    setPageMeta({ title: page.title, slug: page.slug, status: page.status || 'draft' });
    setSelectedBlockId(null);
    setView('builder');
    setPreview(false);
  }

  async function createNewPage() {
    const slug = `halaman-${Date.now()}`;
    try {
      const res = await fetch('/api/pages', { method: 'POST', headers, body: JSON.stringify({ title: 'Halaman Baru', slug, blocks: [], status: 'draft' }) });
      const data = await res.json();
      await fetchPages();
      openBuilder(data);
      showToast('Halaman baru dibuat');
    } catch { showToast('Gagal membuat halaman', 'error'); }
  }

  async function createFromTemplate(template) {
    setShowTemplateModal(false);
    // Assign fresh UUIDs to all block IDs
    const templateBlocks = template.blocks.map(b => ({
      ...b,
      id: uuidv4(),
      settings: {
        ...b.settings,
        items: b.settings?.items ? b.settings.items.map(i => ({ ...i, id: uuidv4() })) : b.settings?.items,
      },
    }));

    // Jika sedang di builder, tanya konfirmasi sebelum ganti blok
    if (view === 'builder') {
      if (template.id === 'blank') {
        if (confirm('Hapus semua blok dan mulai dari kosong?')) {
          setBlocks([]);
          showToast('Blok dihapus, halaman dikosongkan');
        }
        return;
      }
      if (blocks.length > 0 && !confirm(`Ganti semua blok saat ini dengan template "${template.name}"? Blok yang ada akan dihapus.`)) return;
      setBlocks(templateBlocks);
      showToast(`Template "${template.name}" diterapkan! Jangan lupa klik Simpan.`);
      return;
    }

    // Jika dari list view, buat halaman baru
    const slug = `${template.id}-${Date.now()}`;
    const title = template.id === 'blank' ? 'Halaman Baru' : template.name;
    try {
      const res = await fetch('/api/pages', { method: 'POST', headers, body: JSON.stringify({ title, slug, blocks: templateBlocks, status: 'draft' }) });
      const data = await res.json();
      await fetchPages();
      openBuilder(data);
      showToast(template.id === 'blank' ? 'Halaman kosong dibuat' : `Template "${template.name}" berhasil diterapkan!`);
    } catch { showToast('Gagal membuat halaman', 'error'); }
  }

  async function savePage() {
    if (!selectedPage) return;
    setSaving(true);
    try {
      await fetch(`/api/pages/${selectedPage.id}`, { method: 'PUT', headers, body: JSON.stringify({ ...pageMeta, blocks }) });
      showToast('Halaman berhasil disimpan');
      fetchPages();
    } catch { showToast('Gagal menyimpan', 'error'); }
    finally { setSaving(false); }
  }

  async function deletePage(id) {
    if (!confirm('Hapus halaman ini?')) return;
    try {
      await fetch(`/api/pages/${id}`, { method: 'DELETE', headers });
      showToast('Halaman dihapus');
      fetchPages();
    } catch { showToast('Gagal menghapus', 'error'); }
  }

  function addBlock(type) {
    const newBlock = { id: uuidv4(), type, settings: { ...(defaultSettings[type] || {}) } };
    // Deep clone items arrays
    if (newBlock.settings.items) newBlock.settings.items = newBlock.settings.items.map(i => ({...i, id: uuidv4()}));
    setBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  }

  function updateBlock(updated) { setBlocks(prev => prev.map(b => b.id === updated.id ? updated : b)); }
  function deleteBlock(id) { setBlocks(prev => prev.filter(b => b.id !== id)); if (selectedBlockId === id) setSelectedBlockId(null); }

  function handleDragStart(e) { setActiveId(e.active.id); }
  function handleDragEnd(e) {
    const { active, over } = e;
    setActiveId(null);
    if (active.id !== over?.id) {
      setBlocks(items => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  const selectedBlock = blocks.find(b => b.id === selectedBlockId);

  // Page list view
  if (view === 'list') {
    const templateCategories = ['Semua', ...new Set(PAGE_TEMPLATES.map(t => t.category))];
    const filteredTemplates = templateCategory === 'Semua' ? PAGE_TEMPLATES : PAGE_TEMPLATES.filter(t => t.category === templateCategory);

    return (
      <div>
        <Toast msg={toast.msg} type={toast.type} />

        {/* ─── Template Modal ─── */}
        {showTemplateModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowTemplateModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
                <div>
                  <h2 className="text-xl font-extrabold text-[#1b5e20]">Pilih Template Halaman</h2>
                  <p className="text-gray-500 text-sm mt-1">Mulai dengan template siap pakai atau buat dari nol</p>
                </div>
                <button onClick={() => setShowTemplateModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Category filter */}
              <div className="flex gap-2 px-6 pt-4 flex-shrink-0 overflow-x-auto pb-2">
                {templateCategories.map(cat => (
                  <button key={cat} onClick={() => setTemplateCategory(cat)}
                    className={`px-4 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                      templateCategory === cat ? 'bg-[#1b5e20] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* Template grid */}
              <div className="flex-1 overflow-y-auto p-6 pt-4">
                <div className="grid md:grid-cols-3 gap-4">
                  {filteredTemplates.map(tpl => (
                    <button key={tpl.id} onClick={() => createFromTemplate(tpl)}
                      className={`text-left p-4 rounded-2xl border-2 transition-all hover:shadow-md hover:border-[#1b5e20] group ${tpl.color}`}>
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-3xl">{tpl.icon}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-white/70 px-2 py-0.5 rounded-full">{tpl.category}</span>
                      </div>
                      <h3 className="font-bold text-[#1b5e20] text-sm mb-1 group-hover:text-[#2e7d32]">{tpl.name}</h3>
                      <p className="text-gray-500 text-xs leading-relaxed">{tpl.desc}</p>
                      {tpl.blocks.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {tpl.blocks.slice(0, 4).map((b, i) => (
                            <span key={i} className="text-[10px] bg-white/80 text-gray-600 px-1.5 py-0.5 rounded font-medium border border-white/60">
                              {b.type === 'hero' ? '🖼️ Hero' : b.type === 'text' ? '📝 Teks' : b.type === 'cardgrid' ? '⊞ Kartu' : b.type === 'stats' ? '📊 Statistik' : b.type === 'cta' ? '⚡ CTA' : b.type === 'image' ? '🖼️ Gambar' : b.type}
                            </span>
                          ))}
                          {tpl.blocks.length > 4 && <span className="text-[10px] text-gray-400">+{tpl.blocks.length - 4} lagi</span>}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1b5e20]">Page Builder</h1>
            <p className="text-gray-500 text-sm mt-0.5">Kelola halaman statis website</p>
          </div>
          <Button className="bg-[#1b5e20] hover:bg-[#2e7d32] text-white" onClick={() => setShowTemplateModal(true)}>
            <Plus className="w-4 h-4 mr-2" /> Halaman Baru
          </Button>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border p-6 animate-pulse h-32" />)}
          </div>
        ) : pages.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
            <Layers className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="text-gray-500 font-medium">Belum ada halaman</p>
            <p className="text-gray-400 text-sm mb-4">Buat halaman pertama Anda dengan drag & drop builder</p>
            <Button className="bg-[#1b5e20] hover:bg-[#2e7d32] text-white" onClick={() => setShowTemplateModal(true)}>
              <Plus className="w-4 h-4 mr-2" /> Buat Halaman
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {pages.map(page => (
              <div key={page.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-[#1b5e20]/10 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-[#1b5e20]" />
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${page.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {page.status === 'published' ? 'Dipublikasi' : 'Draft'}
                  </span>
                </div>
                <h3 className="font-bold text-[#1b5e20] mb-1">{page.title}</h3>
                <p className="text-gray-500 text-xs mb-1">/{page.slug}</p>
                <p className="text-gray-400 text-xs mb-4">{(page.blocks || []).length} blok</p>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-[#1b5e20] hover:bg-[#2e7d32] text-white text-xs h-8" onClick={() => openBuilder(page)}>
                    <Settings2 className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  {page.status === 'published' && (
                    <Button variant="outline" className="h-8 text-xs" onClick={() => window.open(`/halaman/${page.slug}`, '_blank')}>
                      <Globe className="w-3 h-3" />
                    </Button>
                  )}
                  <Button variant="outline" className="h-8 text-xs text-red-500 border-red-200 hover:bg-red-50" onClick={() => deletePage(page.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Builder view
  return (
    <div className="h-[calc(100vh-120px)] flex flex-col -m-4 md:-m-6">
      <Toast msg={toast.msg} type={toast.type} />

      {/* Template Modal (juga tersedia di builder) */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4" onClick={() => setShowTemplateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
              <div>
                <h2 className="text-xl font-extrabold text-[#1b5e20]">Terapkan Template</h2>
                <p className="text-amber-600 text-sm mt-1">⚠️ Blok yang ada akan diganti dengan blok dari template yang dipilih</p>
              </div>
              <button onClick={() => setShowTemplateModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-2 px-6 pt-4 flex-shrink-0 overflow-x-auto pb-2">
              {['Semua', ...new Set(PAGE_TEMPLATES.map(t => t.category))].map(cat => (
                <button key={cat} onClick={() => setTemplateCategory(cat)}
                  className={`px-4 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${templateCategory === cat ? 'bg-[#1b5e20] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-6 pt-4">
              <div className="grid md:grid-cols-3 gap-4">
                {(templateCategory === 'Semua' ? PAGE_TEMPLATES : PAGE_TEMPLATES.filter(t => t.category === templateCategory)).map(tpl => (
                  <button key={tpl.id} onClick={() => createFromTemplate(tpl)}
                    className={`text-left p-4 rounded-2xl border-2 transition-all hover:shadow-md hover:border-[#1b5e20] group ${tpl.color}`}>
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-3xl">{tpl.icon}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-white/70 px-2 py-0.5 rounded-full">{tpl.category}</span>
                    </div>
                    <h3 className="font-bold text-[#1b5e20] text-sm mb-1">{tpl.name}</h3>
                    <p className="text-gray-500 text-xs leading-relaxed">{tpl.desc}</p>
                    {tpl.blocks.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {tpl.blocks.slice(0, 4).map((b, i) => (
                          <span key={i} className="text-[10px] bg-white/80 text-gray-600 px-1.5 py-0.5 rounded font-medium border border-white/60">
                            {b.type === 'hero' ? '🖼️ Hero' : b.type === 'text' ? '📝 Teks' : b.type === 'cardgrid' ? '⊞ Kartu' : b.type === 'stats' ? '📊 Statistik' : b.type === 'cta' ? '⚡ CTA' : b.type === 'image' ? '🖼️ Gambar' : b.type}
                          </span>
                        ))}
                        {tpl.blocks.length > 4 && <span className="text-[10px] text-gray-400">+{tpl.blocks.length - 4} lagi</span>}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Builder toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={() => setView('list')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Kembali
        </Button>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <Input value={pageMeta.title} onChange={e => setPageMeta(m => ({...m, title: e.target.value}))} className="max-w-48 h-8 text-sm" placeholder="Judul halaman" />
          <div className="flex items-center gap-1 text-gray-400 text-sm">
            <span>/</span>
            <Input value={pageMeta.slug} onChange={e => setPageMeta(m => ({...m, slug: e.target.value}))} className="max-w-36 h-8 text-sm" placeholder="slug" />
          </div>
          <select
            value={pageMeta.status}
            onChange={e => setPageMeta(m => ({...m, status: e.target.value}))}
            className="h-8 border border-gray-200 rounded-lg px-2 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="published">Dipublikasi</option>
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPreview(!preview)}>
          <Eye className="w-4 h-4 mr-1" /> {preview ? 'Edit' : 'Preview'}
        </Button>
        <Button variant="outline" size="sm" title="Ganti dengan template lain" onClick={() => setShowTemplateModal(true)}>
          <Layers className="w-4 h-4 mr-1" /> Template
        </Button>
        <Button size="sm" className="bg-[#d4a017] hover:bg-[#b88010] text-white" onClick={savePage} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> {saving ? 'Simpan...' : 'Simpan'}
        </Button>
      </div>

      {/* Builder content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Block palette - LEFT */}
        {!preview && (
          <div className="w-56 bg-white border-r border-gray-100 flex flex-col flex-shrink-0 overflow-y-auto">
            <div className="p-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Blok Tersedia</p>
            </div>
            <div className="p-2 space-y-1">
              {BLOCK_TYPES.map(bt => {
                const Icon = bt.icon;
                return (
                  <button
                    key={bt.type}
                    onClick={() => addBlock(bt.type)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${bt.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">{bt.label}</p>
                      <p className="text-[10px] text-gray-400 leading-tight">{bt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Canvas - CENTER */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
          <div className="max-w-3xl mx-auto space-y-3">
            {blocks.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-16 text-center bg-white">
                <Layers className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="font-medium text-gray-500">Halaman Kosong</p>
                <p className="text-sm text-gray-400 mt-1">Klik blok di panel kiri untuk menambahkan konten</p>
              </div>
            ) : (
              preview ? (
                <div className="space-y-4 bg-white rounded-2xl overflow-hidden shadow-sm p-6">
                  {blocks.map(block => <BlockPreview key={block.id} block={block} />)}
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-6 pt-6">
                      {blocks.map(block => (
                        <SortableBlock
                          key={block.id}
                          block={block}
                          isSelected={selectedBlockId === block.id}
                          onSelect={setSelectedBlockId}
                          onDelete={deleteBlock}
                        >
                          <BlockPreview block={block} />
                        </SortableBlock>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )
            )}
          </div>
        </div>

        {/* Settings panel - RIGHT */}
        {!preview && selectedBlock && (
          <div className="w-72 bg-white border-l border-gray-100 flex flex-col flex-shrink-0 overflow-y-auto">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5" />
                Pengaturan {BLOCK_TYPES.find(t => t.type === selectedBlock.type)?.label}
              </p>
              <button onClick={() => setSelectedBlockId(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <BlockSettingsPanel block={selectedBlock} onChange={updateBlock} token={token} />
            </div>
          </div>
        )}

        {/* Prompt to select block */}
        {!preview && !selectedBlock && blocks.length > 0 && (
          <div className="w-64 bg-white border-l border-gray-100 flex items-center justify-center flex-shrink-0">
            <div className="text-center p-6 text-gray-400">
              <Settings2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Klik blok untuk mengedit pengaturannya</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
