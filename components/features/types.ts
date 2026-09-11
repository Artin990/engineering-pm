/**
 * Shared domain types — UI layer contract (Wave 2, Hermes).
 * این تایپ‌ها آینه منطقی اسکیمای lib/db/schema.ts هستند تا UI بدون وابستگی به سرور کامپایل شود.
 */

export type IssueStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "blocked"
  | "done"
  | "cancelled";

export type IssuePriority = "urgent" | "high" | "medium" | "low" | "none";

export type IssueType =
  | "task"
  | "bug"
  | "feature"
  | "improvement"
  | "chore"
  | "research";

export type ProjectStatus =
  | "planning"
  | "active"
  | "on_hold"
  | "completed"
  | "archived";

export type ProjectHealth = "on_track" | "at_risk" | "off_track" | "blocked";

export type CycleStatus = "planned" | "active" | "completed";
export type MilestoneStatus = "planned" | "active" | "completed";

export type PrState = "open" | "closed" | "merged" | "draft";

/* ============================================================
   Entities
   ============================================================ */

export interface Member {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  githubLogin?: string | null;
  email?: string | null;
  role?: "admin" | "member" | "intern";
  status?: "active" | "invited";
  joinedAt?: string | null;
}

export interface Issue {
  id: string;
  key: string; // PM-142 (Latin)
  title: string;
  description?: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  type: IssueType;
  estimate: number;
  dueDate?: string | null; // ISO date
  assignee?: Member | null;
  labels: { id: string; name: string; color: string }[];
  milestoneId?: string | null;
  cycleId?: string | null;
  createdAt: string;
  updatedAt: string;
  // GitHub links (optional)
  prCount?: number;
  prOpenCount?: number;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string | null;
  status: MilestoneStatus;
  targetDate?: string | null;
  order: number;
}

export interface Cycle {
  id: string;
  name: string;
  goal?: string | null;
  startDate: string; // ISO date
  endDate: string;
  status: CycleStatus;
  // computed (progress engine)
  progress?: number; // 0..1
  totalEstimate?: number;
  doneEstimate?: number;
}

export interface PullRequest {
  id: string;
  prNumber: number;
  title: string;
  state: PrState;
  authorLogin?: string | null;
  headBranch?: string | null;
  baseBranch?: string | null;
  url?: string | null;
  repoName?: string;
  createdAt: string;
  mergedAt?: string | null;
  linkedIssues?: string[]; // issue keys
}

export interface Commit {
  id: string;
  sha: string;
  message?: string | null;
  authorLogin?: string | null;
  branch?: string | null;
  committedAt: string;
  repoName?: string;
}

export interface ActivityEvent {
  id: string;
  kind: "internal" | "github";
  verb: string;
  entityType: string;
  actor?: Member | null;
  actorLogin?: string | null;
  title: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  health: ProjectHealth;
  targetDate?: string | null;
  owner?: Member | null;
  teamName?: string | null;
  progress: number; // 0..1 — weighted completion
  healthReason?: string;
  counts: {
    todo: number;
    inProgress: number;
    inReview: number;
    blocked: number;
    done: number;
    backlog: number;
    cancelled: number;
  };
  openPrs: number;
  mergedPrs: number;
}

export interface Risk {
  id: string;
  kind: "blocked" | "overdue" | "stale_pr" | "unassigned" | "deadline";
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
  href?: string;
}

/* ============================================================
   Labels (fa-IR)
   ============================================================ */

export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  backlog: "بک‌لاگ",
  todo: "انجام نشده",
  in_progress: "در حال انجام",
  in_review: "در بازبینی",
  blocked: "بلاک شده",
  done: "تمام شده",
  cancelled: "لغو شده",
};

export const ISSUE_PRIORITY_LABEL: Record<IssuePriority, string> = {
  urgent: "فوری",
  high: "بالا",
  medium: "متوسط",
  low: "کم",
  none: "بدون اولویت",
};

export const ISSUE_TYPE_LABEL: Record<IssueType, string> = {
  task: "تسک",
  bug: "باگ",
  feature: "قابلیت",
  improvement: "بهبود",
  chore: "نگهداری",
  research: "تحقیق",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "در برنامه‌ریزی",
  active: "فعال",
  on_hold: "متوقف",
  completed: "تمام شده",
  archived: "آرشیو",
};

export const PROJECT_HEALTH_LABEL: Record<ProjectHealth, string> = {
  on_track: "رو مسیر",
  at_risk: "در معرض ریسک",
  off_track: "خارج از مسیر",
  blocked: "بلاک شده",
};

export const CYCLE_STATUS_LABEL: Record<CycleStatus, string> = {
  planned: "برنامه‌ریزی شده",
  active: "جاری",
  completed: "تمام شده",
};

export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  planned: "برنامه‌ریزی شده",
  active: "فعال",
  completed: "تحویل شده",
};

export const PR_STATE_LABEL: Record<PrState, string> = {
  open: "باز",
  closed: "بسته",
  merged: "مرج شده",
  draft: "پیش‌نویس",
};

export const ISSUE_STATUS_ORDER: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
];
