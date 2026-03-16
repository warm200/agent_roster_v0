DO $$ BEGIN
 CREATE TYPE "public"."runtime_mode" AS ENUM('temporary_execution', 'wakeable_recoverable', 'persistent_live_workspace');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."persistence_mode" AS ENUM('ephemeral', 'recoverable', 'live');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."runtime_instance_state" AS ENUM('provisioning', 'running', 'stopped', 'archived', 'deleted', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "runtime_instances" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text NOT NULL,
  "user_id" text NOT NULL,
  "order_id" text NOT NULL,
  "provider_name" text NOT NULL,
  "provider_instance_ref" text NOT NULL,
  "plan_id" "subscription_plan_id" NOT NULL,
  "runtime_mode" "runtime_mode" NOT NULL,
  "persistence_mode" "persistence_mode" NOT NULL,
  "state" "runtime_instance_state" NOT NULL,
  "stop_reason" text,
  "preserved_state_available" boolean DEFAULT false NOT NULL,
  "started_at" timestamp with time zone,
  "stopped_at" timestamp with time zone,
  "archived_at" timestamp with time zone,
  "deleted_at" timestamp with time zone,
  "recoverable_until_at" timestamp with time zone,
  "workspace_released_at" timestamp with time zone,
  "last_reconciled_at" timestamp with time zone,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "runtime_intervals" (
  "id" text PRIMARY KEY NOT NULL,
  "runtime_instance_id" text NOT NULL,
  "run_id" text NOT NULL,
  "provider_instance_ref" text NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "ended_at" timestamp with time zone,
  "close_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "runtime_instances" ADD CONSTRAINT "runtime_instances_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "runtime_instances" ADD CONSTRAINT "runtime_instances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "runtime_instances" ADD CONSTRAINT "runtime_instances_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "runtime_intervals" ADD CONSTRAINT "runtime_intervals_runtime_instance_id_runtime_instances_id_fk" FOREIGN KEY ("runtime_instance_id") REFERENCES "public"."runtime_instances"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "runtime_intervals" ADD CONSTRAINT "runtime_intervals_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "runtime_instances_provider_ref_idx" ON "runtime_instances" USING btree ("provider_instance_ref");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "runtime_instances_run_idx" ON "runtime_instances" USING btree ("run_id");
