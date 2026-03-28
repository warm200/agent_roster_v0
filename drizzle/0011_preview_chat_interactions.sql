create table "preview_chat_interactions" (
  "id" text primary key not null,
  "user_id" text not null references "users"("id") on delete cascade,
  "agent_id" text not null references "agents"("id") on delete cascade,
  "agent_slug" text not null,
  "latest_user_message" text not null,
  "message_count" integer not null,
  "messages_json" jsonb not null,
  "reply" text not null,
  "created_at" timestamp with time zone not null default now()
);
