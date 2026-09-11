-- ============================================================
-- 02. Identity & Workspaces
-- ============================================================

-- profiles: نگهداری مشخصات کاربر (مرتبط با auth.users در Supabase)
CREATE TABLE IF NOT EXISTS "public"."profiles" (
	"id" uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
	"display_name" varchar(255) DEFAULT '' NOT NULL,
	"avatar_url" text,
	"github_login" varchar(255),
	"email" varchar(320),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- workspaces
CREATE TABLE IF NOT EXISTS "public"."workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"logo_url" text,
	"owner_id" uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_slug_idx" ON "public"."workspaces" ("slug");

-- workspace_members
CREATE TABLE IF NOT EXISTS "public"."workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE CASCADE,
	"user_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
	"role" "public"."workspace_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_members_uniq_idx" ON "public"."workspace_members" ("workspace_id", "user_id");
CREATE INDEX IF NOT EXISTS "workspace_members_user_idx" ON "public"."workspace_members" ("user_id");

-- teams
CREATE TABLE IF NOT EXISTS "public"."teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE CASCADE,
	"name" varchar(255) NOT NULL,
	"description" text,
	"lead_id" uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "teams_workspace_idx" ON "public"."teams" ("workspace_id");

-- team_members
CREATE TABLE IF NOT EXISTS "public"."team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL REFERENCES "public"."teams"("id") ON DELETE CASCADE,
	"user_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "team_members_uniq_idx" ON "public"."team_members" ("team_id", "user_id");
CREATE INDEX IF NOT EXISTS "team_members_user_idx" ON "public"."team_members" ("user_id");
