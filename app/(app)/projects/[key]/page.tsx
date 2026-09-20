import {
  Circle,
  GitPullRequest,
  GitCommitHorizontal,
  GitMerge,
  ListTodo,
  Loader,
  CheckCircle2,
  AlertTriangle,
  Lock,
  UserX,
  CalendarClock,
  Users,
  FolderGit2,
  Target,
  Rocket,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressRing } from "@/components/features/dashboard/progress-ring";
import { HealthBadge } from "@/components/features/dashboard/health-badge";
import {
  getProjectByKey,
  getMembersByProject,
  getMilestonesByProject,
  getActiveCycleByProject,
  getPullRequestsByProject,
  getCommitsByProject,
  getActivityByProject,
  getRisksByProject,
  getBurndownData,
  issues as allIssues,
} from "@/components/features/__fixtures__/mock-data";
import {
  PROJECT_STATUS_LABEL,
  MILESTONE_STATUS_LABEL,
  CYCLE_STATUS_LABEL,
  ISSUE_STATUS_LABEL,
  type IssueStatus,
  type Milestone,
  type Cycle,
  type PullRequest,
  type Commit,
  type ActivityEvent,
  type Risk,
  type Member,
} from "@/components/features/types";
import { faNumber, faPercent, faDate } from "@/lib/format";
import BurndownChart from "./burndown-chart";
import { ProjectArchiveBanner } from "@/components/features/projects/project-archive-banner";

/* ============================================================
   Page — Server Component
   ============================================================ */

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const project = getProjectByKey(key);

  // If real data is swapped in later, this becomes a proper notFound() call.
  if (!project) {
    return (
      <div className="p-[30px]">
        <h1 className="text-xl font-bold">پروژه‌ای با کلید «{key}» یافت نشد</h1>
        <p className="mt-[8px] text-[var(--text-muted)]">
          کلید پروژه را بررسی کنید یا از نوار کناری یک پروژه انتخاب کنید.
        </p>
      </div>
    );
  }

  const members = getMembersByProject(key);
  const projectIssues = allIssues.filter((i) => i.key.startsWith(`${key.toUpperCase()}-`));
  const milestones = getMilestonesByProject(key);
  const activeCycle = getActiveCycleByProject(key);
  const prs = getPullRequestsByProject(key);
  const commits = getCommitsByProject(key);
  const activity = getActivityByProject(key).slice(0, 10);
  const risks = getRisksByProject(key);

  return (
    <div className="flex flex-col gap-[20px]">
      <DashboardHeader
        project={project}
        owner={project.owner ?? null}
        teamName={project.teamName ?? null}
      />
      <ProjectArchiveBanner
        projectKey={key}
        status={project.status}
        progress={project.progress}
      />
      <HealthRow health={project.health} reason={project.healthReason} />

      <div className="grid grid-cols-1 gap-[20px] lg:grid-cols-2">
        <MilestoneProgress milestones={milestones} issues={projectIssues} />
        <CycleCard cycle={activeCycle} />
        <WorkCounts
          counts={project.counts}
        />
        <TeamPanel members={members} issues={projectIssues} />
        <GitHubPanel prs={prs} commits={commits} />
        <TimelinePanel events={activity} />
      </div>

      <RisksPanel risks={risks} />
    </div>
  );
}

/* ============================================================
   a. DashboardHeader
   ============================================================ */

function DashboardHeader({
  project,
  owner,
  teamName,
}: {
  project: { key: string; name: string; description?: string | null; status: keyof typeof PROJECT_STATUS_LABEL; targetDate?: string | null; progress: number };
  owner: Member | null;
  teamName: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-[20px]">
          <div className="flex flex-col gap-[8px]">
            <div className="flex items-center gap-[12px]">
              <h1 className="text-[20px] font-bold">{project.name}</h1>
              <Badge variant="outline" className="font-mono" dir="ltr">
                {project.key}
              </Badge>
              <Badge variant="secondary">{PROJECT_STATUS_LABEL[project.status]}</Badge>
            </div>
            {project.description ? (
              <p className="text-[14px] text-[var(--text-muted)]">{project.description}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-[16px] text-[13px] text-[var(--text-muted)]">
              {owner ? (
                <span className="flex items-center gap-[6px]">
                  <span
                    aria-hidden
                    className="flex h-[24px] w-[24px] items-center justify-center rounded-full bg-[var(--primary)] text-[11px] font-medium text-white"
                  >
                    {owner.displayName.trim().charAt(0)}
                  </span>
                  {owner.displayName}
                </span>
              ) : null}
              {teamName ? <span>تیم: {teamName}</span> : null}
              {project.targetDate ? (
                <span className="flex items-center gap-[4px]">
                  <CalendarClock size={14} aria-hidden />
                  مهلت: {faDate(project.targetDate)}
                </span>
              ) : null}
            </div>
          </div>
          <ProgressRing value={project.progress} size={88} strokeWidth={9} label="پیشرفت کلی" />
        </div>
      </CardHeader>
    </Card>
  );
}

/* ============================================================
   b. HealthRow
   ============================================================ */

function HealthRow({ health, reason }: { health: Parameters<typeof HealthBadge>[0]["health"]; reason?: string }) {
  return (
    <section aria-label="وضعیت سلامت پروژه">
      <Card>
        <CardContent className="pt-[20px]">
          <div className="flex flex-wrap items-center gap-[12px]">
            <HealthBadge health={health} />
            {reason ? (
              <p className="text-[14px] text-[var(--text-muted)]">{reason}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

/* ============================================================
   c. MilestoneProgress
   ============================================================ */

function MilestoneProgress({
  milestones,
  issues,
}: {
  milestones: Milestone[];
  issues: { milestoneId?: string | null; status: IssueStatus }[];
}) {
  return (
    <section aria-label="پیشرفت مایلستون‌ها">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-[8px]">
            <Target size={16} aria-hidden />
            مایلستون‌ها
          </CardTitle>
          <CardDescription>درصد تکمیل ایشوهای هر مایلستون</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-[16px]">
          {milestones.length === 0 ? (
            <p className="text-[13px] text-[var(--text-muted)] py-4 text-center">
              مایلستونی برای این پروژه تعریف نشده است.
            </p>
          ) : (
            milestones.map((m) => {
              const scoped = issues.filter((i) => i.milestoneId === m.id);
              const total = scoped.length;
              const done = scoped.filter((i) => i.status === "done").length;
              const pct = total > 0 ? done / total : 0;
              return (
                <div key={m.id} className="flex flex-col gap-[6px]">
                  <div className="flex items-center justify-between gap-[8px]">
                    <span className="flex items-center gap-[8px] text-[14px] font-medium">
                      {m.title}
                      <Badge
                        variant={m.status === "completed" ? "success" : m.status === "active" ? "warning" : "secondary"}
                        className="text-[12px]"
                      >
                        {MILESTONE_STATUS_LABEL[m.status]}
                      </Badge>
                    </span>
                    <span className="text-[13px] text-[var(--text-muted)]" dir="ltr">
                      {faPercent(pct)} · {faNumber(done)}/{faNumber(total)}
                    </span>
                  </div>
                  <div className="h-[6px] w-full overflow-hidden rounded-full bg-[var(--surface-raised)]">
                    <div
                      className="h-full rounded-full bg-[var(--primary)] transition-[width_0.4s_ease-in-out]"
                      style={{ width: `${Math.round(pct * 100)}%` }}
                      role="progressbar"
                      aria-valuenow={Math.round(pct * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${m.title}: ${faPercent(pct)}`}
                    />
                  </div>
                  {m.targetDate ? (
                    <span className="text-[12px] text-[var(--text-muted)]">
                      مهلت: {faDate(m.targetDate)}
                    </span>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </section>
  );
}

/* ============================================================
   d. CycleCard
   ============================================================ */

function CycleCard({ cycle }: { cycle?: Cycle }) {
  if (!cycle) {
    return (
      <section aria-label="سایکل جاری">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-[8px]">
              <Rocket size={16} aria-hidden />
              سایکل جاری
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[14px] text-[var(--text-muted)]">سایکل فعالی وجود ندارد.</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  const burndown = getBurndownData();

  return (
    <section aria-label="سایکل جاری">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-[8px]">
              <Rocket size={16} aria-hidden />
              {cycle.name}
            </CardTitle>
            <Badge variant="warning" className="text-[12px]">
              {CYCLE_STATUS_LABEL[cycle.status]}
            </Badge>
          </div>
          <CardDescription>
            {faDate(cycle.startDate)} تا {faDate(cycle.endDate)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-[12px]">
          {cycle.goal ? (
            <p className="text-[14px]">🎯 {cycle.goal}</p>
          ) : null}
          <div>
            <div className="mb-[4px] flex items-center justify-between text-[13px] text-[var(--text-muted)]">
              <span>پیشرفت سایکل</span>
              <span>{faPercent(cycle.progress ?? 0)}</span>
            </div>
            <div className="h-[6px] w-full overflow-hidden rounded-full bg-[var(--surface-raised)]">
              <div
                className="h-full rounded-full bg-[var(--primary)]"
                style={{ width: `${Math.round((cycle.progress ?? 0) * 100)}%` }}
                role="progressbar"
                aria-valuenow={Math.round((cycle.progress ?? 0) * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
          <BurndownChart data={burndown} />
          <p className="text-[13px] text-[var(--text-muted)]">
            برآورد انجام‌شده: {faNumber(cycle.doneEstimate ?? 0)} از {faNumber(cycle.totalEstimate ?? 0)} نقطه
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

/* ============================================================
   e. WorkCounts
   ============================================================ */

const statusCards: {
  status: IssueStatus;
  icon: LucideIcon;
  color: string;
  bg: string;
}[] = [
  { status: "todo", icon: ListTodo, color: "#64748b", bg: "rgba(100,116,139,0.12)" },
  { status: "in_progress", icon: Loader, color: "#2563eb", bg: "rgba(37,99,235,0.12)" },
  { status: "in_review", icon: GitPullRequest, color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  { status: "blocked", icon: AlertTriangle, color: "#d97706", bg: "rgba(217,119,6,0.12)" },
  { status: "done", icon: CheckCircle2, color: "#16a34a", bg: "rgba(22,163,74,0.12)" },
];

function WorkCounts({
  counts,
}: {
  counts: Partial<Record<IssueStatus, number>>;
}) {
  return (
    <section aria-label="وضعیت کارها">
      <Card>
        <CardHeader>
          <CardTitle>وضعیت کارها</CardTitle>
          <CardDescription>توزیع ایشوها بر اساس وضعیت</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-[12px] sm:grid-cols-3">
          {statusCards.map(({ status, icon: Icon, color, bg }) => (
            <div
              key={status}
              className="flex flex-col gap-[6px] rounded-[10px] border border-[var(--border)] p-[12px]"
            >
              <span
                className="flex h-[28px] w-[28px] items-center justify-center rounded-full"
                style={{ backgroundColor: bg, color }}
              >
                <Icon size={15} aria-hidden />
              </span>
              <span className="text-[20px] font-bold leading-none">{faNumber(counts[status] ?? 0)}</span>
              <Badge
                variant="outline"
                className="w-fit text-[11px]"
                style={{ color, borderColor: color }}
              >
                {ISSUE_STATUS_LABEL[status]}
              </Badge>
            </div>
          ))}
          {/* Backlog + cancelled summary row */}
          <div className="col-span-2 flex items-center justify-between rounded-[10px] border border-dashed border-[var(--border)] p-[12px] sm:col-span-3">
            <span className="text-[13px] text-[var(--text-muted)]">
              بک‌لاگ: {faNumber(counts.backlog ?? 0)} · لغو شده: {faNumber(counts.cancelled ?? 0)}
            </span>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

/* ============================================================
   f. TeamPanel
   ============================================================ */

function TeamPanel({
  members,
  issues,
}: {
  members: Member[];
  issues: { assignee?: { id: string } | null }[];
}) {
  const maxCount = Math.max(
    1,
    ...members.map((m) => issues.filter((i) => i.assignee?.id === m.id).length)
  );

  return (
    <section aria-label="تیم">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-[8px]">
            <Users size={16} aria-hidden />
            تیم
          </CardTitle>
          <CardDescription>حجم کاری هر عضو (تعداد ایشوهای تخصیص‌یافته)</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
          {members.length === 0 ? (
            <p className="col-span-2 text-[13px] text-[var(--text-muted)] py-4 text-center">
              هنوز عضوی به این پروژه افزوده نشده است.
            </p>
          ) : (
            members.map((m) => {
              const count = issues.filter((i) => i.assignee?.id === m.id).length;
              const pct = count / maxCount;
              return (
                <div key={m.id} className="flex items-center gap-[12px]">
                  <span
                    aria-hidden
                    className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[13px] font-medium text-white"
                  >
                    {m.displayName.trim().charAt(0)}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
                    <div className="flex items-center justify-between gap-[8px]">
                      <span className="truncate text-[13px] font-medium">{m.displayName}</span>
                      <span className="text-[12px] text-[var(--text-muted)]">
                        {faNumber(count)} ایشو
                      </span>
                    </div>
                    <div className="h-[4px] w-full overflow-hidden rounded-full bg-[var(--surface-raised)]">
                      <div
                        className="h-full rounded-full bg-[var(--primary)]"
                        style={{ width: `${Math.round(pct * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </section>
  );
}

/* ============================================================
   g. GitHubPanel
   ============================================================ */

function GitHubPanel({ prs, commits }: { prs: PullRequest[]; commits: Commit[] }) {
  const openPrs = prs.filter((p) => p.state === "open");
  const mergedThisWeek = prs.filter((p) => {
    if (p.state !== "merged" || !p.mergedAt) return false;
    const merged = new Date(p.mergedAt);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return merged >= weekAgo;
  });

  return (
    <section aria-label="فعالیت گیت‌هاب">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-[8px]">
            <FolderGit2 size={16} aria-hidden />
            گیت‌هاب
          </CardTitle>
          <div className="flex items-center gap-[8px]">
            <Badge variant="warning" className="text-[12px]">
              <GitPullRequest size={12} aria-hidden />
              {faNumber(openPrs.length)} باز
            </Badge>
            <Badge variant="success" className="text-[12px]">
              <GitMerge size={12} aria-hidden />
              {faNumber(mergedThisWeek.length)} مرج این هفته
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {commits.length === 0 ? (
            <p className="text-[13px] text-[var(--text-muted)] py-4 text-center">
              کامیتی برای نمایش وجود ندارد.
            </p>
          ) : (
            <ul className="flex flex-col gap-[8px]">
              {commits.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center gap-[8px] text-[13px]">
                  <GitCommitHorizontal size={14} className="shrink-0 text-[var(--text-muted)]" aria-hidden />
                  <span className="font-mono text-[12px] text-[var(--text-muted)]" dir="ltr">
                    {c.sha.slice(0, 7)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{c.message}</span>
                  <span className="shrink-0 text-[12px] text-[var(--text-muted)]">
                    {faRelativeTime(c.committedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

/* ============================================================
   h. TimelinePanel
   ============================================================ */

function TimelinePanel({ events }: { events: ActivityEvent[] }) {
  return (
    <section aria-label="فعالیت‌های اخیر">
      <Card>
        <CardHeader>
          <CardTitle>فعالیت‌های اخیر</CardTitle>
          <CardDescription>ترکیب رویدادهای داخلی و گیت‌هاب</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-[13px] text-[var(--text-muted)] py-4 text-center">
              فعالیت جدیدی ثبت نشده است.
            </p>
          ) : (
            <ul className="flex flex-col gap-[10px]">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-[10px]">
                  <span
                    aria-hidden
                    className={`mt-[2px] flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full ${
                      e.kind === "github"
                        ? "bg-[rgba(100,116,139,0.15)] text-[var(--text-muted)]"
                        : "bg-[rgba(37,99,235,0.12)] text-[var(--primary)]"
                    }`}
                    title={e.kind === "github" ? "گیت‌هاب" : "داخلی"}
                  >
                    {e.kind === "github" ? (
                      <FolderGit2 size={13} />
                    ) : (
                      <Circle size={8} fill="currentColor" />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[13px]">
                      <span className="font-medium">{e.actor?.displayName ?? e.actorLogin}</span>{" "}
                      <span className="text-[var(--text-muted)]">{e.title}</span>
                    </span>
                    <span className="text-[12px] text-[var(--text-muted)]">
                      {faRelativeTime(e.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

/* ============================================================
   i. RisksPanel
   ============================================================ */

const riskKindIcon: Record<Risk["kind"], LucideIcon> = {
  blocked: Lock,
  overdue: CalendarClock,
  stale_pr: GitPullRequest,
  unassigned: UserX,
  deadline: CalendarClock,
};

const severityVariant: Record<Risk["severity"], "destructive" | "warning" | "secondary"> = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
};

const severityLabel: Record<Risk["severity"], string> = {
  high: "بالا",
  medium: "متوسط",
  low: "کم",
};

function RisksPanel({ risks }: { risks: Risk[] }) {
  return (
    <section aria-label="ریسک‌ها">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-[8px]">
            <AlertTriangle size={16} aria-hidden />
            ریسک‌ها
          </CardTitle>
          <CardDescription>مواردی که به توجه فوری نیاز دارند</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-[10px]">
          {risks.length === 0 ? (
            <p className="text-[13px] text-[var(--text-muted)] py-4 text-center">
              ریسک فعالی برای این پروژه شناسایی نشده است.
            </p>
          ) : (
            risks.map((r) => {
              const Icon = riskKindIcon[r.kind];
              return (
                <div
                  key={r.id}
                  className="flex items-start gap-[12px] rounded-[10px] border border-[var(--border)] p-[12px]"
                >
                  <span className="mt-[2px] text-[var(--text-muted)]">
                    <Icon size={16} aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                    <div className="flex items-center gap-[8px]">
                      <span className="text-[14px] font-medium">{r.title}</span>
                      <Badge variant={severityVariant[r.severity]} className="text-[11px]">
                        {severityLabel[r.severity]}
                      </Badge>
                    </div>
                    <span className="text-[13px] text-[var(--text-muted)]">{r.detail}</span>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </section>
  );
}

/* ============================================================
   Helpers
   ============================================================ */

/** زمان نسبی فارسی — برای mock کافی است؛ بعداً از lib/time می‌آید. */
function faRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "همین حالا";
  if (minutes < 60) return `${minutes.toLocaleString("fa-IR")} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours.toLocaleString("fa-IR")} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days.toLocaleString("fa-IR")} روز پیش`;
  return faDate(iso);
}
