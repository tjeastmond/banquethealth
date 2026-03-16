ALTER TABLE "diet_orders"
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

UPDATE "diet_orders"
SET "is_active" = false
WHERE id = 'f5f6e246-0cf6-4eb6-a6f1-fcb894c888ce';
