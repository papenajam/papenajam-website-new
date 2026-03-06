'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  loadA11ySettings, saveA11ySettings, applyA11yClasses,
  DEFAULT_SETTINGS, setupReadingGuide
} from '@/lib/accessibility';

const AccessibilityContext = createContext({
  settings: DEFAULT_SETTINGS,
  updateSetting: () => {},
  resetAll: () => {},
  isSpeaking: false,
});

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = loadA11ySettings();
    setSettings(saved);
    applyA11yClasses(saved);
    if (saved.readingGuide) setupReadingGuide(true);
    setMounted(true);

    // Check TTS state
    const checkSpeaking = setInterval(() => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        setIsSpeaking(window.speechSynthesis.speaking);
      }
    }, 300);
    return () => clearInterval(checkSpeaking);
  }, []);

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      saveA11ySettings(next);
      applyA11yClasses(next);
      if (key === 'readingGuide') setupReadingGuide(value);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    const defaults = { ...DEFAULT_SETTINGS };
    setSettings(defaults);
    saveA11ySettings(defaults);
    applyA11yClasses(defaults);
    setupReadingGuide(false);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  return (
    <AccessibilityContext.Provider value={{ settings, updateSetting, resetAll, isSpeaking, setIsSpeaking, mounted }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  return useContext(AccessibilityContext);
}
