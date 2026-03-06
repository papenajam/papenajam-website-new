'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSavedLanguage, saveLanguage, DEFAULT_LANGUAGE } from '@/lib/i18n';
import { t as translate } from '@/lib/i18n';

const LanguageContext = createContext({
  lang: DEFAULT_LANGUAGE,
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANGUAGE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = getSavedLanguage();
    setLangState(saved);
    setMounted(true);
  }, []);

  const setLang = useCallback((newLang) => {
    setLangState(newLang);
    saveLanguage(newLang);
    // Update html lang attribute
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLang;
    }
  }, []);

  const tFn = useCallback((keyPath, fallback) => {
    return translate(lang, keyPath, fallback);
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: tFn, mounted }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
