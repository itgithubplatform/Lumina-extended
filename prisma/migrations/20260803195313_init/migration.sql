-- CreateTable
CREATE TABLE "AdhdMaterial" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'processing',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdhdMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdhdSlide" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "textContent" TEXT NOT NULL,
    "order" DOUBLE PRECISION NOT NULL,
    "isClarification" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdhdSlide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdhdSlide_materialId_idx" ON "AdhdSlide"("materialId");

-- AddForeignKey
ALTER TABLE "AdhdSlide" ADD CONSTRAINT "AdhdSlide_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "AdhdMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
