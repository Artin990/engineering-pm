import { AlertTriangle, ShieldCheck } from "lucide-react";

import {
  MOCK_ISSUES,
  MOCK_PROJECTS,
} from "@/components/features/__fixtures__/mock-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ISSUE_TYPE_LABEL,
} from "@/components/features/types";
import { faNumber, faPercent } from "@/lib/format";

/**
 * آنالیتیکس — داده از موتور پیشرفت وزنی (بخش ۷ سند).
 * ⚠️ متریک ونتی «تعداد خام کامیت» برای سنجش فرد ممنوع.
 */
export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const project = MOCK_PROJECTS.find((p) => p.key === key) ?? MOCK_PROJECTS[0];

  const scoped = MOCK_ISSUES.filter((i) => i.status !== "cancelled");
  const totalWeight = scoped.reduce((s, i) => s + i.estimate, 0);
  const weightOf = (s: string) =>
    s === "done" ? 1 : s === "in_review" ? 0.8 : s === "in_progress" ? 0.4 : 0;
  const earned = scoped.reduce((s, i) => s + i.estimate * weightOf(i.status), 0);
  const completion = totalWeight > 0 ? earned / totalWeight : 0;

  const byType = scoped.reduce<Record<string, number>>((acc, i) => {
    acc[i.type] = (acc[i.type] ?? 0) + 1;
    return acc;
  }, {});

  const blocked = scoped.filter((i) => i.status === "blocked");
  const overdue = scoped.filter(
    (i) => i.dueDate && new Date(i.dueDate) < new Date() && i.status !== "done"
  );
  const unassigned = scoped.filter((i) => !i.assignee);

  return (
    <section aria-label="آنالیتیکس" className="space-y-[20px]">
      <header>
        <h1 className="text-[20px] font-semibold">آنالیتیکس — {key}</h1>
        <p className="text-[14px] text-[var(--text-muted)]">
          پیشرفت وزنی، توزیع کار، ریسک‌ها
        </p>
      </header>

      <div className="grid grid-cols-1 gap-[16px] md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>نرخ تکمیل وزنی</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[30px] font-semibold">
              {faPercent(completion, 1)}
            </p>
            <p className="text-[14px] text-[var(--text-muted)]">
              {faNumber(earned)} از {faNumber(totalWeight)} استوری‌پوینت
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>توزیع نوع کار</CardTitle>
          </CardHeader>
          <CardContent className="space-y-[8px]">
            {Object.entries(byType).map(([type, count]) => (
              <div
                key={type}
                className="flex items-center justify-between text-[14px]"
              >
                <span>{ISSUE_TYPE_LABEL[type as keyof typeof ISSUE_TYPE_LABEL]}</span>
                <Badge variant="secondary">{faNumber(count)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-[8px]">
              <AlertTriangle className="size-4 text-amber-500" />
              سیگنال‌های ریسک
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-[8px] text-[14px]">
            <div className="flex items-center justify-between">
              <span>بلاک‌شده</span>
              <Badge variant="destructive">{faNumber(blocked.length)}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>دیرکرد (گذشته از ددلاین)</span>
              <Badge variant="warning">{faNumber(overdue.length)}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>بی‌صاحب</span>
              <Badge variant="secondary">{faNumber(unassigned.length)}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-[8px]">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            سلامت پروژه
          </CardTitle>
        </CardHeader>
        <CardContent className="text-[14px] leading-[1.8] text-[var(--text-secondary)]">
          <p>
            سلامت فعلی: <strong>{project.healthReason || "بدون توضیح"}</strong>
          </p>
          <p className="mt-[8px] text-[var(--text-muted)]">
            محاسبه بر اساس: عقب‌افتادگی pace، تعداد بلاک‌شده، اورده‌و، PRهای stale —
            مطابق بخش ۷ سند. متریک‌های ونتی نمایش داده نمی‌شوند.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
