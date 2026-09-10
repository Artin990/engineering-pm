"use client";

import { useEffect } from "react";
import { GitBranch, GitPullRequest, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { faDate, faNumber } from "@/lib/format";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_STATUS_LABEL,
  MILESTONE_STATUS_LABEL,
  type Issue,
} from "@/components/features/types";
import { IssuePriorityIcon } from "@/components/features/issues/issue-priority-icon";
import { IssueTypeBadge } from "@/components/features/issues/issue-type-badge";

const MOCK_COMMENTS = [
  { id: "cm1", author: "سارا محمدی", text: "بررسی کردم؛ مشکل از تنظیمات فونت نمودار بود.", date: "2026-09-08" },
  { id: "cm2", author: "علی رضایی", text: "ممنون، امروز برطرفش می‌کنم.", date: "2026-09-09" },
];

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] text-[var(--text-muted)]">{label}</span>
      <span className="text-[14px] text-[var(--text-primary)]">{children}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[var(--border)] pt-[16px]">
      <h3 className="mb-[8px] text-[14px] font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function IssueDetailPanel({
  issue,
  onClose,
}: {
  issue: Issue | null;
  onClose: () => void;
}) {
  // Lock body scroll while open
  useEffect(() => {
    if (!issue) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [issue]);

  if (!issue) return null;

  const overdue =
    issue.dueDate &&
    issue.status !== "done" &&
    issue.status !== "cancelled" &&
    new Date(issue.dueDate) < new Date(new Date().toDateString());

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Slide-over panel */}
      <div className="absolute inset-y-0 end-0 flex w-full max-w-[480px] flex-col overflow-y-auto border-s border-[var(--border)] bg-[var(--surface)] p-[20px] shadow-[rgba(0,0,0,0.2)_0_0_24px]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span dir="ltr" className="block text-[12px] font-bold text-[var(--text-muted)]">
              {issue.key}
            </span>
            <h2 className="mt-1 text-[18px] font-bold leading-7 text-[var(--text-primary)]">
              {issue.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="shrink-0 rounded-[10px] p-1 text-[var(--text-muted)] hover:bg-[var(--background)] hover:text-[var(--text-primary)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Badges */}
        <div className="mt-[12px] flex flex-wrap items-center gap-2">
          <Badge>{ISSUE_STATUS_LABEL[issue.status]}</Badge>
          <Badge variant="outline" className="gap-1">
            <IssuePriorityIcon priority={issue.priority} />
            {ISSUE_PRIORITY_LABEL[issue.priority]}
          </Badge>
          <IssueTypeBadge type={issue.type} />
        </div>

        {/* Metadata grid */}
        <div className="mt-[16px] grid grid-cols-2 gap-[16px] rounded-[10px] border border-[var(--border)] bg-[var(--background)] p-[12px]">
          <MetaRow label="مسئول">
            {issue.assignee ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)] text-[11px] font-bold text-white">
                  {issue.assignee.displayName.trim().charAt(0)}
                </span>
                {issue.assignee.displayName}
              </span>
            ) : (
              <span className="text-[var(--text-muted)]">تخصیص نیافته</span>
            )}
          </MetaRow>
          <MetaRow label="تخمین">
            {faNumber(issue.estimate)} امتیاز
          </MetaRow>
          <MetaRow label="سررسید">
            {issue.dueDate ? (
              <span className={cn(overdue && "font-semibold text-red-500")}>
                {faDate(issue.dueDate)}
              </span>
            ) : (
              <span className="text-[var(--text-muted)]">—</span>
            )}
          </MetaRow>
          <MetaRow label="سایکل">
            {issue.cycleId ? (
              <span dir="ltr">{issue.cycleId}</span>
            ) : (
              <span className="text-[var(--text-muted)]">—</span>
            )}
          </MetaRow>
          <MetaRow label="مایلستون">
            {issue.milestoneId ? (
              <span dir="ltr">{issue.milestoneId}</span>
            ) : (
              <span className="text-[var(--text-muted)]">—</span>
            )}
          </MetaRow>
        </div>

        {/* Labels */}
        {issue.labels.length > 0 && (
          <div className="mt-[16px]">
            <span className="text-[12px] text-[var(--text-muted)]">برچسب‌ها</span>
            <div className="mt-[8px] flex flex-wrap gap-2">
              {issue.labels.map((l) => (
                <Badge
                  key={l.id}
                  variant="outline"
                  className="gap-1.5"
                  style={{}}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                  {l.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="mt-[16px]">
          <span className="text-[12px] text-[var(--text-muted)]">توضیحات</span>
          <div className="mt-[8px] min-h-[80px] rounded-[10px] border border-[var(--border)] bg-[var(--background)] p-[12px] text-[14px] leading-7 text-[var(--text-secondary)]">
            {issue.description || "توضیحی ثبت نشده است."}
          </div>
        </div>

        {/* GitHub links */}
        <div className="mt-[16px]">
          <Section title="گیت‌هاب">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <GitPullRequest size={12} />
                {faNumber(issue.prCount ?? 0)} پول‌ریکوئست
                {issue.prOpenCount ? (
                  <span className="text-[var(--text-muted)]">
                    ({faNumber(issue.prOpenCount)} باز)
                  </span>
                ) : null}
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <GitBranch size={12} />
                <span dir="ltr">feature/{issue.key.toLowerCase()}</span>
              </Badge>
            </div>
          </Section>
        </div>

        {/* Dependencies (placeholder) */}
        <div className="mt-[16px]">
          <Section title="وابستگی‌ها">
            <p className="text-[14px] text-[var(--text-muted)]">
              هنوز وابستگی‌ای ثبت نشده است.
            </p>
          </Section>
        </div>

        {/* Comments */}
        <div className="mb-[8px] mt-[16px]">
          <Section title="نظرات">
            <div className="flex flex-col gap-[12px]">
              {MOCK_COMMENTS.map((c) => (
                <div
                  key={c.id}
                  className="rounded-[10px] border border-[var(--border)] bg-[var(--background)] p-[12px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-[var(--text-primary)]">
                      <MessageSquare size={12} className="text-[var(--text-muted)]" />
                      {c.author}
                    </span>
                    <span className="text-[12px] text-[var(--text-muted)]">
                      {faDate(c.date)}
                    </span>
                  </div>
                  <p className="mt-[4px] text-[14px] leading-6 text-[var(--text-secondary)]">
                    {c.text}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
