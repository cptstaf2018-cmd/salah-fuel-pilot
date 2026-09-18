-- CreateEnum
CREATE TYPE "NationalIdDocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "national_id_documents" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "front_path" TEXT NOT NULL,
    "back_path" TEXT NOT NULL,
    "status" "NationalIdDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "national_id_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "national_id_documents_vehicle_id_key" ON "national_id_documents"("vehicle_id");

-- CreateIndex
CREATE INDEX "national_id_documents_status_idx" ON "national_id_documents"("status");

-- AddForeignKey
ALTER TABLE "national_id_documents" ADD CONSTRAINT "national_id_documents_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
