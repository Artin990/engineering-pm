-- ============================================================
-- Flowdeck Complete Database Setup (All-in-One SQL)
-- اجرای این فایل در SQL Editor سوپابیس تمام جداول، ایندکس‌ها، RLS و پالیسی‌ها را می‌سازد.
-- ============================================================

-- 1. EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'member', 'viewer'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."project_role" AS ENUM('lead', 'contributor', 'viewer'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."project_status" AS ENUM('planning', 'active', 'on_hold', 'completed', 'archived'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."project_health" AS ENUM('on_track', 'at_risk', 'off_track', 'blocked'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."issue_status" AS ENUM('backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."issue_priority" AS ENUM('urgent', 'high', 'medium', 'low', 'none'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."issue_type" AS ENUM('task', 'bug', 'feature', 'improvement', 'chore', 'research'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."cycle_status" AS ENUM('planned', 'active', 'completed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."milestone_status" AS ENUM('planned', 'active', 'completed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."github_pr_state" AS ENUM('open', 'closed', 'merged', 'draft'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. PROFILES & WORKSPACES
CREATE TABLE IF NOT EXISTS "public"."profiles" (
	"id" uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
	"display_name" varchar(255) DEFAULT '' NOT NULL,
	"avatar_url" text,
	"github_login" varchar(255),
	"email" varchar(320),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

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

CREATE TABLE IF NOT EXISTS "public"."team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL REFERENCES "public"."teams"("id") ON DELETE CASCADE,
	"user_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "team_members_uniq_idx" ON "public"."team_members" ("team_id", "user_id");
CREATE INDEX IF NOT EXISTS "team_members_user_idx" ON "public"."team_members" ("user_id");

-- 3. PROJECTS, CYCLES, MILESTONES, MODULES & DOCUMENTS
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

-- 4. ISSUES, LABELS, COMMENTS & DEPENDENCIES
CREATE TABLE IF NOT EXISTS "public"."labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL REFERENCES "public"."projects"("id") ON DELETE CASCADE,
	"name" varchar(100) NOT NULL,
	"color" varchar(20) DEFAULT '#71717A' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "labels_project_name_idx" ON "public"."labels" ("project_id", "name");

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

CREATE TABLE IF NOT EXISTS "public"."issue_labels" (
	"issue_id" uuid NOT NULL REFERENCES "public"."issues"("id") ON DELETE CASCADE,
	"label_id" uuid NOT NULL REFERENCES "public"."labels"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "issue_labels_uniq_idx" ON "public"."issue_labels" ("issue_id", "label_id");
CREATE INDEX IF NOT EXISTS "issue_labels_label_idx" ON "public"."issue_labels" ("label_id");

CREATE TABLE IF NOT EXISTS "public"."issue_assignees" (
	"issue_id" uuid NOT NULL REFERENCES "public"."issues"("id") ON DELETE CASCADE,
	"user_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "issue_assignees_uniq_idx" ON "public"."issue_assignees" ("issue_id", "user_id");
CREATE INDEX IF NOT EXISTS "issue_assignees_user_idx" ON "public"."issue_assignees" ("user_id");

CREATE TABLE IF NOT EXISTS "public"."issue_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL REFERENCES "public"."issues"("id") ON DELETE CASCADE,
	"depends_on_id" uuid NOT NULL REFERENCES "public"."issues"("id") ON DELETE CASCADE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "issue_dependencies_uniq_idx" ON "public"."issue_dependencies" ("issue_id", "depends_on_id");
CREATE INDEX IF NOT EXISTS "issue_dependencies_depends_on_idx" ON "public"."issue_dependencies" ("depends_on_id");

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

-- 5. GITHUB INTEGRATION
CREATE TABLE IF NOT EXISTS "public"."github_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE CASCADE,
	"installation_id" bigint NOT NULL,
	"account_login" varchar(255) NOT NULL,
	"account_type" varchar(50) NOT NULL,
	"access_token" text,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "github_installations_uniq_idx" ON "public"."github_installations" ("workspace_id", "installation_id");

CREATE TABLE IF NOT EXISTS "public"."github_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" uuid NOT NULL REFERENCES "public"."github_installations"("id") ON DELETE CASCADE,
	"repo_id" bigint NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"default_branch" varchar(255) DEFAULT 'main' NOT NULL,
	"project_id" uuid REFERENCES "public"."projects"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "github_repositories_repo_id_idx" ON "public"."github_repositories" ("repo_id");
CREATE INDEX IF NOT EXISTS "github_repositories_project_idx" ON "public"."github_repositories" ("project_id");

CREATE TABLE IF NOT EXISTS "public"."github_branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL REFERENCES "public"."github_repositories"("id") ON DELETE CASCADE,
	"name" varchar(255) NOT NULL,
	"sha" varchar(40),
	"author_id" uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
	"issue_id" uuid REFERENCES "public"."issues"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "github_branches_repo_name_idx" ON "public"."github_branches" ("repo_id", "name");
CREATE INDEX IF NOT EXISTS "github_branches_issue_idx" ON "public"."github_branches" ("issue_id");

CREATE TABLE IF NOT EXISTS "public"."github_commits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL REFERENCES "public"."github_repositories"("id") ON DELETE CASCADE,
	"sha" varchar(40) NOT NULL,
	"message" text,
	"author_login" varchar(255),
	"author_id" uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
	"branch" varchar(255),
	"committed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "github_commits_repo_sha_idx" ON "public"."github_commits" ("repo_id", "sha");
CREATE INDEX IF NOT EXISTS "github_commits_author_idx" ON "public"."github_commits" ("author_id");

CREATE TABLE IF NOT EXISTS "public"."github_pull_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL REFERENCES "public"."github_repositories"("id") ON DELETE CASCADE,
	"pr_number" integer NOT NULL,
	"title" varchar(500),
	"body" text,
	"state" "public"."github_pr_state" DEFAULT 'open' NOT NULL,
	"author_login" varchar(255),
	"author_id" uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
	"head_branch" varchar(255),
	"base_branch" varchar(255),
	"url" text,
	"merged_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"github_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "github_prs_repo_number_idx" ON "public"."github_pull_requests" ("repo_id", "pr_number");
CREATE INDEX IF NOT EXISTS "github_pull_requests_repo_state_idx" ON "public"."github_pull_requests" ("repo_id", "state");

CREATE TABLE IF NOT EXISTS "public"."github_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pull_request_id" uuid NOT NULL REFERENCES "public"."github_pull_requests"("id") ON DELETE CASCADE,
	"review_id" bigint,
	"reviewer_login" varchar(255),
	"reviewer_id" uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
	"state" varchar(50),
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "github_reviews_review_id_idx" ON "public"."github_reviews" ("review_id");
CREATE INDEX IF NOT EXISTS "github_reviews_pr_idx" ON "public"."github_reviews" ("pull_request_id");

CREATE TABLE IF NOT EXISTS "public"."github_issue_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL REFERENCES "public"."issues"("id") ON DELETE CASCADE,
	"pull_request_id" uuid REFERENCES "public"."github_pull_requests"("id") ON DELETE CASCADE,
	"branch_id" uuid REFERENCES "public"."github_branches"("id") ON DELETE CASCADE,
	"suggested_status" "public"."issue_status",
	"suggestion_state" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "github_issue_links_issue_idx" ON "public"."github_issue_links" ("issue_id");
CREATE INDEX IF NOT EXISTS "github_issue_links_pr_idx" ON "public"."github_issue_links" ("pull_request_id");

CREATE TABLE IF NOT EXISTS "public"."github_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid NOT NULL,
	"event" varchar(100) NOT NULL,
	"action" varchar(100),
	"installation_id" bigint,
	"repo_full_name" varchar(255),
	"payload" jsonb,
	"processed_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'received' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "github_events_delivery_id_idx" ON "public"."github_events" ("delivery_id");
CREATE INDEX IF NOT EXISTS "github_events_status_idx" ON "public"."github_events" ("status");

-- 6. ACTIVITIES & NOTIFICATIONS
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

-- 7. HELPER FUNCTIONS & RLS
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = ws_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(ws_id uuid, allowed workspace_role[])
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = ws_id AND user_id = auth.uid() AND role = ANY (allowed));
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(prj_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_members WHERE project_id = prj_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id WHERE p.id = prj_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin'));
$$;

CREATE OR REPLACE FUNCTION public.has_project_role(prj_id uuid, allowed project_role[])
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_members WHERE project_id = prj_id AND user_id = auth.uid() AND role = ANY (allowed))
    OR EXISTS (SELECT 1 FROM public.projects p JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id WHERE p.id = prj_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin'));
$$;

-- ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_pull_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_issue_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- POLICIES
DROP POLICY IF EXISTS "profiles: خود یا عضو ورک‌اسپیس ببیند" ON public.profiles;
CREATE POLICY "profiles: خود یا عضو ورک‌اسپیس ببیند" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR EXISTS (SELECT 1 FROM public.workspace_members wm2 JOIN public.workspaces w ON w.id = wm2.workspace_id WHERE wm2.user_id = auth.uid() AND w.id IN (SELECT wm3.workspace_id FROM public.workspace_members wm3 WHERE wm3.user_id = profiles.id)));

DROP POLICY IF EXISTS "profiles: فقط خودم آپدیت کنم" ON public.profiles;
CREATE POLICY "profiles: فقط خودم آپدیت کنم" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles: خودکار هنگام ثبت‌نام ساخته شود" ON public.profiles;
CREATE POLICY "profiles: خودکار هنگام ثبت‌نام ساخته شود" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "workspaces: اعضا ببینند" ON public.workspaces;
CREATE POLICY "workspaces: اعضا ببینند" ON public.workspaces FOR SELECT TO authenticated USING (public.is_workspace_member(id));

DROP POLICY IF EXISTS "workspaces: owner/admin ویرایش کند" ON public.workspaces;
CREATE POLICY "workspaces: owner/admin ویرایش کند" ON public.workspaces FOR UPDATE TO authenticated USING (public.has_workspace_role(id, array['owner','admin']::workspace_role[])) WITH CHECK (public.has_workspace_role(id, array['owner','admin']::workspace_role[]));

DROP POLICY IF EXISTS "workspaces: کاربر احرازهویت‌شده بسازد" ON public.workspaces;
CREATE POLICY "workspaces: کاربر احرازهویت‌شده بسازد" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "workspace_members: اعضا لیست را ببینند" ON public.workspace_members;
CREATE POLICY "workspace_members: اعضا لیست را ببینند" ON public.workspace_members FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_members: owner/admin مدیریت کند" ON public.workspace_members;
CREATE POLICY "workspace_members: owner/admin مدیریت کند" ON public.workspace_members FOR ALL TO authenticated USING (public.has_workspace_role(workspace_id, array['owner','admin']::workspace_role[])) WITH CHECK (public.has_workspace_role(workspace_id, array['owner','admin']::workspace_role[]));

DROP POLICY IF EXISTS "teams: اعضای ورک‌اسپیس ببینند" ON public.teams;
CREATE POLICY "teams: اعضای ورک‌اسپیس ببینند" ON public.teams FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "teams: admin/owner بنویسد" ON public.teams;
CREATE POLICY "teams: admin/owner بنویسد" ON public.teams FOR ALL TO authenticated USING (public.has_workspace_role(workspace_id, array['owner','admin']::workspace_role[])) WITH CHECK (public.has_workspace_role(workspace_id, array['owner','admin']::workspace_role[]));

DROP POLICY IF EXISTS "team_members: اعضای ورک‌اسپیس ببینند" ON public.team_members;
CREATE POLICY "team_members: اعضای ورک‌اسپیس ببینند" ON public.team_members FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_members.team_id AND public.is_workspace_member(t.workspace_id)));

DROP POLICY IF EXISTS "team_members: admin/owner بنویسد" ON public.team_members;
CREATE POLICY "team_members: admin/owner بنویسد" ON public.team_members FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_members.team_id AND public.has_workspace_role(t.workspace_id, array['owner','admin']::workspace_role[]))) WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_members.team_id AND public.has_workspace_role(t.workspace_id, array['owner','admin']::workspace_role[])));

DROP POLICY IF EXISTS "projects: اعضا ببینند" ON public.projects;
CREATE POLICY "projects: اعضا ببینند" ON public.projects FOR SELECT TO authenticated USING (public.is_project_member(id));

DROP POLICY IF EXISTS "projects: lead/admin/owner بنویسد" ON public.projects;
CREATE POLICY "projects: lead/admin/owner بنویسد" ON public.projects FOR ALL TO authenticated USING (public.has_project_role(id, array['lead']::project_role[]) OR public.has_workspace_role(workspace_id, array['owner','admin']::workspace_role[])) WITH CHECK (public.has_project_role(id, array['lead']::project_role[]) OR public.has_workspace_role(workspace_id, array['owner','admin']::workspace_role[]));

DROP POLICY IF EXISTS "project_members: اعضا ببینند" ON public.project_members;
CREATE POLICY "project_members: اعضا ببینند" ON public.project_members FOR SELECT TO authenticated USING (public.is_project_member(project_id));

DROP POLICY IF EXISTS "project_members: lead/admin بنویسد" ON public.project_members;
CREATE POLICY "project_members: lead/admin بنویسد" ON public.project_members FOR ALL TO authenticated USING (public.has_project_role(project_id, array['lead']::project_role[])) WITH CHECK (public.has_project_role(project_id, array['lead']::project_role[]));

DROP POLICY IF EXISTS "milestones: read members" ON public.milestones;
CREATE POLICY "milestones: read members" ON public.milestones FOR SELECT TO authenticated USING (public.is_project_member(project_id));

DROP POLICY IF EXISTS "modules: read members" ON public.modules;
CREATE POLICY "modules: read members" ON public.modules FOR SELECT TO authenticated USING (public.is_project_member(project_id));

DROP POLICY IF EXISTS "cycles: read members" ON public.cycles;
CREATE POLICY "cycles: read members" ON public.cycles FOR SELECT TO authenticated USING (public.is_project_member(project_id));

DROP POLICY IF EXISTS "issues: read members" ON public.issues;
CREATE POLICY "issues: read members" ON public.issues FOR SELECT TO authenticated USING (public.is_project_member(project_id));

DROP POLICY IF EXISTS "labels: read members" ON public.labels;
CREATE POLICY "labels: read members" ON public.labels FOR SELECT TO authenticated USING (public.is_project_member(project_id));

DROP POLICY IF EXISTS "milestones: write leads" ON public.milestones;
CREATE POLICY "milestones: write leads" ON public.milestones FOR ALL TO authenticated USING (public.has_project_role(project_id, array['lead','contributor']::project_role[])) WITH CHECK (public.has_project_role(project_id, array['lead','contributor']::project_role[]));

DROP POLICY IF EXISTS "modules: write leads" ON public.modules;
CREATE POLICY "modules: write leads" ON public.modules FOR ALL TO authenticated USING (public.has_project_role(project_id, array['lead','contributor']::project_role[])) WITH CHECK (public.has_project_role(project_id, array['lead','contributor']::project_role[]));

DROP POLICY IF EXISTS "cycles: write leads" ON public.cycles;
CREATE POLICY "cycles: write leads" ON public.cycles FOR ALL TO authenticated USING (public.has_project_role(project_id, array['lead','contributor']::project_role[])) WITH CHECK (public.has_project_role(project_id, array['lead','contributor']::project_role[]));

DROP POLICY IF EXISTS "issues: write members" ON public.issues;
CREATE POLICY "issues: write members" ON public.issues FOR ALL TO authenticated USING (public.has_project_role(project_id, array['lead','contributor']::project_role[])) WITH CHECK (public.has_project_role(project_id, array['lead','contributor']::project_role[]));

DROP POLICY IF EXISTS "labels: write leads" ON public.labels;
CREATE POLICY "labels: write leads" ON public.labels FOR ALL TO authenticated USING (public.has_project_role(project_id, array['lead']::project_role[])) WITH CHECK (public.has_project_role(project_id, array['lead']::project_role[]));

DROP POLICY IF EXISTS "issue_dependencies: read" ON public.issue_dependencies;
CREATE POLICY "issue_dependencies: read" ON public.issue_dependencies FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_dependencies.issue_id AND public.is_project_member(i.project_id)));

DROP POLICY IF EXISTS "issue_dependencies: write" ON public.issue_dependencies;
CREATE POLICY "issue_dependencies: write" ON public.issue_dependencies FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_dependencies.issue_id AND public.has_project_role(i.project_id, array['lead','contributor']::project_role[]))) WITH CHECK (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_dependencies.issue_id AND public.has_project_role(i.project_id, array['lead','contributor']::project_role[])));

DROP POLICY IF EXISTS "issue_comments: read" ON public.issue_comments;
CREATE POLICY "issue_comments: read" ON public.issue_comments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_comments.issue_id AND public.is_project_member(i.project_id)));

DROP POLICY IF EXISTS "issue_comments: author" ON public.issue_comments;
CREATE POLICY "issue_comments: author" ON public.issue_comments FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "issue_labels: read" ON public.issue_labels;
CREATE POLICY "issue_labels: read" ON public.issue_labels FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_labels.issue_id AND public.is_project_member(i.project_id)));

DROP POLICY IF EXISTS "issue_labels: write" ON public.issue_labels;
CREATE POLICY "issue_labels: write" ON public.issue_labels FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_labels.issue_id AND public.has_project_role(i.project_id, array['lead','contributor']::project_role[]))) WITH CHECK (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_labels.issue_id AND public.has_project_role(i.project_id, array['lead','contributor']::project_role[])));

DROP POLICY IF EXISTS "issue_assignees: read" ON public.issue_assignees;
CREATE POLICY "issue_assignees: read" ON public.issue_assignees FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_assignees.issue_id AND public.is_project_member(i.project_id)));

DROP POLICY IF EXISTS "issue_assignees: write" ON public.issue_assignees;
CREATE POLICY "issue_assignees: write" ON public.issue_assignees FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_assignees.issue_id AND public.has_project_role(i.project_id, array['lead','contributor']::project_role[]))) WITH CHECK (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_assignees.issue_id AND public.has_project_role(i.project_id, array['lead','contributor']::project_role[])));

DROP POLICY IF EXISTS "github_installations: read" ON public.github_installations;
CREATE POLICY "github_installations: read" ON public.github_installations FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "github_repositories: read" ON public.github_repositories;
CREATE POLICY "github_repositories: read" ON public.github_repositories FOR SELECT TO authenticated USING (public.is_project_member(project_id) OR public.is_workspace_member((SELECT workspace_id FROM public.github_installations gi WHERE gi.id = github_repositories.installation_id LIMIT 1)));

DROP POLICY IF EXISTS "github_branches: read" ON public.github_branches;
CREATE POLICY "github_branches: read" ON public.github_branches FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.github_repositories r WHERE r.id = github_branches.repo_id AND (public.is_project_member(r.project_id))));

DROP POLICY IF EXISTS "github_commits: read" ON public.github_commits;
CREATE POLICY "github_commits: read" ON public.github_commits FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.github_repositories r WHERE r.id = github_commits.repo_id AND public.is_project_member(r.project_id)));

DROP POLICY IF EXISTS "github_pull_requests: read" ON public.github_pull_requests;
CREATE POLICY "github_pull_requests: read" ON public.github_pull_requests FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.github_repositories r WHERE r.id = github_pull_requests.repo_id AND public.is_project_member(r.project_id)));

DROP POLICY IF EXISTS "github_reviews: read" ON public.github_reviews;
CREATE POLICY "github_reviews: read" ON public.github_reviews FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.github_pull_requests pr JOIN public.github_repositories r ON r.id = pr.repo_id WHERE pr.id = github_reviews.pull_request_id AND public.is_project_member(r.project_id)));

DROP POLICY IF EXISTS "github_issue_links: read" ON public.github_issue_links;
CREATE POLICY "github_issue_links: read" ON public.github_issue_links FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = github_issue_links.issue_id AND public.is_project_member(i.project_id)));

DROP POLICY IF EXISTS "activities: read" ON public.activities;
CREATE POLICY "activities: read" ON public.activities FOR SELECT TO authenticated USING (public.is_project_member(project_id));

DROP POLICY IF EXISTS "notifications: user read" ON public.notifications;
CREATE POLICY "notifications: user read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications: user update" ON public.notifications;
CREATE POLICY "notifications: user update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "documents: read" ON public.documents;
CREATE POLICY "documents: read" ON public.documents FOR SELECT TO authenticated USING (public.is_project_member(project_id));

DROP POLICY IF EXISTS "documents: write" ON public.documents;
CREATE POLICY "documents: write" ON public.documents FOR ALL TO authenticated USING (public.has_project_role(project_id, array['lead','contributor']::project_role[])) WITH CHECK (public.has_project_role(project_id, array['lead','contributor']::project_role[]));
