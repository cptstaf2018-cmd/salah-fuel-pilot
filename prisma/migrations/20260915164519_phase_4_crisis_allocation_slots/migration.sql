-- CreateEnum
CREATE TYPE "CrisisRuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('PENDING', 'ASSIGNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'READY', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "crisis_rules" (
    "id" UUID NOT NULL,
    "fuel_type_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "status" "CrisisRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT NOT NULL,
    "quota_liters" DECIMAL(10,3) NOT NULL,
    "cooldown_hours" INTEGER NOT NULL,
    "vehicles_per_station_per_hour" INTEGER NOT NULL,
    "included_vehicle_types" "VehicleType"[],
    "eligibility_rules" JSONB,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crisis_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crisis_rule_stations" (
    "id" UUID NOT NULL,
    "crisis_rule_id" UUID NOT NULL,
    "station_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crisis_rule_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_slots" (
    "id" UUID NOT NULL,
    "crisis_rule_id" UUID NOT NULL,
    "station_id" UUID NOT NULL,
    "fuel_type_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "booked_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocations" (
    "id" UUID NOT NULL,
    "crisis_rule_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "station_id" UUID NOT NULL,
    "time_slot_id" UUID NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'ASSIGNED',
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "crisis_rule_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "station_id" UUID NOT NULL,
    "fuel_type_id" UUID NOT NULL,
    "time_slot_id" UUID NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "quota_liters" DECIMAL(10,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crisis_rules_fuel_type_id_idx" ON "crisis_rules"("fuel_type_id");

-- CreateIndex
CREATE INDEX "crisis_rules_status_idx" ON "crisis_rules"("status");

-- CreateIndex
CREATE INDEX "crisis_rules_starts_at_ends_at_idx" ON "crisis_rules"("starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "crisis_rule_stations_station_id_idx" ON "crisis_rule_stations"("station_id");

-- CreateIndex
CREATE UNIQUE INDEX "crisis_rule_stations_crisis_rule_id_station_id_key" ON "crisis_rule_stations"("crisis_rule_id", "station_id");

-- CreateIndex
CREATE INDEX "time_slots_crisis_rule_id_idx" ON "time_slots"("crisis_rule_id");

-- CreateIndex
CREATE INDEX "time_slots_station_id_starts_at_idx" ON "time_slots"("station_id", "starts_at");

-- CreateIndex
CREATE INDEX "time_slots_booked_count_idx" ON "time_slots"("booked_count");

-- CreateIndex
CREATE UNIQUE INDEX "time_slots_station_id_fuel_type_id_starts_at_ends_at_key" ON "time_slots"("station_id", "fuel_type_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "allocations_station_id_idx" ON "allocations"("station_id");

-- CreateIndex
CREATE INDEX "allocations_time_slot_id_idx" ON "allocations"("time_slot_id");

-- CreateIndex
CREATE INDEX "allocations_status_idx" ON "allocations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "allocations_crisis_rule_id_vehicle_id_key" ON "allocations"("crisis_rule_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "appointments_station_id_status_idx" ON "appointments"("station_id", "status");

-- CreateIndex
CREATE INDEX "appointments_time_slot_id_idx" ON "appointments"("time_slot_id");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_crisis_rule_id_vehicle_id_key" ON "appointments"("crisis_rule_id", "vehicle_id");

-- AddForeignKey
ALTER TABLE "crisis_rules" ADD CONSTRAINT "crisis_rules_fuel_type_id_fkey" FOREIGN KEY ("fuel_type_id") REFERENCES "fuel_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crisis_rules" ADD CONSTRAINT "crisis_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crisis_rule_stations" ADD CONSTRAINT "crisis_rule_stations_crisis_rule_id_fkey" FOREIGN KEY ("crisis_rule_id") REFERENCES "crisis_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crisis_rule_stations" ADD CONSTRAINT "crisis_rule_stations_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_crisis_rule_id_fkey" FOREIGN KEY ("crisis_rule_id") REFERENCES "crisis_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_fuel_type_id_fkey" FOREIGN KEY ("fuel_type_id") REFERENCES "fuel_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_crisis_rule_id_fkey" FOREIGN KEY ("crisis_rule_id") REFERENCES "crisis_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "time_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_crisis_rule_id_fkey" FOREIGN KEY ("crisis_rule_id") REFERENCES "crisis_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_fuel_type_id_fkey" FOREIGN KEY ("fuel_type_id") REFERENCES "fuel_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "time_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
