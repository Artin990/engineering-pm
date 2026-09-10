import Link from "next/link";
import {
  CircleDot,
  GitBranch,
  GitPullRequest,
  Plus,
  Search,
} from "lucide-react";

import { MOCK_PROJECTS } from "@/components/features/__fixtures__/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProgressRing } from "@/components/features/dashboard/progress-ring";
import {
  PROJECT_HEALTH_LABEL,
  PROJECT_STATUS_LABEL,
} from "@/components/features/types";
import { faNumber } from "@/lib/format";

/**
 * فهرست پروژه‌ها — ورودی اصلی کاربر تیم.
 * در ۱۰ ثانیه: داریم چی می‌سازیم؟ چی تموم شده؟ چی دیر شده؟
 */
export default function ProjectsPage() {
  return (
    <section aria-label="پروژه‌ها" className="space-y-[20px]">
      <header className="flex flex-wrap items-center justify-between gap-[12px]">
        <div>
          <h1 className="text-[20px] font-semibold">پروژه‌ها</h1>
          <p className="text-[14px] text-[var(--text-muted)]">
            {faNumber(MOCK_PROJECTS.length)} پروژه در ورک‌اسپیس
          </p>
        </div>
        <div className="flex items-center gap-[8px]">
          <div className="relative">
            <Search className="absolute right-[12px] top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              placeholder="جستجوی پروژه…"
              className="w-[240px] pr-[36px]"
              aria-label="جستجوی پروژه"
            />
          </div>
          <Button>
            <Plus className="size-4" />
            پروژه جدید
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2 xl:grid-cols-3">
        {MOCK_PROJECTS.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.key}`}
            className="group rounded-[10px] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] hover:-translate-y-[2px]"
          >
            <Card className="h-full">
              <CardHeader className="pb-[10px]">
                <div className="flex items-start justify-between gap-[8px]">
                  <div>
                    <CardTitle className="flex items-center gap-[8px]">
                      <span className="rounded-[10px] bg-[var(--primary)] px-[8px] py-[2px] text-[12px] font-semibold text-white">
                        {project.key}
                      </span>
                      {project.name}
                    </CardTitle>
                    <CardDescription className="mt-[5px] line-clamp-2">
                      {project.description || "بدون توضیح"}
                    </CardDescription>
                  </div>
                  <ProgressRing value={project.progress} size={56} strokeWidth={6} />
                </div>
              </CardHeader>
              <CardContent className="space-y-[12px]">
                <div className="flex flex-wrap items-center gap-[5px]">
                  <Badge variant="secondary">
                    {PROJECT_STATUS_LABEL[project.status]}
                  </Badge>
                  <Badge
                    variant={
                      project.health === "on_track"
                        ? "success"
                        : project.health === "at_risk"
                          ? "warning"
                          : "destructive"
                    }
                  >
                    {PROJECT_HEALTH_LABEL[project.health]}
                  </Badge>
                  {project.counts.blocked > 0 && (
                    <Badge variant="destructive">
                      {faNumber(project.counts.blocked)} بلاک
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-[var(--border)] pt-[12px] text-[14px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-[5px]">
                    <CircleDot className="size-4" />
                    {faNumber(project.counts.inProgress)} در حال انجام
                  </span>
                  <span className="flex items-center gap-[5px]">
                    <GitPullRequest className="size-4" />
                    {faNumber(project.openPrs)} PR باز
                  </span>
                  <span className="flex items-center gap-[5px]">
                    <GitBranch className="size-4" />
                    {project.teamName || "بی‌تیم"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
