import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  pgSchema,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  date,
  integer,
  bigint,
  boolean,
  jsonb,
  uniqueIndex,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/* ============================================================
   Enums
   ============================================================ */

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const projectRoleEnum = pgEnum("project_role", [
  "lead",
  "contributor",
  "viewer",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "active",
  "on_hold",
  "completed",
  "archived",
]);

export const projectHealthEnum = pgEnum("project_health", [
  "on_track",
  "at_risk",
  "off_track",
  "blocked",
]);

export const issueStatusEnum = pgEnum("issue_status", [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
]);

export const issuePriorityEnum = pgEnum("issue_priority", [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
]);

export const issueTypeEnum = pgEnum("issue_type", [
  "task",
  "bug",
  "feature",
  "improvement",
  "chore",
  "research",
]);

export const cycleStatusEnum = pgEnum("cycle_status", [
  "planned",
  "active",
  "completed",
]);

export const milestoneStatusEnum = pgEnum("milestone_status", [
  "planned",
  "active",
  "completed",
]);

export const prStateEnum = pgEnum("github_pr_state", [
  "open",
  "closed",
  "merged",
  "draft",
]);

/* ============================================================
   Identity & Organization
   ============================================================ */

/** profile — separate from Supabase auth.users */
export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 255 }).notNull().default(""),
  avatarUrl: text("avatar_url"),
  githubLogin: varchar("github_login", { length: 255 }),
  email: varchar("email", { length: 320 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => sql`now()`),
});

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    inviteCode: varchar("invite_code", { length: 32 }),
    logoUrl: text("logo_url"),
    ownerId: uuid("owner_id").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // soft delete
  },
  (t) => [
    uniqueIndex("workspaces_slug_idx").on(t.slug),
    uniqueIndex("workspaces_invite_code_idx").on(t.inviteCode),
  ]
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
  },
  (t) => [
    uniqueIndex("workspace_members_uniq_idx").on(t.workspaceId, t.userId),
    index("workspace_members_user_idx").on(t.userId),
  ]
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    leadId: uuid("lead_id").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("teams_workspace_idx").on(t.workspaceId)]
);

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("team_members_uniq_idx").on(t.teamId, t.userId),
    index("team_members_user_idx").on(t.userId),
  ]
);

/* ============================================================
   Projects
   ============================================================ */

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 10 }).notNull(), // e.g. PM
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    status: projectStatusEnum("status").notNull().default("planning"),
    health: projectHealthEnum("health").notNull().default("on_track"),
    targetDate: date("target_date"),
    githubRepo: varchar("github_repo", { length: 255 }),
    ownerId: uuid("owner_id").references(() => profiles.id),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("projects_workspace_key_idx").on(t.workspaceId, t.key),
    index("projects_workspace_idx").on(t.workspaceId),
  ]
);

export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: projectRoleEnum("role").notNull().default("contributor"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
  },
  (t) => [
    uniqueIndex("project_members_uniq_idx").on(t.projectId, t.userId),
    index("project_members_user_idx").on(t.userId),
  ]
);

export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: milestoneStatusEnum("status").notNull().default("planned"),
    targetDate: date("target_date"),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("milestones_project_idx").on(t.projectId)]
);

export const modules = pgTable(
  "modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("modules_project_idx").on(t.projectId)]
);

export const cycles = pgTable(
  "cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    goal: text("goal"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: cycleStatusEnum("status").notNull().default("planned"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("cycles_project_status_idx").on(t.projectId, t.status)]
);

/* ============================================================
   Issues
   ============================================================ */

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 20 }).notNull(), // PM-142 (Latin only)
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    status: issueStatusEnum("status").notNull().default("backlog"),
    priority: issuePriorityEnum("priority").notNull().default("none"),
    type: issueTypeEnum("type").notNull().default("task"),
    estimate: integer("estimate").notNull().default(1), // story points — weight for progress engine
    dueDate: date("due_date"),
    parentId: uuid("parent_id").references((): AnyPgColumn => issues.id, {
      onDelete: "set null",
    }),
    milestoneId: uuid("milestone_id").references(() => milestones.id, {
      onDelete: "set null",
    }),
    moduleId: uuid("module_id").references(() => modules.id, {
      onDelete: "set null",
    }),
    cycleId: uuid("cycle_id").references(() => cycles.id, {
      onDelete: "set null",
    }),
    assigneeId: uuid("assignee_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by").references(() => profiles.id),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("issues_project_key_idx").on(t.projectId, t.key),
    // Critical indexes (doc section 5):
    index("issues_project_status_idx").on(t.projectId, t.status),
    index("issues_cycle_idx").on(t.cycleId),
    index("issues_assignee_idx").on(t.assigneeId),
    index("issues_milestone_idx").on(t.milestoneId),
    index("issues_parent_idx").on(t.parentId),
  ]
);

export const issueDependencies = pgTable(
  "issue_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    dependsOnId: uuid("depends_on_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("issue_dependencies_uniq_idx").on(t.issueId, t.dependsOnId),
    index("issue_dependencies_depends_on_idx").on(t.dependsOnId),
  ]
);

export const issueComments = pgTable(
  "issue_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // soft delete
  },
  (t) => [index("issue_comments_issue_idx").on(t.issueId)]
);

export const labels = pgTable(
  "labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    color: varchar("color", { length: 20 }).notNull().default("#71717A"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("labels_project_name_idx").on(t.projectId, t.name)]
);

export const issueLabels = pgTable(
  "issue_labels",
  {
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("issue_labels_uniq_idx").on(t.issueId, t.labelId),
    index("issue_labels_label_idx").on(t.labelId),
  ]
);

export const issueAssignees = pgTable(
  "issue_assignees",
  {
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("issue_assignees_uniq_idx").on(t.issueId, t.userId),
    index("issue_assignees_user_idx").on(t.userId),
  ]
);

/* ============================================================
   GitHub Integration (Source of Truth: GitHub)
   ============================================================ */

export const githubInstallations = pgTable(
  "github_installations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    installationId: bigint("installation_id", { mode: "number" }).notNull(),
    accountLogin: varchar("account_login", { length: 255 }).notNull(),
    accountType: varchar("account_type", { length: 50 }).notNull(), // User | Organization
    accessToken: text("access_token"), // server-side only — never expose to frontend
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
  },
  (t) => [
    uniqueIndex("github_installations_uniq_idx").on(t.workspaceId, t.installationId),
  ]
);

export const githubRepositories = pgTable(
  "github_repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    installationId: uuid("installation_id")
      .notNull()
      .references(() => githubInstallations.id, { onDelete: "cascade" }),
    repoId: bigint("repo_id", { mode: "number" }).notNull(), // GitHub numeric id
    name: varchar("name", { length: 255 }).notNull(), // owner/repo
    isPrivate: boolean("is_private").notNull().default(false),
    defaultBranch: varchar("default_branch", { length: 255 }).notNull().default("main"),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
  },
  (t) => [
    uniqueIndex("github_repositories_repo_id_idx").on(t.repoId),
    index("github_repositories_project_idx").on(t.projectId),
  ]
);

export const githubBranches = pgTable(
  "github_branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => githubRepositories.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    sha: varchar("sha", { length: 40 }),
    authorId: uuid("author_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    issueId: uuid("issue_id").references(() => issues.id, {
      onDelete: "set null",
    }), // auto-link by issue key pattern in branch name
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
  },
  (t) => [
    uniqueIndex("github_branches_repo_name_idx").on(t.repoId, t.name),
    index("github_branches_issue_idx").on(t.issueId),
  ]
);

export const githubCommits = pgTable(
  "github_commits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => githubRepositories.id, { onDelete: "cascade" }),
    sha: varchar("sha", { length: 40 }).notNull(),
    message: text("message"),
    authorLogin: varchar("author_login", { length: 255 }),
    authorId: uuid("author_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    branch: varchar("branch", { length: 255 }),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("github_commits_repo_sha_idx").on(t.repoId, t.sha),
    index("github_commits_author_idx").on(t.authorId),
  ]
);

export const githubPullRequests = pgTable(
  "github_pull_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => githubRepositories.id, { onDelete: "cascade" }),
    prNumber: integer("pr_number").notNull(),
    title: varchar("title", { length: 500 }),
    body: text("body"),
    state: prStateEnum("state").notNull().default("open"),
    authorLogin: varchar("author_login", { length: 255 }),
    authorId: uuid("author_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    headBranch: varchar("head_branch", { length: 255 }),
    baseBranch: varchar("base_branch", { length: 255 }),
    url: text("url"),
    mergedAt: timestamp("merged_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    githubCreatedAt: timestamp("github_created_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
  },
  (t) => [
    uniqueIndex("github_prs_repo_number_idx").on(t.repoId, t.prNumber),
    // Critical index (doc section 5):
    index("github_pull_requests_repo_state_idx").on(t.repoId, t.state),
  ]
);

export const githubReviews = pgTable(
  "github_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pullRequestId: uuid("pull_request_id")
      .notNull()
      .references(() => githubPullRequests.id, { onDelete: "cascade" }),
    reviewId: bigint("review_id", { mode: "number" }),
    reviewerLogin: varchar("reviewer_login", { length: 255 }),
    reviewerId: uuid("reviewer_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    state: varchar("state", { length: 50 }), // APPROVED | CHANGES_REQUESTED | COMMENTED
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("github_reviews_review_id_idx").on(t.reviewId),
    index("github_reviews_pr_idx").on(t.pullRequestId),
  ]
);

/** Link: internal Issue <-> GitHub (branch/PR/imported issue) */
export const githubIssueLinks = pgTable(
  "github_issue_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    pullRequestId: uuid("pull_request_id").references(
      () => githubPullRequests.id,
      { onDelete: "cascade" }
    ),
    branchId: uuid("branch_id").references(() => githubBranches.id, {
      onDelete: "cascade",
    }),
    /**
     * GitHub suggests status (merge -> Done) — user confirms/rejects.
     * Per SSOT doc: GitHub only suggests, never writes.
     */
    suggestedStatus: issueStatusEnum("suggested_status"),
    suggestionState: varchar("suggestion_state", { length: 20 })
      .notNull()
      .default("pending"), // pending | accepted | rejected
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
  },
  (t) => [
    index("github_issue_links_issue_idx").on(t.issueId),
    index("github_issue_links_pr_idx").on(t.pullRequestId),
  ]
);

/**
 * Webhook idempotency — delivery_id must be UNIQUE.
 * Duplicate event = skip (doc section 6).
 */
export const githubEvents = pgTable(
  "github_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deliveryId: uuid("delivery_id").notNull(),
    event: varchar("event", { length: 100 }).notNull(), // pull_request | push | ...
    action: varchar("action", { length: 100 }),
    installationId: bigint("installation_id", { mode: "number" }),
    repoFullName: varchar("repo_full_name", { length: 255 }),
    payload: jsonb("payload"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    status: varchar("status", { length: 20 }).notNull().default("received"), // received | processed | failed | skipped
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Critical index (doc section 5): delivery_id UNIQUE
    uniqueIndex("github_events_delivery_id_idx").on(t.deliveryId),
    index("github_events_status_idx").on(t.status),
  ]
);

/* ============================================================
   Activity & Notifications & Documents
   ============================================================ */

/** Unified: internal event + GitHub event (doc section 5) */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    actorId: uuid("actor_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    /** type: internal | github — keeps the source separated */
    kind: varchar("kind", { length: 50 }).notNull(),
    verb: varchar("verb", { length: 50 }).notNull(), // created | updated | merged | ...
    entityType: varchar("entity_type", { length: 50 }).notNull(), // issue | pr | commit | ...
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Critical index (doc section 5): activities(project_id, created_at desc)
    index("activities_project_created_idx").on(
      t.projectId,
      sql`${t.createdAt} desc`
    ),
    index("activities_workspace_idx").on(t.workspaceId),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body"),
    link: text("link"),
    /** Anti-spam (doc section 7, phase 6): dedupe_key deduplicates same notification in a time window */
    dedupeKey: varchar("dedupe_key", { length: 255 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_read_idx").on(t.userId, t.readAt),
    index("notifications_dedupe_idx").on(t.dedupeKey),
  ]
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body"),
    storagePath: text("storage_path"), // Supabase Storage
    authorId: uuid("author_id").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("documents_project_idx").on(t.projectId)]
);

/* ============================================================
   Supabase auth.users reference (managed by Supabase — not us)
   ============================================================ */

const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

/* ============================================================
   Relations (for type-safe queries in wave 2)
   ============================================================ */

export const projectsRelations = relations(projects, ({ many, one }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  owner: one(profiles, {
    fields: [projects.ownerId],
    references: [profiles.id],
  }),
  members: many(projectMembers),
  issues: many(issues),
  cycles: many(cycles),
  milestones: many(milestones),
  modules: many(modules),
  labels: many(labels),
  activities: many(activities),
  documents: many(documents),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  project: one(projects, {
    fields: [issues.projectId],
    references: [projects.id],
  }),
  parent: one(issues, {
    fields: [issues.parentId],
    references: [issues.id],
    relationName: "issueHierarchy",
  }),
  children: many(issues, { relationName: "issueHierarchy" }),
  milestone: one(milestones, {
    fields: [issues.milestoneId],
    references: [milestones.id],
  }),
  module: one(modules, {
    fields: [issues.moduleId],
    references: [modules.id],
  }),
  cycle: one(cycles, {
    fields: [issues.cycleId],
    references: [cycles.id],
  }),
  assignee: one(profiles, {
    fields: [issues.assigneeId],
    references: [profiles.id],
  }),
  labels: many(issueLabels),
  comments: many(issueComments),
  dependencies: many(issueDependencies, { relationName: "depender" }),
  githubLinks: many(githubIssueLinks),
}));

export const cyclesRelations = relations(cycles, ({ one, many }) => ({
  project: one(projects, {
    fields: [cycles.projectId],
    references: [projects.id],
  }),
  issues: many(issues),
}));

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  project: one(projects, {
    fields: [milestones.projectId],
    references: [projects.id],
  }),
  issues: many(issues),
}));

export const githubRepositoriesRelations = relations(
  githubRepositories,
  ({ one, many }) => ({
    installation: one(githubInstallations, {
      fields: [githubRepositories.installationId],
      references: [githubInstallations.id],
    }),
    project: one(projects, {
      fields: [githubRepositories.projectId],
      references: [projects.id],
    }),
    branches: many(githubBranches),
    commits: many(githubCommits),
    pullRequests: many(githubPullRequests),
  })
);

export const githubPullRequestsRelations = relations(
  githubPullRequests,
  ({ one, many }) => ({
    repo: one(githubRepositories, {
      fields: [githubPullRequests.repoId],
      references: [githubRepositories.id],
    }),
    reviews: many(githubReviews),
    issueLinks: many(githubIssueLinks),
  })
);
