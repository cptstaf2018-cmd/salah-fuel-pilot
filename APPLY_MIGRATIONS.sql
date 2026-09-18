-- ============================================================================
--  منظومة وقود صلاح الدين — تطبيق الترحيلات يدوياً
--  الصق هذا كاملاً في: Supabase → SQL Editor → New query → Run
--
--  آمن للتشغيل أكثر من مرة: كل خطوة تتحقق قبل أن تنفّذ.
--  لا يحذف أي بيانات إلا النسخ المكررة من نفس اللوحة (ويُبقي الأقدم).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- ١) حذف تسجيلات اللوحات المكررة
--
-- قيد التفرد على (اللوحة، المحافظة، الصنف) لم يكن فعّالاً: الحقلان الأخيران
-- اختياريان، وPostgres يعتبر NULL مختلفاً عن NULL — فأمكن تسجيل نفس اللوحة
-- مرات بلا حد. نُبقي أقدم تسجيل ونحذف ما بعده، وفقط ما لا يرتبط بحصة مخصصة.
-- ----------------------------------------------------------------------------
DELETE FROM "vehicles" AS v
USING "vehicles" AS keeper
WHERE v."plate_number" = keeper."plate_number"
  AND COALESCE(v."plate_governorate", '') = COALESCE(keeper."plate_governorate", '')
  AND COALESCE(v."plate_category", '')    = COALESCE(keeper."plate_category", '')
  AND (
    v."created_at" > keeper."created_at"
    OR (v."created_at" = keeper."created_at" AND v."id" > keeper."id")
  )
  AND NOT EXISTS (SELECT 1 FROM "allocations"  a  WHERE a."vehicle_id"  = v."id")
  AND NOT EXISTS (SELECT 1 FROM "appointments" ap WHERE ap."vehicle_id" = v."id");

-- ----------------------------------------------------------------------------
-- ٢) تحويل القيم الفارغة إلى '' حتى يصبح قيد التفرد فعّالاً
-- ----------------------------------------------------------------------------
UPDATE "vehicles" SET "plate_governorate" = '' WHERE "plate_governorate" IS NULL;
UPDATE "vehicles" SET "plate_category"    = '' WHERE "plate_category"    IS NULL;

ALTER TABLE "vehicles"
  ALTER COLUMN "plate_governorate" SET DEFAULT '',
  ALTER COLUMN "plate_governorate" SET NOT NULL,
  ALTER COLUMN "plate_category"    SET DEFAULT '',
  ALTER COLUMN "plate_category"    SET NOT NULL;

-- ----------------------------------------------------------------------------
-- ٣) أعمدة الصرف — اللحظة التي يتسلم فيها المواطن الوقود فعلياً
--
-- بدونها كان المخزون يزيد فقط ولا ينقص أبداً، ولا يُسجَّل أي مواطن كمخدوم.
-- ----------------------------------------------------------------------------
ALTER TABLE "appointments"
  ADD COLUMN IF NOT EXISTS "dispensed_at"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dispensed_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "dispensed_liters"     DECIMAL(10,3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_dispensed_by_user_id_fkey'
  ) THEN
    ALTER TABLE "appointments"
      ADD CONSTRAINT "appointments_dispensed_by_user_id_fkey"
      FOREIGN KEY ("dispensed_by_user_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "appointments_dispensed_at_idx"
  ON "appointments"("dispensed_at");
CREATE INDEX IF NOT EXISTS "appointments_station_id_dispensed_at_idx"
  ON "appointments"("station_id", "dispensed_at");

-- ----------------------------------------------------------------------------
-- ٤) تسجيل الترحيلتين كمطبَّقتين في دفتر Prisma
--
-- هذه الخطوة ضرورية: بدونها سيحاول البناء القادم تطبيقهما من جديد فيفشل.
-- البصمات محسوبة من الملفات الفعلية في المستودع.
-- ----------------------------------------------------------------------------
INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES
  (
    gen_random_uuid()::text,
    'c540aee1180b9bf81fd08e47534054882ffc318a2c5e10ba43e7c298b4295300',
    now(),
    '20260918170000_enforce_unique_plate_identity',
    'applied manually via Supabase SQL editor',
    NULL,
    now(),
    1
  ),
  (
    gen_random_uuid()::text,
    '522be2edc387fb200ae795bcb7cbb8956a6f0e195dc30804363e42a4f40a6eda',
    now(),
    '20260918180000_appointment_dispensing',
    'applied manually via Supabase SQL editor',
    NULL,
    now(),
    1
  )
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================
--  تحقّق من النتيجة
-- ============================================================================
SELECT migration_name, finished_at
FROM "_prisma_migrations"
ORDER BY started_at DESC
LIMIT 7;

SELECT count(*) AS "عدد المركبات المتبقية" FROM "vehicles";

SELECT "plate_number", count(*) AS "نسخ"
FROM "vehicles"
GROUP BY "plate_number"
HAVING count(*) > 1;
