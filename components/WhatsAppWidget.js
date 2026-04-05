'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { MessageCircle } from 'lucide-react';

export default function WhatsAppWidget() {
  const { lang } = useLanguage();
  const [phone, setPhone] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch('/api/settings').then(r=>r.json()).then(d=>{ if(d.whatsapp) setPhone(d.whatsapp.replace(/[^0-9+]/g,'')); }).catch(()=>{});
  }, []);

  if (!mounted || !phone) return null;

  const waUrl = `https://wa.me/${phone.startsWith('+')? phone : '62'+phone.replace(/^0/,'')}?text=${encodeURIComponent(lang==='id'?'Halo, saya ingin bertanya mengenai pelayanan Pengadilan Agama Penajam.':'Hello, I would like to inquire about the services at Penajam Religious Court.')}` ;

  return (
    <a href={waUrl} target="_blank" rel="noopener noreferrer"
      className="fixed bottom-6 left-6 z-[9997] bg-[#25D366] hover:bg-[#20ba58] text-white rounded-2xl p-3 shadow-lg flex items-center gap-2 transition-all hover:shadow-xl hover:scale-105 group"
      aria-label={lang==='id'?'Hubungi via WhatsApp':'Contact via WhatsApp'}
    >
      <MessageCircle className="w-6 h-6" />
      <span className="text-sm font-semibold max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 whitespace-nowrap">
        {lang==='id'?'WhatsApp Kami':'WhatsApp Us'}
      </span>
    </a>
  );
}
