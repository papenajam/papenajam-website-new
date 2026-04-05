import BeritaDetailContent from './BeritaDetailContent';

export async function generateMetadata({ params }) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/news/${params.id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return {
        title: 'Berita Tidak Ditemukan',
        description: 'Berita yang Anda cari tidak ditemukan di website Pengadilan Agama Penajam.',
      };
    }
    const item = await res.json();
    const rawText = item.content?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || '';
    const description = rawText.substring(0, 160) || `Baca berita ${item.title} dari Pengadilan Agama Penajam.`;

    return {
      title: item.title,
      description,
      keywords: [item.category, item.author, 'berita pengadilan agama penajam', 'pengadilan agama penajam'].filter(Boolean).join(', '),
      openGraph: {
        title: item.title,
        description,
        type: 'article',
        publishedTime: item.publishedAt || item.createdAt,
        modifiedTime: item.updatedAt,
        authors: item.author ? [item.author] : [],
        tags: item.category ? [item.category] : [],
        images: item.image
          ? [{ url: item.image, alt: item.imageAlt || item.title, width: 1200, height: 630 }]
          : [],
      },
      twitter: {
        card: 'summary_large_image',
        title: item.title,
        description,
        images: item.image ? [item.image] : [],
      },
      alternates: {
        canonical: `${baseUrl}/berita/${params.id}`,
      },
    };
  } catch {
    return {
      title: 'Berita',
      description: 'Berita terkini dari Pengadilan Agama Penajam.',
    };
  }
}

export default function BeritaDetailPage() {
  return <BeritaDetailContent />;
}
