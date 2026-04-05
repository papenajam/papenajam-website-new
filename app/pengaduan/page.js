'use client';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, Check, Phone, Mail, MapPin, Clock } from 'lucide-react';
import PublicLayout from '@/components/PublicLayout';

const CATEGORIES = ['Pelayanan', 'Informasi Perkara', 'Pengaduan Pegawai', 'Saran & Masukan', 'Pertanyaan Umum', 'Lainnya'];

export default function PengaduanPage() {
  const { lang } = useLanguage();
  const [form, setForm] = useState({ name: '', email: '', phone: '', category: 'Pelayanan', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.message) { setError(lang === 'id' ? 'Nama dan pesan wajib diisi' : 'Name and message are required'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/complaints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(true);
    } catch (e) { setError(e.message || 'Gagal mengirim'); }
    finally { setLoading(false); }
  }

  return (
    <PublicLayout
      title={lang === 'id' ? 'Pengaduan & Kontak' : 'Complaints & Contact'}
      subtitle={lang === 'id' ? 'Sampaikan pengaduan, pertanyaan, atau saran Anda kepada kami' : 'Submit your complaints, questions, or suggestions'}
    >
      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Form */}
          <div className="lg:col-span-2">
            {success ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-[#1e3a5f] mb-2">{lang === 'id' ? 'Pengaduan Terkirim!' : 'Complaint Sent!'}</h2>
                <p className="text-gray-500 mb-6">{lang === 'id' ? 'Terima kasih. Kami akan menindaklanjuti pengaduan Anda dalam 3x24 jam kerja.' : 'Thank you. We will follow up on your complaint within 3 working days.'}</p>
                <button
                  onClick={() => { setSuccess(false); setForm({ name: '', email: '', phone: '', category: 'Pelayanan', subject: '', message: '' }); }}
                  className="text-[#c9a84c] font-semibold hover:underline"
                >
                  {lang === 'id' ? 'Kirim pengaduan lain' : 'Send another complaint'}
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-bold text-[#1e3a5f] text-lg mb-6">
                  {lang === 'id' ? '📝 Form Pengaduan' : '📝 Complaint Form'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold mb-1 block">{lang === 'id' ? 'Nama Lengkap *' : 'Full Name *'}</Label>
                      <Input value={form.name} onChange={e => upd('name', e.target.value)} placeholder={lang === 'id' ? 'Nama Anda' : 'Your name'} required />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold mb-1 block">{lang === 'id' ? 'No. Telepon' : 'Phone Number'}</Label>
                      <Input value={form.phone} onChange={e => upd('phone', e.target.value)} placeholder="08xx-xxxx-xxxx" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-1 block">Email</Label>
                    <Input type="email" value={form.email} onChange={e => upd('email', e.target.value)} placeholder="email@contoh.com" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-1 block">{lang === 'id' ? 'Kategori' : 'Category'}</Label>
                    <select
                      value={form.category}
                      onChange={e => upd('category', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-1 block">{lang === 'id' ? 'Subjek' : 'Subject'}</Label>
                    <Input value={form.subject} onChange={e => upd('subject', e.target.value)} placeholder={lang === 'id' ? 'Subjek pengaduan...' : 'Complaint subject...'} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-1 block">{lang === 'id' ? 'Pesan *' : 'Message *'}</Label>
                    <textarea
                      value={form.message}
                      onChange={e => upd('message', e.target.value)}
                      placeholder={lang === 'id' ? 'Tuliskan pengaduan atau pertanyaan Anda di sini...' : 'Write your complaint or question here...'}
                      className="w-full p-3 border border-gray-200 rounded-lg text-sm h-36 resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                      required
                    />
                  </div>
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{error}</div>
                  )}
                  <Button type="submit" className="w-full bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white py-3" disabled={loading}>
                    <Send className="w-4 h-4 mr-2" />
                    {loading ? (lang === 'id' ? 'Mengirim...' : 'Sending...') : (lang === 'id' ? 'Kirim Pengaduan' : 'Send Complaint')}
                  </Button>
                </form>
              </div>
            )}
          </div>

          {/* Info Kontak */}
          <div className="space-y-4">
            <div className="bg-[#1e3a5f] rounded-2xl p-5 text-white">
              <h3 className="font-bold mb-4 flex items-center gap-2">📞 {lang === 'id' ? 'Informasi Kontak' : 'Contact Information'}</h3>
              <div className="space-y-3 text-sm">
                {[
                  { icon: MapPin, label: 'Jl. Propinsi Km. 9, Penajam, Kab. Penajam Paser Utara, Kaltim 76141' },
                  { icon: Phone, label: '(0542) 7211234' },
                  { icon: Mail, label: 'pa.penajam@gmail.com' },
                  { icon: Clock, label: lang === 'id' ? 'Sen-Kam: 08:00–16:00 WITA\nJum: 08:00–11:00 WITA' : 'Mon–Thu: 08:00–16:00\nFri: 08:00–11:00' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-start gap-3">
                    <Icon className="w-4 h-4 text-[#c9a84c] flex-shrink-0 mt-0.5" />
                    <span className="text-white/80 whitespace-pre-line">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <h3 className="font-bold text-amber-800 mb-2">⚠️ {lang === 'id' ? 'Catatan Penting' : 'Important Note'}</h3>
              <ul className="space-y-1.5 text-sm text-amber-700">
                <li>• {lang === 'id' ? 'Isi formulir dengan jujur dan lengkap' : 'Fill the form honestly and completely'}</li>
                <li>• {lang === 'id' ? 'Pengaduan diproses dalam 3×24 jam kerja' : 'Processed within 3 working days'}</li>
                <li>• {lang === 'id' ? 'Keadaan darurat: hubungi langsung via telepon' : 'Urgent: contact us directly by phone'}</li>
              </ul>
            </div>

            <a
              href="/faq"
              className="block bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow text-center"
            >
              <p className="text-2xl mb-1">❓</p>
              <p className="font-semibold text-[#1e3a5f] text-sm">{lang === 'id' ? 'Cek FAQ terlebih dahulu' : 'Check FAQ first'}</p>
              <p className="text-xs text-gray-400 mt-1">{lang === 'id' ? 'Mungkin pertanyaan Anda sudah terjawab' : 'Your question might already be answered'}</p>
            </a>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
