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

-- ============================================================
-- 09. Add github_repo to projects and Auto-Provision Profile & Member Role
-- ============================================================

ALTER TABLE "public"."projects" 
ADD COLUMN IF NOT EXISTS "github_repo" varchar(255);

CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_is_admin boolean := false;
  v_user_email text;
  v_display_name text;
  v_avatar_url text;
  v_github_login text;
BEGIN
  v_user_email := LOWER(COALESCE(NEW.email, ''));
  
  IF v_user_email IN ('amiriartin185@gmil.com', 'amiriartin185@gmail.com', 'artinamiri185@gmail.com') THEN
    v_is_admin := true;
  END IF;

  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'user_name',
    split_part(NEW.email, '@', 1),
    'کاربر جدید'
  );

  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NULL
  );

  v_github_login := COALESCE(
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'github_login',
    NULL
  );

  INSERT INTO public.profiles (id, display_name, avatar_url, github_login, email)
  VALUES (NEW.id, v_display_name, v_avatar_url, v_github_login, NEW.email)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    github_login = COALESCE(EXCLUDED.github_login, public.profiles.github_login),
    email = EXCLUDED.email,
    updated_at = now();

  SELECT id INTO v_workspace_id FROM public.workspaces ORDER BY created_at ASC LIMIT 1;

  IF v_workspace_id IS NOT NULL THEN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (
      v_workspace_id, 
      NEW.id, 
      CASE WHEN v_is_admin THEN 'admin'::public.workspace_role ELSE 'member'::public.workspace_role END
    )
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET
      role = CASE WHEN v_is_admin THEN 'admin'::public.workspace_role ELSE 'member'::public.workspace_role END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_registration();

DO $$
DECLARE
  v_workspace_id uuid;
  u RECORD;
  v_is_admin boolean;
  v_display_name text;
  v_avatar_url text;
  v_github_login text;
BEGIN
  SELECT id INTO v_workspace_id FROM public.workspaces ORDER BY created_at ASC LIMIT 1;

  FOR u IN SELECT * FROM auth.users LOOP
    v_is_admin := LOWER(COALESCE(u.email, '')) IN ('amiriartin185@gmil.com', 'amiriartin185@gmail.com', 'artinamiri185@gmail.com');
    
    v_display_name := COALESCE(
      u.raw_user_meta_data->>'name',
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'user_name',
      split_part(u.email, '@', 1),
      'کاربر'
    );

    v_avatar_url := COALESCE(
      u.raw_user_meta_data->>'avatar_url',
      u.raw_user_meta_data->>'picture',
      NULL
    );

    v_github_login := COALESCE(
      u.raw_user_meta_data->>'user_name',
      u.raw_user_meta_data->>'github_login',
      NULL
    );

    INSERT INTO public.profiles (id, display_name, avatar_url, github_login, email)
    VALUES (u.id, v_display_name, v_avatar_url, v_github_login, u.email)
    ON CONFLICT (id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
      github_login = COALESCE(EXCLUDED.github_login, public.profiles.github_login),
      email = EXCLUDED.email,
      updated_at = now();

    IF v_workspace_id IS NOT NULL THEN
      INSERT INTO public.workspace_members (workspace_id, user_id, role)
      VALUES (
        v_workspace_id, 
        u.id, 
        CASE WHEN v_is_admin THEN 'admin'::public.workspace_role ELSE 'member'::public.workspace_role END
      )
      ON CONFLICT (workspace_id, user_id) DO UPDATE SET
        role = CASE WHEN v_is_admin THEN 'admin'::public.workspace_role ELSE 'member'::public.workspace_role END;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 10. User Deletion & Self-Account Removal
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_is_caller_admin boolean := false;
  v_caller_email text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'کاربر احراز هویت نشده است.';
  END IF;

  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;
  IF LOWER(COALESCE(v_caller_email, '')) IN ('amiriartin185@gmil.com', 'amiriartin185@gmail.com', 'artinamiri185@gmail.com') THEN
    v_is_caller_admin := true;
  END IF;

  IF v_caller_id <> target_user_id AND NOT v_is_caller_admin THEN
    RAISE EXCEPTION 'شما اجازه حذف حساب سایر کاربران را ندارید.';
  END IF;

  DELETE FROM public.project_members WHERE user_id = target_user_id;
  DELETE FROM public.workspace_members WHERE user_id = target_user_id;
  DELETE FROM public.team_members WHERE user_id = target_user_id;
  DELETE FROM public.notifications WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated;

-- ============================================================
-- 11. Project Deletion (Admin / CEO Only)
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_project_by_key_or_id(
  p_project_key text DEFAULT NULL,
  p_project_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_email text;
  v_is_caller_admin boolean := false;
  v_project_id uuid;
  v_project_key text;
  v_project_name text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'کاربر احراز هویت نشده است.';
  END IF;

  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;
  IF LOWER(COALESCE(v_caller_email, '')) IN ('amiriartin185@gmil.com', 'amiriartin185@gmail.com', 'artinamiri185@gmail.com') THEN
    v_is_caller_admin := true;
  END IF;

  IF NOT v_is_caller_admin THEN
    RAISE EXCEPTION 'دسترسی غیرمجاز: تنها مدیرعامل و ادمین ارشد سامانه مجاز به حذف پروژه می‌باشند.';
  END IF;

  IF p_project_id IS NOT NULL THEN
    SELECT id, key, name INTO v_project_id, v_project_key, v_project_name
    FROM public.projects
    WHERE id = p_project_id;
  ELSIF p_project_key IS NOT NULL THEN
    SELECT id, key, name INTO v_project_id, v_project_key, v_project_name
    FROM public.projects
    WHERE UPPER(key) = UPPER(p_project_key);
  ELSE
    RAISE EXCEPTION 'شناسه یا کلید پروژه مشخص نشده است.';
  END IF;

  IF v_project_id IS NULL THEN
    RETURN json_build_object('success', true, 'message', 'پروژه در دیتابیس یافت نشد یا قبلاً حذف شده است.');
  END IF;

  DELETE FROM public.issue_comments WHERE issue_id IN (SELECT id FROM public.issues WHERE project_id = v_project_id);
  DELETE FROM public.issue_dependencies WHERE issue_id IN (SELECT id FROM public.issues WHERE project_id = v_project_id)
    OR depends_on_issue_id IN (SELECT id FROM public.issues WHERE project_id = v_project_id);
  DELETE FROM public.issue_labels WHERE issue_id IN (SELECT id FROM public.issues WHERE project_id = v_project_id);
  DELETE FROM public.issue_assignees WHERE issue_id IN (SELECT id FROM public.issues WHERE project_id = v_project_id);
  DELETE FROM public.github_issue_links WHERE issue_id IN (SELECT id FROM public.issues WHERE project_id = v_project_id);
  DELETE FROM public.issues WHERE project_id = v_project_id;
  DELETE FROM public.cycles WHERE project_id = v_project_id;
  DELETE FROM public.milestones WHERE project_id = v_project_id;
  DELETE FROM public.modules WHERE project_id = v_project_id;
  DELETE FROM public.project_members WHERE project_id = v_project_id;
  DELETE FROM public.activities WHERE project_id = v_project_id;
  DELETE FROM public.documents WHERE project_id = v_project_id;
  DELETE FROM public.github_repositories WHERE project_id = v_project_id;
  DELETE FROM public.projects WHERE id = v_project_id;

  RETURN json_build_object(
    'success', true,
    'deletedProjectId', v_project_id,
    'deletedProjectKey', v_project_key,
    'deletedProjectName', v_project_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_project_by_key_or_id(text, uuid) TO authenticated;

-- ============================================================
-- 12. Team Live Chat Sessions & Messages (Idempotent Migration)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'جلسه هماهنگی سریع مهندسی',
  duration_minutes integer NOT NULL DEFAULT 10,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_name text NOT NULL,
  sender_email text,
  sender_role text DEFAULT 'member',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read chat_sessions" ON public.chat_sessions;
CREATE POLICY "Allow authenticated read chat_sessions"
  ON public.chat_sessions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert/update chat_sessions" ON public.chat_sessions;
CREATE POLICY "Allow authenticated insert/update chat_sessions"
  ON public.chat_sessions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read chat_messages" ON public.chat_messages;
CREATE POLICY "Allow authenticated read chat_messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert chat_messages" ON public.chat_messages;
CREATE POLICY "Allow authenticated insert chat_messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete chat_messages" ON public.chat_messages;
CREATE POLICY "Allow authenticated delete chat_messages"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================
-- 13. Organization Invite Codes & Subordinate System
-- ============================================================

DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspaces' AND column_name = 'invite_code'
  ) THEN 
    ALTER TABLE public.workspaces ADD COLUMN invite_code varchar(32);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_invite_code_idx" ON public.workspaces (invite_code);

UPDATE public.workspaces
SET invite_code = UPPER('RC-' || SUBSTRING(COALESCE(slug, id::text) FROM 1 FOR 6) || SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 3))
WHERE invite_code IS NULL;

UPDATE public.workspaces w
SET invite_code = 'RADAR-185'
FROM public.profiles p
WHERE w.owner_id = p.id 
  AND p.email ILIKE '%amiriartin185%'
  AND (w.invite_code IS NULL OR w.invite_code NOT LIKE 'RADAR-%');

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read workspaces" ON public.workspaces;
CREATE POLICY "Allow authenticated read workspaces"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert/update workspaces" ON public.workspaces;
CREATE POLICY "Allow authenticated insert/update workspaces"
  ON public.workspaces FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read workspace_members" ON public.workspace_members;
CREATE POLICY "Allow authenticated read workspace_members"
  ON public.workspace_members FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert/update workspace_members" ON public.workspace_members;
CREATE POLICY "Allow authenticated insert/update workspace_members"
  ON public.workspace_members FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete workspace_members" ON public.workspace_members;
CREATE POLICY "Allow authenticated delete workspace_members"
  ON public.workspace_members FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================
-- 14. CHAT ENHANCEMENTS & CODE ROTATION
-- ============================================================
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'reply_to') THEN 
    ALTER TABLE public.chat_messages ADD COLUMN reply_to jsonb DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'reactions') THEN 
    ALTER TABLE public.chat_messages ADD COLUMN reactions jsonb DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'is_edited') THEN 
    ALTER TABLE public.chat_messages ADD COLUMN is_edited boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'updated_at') THEN 
    ALTER TABLE public.chat_messages ADD COLUMN updated_at timestamptz DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'invite_code_expires_at') THEN 
    ALTER TABLE public.workspaces ADD COLUMN invite_code_expires_at timestamptz DEFAULT (now() + interval '10 minutes');
  END IF;
END $$;

-- ============================================================
-- 15. CEO NATIONAL ID & ARCHIVED PROJECTS (US1 & US7)
-- ============================================================
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'national_id') THEN 
    ALTER TABLE public.profiles ADD COLUMN national_id varchar(10);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'verification_status') THEN 
    ALTER TABLE public.profiles ADD COLUMN verification_status varchar(20) NOT NULL DEFAULT 'verified';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'archived_at') THEN 
    ALTER TABLE public.projects ADD COLUMN archived_at timestamp with time zone;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'approved_by') THEN 
    ALTER TABLE public.projects ADD COLUMN approved_by uuid REFERENCES public.profiles(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'success_rate') THEN 
    ALTER TABLE public.projects ADD COLUMN success_rate integer DEFAULT 100;
  END IF;
END $$;

UPDATE public.profiles
SET verification_status = 'verified'
WHERE email ILIKE '%amiriartin185%' OR email ILIKE '%artinamiri185%';



