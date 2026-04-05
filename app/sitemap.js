export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // Static routes
  const staticRoutes = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/berita`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/pengumuman`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/agenda-sidang`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/pencarian-perkara`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/putusan`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/galeri`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/dokumen`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/pengaduan`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/pencarian`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];

  // Dynamic news routes
  let newsRoutes = [];
  try {
    const res = await fetch(`${baseUrl}/api/news?public=true&limit=100`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      newsRoutes = (data.items || []).map((item) => ({
        url: `${baseUrl}/berita/${item.id}`,
        lastModified: item.updatedAt ? new Date(item.updatedAt) : new Date(item.createdAt),
        changeFrequency: 'weekly',
        priority: 0.7,
      }));
    }
  } catch {}

  // Dynamic page routes
  let pageRoutes = [];
  try {
    const res = await fetch(`${baseUrl}/api/pages?public=true&limit=50`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      const pages = Array.isArray(data) ? data : (data.items || []);
      pageRoutes = pages
        .filter((p) => p.slug && p.slug !== '_homepage' && p.status === 'published')
        .map((p) => ({
          url: `${baseUrl}/halaman/${p.slug}`,
          lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
          changeFrequency: 'monthly',
          priority: 0.6,
        }));
    }
  } catch {}

  return [...staticRoutes, ...newsRoutes, ...pageRoutes];
}
