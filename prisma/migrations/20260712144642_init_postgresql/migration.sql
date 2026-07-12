-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "content" TEXT NOT NULL,
    "contentEn" TEXT,
    "image" TEXT,
    "imageAlt" TEXT,
    "imageAltEn" TEXT,
    "author" TEXT,
    "category" TEXT,
    "isPublished" BOOLEAN NOT NULL,
    "publishDate" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "publishDate" DATE,
    "isActive" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" UUID NOT NULL,
    "nomorPerkara" TEXT NOT NULL,
    "tahun" TEXT NOT NULL,
    "jenisPerkara" TEXT NOT NULL,
    "pemohon" TEXT,
    "termohon" TEXT,
    "status" TEXT,
    "jadwalSidang" DATE,
    "ruangSidang" TEXT,
    "hakim" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agenda" (
    "id" UUID NOT NULL,
    "nomorPerkara" TEXT NOT NULL,
    "jenisPerkara" TEXT,
    "tanggalSidang" DATE NOT NULL,
    "waktuSidang" TEXT,
    "ruangSidang" TEXT,
    "hakim" TEXT,
    "panitera" TEXT,
    "status" TEXT,
    "keterangan" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "putusan" (
    "id" UUID NOT NULL,
    "nomorPerkara" TEXT NOT NULL,
    "jenisPerkara" TEXT,
    "tanggalPutusan" DATE,
    "ringkasanPutusan" TEXT,
    "filePutusan" TEXT,
    "hakim" TEXT,
    "statusPublish" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "putusan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "blocks" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menus" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "labelEn" TEXT,
    "url" TEXT NOT NULL,
    "type" TEXT,
    "icon" TEXT,
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "parentId" UUID,
    "description" TEXT,
    "descriptionEn" TEXT,
    "target" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sidebar_widgets" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelEn" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL,
    "order" INTEGER NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "sidebar_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "description" TEXT,
    "category" TEXT,
    "imageUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "gallery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "description" TEXT,
    "category" TEXT,
    "fileUrl" TEXT,
    "fileType" TEXT,
    "isActive" BOOLEAN NOT NULL,
    "order" INTEGER NOT NULL,
    "downloadCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq" (
    "id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "questionEn" TEXT,
    "answer" TEXT NOT NULL,
    "answerEn" TEXT,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "buttonText" TEXT,
    "buttonUrl" TEXT,
    "imageUrl" TEXT,
    "bgColor" TEXT,
    "textColor" TEXT,
    "isActive" BOOLEAN NOT NULL,
    "order" INTEGER NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "category" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "path" TEXT NOT NULL,
    "views" INTEGER NOT NULL,

    CONSTRAINT "analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_config" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "thankYouMessage" TEXT,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "survey_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "page" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER NOT NULL,
    "ext" TEXT,
    "title" TEXT,
    "alt" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "news_isPublished_createdAt_idx" ON "news"("isPublished", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "news_createdAt_idx" ON "news"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "announcements_isActive_createdAt_idx" ON "announcements"("isActive", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "services_order_idx" ON "services"("order");

-- CreateIndex
CREATE INDEX "services_isActive_order_idx" ON "services"("isActive", "order");

-- CreateIndex
CREATE INDEX "cases_createdAt_idx" ON "cases"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "cases_tahun_idx" ON "cases"("tahun");

-- CreateIndex
CREATE INDEX "cases_status_idx" ON "cases"("status");

-- CreateIndex
CREATE INDEX "cases_jenisPerkara_idx" ON "cases"("jenisPerkara");

-- CreateIndex
CREATE INDEX "agenda_tanggalSidang_waktuSidang_idx" ON "agenda"("tanggalSidang", "waktuSidang");

-- CreateIndex
CREATE INDEX "agenda_status_idx" ON "agenda"("status");

-- CreateIndex
CREATE INDEX "agenda_nomorPerkara_idx" ON "agenda"("nomorPerkara");

-- CreateIndex
CREATE INDEX "putusan_statusPublish_createdAt_idx" ON "putusan"("statusPublish", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "putusan_createdAt_idx" ON "putusan"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_key" ON "pages"("slug");

-- CreateIndex
CREATE INDEX "pages_status_createdAt_idx" ON "pages"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "menus_parentId_order_idx" ON "menus"("parentId", "order");

-- CreateIndex
CREATE INDEX "menus_isActive_order_idx" ON "menus"("isActive", "order");

-- CreateIndex
CREATE INDEX "sidebar_widgets_isActive_order_idx" ON "sidebar_widgets"("isActive", "order");

-- CreateIndex
CREATE INDEX "gallery_isActive_category_order_idx" ON "gallery"("isActive", "category", "order");

-- CreateIndex
CREATE INDEX "gallery_order_createdAt_idx" ON "gallery"("order", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "documents_isActive_category_createdAt_idx" ON "documents"("isActive", "category", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "documents_createdAt_idx" ON "documents"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "faq_isActive_category_order_idx" ON "faq"("isActive", "category", "order");

-- CreateIndex
CREATE INDEX "banners_isActive_order_idx" ON "banners"("isActive", "order");

-- CreateIndex
CREATE INDEX "banners_isActive_endDate_idx" ON "banners"("isActive", "endDate");

-- CreateIndex
CREATE INDEX "complaints_status_createdAt_idx" ON "complaints"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "complaints_createdAt_idx" ON "complaints"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "analytics_date_idx" ON "analytics"("date" DESC);

-- CreateIndex
CREATE INDEX "analytics_views_idx" ON "analytics"("views" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_date_path_key" ON "analytics"("date", "path");

-- CreateIndex
CREATE INDEX "survey_responses_createdAt_idx" ON "survey_responses"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "media_createdAt_idx" ON "media"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "media_originalName_idx" ON "media"("originalName");

-- CreateIndex
CREATE INDEX "media_size_idx" ON "media"("size");

-- CreateIndex
CREATE INDEX "media_type_idx" ON "media"("type");

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "menus"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
