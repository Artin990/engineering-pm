-- ============================================================
-- 05. GitHub Integration (Installations, Repos, PRs, Commits, Links)
-- ============================================================

-- github_installations
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

-- github_repositories
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

-- github_branches
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

-- github_commits
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

-- github_pull_requests
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

-- github_reviews
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

-- github_issue_links
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

-- github_events
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
