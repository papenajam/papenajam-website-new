export const IDS = Object.freeze({
  admin: '10000000-0000-4000-8000-000000000001',
  newsNewest: '20000000-0000-4000-8000-000000000001',
  newsOlder: '20000000-0000-4000-8000-000000000002',
  announcementActive: '30000000-0000-4000-8000-000000000001',
  announcementInactive: '30000000-0000-4000-8000-000000000002',
  serviceFirst: '40000000-0000-4000-8000-000000000001',
  serviceSecond: '40000000-0000-4000-8000-000000000002',
  caseNewest: '50000000-0000-4000-8000-000000000001',
  caseOlder: '50000000-0000-4000-8000-000000000002',
  pagePublished: '60000000-0000-4000-8000-000000000001',
  pageDraft: '60000000-0000-4000-8000-000000000002',
  agendaEarly: '70000000-0000-4000-8000-000000000001',
  agendaLate: '70000000-0000-4000-8000-000000000002',
  agendaCancelled: '70000000-0000-4000-8000-000000000003',
  putusanPublished: '80000000-0000-4000-8000-000000000001',
  putusanDraft: '80000000-0000-4000-8000-000000000002',
  sidebar: '90000000-0000-4000-8000-000000000001',
  gallery: 'a0000000-0000-4000-8000-000000000001',
  documentNewest: 'b0000000-0000-4000-8000-000000000001',
  documentOlder: 'b0000000-0000-4000-8000-000000000002',
  faq: 'c0000000-0000-4000-8000-000000000001',
  bannerNullEnd: 'd0000000-0000-4000-8000-000000000001',
  bannerEmptyEnd: 'd0000000-0000-4000-8000-000000000002',
  complaint: 'e0000000-0000-4000-8000-000000000001',
  menuParent: 'f0000000-0000-4000-8000-000000000001',
  menuChild: 'f0000000-0000-4000-8000-000000000002',
  mediaNewest: '11000000-0000-4000-8000-000000000001',
  mediaOlder: '11000000-0000-4000-8000-000000000002',
  survey: '12000000-0000-4000-8000-000000000001'
});

export function createSeedData(passwordHash) {
  return {
    users: [{
      id: IDS.admin,
      name: 'Contract Admin',
      email: 'contract-admin@example.test',
      password: passwordHash,
      role: 'superadmin',
      createdAt: '2024-01-01T00:00:00.000Z'
    }],
    news: [
      { id: IDS.newsNewest, title: 'Contract News Newest', content: '<p>Contract searchable alpha content</p>', author: 'Admin', category: 'Kegiatan', isPublished: true, publishDate: '2024-02-02', createdAt: '2024-02-02T10:00:00.000Z', updatedAt: '2024-02-02T10:00:00.000Z' },
      { id: IDS.newsOlder, title: 'Contract News Older', content: '<p>Older content</p>', author: 'Admin', category: 'Kegiatan', isPublished: false, publishDate: '', createdAt: '2024-01-01T10:00:00.000Z', updatedAt: '2024-01-01T10:00:00.000Z' }
    ],
    announcements: [
      { id: IDS.announcementActive, title: 'Contract Announcement Active', content: 'Contract searchable announcement', isActive: true, publishDate: '2024-02-01', createdAt: '2024-02-01T09:00:00.000Z', updatedAt: '2024-02-01T09:00:00.000Z' },
      { id: IDS.announcementInactive, title: 'Contract Announcement Inactive', content: 'Hidden', isActive: false, publishDate: '', createdAt: '2024-01-01T09:00:00.000Z', updatedAt: '2024-01-01T09:00:00.000Z' }
    ],
    services: [
      { id: IDS.serviceSecond, title: 'Second Service', description: 'Second', icon: 'FileText', order: 2, isActive: true, createdAt: '2024-01-02T00:00:00.000Z' },
      { id: IDS.serviceFirst, title: 'First Service', description: 'First', icon: 'Calendar', order: 1, isActive: true, createdAt: '2024-01-01T00:00:00.000Z' }
    ],
    cases: [
      { id: IDS.caseNewest, nomorPerkara: '0002/Pdt.G/2024/PA.Pnj', tahun: '2024', jenisPerkara: 'Cerai Gugat', pemohon: 'Siti Contract', termohon: 'Budi Contract', status: 'berjalan', jadwalSidang: '2024-03-01', ruangSidang: 'Ruang I', hakim: 'Hakim A', createdAt: '2024-02-02T00:00:00.000Z' },
      { id: IDS.caseOlder, nomorPerkara: '0001/Pdt.G/2024/PA.Pnj', tahun: '2024', jenisPerkara: 'Itsbat Nikah', pemohon: 'Rina', termohon: '-', status: 'selesai', jadwalSidang: '', ruangSidang: 'Ruang II', hakim: 'Hakim B', createdAt: '2024-01-01T00:00:00.000Z' }
    ],
    pages: [
      { id: IDS.pagePublished, title: 'Published Contract Page', slug: 'contract-published', status: 'published', blocks: [], createdAt: '2024-02-01T00:00:00.000Z', updatedAt: '2024-02-01T00:00:00.000Z' },
      { id: IDS.pageDraft, title: 'Draft Contract Page', slug: 'contract-draft', status: 'draft', blocks: [{ id: 'hero-contract', type: 'hero', settings: { title: 'Draft' } }], createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' }
    ],
    agenda: [
      { id: IDS.agendaLate, nomorPerkara: '0002/Pdt.G/2024/PA.Pnj', jenisPerkara: 'Cerai Gugat', tanggalSidang: '2024-03-02', waktuSidang: '09:00', ruangSidang: 'Ruang II', hakim: 'Hakim B', panitera: 'Panitera', status: 'dijadwalkan', keterangan: '', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
      { id: IDS.agendaEarly, nomorPerkara: '0001/Pdt.G/2024/PA.Pnj', jenisPerkara: 'Itsbat Nikah', tanggalSidang: '2024-03-01', waktuSidang: '08:30', ruangSidang: 'Ruang I', hakim: 'Hakim A', panitera: 'Panitera', status: 'selesai', keterangan: '', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
      { id: IDS.agendaCancelled, nomorPerkara: '0003/Pdt.G/2024/PA.Pnj', jenisPerkara: 'Waris', tanggalSidang: '2024-03-03', waktuSidang: '10:00', ruangSidang: 'Ruang I', hakim: 'Hakim A', panitera: 'Panitera', status: 'dibatalkan', keterangan: 'Dibatalkan', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' }
    ],
    putusan: [
      { id: IDS.putusanPublished, nomorPerkara: '0002/Pdt.G/2024/PA.Pnj', jenisPerkara: 'Cerai Gugat', tanggalPutusan: '2024-02-02', statusPublish: true, ringkasan: 'Published', fileUrl: '/uploads/pdfs/published.pdf', createdAt: '2024-02-02T00:00:00.000Z', updatedAt: '2024-02-02T00:00:00.000Z' },
      { id: IDS.putusanDraft, nomorPerkara: '0001/Pdt.G/2024/PA.Pnj', jenisPerkara: 'Waris', tanggalPutusan: '', statusPublish: false, ringkasan: '', fileUrl: '', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' }
    ],
    sidebar_widgets: [{ id: IDS.sidebar, title: 'Sidebar Contract', type: 'link', isActive: true, order: 1, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' }],
    gallery: [{ id: IDS.gallery, title: 'Gallery Contract', imageUrl: '/gallery.jpg', category: 'Kegiatan', isActive: true, order: 1, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' }],
    documents: [
      { id: IDS.documentNewest, title: 'Contract Document Newest', description: 'Contract searchable document', category: 'Laporan', fileUrl: '/documents/newest.pdf', isActive: true, downloadCount: 0, createdAt: '2024-02-02T00:00:00.000Z', updatedAt: '2024-02-02T00:00:00.000Z' },
      { id: IDS.documentOlder, title: 'Contract Document Older', description: '', category: 'Laporan', fileUrl: '/documents/older.pdf', isActive: true, downloadCount: 3, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' }
    ],
    faq: [{ id: IDS.faq, question: 'Contract searchable question?', answer: '<p>Contract answer</p>', category: 'Umum', isActive: true, order: 1, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' }],
    banners: [
      { id: IDS.bannerNullEnd, title: 'Null End Date', imageUrl: '/banner-null.jpg', isActive: true, order: 1, startDate: '2024-01-01', endDate: null, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
      { id: IDS.bannerEmptyEnd, title: 'Empty End Date', imageUrl: '/banner-empty.jpg', isActive: true, order: 2, startDate: '2024-01-01', endDate: '', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' }
    ],
    complaints: [{ id: IDS.complaint, name: 'Contract User', email: '', phone: null, message: 'Existing complaint', status: 'baru', adminNotes: '', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' }],
    analytics: [
      { date: '2024-01-01', path: '/', views: 2 },
      { date: '2024-01-02', path: '/faq', views: 3 }
    ],
    survey_config: [{ id: 'main', isActive: true, title: 'Contract Survey', subtitle: '' }],
    survey_responses: [{ id: IDS.survey, rating: 4, comment: '', createdAt: '2024-01-01T00:00:00.000Z' }],
    menus: [
      { id: IDS.menuParent, title: 'Contract Menu', url: '/', parentId: null, isActive: true, order: 1, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
      { id: IDS.menuChild, title: 'Contract Child', url: '/child', parentId: IDS.menuParent, isActive: true, order: 2, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' }
    ],
    settings: [
      { key: 'court_name', value: 'Pengadilan Agama Contract' },
      { key: 'empty_value', value: '' },
      { key: 'nullable_value', value: null }
    ],
    media: [
      { id: IDS.mediaNewest, filename: 'newest.png', originalName: 'newest.png', url: '/uploads/images/newest.png', type: 'image', mimeType: 'image/png', size: 100, ext: 'png', title: 'Newest', alt: '', uploadedBy: 'Contract Admin', createdAt: '2024-02-02T00:00:00.000Z', updatedAt: '2024-02-02T00:00:00.000Z' },
      { id: IDS.mediaOlder, filename: 'older.pdf', originalName: 'older.pdf', url: '/uploads/pdfs/older.pdf', type: 'pdf', mimeType: 'application/pdf', size: 200, ext: 'pdf', title: 'Older', alt: null, uploadedBy: 'Contract Admin', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' }
    ]
  };
}
