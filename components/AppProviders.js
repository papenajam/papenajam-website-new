'use client';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AccessibilityProvider } from '@/contexts/AccessibilityContext';
import AccessibilityToolbar from './AccessibilityToolbar';
import WhatsAppWidget from './WhatsAppWidget';
import SurveyWidget from './SurveyWidget';
import FloatingSidebar from './FloatingSidebar';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function AnalyticsTracker() {
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/admin')) return; // Don't track admin pages
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    }).catch(() => {});
  }, []);
  return null;
}

export default function AppProviders({ children }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  return (
    <LanguageProvider>
      <AccessibilityProvider>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[10000] focus:bg-[#d4a017] focus:text-[#1b5e20] focus:px-4 focus:py-2 focus:rounded-lg focus:font-bold focus:shadow-lg focus:text-base"
          aria-label="Skip to main content"
        >
          Lewati ke konten utama / Skip to main content
        </a>
        <AnalyticsTracker />
        <AccessibilityToolbar />
        {!isAdmin && (
          <>
            <FloatingSidebar />
            <WhatsAppWidget />
            <SurveyWidget />
          </>
        )}
        {children}
      </AccessibilityProvider>
    </LanguageProvider>
  );
}

