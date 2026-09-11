/* eslint-disable @next/next/no-img-element */
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
import { faDate, faNumber, faRelativeTime, toPersianDigits } from "@/lib/format";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_STATUS_LABEL,
  type Issue,
  type IssuePriority,
  type IssueStatus,
} from "@/components/features/types";
import { IssueTypeBadge } from "@/components/features/issues/issue-type-badge";
import { useUserRole } from "@/lib/role-context";

export interface IssueCommentItem {
  id: string;
  author: string;
  avatar?: string;
  text: string;
  date: string;
}

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
  const { profile } = useUserRole();
  const [comments, setComments] = useState<IssueCommentItem[]>([]);
  const [newComment, setNewComment] = useState("");

  // Load dynamic comments for the specific issue
  useEffect(() => {
    if (!issue?.id) {
      setComments([]);
      return;
    }
    try {
      const stored = localStorage.getItem(`flowdeck_comments_${issue.id}`);
      if (stored) {
        setComments(JSON.parse(stored));
      } else {
        setComments([]);
      }
    } catch {
      setComments([]);
    }
  }, [issue?.id]);

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
    if (!newComment.trim() || !issue?.id) return;

    const authorName = profile?.name || "کاربر جاری";
    const authorAvatar = profile?.avatar || authorName.charAt(0);

    const updated: IssueCommentItem[] = [
      ...comments,
      {
        id: `cm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        author: authorName,
        avatar: authorAvatar,
        text: newComment.trim(),
        date: new Date().toISOString(),
      },
    ];

    setComments(updated);
    try {
      localStorage.setItem(`flowdeck_comments_${issue.id}`, JSON.stringify(updated));
    } catch (err) {
      console.warn("Could not save comment to localStorage:", err);
    }
    setNewComment("");
  };

  const handleDeleteComment = (commentId: string) => {
    if (!issue?.id) return;
    const updated = comments.filter((c) => c.id !== commentId);
    setComments(updated);
    try {
      localStorage.setItem(`flowdeck_comments_${issue.id}`, JSON.stringify(updated));
    } catch (err) {
      console.warn("Could not delete comment from localStorage:", err);
    }
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

      {/* Drawer */}
      <div className="relative z-10 flex h-full w-full max-w-[560px] flex-col overflow-y-auto border-s border-[var(--border)] bg-[var(--surface)] p-[24px] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-[16px]">
          <div className="flex items-center gap-[8px]">
            <IssueTypeBadge type={issue.type} />
            <span className="font-mono text-[13px] font-bold text-[var(--text-muted)]">
              {issue.key}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex size-[32px] items-center justify-center rounded-[8px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] cursor-pointer"
            aria-label="بستن پنل"
          >
            ✕
          </button>
        </div>

        {/* Title */}
        <h2 className="text-[18px] font-bold leading-7 text-[var(--text-primary)]">
          {issue.title}
        </h2>

        {/* Description */}
        {issue.description && (
          <p className="mt-[12px] text-[14px] leading-6 text-[var(--text-secondary)] whitespace-pre-wrap">
            {issue.description}
          </p>
        )}

        {/* Meta Grid */}
        <div className="my-[20px] grid grid-cols-2 gap-[16px] rounded-[10px] bg-[var(--surface-raised)] p-[16px]">
          <MetaRow label="وضعیت">
            <Select value={issue.status} onValueChange={(val) => handleStatusChange(val as IssueStatus)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ISSUE_STATUS_LABEL).map(([val, label]) => (
                  <SelectItem key={val} value={val} className="text-xs">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MetaRow>

          <MetaRow label="اولویت">
            <Select value={issue.priority} onValueChange={(val) => handlePriorityChange(val as IssuePriority)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ISSUE_PRIORITY_LABEL).map(([val, label]) => (
                  <SelectItem key={val} value={val} className="text-xs">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MetaRow>

          <MetaRow label="مسئول">
            {issue.assignee ? (
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="flex size-5 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] text-white overflow-hidden">
                  {issue.assignee.avatarUrl && issue.assignee.avatarUrl.startsWith("http") ? (
                    <img src={issue.assignee.avatarUrl} alt={issue.assignee.displayName} className="size-full rounded-full object-cover" />
                  ) : (
                    issue.assignee.displayName?.charAt(0) || "ک"
                  )}
                </span>
                {issue.assignee.displayName}
              </span>
            ) : (
              <span className="text-[var(--text-muted)]">تعیین نشده</span>
            )}
          </MetaRow>

          <MetaRow label="تخمین تلاش">
            <span>{faNumber(issue.estimate ?? 0)} استوری پوینت</span>
          </MetaRow>

          <MetaRow label="سررسید">
            {issue.dueDate ? (
              <span className={cn(overdue && "font-semibold text-red-600 dark:text-red-400")}>
                {faDate(issue.dueDate)}
                {overdue ? " (گذشته)" : ""}
              </span>
            ) : (
              <span className="text-[var(--text-muted)]">ندارد</span>
            )}
          </MetaRow>

          <MetaRow label="آخرین بروزرسانی">
            <span className="text-[12px] text-[var(--text-muted)]">
              {faRelativeTime(issue.updatedAt || issue.createdAt)}
            </span>
          </MetaRow>
        </div>

        {/* Labels & GitHub */}
        <div className="space-y-[12px]">
          {issue.labels?.length > 0 && (
            <Section title="برچسب‌ها">
              <div className="flex flex-wrap gap-1.5">
                {issue.labels.map((l) => (
                  <span
                    key={l.id}
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white shadow-xs"
                    style={{ backgroundColor: l.color }}
                  >
                    {l.name}
                  </span>
                ))}
              </div>
            </Section>
          )}

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
          <Section title={`نظرات و گفتگو (${toPersianDigits(comments.length)})`}>
            <div className="flex flex-col gap-[10px]">
              {comments.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-[var(--border)] p-5 text-center text-xs text-[var(--text-muted)] flex flex-col items-center justify-center gap-1.5 bg-[var(--surface-raised)]/50">
                  <MessageSquare className="size-5 text-[var(--text-muted)] opacity-60" />
                  <span>هنوز نظری برای این تسک ثبت نشده است. اولین نظر را بنویسید.</span>
                </div>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-[12px] transition-colors relative group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] text-white overflow-hidden">
                          {c.avatar && c.avatar.startsWith("http") ? (
                            <img src={c.avatar} alt={c.author} className="size-full object-cover" />
                          ) : (
                            c.author?.charAt(0) || "ک"
                          )}
                        </span>
                        <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                          {c.author}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[var(--text-muted)]" title={faDate(c.date)}>
                          {faRelativeTime(c.date)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(c.id)}
                          title="حذف نظر"
                          className="text-[var(--text-muted)] hover:text-red-500 opacity-60 hover:opacity-100 p-1 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <p className="mt-[6px] text-[13px] leading-6 text-[var(--text-secondary)] whitespace-pre-wrap">
                      {c.text}
                    </p>
                  </div>
                ))
              )}

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
