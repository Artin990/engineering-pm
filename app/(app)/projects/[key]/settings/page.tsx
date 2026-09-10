import { Settings, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MOCK_MEMBERS, MOCK_PROJECTS } from "@/components/features/__fixtures__/mock-data";
import { faNumber } from "@/lib/format";

/**
 * تنظیمات پروژه — اطلاعات پایه، اعضا، خطرناک‌ها.
 */
export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const project =
    MOCK_PROJECTS.find((p) => p.key === key) ?? MOCK_PROJECTS[0];

  return (
    <section aria-label="تنظیمات پروژه" className="space-y-[20px]">
      <header>
        <h1 className="text-[20px] font-semibold">تنظیمات — {key}</h1>
        <p className="text-[14px] text-[var(--text-muted)]">
          مدیریت اطلاعات پایه پروژه
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-[8px]">
            <Settings className="size-4" />
            اطلاعات پایه
          </CardTitle>
          <CardDescription>
            نام، توضیح و تاریخ هدف پروژه
          </CardDescription>
        </CardHeader>
        <CardContent className="grid max-w-[560px] gap-[16px]">
          <label className="grid gap-[5px] text-[14px]">
            نام پروژه
            <Input defaultValue={project.name} />
          </label>
          <label className="grid gap-[5px] text-[14px]">
            کد پروژه (لاتین)
            <Input defaultValue={project.key} dir="ltr" className="font-mono" disabled />
          </label>
          <label className="grid gap-[5px] text-[14px]">
            تاریخ هدف
            <Input type="date" defaultValue={project.targetDate ?? ""} />
          </label>
          <div>
            <Button>ذخیره تغییرات</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-[8px]">
            <Users className="size-4" />
            اعضا ({faNumber(MOCK_MEMBERS.length)})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-[8px]">
          {MOCK_MEMBERS.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-[10px] border border-[var(--border)] p-[12px]"
            >
              <span className="flex items-center gap-[8px] text-[14px] font-medium">
                <span className="flex size-8 items-center justify-center rounded-full bg-[var(--primary)] text-[12px] font-semibold text-white">
                  {m.displayName.charAt(0)}
                </span>
                {m.displayName}
                {m.githubLogin && (
                  <span dir="ltr" className="text-[12px] text-[var(--text-muted)]">
                    @{m.githubLogin}
                  </span>
                )}
              </span>
              <Badge variant="secondary">عضو</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
