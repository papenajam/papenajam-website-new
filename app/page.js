'use client';
import dynamic from 'next/dynamic';

const DynamicHomepage = dynamic(() => import('@/components/DynamicHomepage'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#1b5e20] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-white/20 border-t-[#d4a017] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/70 text-sm">Memuat...</p>
      </div>
    </div>
  ),
});

export default function HomePage() {
  return <DynamicHomepage />;
}
