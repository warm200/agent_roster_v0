CREATE TYPE "public"."credit_top_up_pack_id" AS ENUM('quick_refill', 'builder_pack', 'power_pack');

CREATE TABLE "subscription_credit_top_ups" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "subscription_id" text,
  "pack_id" "credit_top_up_pack_id" NOT NULL,
  "credits_total" integer NOT NULL,
  "credits_remaining" integer NOT NULL,
  "price_cents" integer NOT NULL,
  "currency" text NOT NULL,
  "stripe_checkout_session_id" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "subscription_credit_top_ups"
  ADD CONSTRAINT "subscription_credit_top_ups_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "subscription_credit_top_ups"
  ADD CONSTRAINT "subscription_credit_top_ups_subscription_id_user_subscriptions_id_fk"
  FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX "subscription_credit_top_ups_checkout_session_idx"
  ON "subscription_credit_top_ups" USING btree ("stripe_checkout_session_id");
