ALTER TYPE "public"."subscription_status" ADD VALUE IF NOT EXISTS 'expired';
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."credit_ledger_event_type" AS ENUM(
  'grant',
  'reset',
  'reserve',
  'commit',
  'refund',
  'adjust',
  'expire',
  'shadow_usage_estimate'
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."credit_ledger_unit_type" AS ENUM(
  'launch_credit',
  'wake_credit',
  'always_on_budget',
  'fair_use_adjustment'
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."credit_ledger_status" AS ENUM('pending', 'committed', 'reversed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "plan_version" text DEFAULT 'v1';
--> statement-breakpoint
UPDATE "user_subscriptions" SET "plan_version" = 'v1' WHERE "plan_version" IS NULL;
--> statement-breakpoint
ALTER TABLE "user_subscriptions" ALTER COLUMN "plan_version" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_ledger" RENAME COLUMN "balance_after" TO "resulting_balance";
EXCEPTION
 WHEN undefined_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_ledger" RENAME COLUMN "reason" TO "reason_code";
EXCEPTION
 WHEN undefined_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_ledger" RENAME COLUMN "metadata" TO "metadata_json";
EXCEPTION
 WHEN undefined_column THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "order_id" text;
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "run_id" text;
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "event_type" "credit_ledger_event_type";
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "unit_type" "credit_ledger_unit_type";
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "status" "credit_ledger_status" DEFAULT 'committed';
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
--> statement-breakpoint
UPDATE "credit_ledger"
SET
  "event_type" = CASE WHEN "reason_code" = 'subscription_update' THEN 'reset'::"credit_ledger_event_type" ELSE 'grant'::"credit_ledger_event_type" END,
  "unit_type" = 'launch_credit'::"credit_ledger_unit_type",
  "status" = COALESCE("status", 'committed'::"credit_ledger_status"),
  "idempotency_key" = COALESCE("idempotency_key", CONCAT('legacy:', "id"))
WHERE "event_type" IS NULL
   OR "unit_type" IS NULL
   OR "status" IS NULL
   OR "idempotency_key" IS NULL;
--> statement-breakpoint
ALTER TABLE "credit_ledger" ALTER COLUMN "event_type" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "credit_ledger" ALTER COLUMN "unit_type" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "credit_ledger" ALTER COLUMN "status" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "credit_ledger" ALTER COLUMN "idempotency_key" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_ledger_idempotency_idx" ON "credit_ledger" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "run_usage" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text NOT NULL,
  "user_id" text NOT NULL,
  "order_id" text NOT NULL,
  "plan_id" "subscription_plan_id" NOT NULL,
  "plan_version" text DEFAULT 'v1' NOT NULL,
  "trigger_mode_snapshot" text NOT NULL,
  "agent_count" integer NOT NULL,
  "uses_real_workspace" boolean DEFAULT false NOT NULL,
  "uses_tools" boolean DEFAULT false NOT NULL,
  "network_enabled" boolean DEFAULT false NOT NULL,
  "provisioning_started_at" timestamp with time zone,
  "provider_accepted_at" timestamp with time zone,
  "running_started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "workspace_released_at" timestamp with time zone,
  "termination_reason" text,
  "workspace_minutes" integer,
  "tool_calls_count" integer,
  "input_tokens_est" integer,
  "output_tokens_est" integer,
  "estimated_internal_cost_cents" integer,
  "status_snapshot" "run_status" NOT NULL,
  "ttl_policy_snapshot" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "run_usage" ADD CONSTRAINT "run_usage_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "run_usage" ADD CONSTRAINT "run_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "run_usage" ADD CONSTRAINT "run_usage_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "run_usage_run_idx" ON "run_usage" USING btree ("run_id");
