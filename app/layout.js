import './globals.css';
import AppProviders from '@/components/AppProviders';

export const metadata = {
  title: {
    default: 'Pengadilan Agama Penajam - Website Resmi',
    template: '%s | Pengadilan Agama Penajam',
  },
  description: 'Website resmi Pengadilan Agama Penajam Kelas I B. Layanan peradilan agama yang cepat, sederhana, dan berbiaya ringan. Official website of Penajam Religious Court.',
  keywords: 'pengadilan agama, penajam, paser utara, kalimantan timur, perceraian, waris, hibah, wakaf, religious court, Indonesia',
  openGraph: {
    title: 'Pengadilan Agama Penajam',
    description: 'Website resmi Pengadilan Agama Penajam Kelas I B, Kabupaten Penajam Paser Utara, Kalimantan Timur.',
    locale: 'id_ID',
    alternateLocale: 'en_US',
    type: 'website',
  },
  other: {
    'theme-color': '#1e3a5f',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* Prevent DataCloneError for PerformanceServerTiming */}
        <script dangerouslySetInnerHTML={{
          __html: 'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'
        }} />
        {/* Apply saved a11y classes before paint to prevent flash */}
        <script dangerouslySetInnerHTML={{
          __html: `
            (function(){
              try {
                var s = JSON.parse(localStorage.getItem('pa_accessibility')||'{}');
                var cls = [];
                if(s.fontSize && s.fontSize !== 'normal') cls.push('a11y-font-'+s.fontSize);
                if(s.highContrast) cls.push('a11y-high-contrast');
                if(s.darkMode) cls.push('a11y-dark');
                if(s.dyslexiaFont) cls.push('a11y-dyslexia');
                if(s.highlightLinks) cls.push('a11y-highlight-links');
                if(s.simpleMode) cls.push('a11y-simple-mode');
                if(cls.length) document.documentElement.classList.add.apply(document.documentElement.classList, cls);
                var lang = localStorage.getItem('pa_language') || 'id';
                document.documentElement.lang = lang;
              } catch(e){}
            })();
          `
        }} />
      </head>
      <body className="bg-background text-foreground">
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
