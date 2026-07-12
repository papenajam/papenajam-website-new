import HalamanContent from './HalamanContent';

export async function generateMetadata({ params }) {
  try {
    const { slug } = await params;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/pages/slug/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return {
        title: 'Halaman Tidak Ditemukan',
        description: 'Halaman yang Anda cari tidak ditemukan di website Pengadilan Agama Penajam.',
      };
    }
    const page = await res.json();

    // Extract text from blocks for description
    let description = '';
    if (page.blocks && Array.isArray(page.blocks)) {
      for (const block of page.blocks) {
        const s = block.settings || {};
        if (block.type === 'hero' && s.subtitle) {
          description = s.subtitle;
          break;
        }
        if (block.type === 'text' && s.content) {
          description = s.content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().substring(0, 160);
          if (description) break;
        }
      }
    }

    if (!description) {
      description = `${page.title} - Pengadilan Agama Penajam Kelas I B, Kabupaten Penajam Paser Utara, Kalimantan Timur.`;
    }

    return {
      title: page.title,
      description,
      openGraph: {
        title: page.title,
        description,
        type: 'website',
      },
      alternates: {
        canonical: `${baseUrl}/halaman/${slug}`,
      },
    };
  } catch {
    return {
      title: 'Halaman',
      description: 'Website resmi Pengadilan Agama Penajam.',
    };
  }
}

export default function DynamicPage() {
  return <HalamanContent />;
}
