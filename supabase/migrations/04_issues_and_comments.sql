-- ============================================================
-- 04. Issues, Labels, Comments & Dependencies
-- ============================================================

-- labels
CREATE TABLE IF NOT EXISTS "public"."labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL REFERENCES "public"."projects"("id") ON DELETE CASCADE,
	"name" varchar(100) NOT NULL,
	"color" varchar(20) DEFAULT '#71717A' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "labels_project_name_idx" ON "public"."labels" ("project_id", "name");

-- issues
CREATE TABLE IF NOT EXISTS "public"."issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL REFERENCES "public"."projects"("id") ON DELETE CASCADE,
	"key" varchar(20) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"status" "public"."issue_status" DEFAULT 'backlog' NOT NULL,
	"priority" "public"."issue_priority" DEFAULT 'none' NOT NULL,
	"type" "public"."issue_type" DEFAULT 'task' NOT NULL,
	"estimate" integer DEFAULT 1 NOT NULL,
	"due_date" date,
	"parent_id" uuid REFERENCES "public"."issues"("id") ON DELETE SET NULL,
	"milestone_id" uuid REFERENCES "public"."milestones"("id") ON DELETE SET NULL,
	"module_id" uuid REFERENCES "public"."modules"("id") ON DELETE SET NULL,
	"cycle_id" uuid REFERENCES "public"."cycles"("id") ON DELETE SET NULL,
	"assignee_id" uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
	"created_by" uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "issues_project_key_idx" ON "public"."issues" ("project_id", "key");
CREATE INDEX IF NOT EXISTS "issues_project_status_idx" ON "public"."issues" ("project_id", "status");
CREATE INDEX IF NOT EXISTS "issues_cycle_idx" ON "public"."issues" ("cycle_id");
CREATE INDEX IF NOT EXISTS "issues_assignee_idx" ON "public"."issues" ("assignee_id");
CREATE INDEX IF NOT EXISTS "issues_milestone_idx" ON "public"."issues" ("milestone_id");
CREATE INDEX IF NOT EXISTS "issues_parent_idx" ON "public"."issues" ("parent_id");

-- issue_labels
CREATE TABLE IF NOT EXISTS "public"."issue_labels" (
	"issue_id" uuid NOT NULL REFERENCES "public"."issues"("id") ON DELETE CASCADE,
	"label_id" uuid NOT NULL REFERENCES "public"."labels"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "issue_labels_uniq_idx" ON "public"."issue_labels" ("issue_id", "label_id");
CREATE INDEX IF NOT EXISTS "issue_labels_label_idx" ON "public"."issue_labels" ("label_id");

-- issue_assignees
CREATE TABLE IF NOT EXISTS "public"."issue_assignees" (
	"issue_id" uuid NOT NULL REFERENCES "public"."issues"("id") ON DELETE CASCADE,
	"user_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "issue_assignees_uniq_idx" ON "public"."issue_assignees" ("issue_id", "user_id");
CREATE INDEX IF NOT EXISTS "issue_assignees_user_idx" ON "public"."issue_assignees" ("user_id");

-- issue_dependencies
CREATE TABLE IF NOT EXISTS "public"."issue_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL REFERENCES "public"."issues"("id") ON DELETE CASCADE,
	"depends_on_id" uuid NOT NULL REFERENCES "public"."issues"("id") ON DELETE CASCADE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "issue_dependencies_uniq_idx" ON "public"."issue_dependencies" ("issue_id", "depends_on_id");
CREATE INDEX IF NOT EXISTS "issue_dependencies_depends_on_idx" ON "public"."issue_dependencies" ("depends_on_id");

-- issue_comments
CREATE TABLE IF NOT EXISTS "public"."issue_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL REFERENCES "public"."issues"("id") ON DELETE CASCADE,
	"author_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "issue_comments_issue_idx" ON "public"."issue_comments" ("issue_id");
