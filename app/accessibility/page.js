'use client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Scale, CheckCircle, Phone, Mail, Globe, Monitor, Ear, Eye, Brain, Keyboard } from 'lucide-react';
import Link from 'next/link';

export default function AccessibilityPage() {
  const { lang } = useLanguage();
  const id = lang === 'id';

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white" role="banner">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/"
            aria-label={id ? 'Kembali ke beranda' : 'Back to homepage'}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <Scale className="w-5 h-5 text-[#c9a84c]" aria-hidden="true" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">
                {id ? 'Pengadilan Agama' : 'Religious Court'}
              </p>
              <p className="font-extrabold text-[#c9a84c] leading-tight">Penajam</p>
            </div>
          </Link>
        </div>
      </header>

      <main id="main-content" className="container mx-auto px-4 py-12 max-w-4xl" role="main">
        {/* Page Title */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
              <span className="text-2xl" aria-hidden="true">♿</span>
            </div>
            <h1 className="text-3xl font-extrabold text-[#1e3a5f]">
              {id ? 'Pernyataan Aksesibilitas' : 'Accessibility Statement'}
            </h1>
          </div>
          <p className="text-gray-500 text-lg">
            {id
              ? 'Pengadilan Agama Penajam berkomitmen untuk memastikan aksesibilitas digital bagi semua pengguna.'
              : 'Penajam Religious Court is committed to ensuring digital accessibility for all users.'}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            {id ? 'Terakhir diperbarui: Juni 2025' : 'Last updated: June 2025'}
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-10">

          {/* Commitment */}
          <section aria-labelledby="commitment-heading">
            <h2 id="commitment-heading" className="text-xl font-bold text-[#1e3a5f] mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" aria-hidden="true" />
              {id ? 'Komitmen Aksesibilitas' : 'Accessibility Commitment'}
            </h2>
            <div className="bg-green-50 border border-green-100 rounded-xl p-6 text-gray-700 space-y-3">
              <p>
                {id
                  ? 'Pengadilan Agama Penajam berkomitmen untuk menyediakan website yang dapat diakses oleh semua orang, termasuk penyandang disabilitas, lansia, dan pengguna dengan kebutuhan khusus. Kami berupaya memenuhi standar Web Content Accessibility Guidelines (WCAG) 2.1 level AA.'
                  : 'Penajam Religious Court is committed to providing a website accessible to everyone, including people with disabilities, the elderly, and users with special needs. We strive to meet the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standard.'}
              </p>
              <p>
                {id
                  ? 'Website ini dirancang untuk dapat digunakan dengan berbagai teknologi asistif seperti pembaca layar, navigasi keyboard, dan alat aksesibilitas lainnya.'
                  : 'This website is designed to be usable with various assistive technologies such as screen readers, keyboard navigation, and other accessibility tools.'}
              </p>
            </div>
          </section>

          {/* Supported Technologies */}
          <section aria-labelledby="tech-heading">
            <h2 id="tech-heading" className="text-xl font-bold text-[#1e3a5f] mb-4 flex items-center gap-2">
              <Monitor className="w-5 h-5 text-blue-500" aria-hidden="true" />
              {id ? 'Teknologi Asistif yang Didukung' : 'Supported Assistive Technologies'}
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { icon: Ear, title: id ? 'Pembaca Layar' : 'Screen Readers', desc: id ? 'NVDA, JAWS, VoiceOver, TalkBack' : 'NVDA, JAWS, VoiceOver, TalkBack' },
                { icon: Keyboard, title: id ? 'Navigasi Keyboard' : 'Keyboard Navigation', desc: id ? 'Tab, Enter, Arrow keys, Escape' : 'Tab, Enter, Arrow keys, Escape' },
                { icon: Eye, title: id ? 'Mode Kontras Tinggi' : 'High Contrast Mode', desc: id ? 'Didukung melalui toolbar aksesibilitas' : 'Supported via accessibility toolbar' },
                { icon: Brain, title: id ? 'Font Ramah Disleksia' : 'Dyslexia-Friendly Font', desc: id ? 'Tersedia di toolbar aksesibilitas' : 'Available in accessibility toolbar' },
              ].map((item, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-5 flex gap-4">
                  <div className="w-10 h-10 bg-[#1e3a5f]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-[#1e3a5f]" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1e3a5f] text-sm">{item.title}</h3>
                    <p className="text-gray-500 text-sm mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Features */}
          <section aria-labelledby="features-heading">
            <h2 id="features-heading" className="text-xl font-bold text-[#1e3a5f] mb-4">
              {id ? 'Fitur Aksesibilitas yang Tersedia' : 'Available Accessibility Features'}
            </h2>
            <ul className="space-y-3" role="list">
              {(id ? [
                'Toolbar aksesibilitas di sisi kiri halaman — tersedia di setiap halaman',
                'Tiga ukuran teks yang dapat disesuaikan: Normal, Besar, Sangat Besar',
                'Mode kontras tinggi untuk pengguna dengan gangguan penglihatan',
                'Mode gelap untuk mengurangi ketegangan mata',
                'Font ramah disleksia dengan spasi karakter yang ditingkatkan',
                'Penyorotan tautan untuk memudahkan identifikasi',
                'Panduan baca untuk membantu fokus pada teks',
                'Akses Sederhana — tata letak lebih besar dan lebih mudah digunakan',
                'Fitur Baca Halaman menggunakan teknologi text-to-speech',
                'Dukungan bilingual: Bahasa Indonesia dan Inggris',
                'Tombol lewati ke konten utama (Tab pertama)',
                'Semua gambar memiliki teks alternatif',
                'Navigasi keyboard penuh pada semua halaman',
              ] : [
                'Accessibility toolbar on the left side of every page',
                'Three adjustable text sizes: Normal, Large, Extra Large',
                'High contrast mode for users with visual impairments',
                'Dark mode to reduce eye strain',
                'Dyslexia-friendly font with enhanced character spacing',
                'Link highlighting for easy identification',
                'Reading guide to help focus on text',
                'Simple View mode — larger layout, easier to use',
                'Read Page feature using text-to-speech technology',
                'Bilingual support: Bahasa Indonesia and English',
                'Skip to main content button (first Tab)',
                'All images have alternative text',
                'Full keyboard navigation on all pages',
              ]).map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <span className="text-gray-700 text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* WCAG Compliance */}
          <section aria-labelledby="wcag-heading">
            <h2 id="wcag-heading" className="text-xl font-bold text-[#1e3a5f] mb-4">
              {id ? 'Kepatuhan WCAG 2.1' : 'WCAG 2.1 Compliance'}
            </h2>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 space-y-4">
              <p className="text-gray-700 text-sm">
                {id
                  ? 'Website ini berupaya memenuhi standar WCAG 2.1 Level AA. Berikut adalah area utama yang kami perhatikan:'
                  : 'This website strives to meet WCAG 2.1 Level AA standards. Below are the key areas we focus on:'}
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  { code: '1.4.3', desc: id ? 'Rasio kontras minimum 4.5:1 untuk teks normal' : 'Minimum contrast ratio 4.5:1 for normal text' },
                  { code: '1.4.4', desc: id ? 'Teks dapat diperbesar hingga 200% tanpa kehilangan konten' : 'Text can be resized up to 200% without loss of content' },
                  { code: '2.4.1', desc: id ? 'Lewati blok — tombol Skip to Content' : 'Bypass blocks — Skip to Content button' },
                  { code: '2.4.7', desc: id ? 'Fokus keyboard terlihat di semua elemen interaktif' : 'Keyboard focus visible on all interactive elements' },
                  { code: '1.1.1', desc: id ? 'Semua gambar memiliki teks alternatif' : 'All images have alternative text' },
                  { code: '2.5.5', desc: id ? 'Target klik minimal 44x44 piksel' : 'Minimum click target 44x44 pixels' },
                ].map(({ code, desc }) => (
                  <div key={code} className="flex items-start gap-2">
                    <span className="bg-[#1e3a5f] text-white text-xs font-bold px-2 py-0.5 rounded flex-shrink-0">{code}</span>
                    <span className="text-gray-600 text-sm">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Known Limitations */}
          <section aria-labelledby="limits-heading">
            <h2 id="limits-heading" className="text-xl font-bold text-[#1e3a5f] mb-4">
              {id ? 'Keterbatasan yang Diketahui' : 'Known Limitations'}
            </h2>
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-6">
              <p className="text-gray-700 text-sm">
                {id
                  ? 'Kami terus berupaya meningkatkan aksesibilitas. Beberapa konten PDF lama mungkin belum sepenuhnya dapat diakses. Jika Anda menemukan hambatan aksesibilitas, silakan hubungi kami.'
                  : 'We are continuously working to improve accessibility. Some older PDF content may not be fully accessible. If you encounter any accessibility barriers, please contact us.'}
              </p>
            </div>
          </section>

          {/* Feedback / Contact */}
          <section aria-labelledby="contact-heading">
            <h2 id="contact-heading" className="text-xl font-bold text-[#1e3a5f] mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5 text-[#c9a84c]" aria-hidden="true" />
              {id ? 'Hubungi Kami untuk Masukan Aksesibilitas' : 'Contact Us for Accessibility Feedback'}
            </h2>
            <div className="bg-[#1e3a5f] text-white rounded-xl p-6 space-y-4">
              <p className="text-white/80 text-sm">
                {id
                  ? 'Jika Anda mengalami kesulitan mengakses konten di website ini atau ingin memberikan masukan terkait aksesibilitas, silakan hubungi kami melalui:'
                  : 'If you experience difficulty accessing content on this website or wish to provide accessibility feedback, please contact us through:'}
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-[#c9a84c] flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wide">{id ? 'Telepon' : 'Phone'}</p>
                    <a href="tel:+625433371012" className="text-white font-medium hover:text-[#c9a84c] transition-colors">
                      (0543) 337-1012
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-[#c9a84c] flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wide">{id ? 'Email' : 'Email'}</p>
                    <a href="mailto:pa.penajam@gmail.com" className="text-white font-medium hover:text-[#c9a84c] transition-colors">
                      pa.penajam@gmail.com
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-[#c9a84c] flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wide">{id ? 'Alamat' : 'Address'}</p>
                    <p className="text-white font-medium">
                      Jl. Propinsi No. 01, Penajam, Kabupaten Penajam Paser Utara, Kalimantan Timur 76141
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-white/60 text-xs">
                {id
                  ? 'Kami berkomitmen merespons masukan aksesibilitas dalam 5 hari kerja.'
                  : 'We are committed to responding to accessibility feedback within 5 business days.'}
              </p>
            </div>
          </section>

          {/* Date */}
          <div className="border-t border-gray-100 pt-6">
            <p className="text-gray-400 text-sm text-center">
              {id
                ? 'Pernyataan aksesibilitas ini terakhir ditinjau pada Juni 2025 oleh tim pengembang Pengadilan Agama Penajam.'
                : 'This accessibility statement was last reviewed in June 2025 by the Penajam Religious Court development team.'}
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#1e3a5f] text-white py-6 mt-12" role="contentinfo">
        <div className="container mx-auto px-4 text-center">
          <p className="text-white/60 text-sm">
            &copy; {new Date().getFullYear()} Pengadilan Agama Penajam.{' '}
            {id ? 'Seluruh hak cipta dilindungi.' : 'All rights reserved.'}
          </p>
          <Link href="/" className="text-[#c9a84c] hover:underline text-sm mt-1 inline-block">
            {id ? '← Kembali ke Beranda' : '← Back to Home'}
          </Link>
        </div>
      </footer>
    </div>
  );
}
