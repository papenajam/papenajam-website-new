'use client';
import { useLanguage } from '@/contexts/LanguageContext';
import { LANGUAGES } from '@/lib/i18n';

export default function LanguageSwitcher({ variant = 'default', scrolled = true }) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      role="group"
      aria-label={lang === 'id' ? 'Pilih bahasa' : 'Select language'}
      className="flex items-center gap-0.5"
    >
      {Object.values(LANGUAGES).map((language) => {
        const isActive = lang === language.code;
        return (
          <button
            key={language.code}
            onClick={() => setLang(language.code)}
            lang={language.code}
            aria-label={`${lang === 'id' ? 'Ganti bahasa ke' : 'Switch language to'} ${language.name}`}
            aria-pressed={isActive}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
              isActive
                ? 'bg-[#c9a84c] text-[#1e3a5f]'
                : variant === 'dark' || !scrolled
                  ? 'text-white/70 hover:text-white hover:bg-white/10'
                  : 'text-gray-500 hover:text-[#1e3a5f] hover:bg-gray-100'
            }`}
          >
            {language.label}
          </button>
        );
      })}
    </div>
  );
}
