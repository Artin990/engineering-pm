"use client";

import { use, useState } from "react";
import {
  Bug,
  CircleDot,
  GitMerge,
  MessageSquare,
  Sparkles,
  UserPlus,
  Wrench,
  Layers,
  Activity as ActivityIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { faDate, faRelativeTime } from "@/lib/format";
import { useProjectStore } from "@/lib/project-store";
import type { ActivityEvent } from "@/components/features/types";

const VERB_ICON: Record<string, React.ReactNode> = {
  created: <CircleDot className="size-4 text-[var(--primary)]" />,
  updated: <Wrench className="size-4 text-[var(--text-muted)]" />,
  commented: <MessageSquare className="size-4 text-[var(--text-muted)]" />,
  assigned: <UserPlus className="size-4 text-emerald-500" />,
  merged: <GitMerge className="size-4 text-purple-500" />,
  opened: <Sparkles className="size-4 text-blue-500" />,
  closed: <CircleDot className="size-4 text-red-500" />,
  fixed: <Bug className="size-4 text-red-600 dark:text-red-400" />,
};

export default function ProjectActivityPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = use(params);
  const { activities, issues } = useProjectStore();
  const [filterKind, setFilterKind] = useState<"all" | "internal" | "github">("all");

  // Fallback: If no explicit activity recorded yet, generate dynamic activity stream from project issues
  const computedActivities: ActivityEvent[] = activities.length > 0
    ? activities
    : issues.map((i) => ({
        id: `act-${i.id}`,
        kind: "internal" as const,
        verb: i.status === "done" ? "merged" : "created",
        entityType: "issue",
        actor: i.assignee || null,
        title: `ایشو ${i.key}: ${i.title} (${i.status === "done" ? "تکمیل شد" : "ثبت شد"})`,
        createdAt: i.updatedAt || i.createdAt || new Date().toISOString(),
      }));

  const filtered = computedActivities.filter((a) => {
    if (filterKind === "all") return true;
    return a.kind === filterKind;
  });

  return (
    <section aria-label="فعالیت" className="space-y-[20px] max-w-5xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--text-primary)]">
            گزارش فعالیت — پروژه {key}
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">
            رویدادهای زنده، کامیت‌ها، ایجاد ایشوها و تغییرات ساختار پروژه
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-1">
          <button
            type="button"
            onClick={() => setFilterKind("all")}
            className={`px-3 py-1 text-[12px] font-medium rounded-[7px] transition-colors ${
              filterKind === "all"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"
            }`}
          >
            همه رویدادها
          </button>
          <button
            type="button"
            onClick={() => setFilterKind("internal")}
            className={`px-3 py-1 text-[12px] font-medium rounded-[7px] transition-colors ${
              filterKind === "internal"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"
            }`}
          >
            رویدادهای داخلی
          </button>
          <button
            type="button"
            onClick={() => setFilterKind("github")}
            className={`px-3 py-1 text-[12px] font-medium rounded-[7px] transition-colors ${
              filterKind === "github"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"
            }`}
          >
            گیت‌هاب
          </button>
        </div>
      </header>

      <Card className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
        <CardHeader className="pb-3 border-b border-[var(--border)]">
          <CardTitle className="text-[16px] flex items-center gap-2">
            <ActivityIcon size={17} className="text-[var(--primary)]" />
            تایم‌لاین زنده فعالیت‌های تیم
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Layers className="size-10 text-[var(--text-muted)] mb-2.5 opacity-50" />
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
                هنوز فعالیتی ثبت نشده است
              </h3>
              <p className="text-[13px] text-[var(--text-muted)] mt-1 max-w-sm">
                با ایجاد ایشوها، تغییر وضعیت تسک‌ها، ایجاد اسپرینت‌ها یا پوش کامیت‌های گیت‌هاب، رویدادها به صورت زنده در این بخش ثبت می‌شوند.
              </p>
            </div>
          ) : (
            <ol className="relative space-y-[20px] border-r border-[var(--border)] pr-[20px] me-2">
              {filtered.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -right-[33px] top-[2px] flex size-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-raised)] shadow-xs">
                    {VERB_ICON[a.verb] ?? <CircleDot className="size-4" />}
                  </span>
                  <div className="flex flex-wrap items-center gap-[8px]">
                    <span className="text-[14px] font-bold text-[var(--text-primary)]">
                      {a.actor?.displayName || a.actorLogin || "توسعه‌دهنده"}
                    </span>
                    <Badge
                      variant={a.kind === "github" ? "default" : "secondary"}
                      className="text-[10px] px-2 py-0.5"
                    >
                      {a.kind === "github" ? "گیت‌هاب" : "سیستم داخلی"}
                    </Badge>
                    <span className="text-[13px] text-[var(--text-secondary)]">
                      {a.title}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                    <span>{faRelativeTime(a.createdAt)}</span>
                    <span>•</span>
                    <span>{faDate(a.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
