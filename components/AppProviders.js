'use client';
// Provider wrapper — wraps contexts together
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AccessibilityProvider } from '@/contexts/AccessibilityContext';
import AccessibilityToolbar from './AccessibilityToolbar';

export default function AppProviders({ children }) {
  return (
    <LanguageProvider>
      <AccessibilityProvider>
        {/* Skip to main content - WCAG requirement */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[10000] focus:bg-[#c9a84c] focus:text-[#1e3a5f] focus:px-4 focus:py-2 focus:rounded-lg focus:font-bold focus:shadow-lg focus:text-base"
          aria-label="Skip to main content"
        >
          Lewati ke konten utama / Skip to main content
        </a>
        <AccessibilityToolbar />
        {children}
      </AccessibilityProvider>
    </LanguageProvider>
  );
}
