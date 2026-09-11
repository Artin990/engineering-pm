-- ============================================================
-- 03. Projects, Cycles, Milestones, Modules & Documents
-- ============================================================

-- projects
CREATE TABLE IF NOT EXISTS "public"."projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE CASCADE,
	"key" varchar(10) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "public"."project_status" DEFAULT 'planning' NOT NULL,
	"health" "public"."project_health" DEFAULT 'on_track' NOT NULL,
	"target_date" date,
	"owner_id" uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
	"team_id" uuid REFERENCES "public"."teams"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "projects_workspace_key_idx" ON "public"."projects" ("workspace_id", "key");
CREATE INDEX IF NOT EXISTS "projects_workspace_idx" ON "public"."projects" ("workspace_id");

-- project_members
CREATE TABLE IF NOT EXISTS "public"."project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL REFERENCES "public"."projects"("id") ON DELETE CASCADE,
	"user_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
	"role" "public"."project_role" DEFAULT 'contributor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_members_uniq_idx" ON "public"."project_members" ("project_id", "user_id");
CREATE INDEX IF NOT EXISTS "project_members_user_idx" ON "public"."project_members" ("user_id");

-- milestones
CREATE TABLE IF NOT EXISTS "public"."milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL REFERENCES "public"."projects"("id") ON DELETE CASCADE,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "public"."milestone_status" DEFAULT 'planned' NOT NULL,
	"target_date" date,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "milestones_project_idx" ON "public"."milestones" ("project_id");

-- modules
CREATE TABLE IF NOT EXISTS "public"."modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL REFERENCES "public"."projects"("id") ON DELETE CASCADE,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "modules_project_idx" ON "public"."modules" ("project_id");

-- cycles
CREATE TABLE IF NOT EXISTS "public"."cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL REFERENCES "public"."projects"("id") ON DELETE CASCADE,
	"name" varchar(255) NOT NULL,
	"goal" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "public"."cycle_status" DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "cycles_project_status_idx" ON "public"."cycles" ("project_id", "status");

-- documents
CREATE TABLE IF NOT EXISTS "public"."documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL REFERENCES "public"."projects"("id") ON DELETE CASCADE,
	"title" varchar(255) NOT NULL,
	"body" text,
	"storage_path" text,
	"author_id" uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "documents_project_idx" ON "public"."documents" ("project_id");
