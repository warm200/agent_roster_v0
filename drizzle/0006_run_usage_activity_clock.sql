ALTER TABLE "run_usage"
ADD COLUMN "last_meaningful_activity_at" timestamp with time zone;

UPDATE "run_usage"
SET "last_meaningful_activity_at" = COALESCE("running_started_at", "provider_accepted_at", "provisioning_started_at")
WHERE "last_meaningful_activity_at" IS NULL;
