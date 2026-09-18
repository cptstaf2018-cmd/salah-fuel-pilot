-- The unique constraint on (plate_number, plate_governorate, plate_category) never bound,
-- because both governorate and category are optional and Postgres treats NULL as distinct
-- from NULL. A plate registered without those parts could therefore be inserted any number
-- of times. Collapse the optional parts to '' so the constraint applies to every row.

-- Step 1: drop the duplicates the permissive constraint let through, keeping the earliest
-- registration. Only rows nothing else references are removed; a duplicate that already
-- holds an allocation or appointment is a real registration and must be resolved by hand,
-- so this migration fails loudly rather than deleting it.
DELETE FROM "vehicles" AS v
USING "vehicles" AS keeper
WHERE v."plate_number" = keeper."plate_number"
  AND COALESCE(v."plate_governorate", '') = COALESCE(keeper."plate_governorate", '')
  AND COALESCE(v."plate_category", '') = COALESCE(keeper."plate_category", '')
  AND (
    v."created_at" > keeper."created_at"
    OR (v."created_at" = keeper."created_at" AND v."id" > keeper."id")
  )
  AND NOT EXISTS (SELECT 1 FROM "allocations" a WHERE a."vehicle_id" = v."id")
  AND NOT EXISTS (SELECT 1 FROM "appointments" ap WHERE ap."vehicle_id" = v."id");

-- Step 2: normalise the remaining rows.
UPDATE "vehicles" SET "plate_governorate" = '' WHERE "plate_governorate" IS NULL;
UPDATE "vehicles" SET "plate_category" = '' WHERE "plate_category" IS NULL;

-- Step 3: make the absence of a governorate or category a real value rather than NULL,
-- which is what gives the existing unique index its teeth.
ALTER TABLE "vehicles"
  ALTER COLUMN "plate_governorate" SET DEFAULT '',
  ALTER COLUMN "plate_governorate" SET NOT NULL,
  ALTER COLUMN "plate_category" SET DEFAULT '',
  ALTER COLUMN "plate_category" SET NOT NULL;
