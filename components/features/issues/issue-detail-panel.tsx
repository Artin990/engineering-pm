"use client";

import { useEffect, useState } from "react";
import { GitBranch, GitPullRequest, MessageSquare, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { faDate, faNumber } from "@/lib/format";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_STATUS_LABEL,
  type Issue,
  type IssuePriority,
  type IssueStatus,
} from "@/components/features/types";
import { IssueTypeBadge } from "@/components/features/issues/issue-type-badge";

const INITIAL_COMMENTS: Record<string, { id: string; author: string; text: string; date: string }[]> = {
  default: [
    { id: "cm1", author: "سارا احمدی", text: "بررسی کردم؛ مستندات و تست‌ها آماده است.", date: "2026-09-08" },
    { id: "cm2", author: "علی محمدی", text: "تغییرات با موفقیت روی شاخه اصلی تست شد.", date: "2026-09-09" },
  ],
};

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
  onUpdateIssue,
  onDeleteIssue,
}: {
  issue: Issue | null;
  onClose: () => void;
  onUpdateIssue?: (updated: Issue) => void;
  onDeleteIssue?: (issueId: string) => void;
}) {
  const [comments, setComments] = useState<{ id: string; author: string; text: string; date: string }[]>(
    INITIAL_COMMENTS.default
  );
  const [newComment, setNewComment] = useState("");

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

  const handleStatusChange = (newStatus: IssueStatus) => {
    if (onUpdateIssue) {
      onUpdateIssue({ ...issue, status: newStatus, updatedAt: new Date().toISOString() });
    }
  };

  const handlePriorityChange = (newPriority: IssuePriority) => {
    if (onUpdateIssue) {
      onUpdateIssue({ ...issue, priority: newPriority, updatedAt: new Date().toISOString() });
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setComments((prev) => [
      ...prev,
      {
        id: `cm-${Date.now()}`,
        author: "کاربر جاری",
        text: newComment.trim(),
        date: new Date().toISOString().slice(0, 10),
      },
    ]);
    setNewComment("");
  };

  const overdue =
    issue.dueDate &&
    issue.status !== "done" &&
    issue.status !== "cancelled" &&
    new Date(issue.dueDate) < new Date(new Date().toDateString());

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Slide-over panel */}
      <div className="relative z-10 flex w-full max-w-[500px] flex-col overflow-y-auto border-s border-[var(--border)] bg-[var(--surface)] p-[20px] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
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
            className="shrink-0 rounded-[10px] p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Quick controls (Status + Priority) */}
        <div className="mt-[14px] flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-[13px]">
            <span className="text-[var(--text-muted)] text-[12px]">وضعیت:</span>
            <Select value={issue.status} onValueChange={(v) => handleStatusChange(v as IssueStatus)}>
              <SelectTrigger className="h-8 text-[12px] px-2.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ISSUE_STATUS_LABEL) as IssueStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {ISSUE_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1 text-[13px]">
            <span className="text-[var(--text-muted)] text-[12px]">اولویت:</span>
            <Select value={issue.priority} onValueChange={(v) => handlePriorityChange(v as IssuePriority)}>
              <SelectTrigger className="h-8 text-[12px] px-2.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ISSUE_PRIORITY_LABEL) as IssuePriority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {ISSUE_PRIORITY_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <IssueTypeBadge type={issue.type} />
        </div>

        {/* Metadata grid */}
        <div className="mt-[16px] grid grid-cols-2 gap-[14px] rounded-[10px] border border-[var(--border)] bg-[var(--background)] p-[14px]">
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
              <span>{issue.cycleId === "c1" ? "اسپرینت ۱" : issue.cycleId === "c2" ? "اسپرینت ۲" : issue.cycleId}</span>
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
          <div className="mt-[8px] min-h-[70px] rounded-[10px] border border-[var(--border)] bg-[var(--background)] p-[12px] text-[13px] leading-6 text-[var(--text-secondary)]">
            {issue.description || "توضیحی ثبت نشده است."}
          </div>
        </div>

        {/* GitHub links */}
        <div className="mt-[16px]">
          <Section title="گیت‌هاب و شاخه‌ها">
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

        {/* Comments Thread */}
        <div className="mb-[8px] mt-[16px]">
          <Section title="نظرات و گفتگو">
            <div className="flex flex-col gap-[10px]">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="rounded-[10px] border border-[var(--border)] bg-[var(--background)] p-[12px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
                      <MessageSquare size={12} className="text-[var(--text-muted)]" />
                      {c.author}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {faDate(c.date)}
                    </span>
                  </div>
                  <p className="mt-[4px] text-[13px] leading-6 text-[var(--text-secondary)]">
                    {c.text}
                  </p>
                </div>
              ))}

              {/* Add comment form */}
              <form onSubmit={handleAddComment} className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="ثبت نظر جدید..."
                  className="flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
                />
                <Button type="submit" size="sm" disabled={!newComment.trim()} className="gap-1">
                  <Send size={13} />
                  ارسال
                </Button>
              </form>
            </div>
          </Section>
        </div>

        {/* Danger zone actions */}
        {onDeleteIssue && (
          <div className="mt-auto border-t border-[var(--border)] pt-4 flex justify-between items-center">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm(`آیا از حذف ایشوی ${issue.key} اطمینان دارید؟`)) {
                  onDeleteIssue(issue.id);
                  onClose();
                }
              }}
              className="gap-1.5"
            >
              <Trash2 size={14} />
              حذف ایشو
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              بستن
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
