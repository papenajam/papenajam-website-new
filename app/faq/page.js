'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { HelpCircle } from 'lucide-react';
import PublicLayout from '@/components/PublicLayout';

function FAQItem({ item, lang }) {
  const [open, setOpen] = useState(false);
  const q = lang === 'en' && item.questionEn ? item.questionEn : item.question;
  const a = lang === 'en' && item.answerEn ? item.answerEn : item.answer;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-[#1e3a5f] text-sm pr-4">{q}</span>
        <span className={`text-[#c9a84c] flex-shrink-0 text-xl font-bold leading-none transition-transform duration-200 ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && (
        <div className="px-6 pb-5 text-gray-600 text-sm leading-relaxed border-t border-gray-50 pt-4">{a}</div>
      )}
    </div>
  );
}

export default function FAQPage() {
  const { lang } = useLanguage();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = filter ? `/api/faq?category=${encodeURIComponent(filter)}` : '/api/faq';
    fetch(url).then(r => r.json()).then(d => {
      setItems(d.items || []);
      setCategories(d.categories || []);
    }).finally(() => setLoading(false));
  }, [filter]);

  return (
    <PublicLayout
      title={lang === 'id' ? 'Tanya Jawab (FAQ)' : 'Frequently Asked Questions'}
      subtitle={lang === 'id' ? 'Jawaban atas pertanyaan yang sering diajukan masyarakat' : 'Answers to commonly asked questions'}
    >
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        {categories.length > 0 && (
          <div className="flex gap-2 mb-8 flex-wrap justify-center">
            <button onClick={() => setFilter('')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${!filter ? 'bg-[#1e3a5f] text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
              {lang === 'id' ? 'Semua' : 'All'}
            </button>
            {categories.map(c => (
              <button key={c} onClick={() => setFilter(c)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === c ? 'bg-[#1e3a5f] text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>{c}</button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-2xl animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <div className="py-24 text-center"><HelpCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" /><p className="text-gray-400">{lang === 'id' ? 'Belum ada FAQ' : 'No FAQ yet'}</p></div>
        ) : (
          <div className="space-y-3 mb-10">
            {items.map(item => <FAQItem key={item.id} item={item} lang={lang} />)}
          </div>
        )}

        <div className="bg-[#1e3a5f] rounded-2xl p-6 text-center">
          <h2 className="font-bold text-white mb-2">{lang === 'id' ? 'Tidak menemukan jawaban?' : "Can't find an answer?"}</h2>
          <p className="text-white/70 text-sm mb-4">{lang === 'id' ? 'Hubungi kami atau kirimkan pengaduan' : 'Contact us or submit a complaint'}</p>
          <a href="/pengaduan" className="inline-flex items-center gap-2 bg-[#c9a84c] hover:bg-[#b8962f] text-white font-semibold px-6 py-3 rounded-xl transition-colors">
            {lang === 'id' ? '📩 Kirim Pertanyaan' : '📩 Send Question'}
          </a>
        </div>
      </div>
    </PublicLayout>
  );
}
