'use client';
import { useState } from 'react';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { TTS } from '@/lib/accessibility';

export default function AccessibilityToolbar() {
  const [open, setOpen] = useState(false);
  const { settings, updateSetting, resetAll, isSpeaking, setIsSpeaking, mounted } = useAccessibility();
  const { t, lang } = useLanguage();

  // Jangan render sampai client-side mounted untuk menghindari hydration error
  if (!mounted) return null;

  function cycleFontSize() {
    const order = ['normal', 'large', 'xlarge'];
    const idx = order.indexOf(settings.fontSize || 'normal');
    const next = order[(idx + 1) % order.length];
    updateSetting('fontSize', next);
  }

  function handleTTS() {
    if (isSpeaking) {
      TTS.stop();
      setIsSpeaking(false);
    } else {
      const started = TTS.readPage(lang);
      if (started) setIsSpeaking(true);
    }
  }

  const fontLabel = { normal: t('accessibility.fontNormal'), large: t('accessibility.fontLarge'), xlarge: t('accessibility.fontXLarge') };

  const ToggleBtn = ({ label, icon, active, onClick, className = '' }) => (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-xs font-medium transition-all min-w-[70px] border-2 ${
        active
          ? 'bg-[#1b5e20] text-white border-[#1b5e20] shadow-inner'
          : 'bg-white text-gray-700 border-gray-200 hover:border-[#1b5e20] hover:bg-[#1b5e20]/5'
      } ${className}`}
      aria-label={`${label}: ${active ? (lang === 'id' ? 'aktif' : 'on') : (lang === 'id' ? 'nonaktif' : 'off')}`}
    >
      <span className="text-lg" aria-hidden="true">{icon}</span>
      <span className="leading-tight text-center" style={{ fontSize: '0.65rem' }}>{label}</span>
    </button>
  );

  return (
    <>
      {/* Floating trigger button */}
      <div
        className="fixed left-0 top-1/2 -translate-y-1/2 z-[9999]"
        style={{ transform: 'translateY(-50%)' }}
      >
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? t('accessibility.closeToolbar') : t('accessibility.openToolbar')}
          aria-expanded={open}
          aria-controls="a11y-toolbar"
          className="bg-[#1b5e20] text-white w-10 h-24 flex flex-col items-center justify-center gap-0.5 shadow-lg hover:bg-[#2e7d32] transition-all rounded-r-2xl focus:outline-none focus:ring-2 focus:ring-[#d4a017] focus:ring-offset-1"
          style={{ writingMode: 'vertical-rl', borderRadius: '0 12px 12px 0' }}
        >
          <span className="text-sm" aria-hidden="true">{open ? '✕' : '♿'}</span>
          <span style={{ fontSize: '0.6rem', letterSpacing: '0.1em', writingMode: 'vertical-rl' }}>
            {lang === 'id' ? 'AKSES' : 'ACCESS'}
          </span>
        </button>
      </div>

      {/* Toolbar Panel */}
      <div
        id="a11y-toolbar"
        role="region"
        aria-label={t('accessibility.toolbar')}
        className={`fixed left-10 top-1/2 z-[9999] transition-all duration-300 ${
          open ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 -translate-x-4 pointer-events-none'
        }`}
        style={{ transform: `translateY(-50%) ${open ? 'translateX(0)' : 'translateX(-1rem)'}` }}
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden w-[300px]">
          {/* Header */}
          <div className="bg-[#1b5e20] text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">♿</span>
              <h2 className="text-sm font-bold">{t('accessibility.toolbar')}</h2>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label={t('accessibility.closeToolbar')}
              className="text-white/70 hover:text-white transition-colors p-1 rounded"
            >
              ✕
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Font Size */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2" id="font-size-label">
                {lang === 'id' ? 'Ukuran Teks' : 'Text Size'}
              </p>
              <div className="flex items-center gap-2" role="group" aria-labelledby="font-size-label">
                <button
                  onClick={() => updateSetting('fontSize', 'normal')}
                  aria-pressed={settings.fontSize === 'normal'}
                  aria-label={lang === 'id' ? 'Teks Normal' : 'Normal text'}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                    settings.fontSize === 'normal' || !settings.fontSize
                      ? 'bg-[#1b5e20] text-white border-[#1b5e20]'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-[#1b5e20]'
                  }`}
                >
                  A
                </button>
                <button
                  onClick={() => updateSetting('fontSize', 'large')}
                  aria-pressed={settings.fontSize === 'large'}
                  aria-label={lang === 'id' ? 'Teks Besar' : 'Large text'}
                  className={`flex-1 py-2 rounded-lg font-bold border-2 transition-all ${
                    settings.fontSize === 'large'
                      ? 'bg-[#1b5e20] text-white border-[#1b5e20] text-base'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-[#1b5e20] text-base'
                  }`}
                >
                  A
                </button>
                <button
                  onClick={() => updateSetting('fontSize', 'xlarge')}
                  aria-pressed={settings.fontSize === 'xlarge'}
                  aria-label={lang === 'id' ? 'Teks Sangat Besar' : 'Extra large text'}
                  className={`flex-1 py-2 rounded-lg font-bold border-2 transition-all ${
                    settings.fontSize === 'xlarge'
                      ? 'bg-[#1b5e20] text-white border-[#1b5e20] text-xl'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-[#1b5e20] text-xl'
                  }`}
                >
                  A
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center mt-1">
                {t('accessibility.currentFontSize')}: <strong>{fontLabel[settings.fontSize || 'normal']}</strong>
              </p>
            </div>

            {/* Toggle Options */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2" id="display-options-label">
                {lang === 'id' ? 'Tampilan' : 'Display'}
              </p>
              <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="display-options-label">
                <ToggleBtn
                  label={t('accessibility.highContrast')}
                  icon="🌓"
                  active={settings.highContrast}
                  onClick={() => updateSetting('highContrast', !settings.highContrast)}
                />
                <ToggleBtn
                  label={t('accessibility.darkMode')}
                  icon="🌙"
                  active={settings.darkMode}
                  onClick={() => updateSetting('darkMode', !settings.darkMode)}
                />
                <ToggleBtn
                  label={t('accessibility.dyslexiaFont')}
                  icon="📝"
                  active={settings.dyslexiaFont}
                  onClick={() => updateSetting('dyslexiaFont', !settings.dyslexiaFont)}
                />
                <ToggleBtn
                  label={t('accessibility.highlightLinks')}
                  icon="🔗"
                  active={settings.highlightLinks}
                  onClick={() => updateSetting('highlightLinks', !settings.highlightLinks)}
                />
                <ToggleBtn
                  label={t('accessibility.readingGuide')}
                  icon="📖"
                  active={settings.readingGuide}
                  onClick={() => updateSetting('readingGuide', !settings.readingGuide)}
                />
                <ToggleBtn
                  label={t('accessibility.simpleMode')}
                  icon="🔯"
                  active={settings.simpleMode}
                  onClick={() => updateSetting('simpleMode', !settings.simpleMode)}
                />
              </div>
            </div>

            {/* Text to Speech */}
            {typeof window !== 'undefined' && 'speechSynthesis' in window && (
              <div>
                <button
                  onClick={handleTTS}
                  aria-label={isSpeaking ? t('accessibility.stopSpeech') : t('accessibility.textToSpeech')}
                  className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                    isSpeaking
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-[#d4a017] hover:bg-[#b88010] text-white'
                  }`}
                >
                  <span aria-hidden="true">{isSpeaking ? '⏹️' : '🔊'}</span>
                  {isSpeaking ? t('accessibility.stopSpeech') : t('accessibility.textToSpeech')}
                </button>
              </div>
            )}

            {/* Reset */}
            <button
              onClick={resetAll}
              aria-label={t('accessibility.resetAll')}
              className="w-full py-2 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-medium hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-all"
            >
              ↺ {t('accessibility.resetAll')}
            </button>

            {/* Link to statement */}
            <a
              href="/accessibility"
              className="block text-center text-xs text-[#1b5e20] hover:underline"
            >
              {t('accessibility.statement')}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
