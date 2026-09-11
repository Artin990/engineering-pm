import {
  Bug,
  CircleDot,
  GitMerge,
  MessageSquare,
  Sparkles,
  UserPlus,
  Wrench,
} from "lucide-react";

import {
  MOCK_ACTIVITIES,
} from "@/components/features/__fixtures__/mock-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { faDate } from "@/lib/format";

const VERB_ICON: Record<string, React.ReactNode> = {
  created: <CircleDot className="size-4 text-[var(--primary)]" />,
  updated: <Wrench className="size-4 text-[var(--text-muted)]" />,
  commented: <MessageSquare className="size-4 text-[var(--text-muted)]" />,
  assigned: <UserPlus className="size-4 text-[var(--text-muted)]" />,
  merged: <GitMerge className="size-4 text-emerald-600 dark:text-emerald-400" />,
  opened: <Sparkles className="size-4 text-[var(--primary)]" />,
  closed: <CircleDot className="size-4 text-[var(--text-muted)]" />,
  fixed: <Bug className="size-4 text-red-600 dark:text-red-400" />,
};

/**
 * Activity feed یکپارچه — رویدادهای داخلی + گیت‌هاب (بخش ۵ سند).
 */
export default async function ProjectActivityPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;

  return (
    <section aria-label="فعالیت" className="space-y-[20px]">
      <header>
        <h1 className="text-[20px] font-semibold">فعالیت — {key}</h1>
        <p className="text-[14px] text-[var(--text-muted)]">
          رویدادهای ترکیبی داخلی و گیت‌هاب
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>تایم‌لاین</CardTitle>
        </CardHeader>
        <CardContent>
          {MOCK_ACTIVITIES.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[var(--text-muted)]">
              هنوز فعالیتی در این پروژه ثبت نشده است. با ایجاد یا ویرایش ایشوها، رویدادها در این بخش ظاهر می‌شوند.
            </div>
          ) : (
            <ol className="relative space-y-[16px] border-r border-[var(--border)] pr-[16px]">
              {MOCK_ACTIVITIES.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -right-[24px] top-[4px] flex size-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]">
                    {VERB_ICON[a.verb] ?? <CircleDot className="size-4" />}
                  </span>
                  <div className="flex flex-wrap items-center gap-[8px]">
                    <span className="text-[14px] font-semibold">
                      {a.actor?.displayName || a.actorLogin || "سیستم"}
                    </span>
                    <Badge variant={a.kind === "github" ? "default" : "secondary"}>
                      {a.kind === "github" ? "گیت‌هاب" : "داخلی"}
                    </Badge>
                    <span className="text-[14px] text-[var(--text-secondary)]">
                      {a.title}
                    </span>
                  </div>
                  <p className="mt-[5px] text-[12px] text-[var(--text-muted)]">
                    {faDate(a.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
