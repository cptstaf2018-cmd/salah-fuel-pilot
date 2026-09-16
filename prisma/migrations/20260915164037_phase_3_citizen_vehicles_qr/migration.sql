-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('PRIVATE_CAR', 'TAXI', 'BUS', 'TRUCK', 'MOTORCYCLE', 'GOVERNMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "VehicleRegistrationStatus" AS ENUM ('PENDING_ALLOCATION', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateTable
CREATE TABLE "vehicle_owners" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "fuel_type_id" UUID NOT NULL,
    "plate_number" TEXT NOT NULL,
    "plate_governorate" TEXT,
    "plate_category" TEXT,
    "plate_metadata" JSONB,
    "vehicle_type" "VehicleType" NOT NULL,
    "registration_status" "VehicleRegistrationStatus" NOT NULL DEFAULT 'PENDING_ALLOCATION',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_qr_tokens" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_qr_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_owners_user_id_key" ON "vehicle_owners"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_owners_phone_key" ON "vehicle_owners"("phone");

-- CreateIndex
CREATE INDEX "vehicle_owners_phone_idx" ON "vehicle_owners"("phone");

-- CreateIndex
CREATE INDEX "vehicles_owner_id_idx" ON "vehicles"("owner_id");

-- CreateIndex
CREATE INDEX "vehicles_fuel_type_id_idx" ON "vehicles"("fuel_type_id");

-- CreateIndex
CREATE INDEX "vehicles_registration_status_idx" ON "vehicles"("registration_status");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_number_plate_governorate_plate_category_key" ON "vehicles"("plate_number", "plate_governorate", "plate_category");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_qr_tokens_public_id_key" ON "vehicle_qr_tokens"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_qr_tokens_token_hash_key" ON "vehicle_qr_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "vehicle_qr_tokens_vehicle_id_idx" ON "vehicle_qr_tokens"("vehicle_id");

-- AddForeignKey
ALTER TABLE "vehicle_owners" ADD CONSTRAINT "vehicle_owners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "vehicle_owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_fuel_type_id_fkey" FOREIGN KEY ("fuel_type_id") REFERENCES "fuel_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_qr_tokens" ADD CONSTRAINT "vehicle_qr_tokens_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
