'use client';
import { useState, useEffect } from 'react';
import { MessageSquare, Star, X, Send, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SurveyWidget() {
  const { lang } = useLanguage();
  const [config, setConfig] = useState(null);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user already responded today
    const lastSurvey = localStorage.getItem('survey_done');
    const today = new Date().toDateString();
    if (lastSurvey === today) { setDismissed(true); return; }
    fetch('/api/surveys/config').then(r => r.json()).then(d => {
      if (d && d.isActive) setConfig(d);
    }).catch(() => {});
  }, []);

  async function handleSubmit() {
    if (!rating) return;
    setLoading(true);
    try {
      await fetch('/api/surveys/submit', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ rating, comment, page: window.location.pathname }) });
      localStorage.setItem('survey_done', new Date().toDateString());
      setDone(true);
      setTimeout(() => { setOpen(false); setDismissed(true); }, 2000);
    } catch { } finally { setLoading(false); }
  }

  function dismiss() { setDismissed(true); localStorage.setItem('survey_done', new Date().toDateString()); }

  if (!config || dismissed) return null;

  return (
    <div className="fixed bottom-6 right-20 z-[9998]">
      {!open ? (
        <button onClick={() => setOpen(true)} className="bg-[#c9a84c] hover:bg-[#b8962f] text-white rounded-2xl px-4 py-2.5 shadow-lg flex items-center gap-2 text-sm font-semibold transition-all hover:shadow-xl">
          <Star className="w-4 h-4" />
          {lang==='id'?'Beri Penilaian':'Rate Us'}
        </button>
      ) : (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-72 overflow-hidden">
          <div className="bg-[#1e3a5f] px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-bold text-white text-sm">{config.title}</p>
              <p className="text-white/60 text-xs">{config.subtitle}</p>
            </div>
            <button onClick={dismiss} className="text-white/60 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4">
            {done ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2"><Check className="w-6 h-6 text-green-600" /></div>
                <p className="font-semibold text-[#1e3a5f]">{config.thankYouMessage || 'Terima kasih!'}</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-3 text-center">{lang==='id'?'Bagaimana pelayanan kami?':'How was our service?'}</p>
                <div className="flex justify-center gap-1 mb-4">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setRating(s)} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
                      className="transition-transform hover:scale-110">
                      <Star className={`w-8 h-8 transition-colors ${ (hover||rating) >= s ? 'fill-[#c9a84c] text-[#c9a84c]' : 'text-gray-300' }`} />
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder={lang==='id'?'Komentar (opsional)...':'Comment (optional)...'} className="w-full p-2 border border-gray-200 rounded-lg text-xs h-16 resize-none mb-3 focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]/30" />
                )}
                <button onClick={handleSubmit} disabled={!rating||loading} className="w-full bg-[#c9a84c] hover:bg-[#b8962f] disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                  {loading?<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<Send className="w-4 h-4"/>}
                  {loading?(lang==='id'?'Mengirim...':'Sending...'):(lang==='id'?'Kirim Penilaian':'Submit Rating')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
