-- Record the moment fuel actually changes hands. Until now an appointment could
-- only be promised, never fulfilled: inventory rose on receipt and never fell,
-- so no citizen was ever recorded as having been served.

ALTER TABLE "appointments"
  ADD COLUMN "dispensed_at" TIMESTAMP(3),
  ADD COLUMN "dispensed_by_user_id" UUID,
  ADD COLUMN "dispensed_liters" DECIMAL(10,3);

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_dispensed_by_user_id_fkey"
  FOREIGN KEY ("dispensed_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reporting asks "what was dispensed today, per station", so both columns lead.
CREATE INDEX "appointments_dispensed_at_idx" ON "appointments"("dispensed_at");
CREATE INDEX "appointments_station_id_dispensed_at_idx"
  ON "appointments"("station_id", "dispensed_at");
