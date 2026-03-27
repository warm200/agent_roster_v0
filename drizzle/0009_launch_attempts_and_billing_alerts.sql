DO $$
BEGIN
  CREATE TYPE "public"."launch_attempt_result" AS ENUM('blocked', 'reserved', 'provider_accepted', 'failed_before_accept');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "public"."billing_alert_type" AS ENUM('stale_reserve', 'balance_mismatch', 'negative_balance', 'duplicate_idempotency', 'refund_chain_error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "public"."billing_alert_severity" AS ENUM('info', 'warning', 'critical');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "launch_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "order_id" text NOT NULL,
  "run_id" text,
  "plan_code_snapshot" text NOT NULL,
  "agent_count_snapshot" integer NOT NULL,
  "remaining_credits_snapshot" integer,
  "attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "result" "launch_attempt_result" NOT NULL,
  "blocker_reason" text,
  "metadata_json" jsonb NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "launch_attempts"
    ADD CONSTRAINT "launch_attempts_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "launch_attempts"
    ADD CONSTRAINT "launch_attempts_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "launch_attempts"
    ADD CONSTRAINT "launch_attempts_run_id_runs_id_fk"
    FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "launch_attempts_run_idx" ON "launch_attempts" USING btree ("run_id");

CREATE TABLE IF NOT EXISTS "billing_alerts" (
  "id" text PRIMARY KEY NOT NULL,
  "alert_type" "billing_alert_type" NOT NULL,
  "severity" "billing_alert_severity" NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text,
  "message" text NOT NULL,
  "metadata_json" jsonb NOT NULL,
  "acknowledged_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
