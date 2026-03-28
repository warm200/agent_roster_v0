CREATE TABLE IF NOT EXISTS "admin_runtime_grants" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "granted_by_user_id" text,
  "credits_total" integer NOT NULL,
  "credits_remaining" integer NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "admin_runtime_grants"
    ADD CONSTRAINT "admin_runtime_grants_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "admin_runtime_grants"
    ADD CONSTRAINT "admin_runtime_grants_granted_by_user_id_users_id_fk"
    FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
