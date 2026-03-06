// ============================================================
// ACCESSIBILITY UTILITIES
// WCAG 2.1 AA Compliance Helpers
// ============================================================

export const ACCESSIBILITY_STORAGE_KEY = 'pa_accessibility';

export const DEFAULT_SETTINGS = {
  fontSize: 'normal',      // 'normal' | 'large' | 'xlarge'
  highContrast: false,
  darkMode: false,
  dyslexiaFont: false,
  highlightLinks: false,
  readingGuide: false,
  simpleMode: false,
};

// Font size multipliers
export const FONT_SIZES = {
  normal: { class: '', label: 'Normal', scale: 1 },
  large: { class: 'a11y-font-large', label: 'Besar / Large', scale: 1.2 },
  xlarge: { class: 'a11y-font-xlarge', label: 'Sangat Besar / Extra Large', scale: 1.4 },
};

/**
 * Load accessibility settings from localStorage
 */
export function loadA11ySettings() {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const saved = localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save accessibility settings to localStorage
 */
export function saveA11ySettings(settings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

/**
 * Apply accessibility classes to document root
 */
export function applyA11yClasses(settings) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  const body = document.body;

  // Remove all a11y classes first
  html.classList.remove(
    'a11y-font-large', 'a11y-font-xlarge',
    'a11y-high-contrast', 'a11y-dark',
    'a11y-dyslexia', 'a11y-highlight-links',
    'a11y-simple-mode'
  );

  // Apply font size
  if (settings.fontSize && settings.fontSize !== 'normal') {
    html.classList.add(`a11y-font-${settings.fontSize}`);
  }

  // Apply contrast/theme
  if (settings.highContrast) html.classList.add('a11y-high-contrast');
  if (settings.darkMode) html.classList.add('a11y-dark');
  if (settings.dyslexiaFont) html.classList.add('a11y-dyslexia');
  if (settings.highlightLinks) html.classList.add('a11y-highlight-links');
  if (settings.simpleMode) html.classList.add('a11y-simple-mode');
}

/**
 * Text-to-Speech using Web Speech API
 */
export const TTS = {
  speaking: false,
  utterance: null,

  read(text, lang = 'id-ID') {
    if (!window.speechSynthesis) return false;
    this.stop();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'id' ? 'id-ID' : 'en-US';
    utterance.rate = 0.85;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = () => { this.speaking = false; };
    utterance.onerror = () => { this.speaking = false; };
    this.speaking = true;
    this.utterance = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  },

  readPage(lang = 'id') {
    const mainEl = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
    const text = mainEl ? mainEl.innerText : document.body.innerText;
    const cleaned = text.replace(/\s+/g, ' ').trim().substring(0, 5000);
    return this.read(cleaned, lang);
  },

  stop() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.speaking = false;
    }
  },

  isSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  },
};

/**
 * Reading guide tracker
 */
export function setupReadingGuide(enabled) {
  if (typeof document === 'undefined') return;
  const existingGuide = document.getElementById('reading-guide');

  if (!enabled) {
    if (existingGuide) existingGuide.remove();
    document.removeEventListener('mousemove', handleReadingGuide);
    return;
  }

  if (!existingGuide) {
    const guide = document.createElement('div');
    guide.id = 'reading-guide';
    guide.setAttribute('aria-hidden', 'true');
    guide.style.cssText = `
      position: fixed;
      left: 0;
      right: 0;
      height: 2.5rem;
      background: rgba(201, 168, 76, 0.15);
      border-top: 2px solid rgba(201, 168, 76, 0.5);
      border-bottom: 2px solid rgba(201, 168, 76, 0.5);
      pointer-events: none;
      z-index: 9998;
      transition: top 0.05s linear;
    `;
    document.body.appendChild(guide);
  }

  document.addEventListener('mousemove', handleReadingGuide);
}

function handleReadingGuide(e) {
  const guide = document.getElementById('reading-guide');
  if (guide) {
    guide.style.top = (e.clientY - 20) + 'px';
  }
}

/**
 * Generate accessible color pair that meets WCAG AA (4.5:1 contrast)
 */
export const WCAG_COLORS = {
  // Court blue - primary brand
  primary: '#1e3a5f',
  primaryFg: '#ffffff',
  // Gold accent  
  accent: '#c9a84c',
  accentFg: '#1e3a5f',
  // High contrast overrides
  hcBg: '#000000',
  hcFg: '#ffffff',
  hcAccent: '#ffff00',
  hcLink: '#00ffff',
};
