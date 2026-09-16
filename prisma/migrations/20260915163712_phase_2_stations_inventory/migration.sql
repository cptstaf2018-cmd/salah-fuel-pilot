-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('TANKER_RECEIPT', 'DISPENSING', 'MANUAL_ADJUSTMENT', 'CORRECTION');

-- CreateTable
CREATE TABLE "station_users" (
    "id" UUID NOT NULL,
    "station_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "station_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fuel_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_inventory" (
    "id" UUID NOT NULL,
    "station_id" UUID NOT NULL,
    "fuel_type_id" UUID NOT NULL,
    "quantity_liters" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "minimum_threshold_liters" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fuel_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" UUID NOT NULL,
    "station_id" UUID NOT NULL,
    "fuel_type_id" UUID NOT NULL,
    "inventory_id" UUID NOT NULL,
    "type" "InventoryTransactionType" NOT NULL,
    "quantity_before" DECIMAL(14,3) NOT NULL,
    "quantity_change" DECIMAL(14,3) NOT NULL,
    "quantity_after" DECIMAL(14,3) NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "reason" TEXT,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "station_users_user_id_idx" ON "station_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "station_users_station_id_user_id_key" ON "station_users"("station_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "fuel_types_code_key" ON "fuel_types"("code");

-- CreateIndex
CREATE INDEX "fuel_types_is_active_idx" ON "fuel_types"("is_active");

-- CreateIndex
CREATE INDEX "fuel_inventory_station_id_idx" ON "fuel_inventory"("station_id");

-- CreateIndex
CREATE INDEX "fuel_inventory_fuel_type_id_idx" ON "fuel_inventory"("fuel_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "fuel_inventory_station_id_fuel_type_id_key" ON "fuel_inventory"("station_id", "fuel_type_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_station_id_fuel_type_id_idx" ON "inventory_transactions"("station_id", "fuel_type_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_inventory_id_idx" ON "inventory_transactions"("inventory_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_type_idx" ON "inventory_transactions"("type");

-- CreateIndex
CREATE INDEX "inventory_transactions_created_at_idx" ON "inventory_transactions"("created_at");

-- AddForeignKey
ALTER TABLE "station_users" ADD CONSTRAINT "station_users_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_users" ADD CONSTRAINT "station_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_inventory" ADD CONSTRAINT "fuel_inventory_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_inventory" ADD CONSTRAINT "fuel_inventory_fuel_type_id_fkey" FOREIGN KEY ("fuel_type_id") REFERENCES "fuel_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_fuel_type_id_fkey" FOREIGN KEY ("fuel_type_id") REFERENCES "fuel_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "fuel_inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
