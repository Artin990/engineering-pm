"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronUp, Inbox, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { faDate, faNumber, faPercent } from "@/lib/format";
import { useProjectStore } from "@/lib/project-store";
import {
  ISSUE_STATUS_LABEL,
  MILESTONE_STATUS_LABEL,
  type Issue,
  type Milestone,
  type MilestoneStatus,
} from "@/components/features/types";

const STATUS_BADGE: Record<MilestoneStatus, string> = {
  completed: "bg-emerald-500/10 text-emerald-600",
  active: "bg-[var(--primary)]/10 text-[var(--primary)]",
  planned: "bg-[var(--surface)] text-[var(--text-secondary)]",
};

function MilestoneCard({
  milestone,
  issues,
  expanded,
  onToggle,
}: {
  milestone: Milestone;
  issues: Issue[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const done = issues.filter((i) => i.status === "done").length;
  const pct = issues.length ? done / issues.length : 0;

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] transition-all">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-[12px] p-[20px] text-start"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
              {milestone.title}
            </h3>
            {milestone.description && (
              <p className="mt-1 text-[13px] leading-6 text-[var(--text-muted)]">
                {milestone.description}
              </p>
            )}
          </div>
          <Badge
            variant="secondary"
            className={cn("shrink-0", STATUS_BADGE[milestone.status])}
          >
            {MILESTONE_STATUS_LABEL[milestone.status]}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--text-secondary)]">
          <span>سررسید: {milestone.targetDate ? faDate(milestone.targetDate) : "—"}</span>
          <span>{faNumber(issues.length)} ایشو</span>
          <span>{faNumber(done)} انجام‌شده</span>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)]">
            <span>پیشرفت</span>
            <span>{faPercent(pct)}</span>
          </div>
          <div className="mt-[4px] h-[6px] w-full overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-[width_0.4s_ease-in-out]"
              style={{ width: `${Math.round(pct * 100)}%` }}
            />
          </div>
        </div>

        <span className="inline-flex items-center gap-1 text-[12px] text-[var(--primary)] font-medium">
          {expanded ? (
            <>
              بستن <ChevronUp size={14} />
            </>
          ) : (
            <>
              نمایش ایشوها ({faNumber(issues.length)}) <ChevronDown size={14} />
            </>
          )}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border)] p-[16px]">
          {issues.length === 0 ? (
            <p className="text-[13px] text-[var(--text-muted)]">
              هیچ ایشویی برای این مایلستون تعریف نشده است.
            </p>
          ) : (
            <ul className="flex flex-col gap-[8px]">
              {issues.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between rounded-[8px] bg-[var(--background)] p-[10px] text-[13px]"
                >
                  <div className="flex items-center gap-[8px]">
                    <span className="font-mono text-[11px] text-[var(--text-muted)]" dir="ltr">
                      {i.key}
                    </span>
                    <span className="text-[var(--text-primary)]">{i.title}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {ISSUE_STATUS_LABEL[i.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function MilestonesPage() {
  const params = useParams<{ key?: string }>();
  const projectKey = (params?.key || "PM").toUpperCase();

  const { milestones, issues, addMilestone } = useProjectStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Create form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [status, setStatus] = useState<MilestoneStatus>("planned");

  const handleCreateMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newMs: Milestone = {
      id: `ms-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || undefined,
      targetDate: targetDate || undefined,
      status,
      order: milestones.length + 1,
    };

    addMilestone(newMs);
    setTitle("");
    setDescription("");
    setTargetDate("");
    setCreateOpen(false);
  };

  return (
    <div className="flex flex-col gap-[16px] p-[20px] max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--text-primary)]">
            مایلستون‌های پروژه {projectKey}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            نقاط عطف و اهداف کلیدی تحویل پروژه
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5 shadow-sm">
          <Plus size={16} />
          ساخت مایلستون
        </Button>
      </div>

      {milestones.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-[40px] text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--background)] text-[var(--text-muted)]">
            <Inbox size={22} />
          </span>
          <div>
            <p className="font-semibold text-[var(--text-primary)]">
              مایلستونی یافت نشد
            </p>
            <p className="mt-1 text-[14px] text-[var(--text-muted)]">
              اولین مایلستون پروژه را بسازید.
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            ساخت مایلستون جدید
          </Button>
        </div>
      ) : (
        <div className="grid gap-[12px] md:grid-cols-2">
          {milestones.map((m) => (
            <MilestoneCard
              key={m.id}
              milestone={m}
              issues={issues.filter((i) => i.milestoneId === m.id)}
              expanded={expandedId === m.id}
              onToggle={() => setExpandedId((cur) => (cur === m.id ? null : m.id))}
            />
          ))}
        </div>
      )}

      {/* Create Milestone Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="w-full max-w-[480px] rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-[24px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h2 className="text-[17px] font-bold text-[var(--text-primary)]">
                ساخت مایلستون جدید
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-[8px] p-1 text-[var(--text-muted)] hover:bg-[var(--surface-raised)]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateMilestone} className="mt-4 space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  عنوان مایلستون <span className="text-red-500">*</span>
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: انتشار نسخه بتا (Beta Launch)"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  توضیحات
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="شرح اهداف این نقطه عطف..."
                  className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--background)] p-2.5 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                    وضعیت
                  </label>
                  <Select value={status} onValueChange={(v) => setStatus(v as MilestoneStatus)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">برنامه‌ریزی‌شده</SelectItem>
                      <SelectItem value="active">فعال</SelectItem>
                      <SelectItem value="completed">تکمیل‌شده</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[13px] font-medium text-[var(--text-primary)]">
                      تاریخ سررسید
                    </label>
                    {targetDate && (
                      <span className="text-[12px] font-medium text-[var(--primary)]">
                        تقویم شمسی: {faDate(targetDate)}
                      </span>
                    )}
                  </div>
                  <Input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="bg-[var(--background)]"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  انصراف
                </Button>
                <Button type="submit" className="gap-1.5" disabled={!title.trim()}>
                  <Plus size={16} />
                  ایجاد مایلستون
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
