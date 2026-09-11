-- ============================================================
-- 06. Activities & Notifications
-- ============================================================

-- activities
CREATE TABLE IF NOT EXISTS "public"."activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE CASCADE,
	"project_id" uuid REFERENCES "public"."projects"("id") ON DELETE CASCADE,
	"actor_id" uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
	"kind" varchar(50) NOT NULL,
	"verb" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "activities_project_created_idx" ON "public"."activities" ("project_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "activities_workspace_idx" ON "public"."activities" ("workspace_id");

-- notifications
CREATE TABLE IF NOT EXISTS "public"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text,
	"link" text,
	"dedupe_key" varchar(255),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "notifications_user_read_idx" ON "public"."notifications" ("user_id", "read_at");
CREATE INDEX IF NOT EXISTS "notifications_dedupe_idx" ON "public"."notifications" ("dedupe_key");
