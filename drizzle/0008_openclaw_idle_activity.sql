ALTER TABLE "run_usage"
ADD COLUMN "last_openclaw_session_activity_at" timestamp with time zone;

ALTER TABLE "run_usage"
ADD COLUMN "last_openclaw_session_probe_at" timestamp with time zone;

ALTER TABLE "run_usage"
ADD COLUMN "openclaw_session_count" integer;
