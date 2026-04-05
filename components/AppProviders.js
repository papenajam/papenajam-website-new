'use client';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AccessibilityProvider } from '@/contexts/AccessibilityContext';
import AccessibilityToolbar from './AccessibilityToolbar';
import WhatsAppWidget from './WhatsAppWidget';
import SurveyWidget from './SurveyWidget';
import { useEffect } from 'react';

function AnalyticsTracker() {
  useEffect(() => {
    // Track page view
    const path = window.location.pathname;
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    }).catch(() => {});
  }, []);
  return null;
}

export default function AppProviders({ children }) {
  return (
    <LanguageProvider>
      <AccessibilityProvider>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[10000] focus:bg-[#c9a84c] focus:text-[#1e3a5f] focus:px-4 focus:py-2 focus:rounded-lg focus:font-bold focus:shadow-lg focus:text-base"
          aria-label="Skip to main content"
        >
          Lewati ke konten utama / Skip to main content
        </a>
        <AnalyticsTracker />
        <AccessibilityToolbar />
        <WhatsAppWidget />
        <SurveyWidget />
        {children}
      </AccessibilityProvider>
    </LanguageProvider>
  );
}
