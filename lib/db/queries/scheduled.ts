/**
 * اعلان‌های زمان‌بندی‌شده — ددلاین نزدیک + پایان سایکل.
 * این فایل فقط logic است؛ اجرای cron بر عهده Aion CLI (app/api/cron/sync) است.
 * cron باید `notifyUpcomingDeadlines` و `notifyEndingCycles` را صدا بزند.
 */
import { eq, and, isNull, lte, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { issues, cycles, projects } from "@/lib/db/schema";
import { listProjectMemberIds } from "./issue";
import { notify } from "../../notifications";

/** ایشوهایی با due_date در ۴۸ ساعت آینده و status باز — اعلان به assignee. */
export async function notifyUpcomingDeadlines(): Promise<{ notified: number }> {
  const twoDaysOut = new Date(Date.now() + 48 * 3600_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const rows = await db
    .select({
      id: issues.id,
      key: issues.key,
      title: issues.title,
      dueDate: issues.dueDate,
      assigneeId: issues.assigneeId,
      projectId: issues.projectId,
    })
    .from(issues)
    .where(
      and(
        isNull(issues.deletedAt),
        gt(issues.dueDate, today),
        lte(issues.dueDate, twoDaysOut)
      )
    );

  let notified = 0;
  for (const r of rows) {
    if (!r.assigneeId) continue;
    const { skipped } = await notify({
      userId: r.assigneeId,
      type: "deadline_soon",
      title: `ددلاین ${r.key} نزدیک است`,
      body: `${r.title} — موعد: ${r.dueDate}`,
      link: `/projects/${r.projectId}/issues/${r.id}`,
      aggregateKey: `${r.id}:deadline`,
    });
    if (!skipped) notified++;
  }
  return { notified };
}

/** سایکل‌های درحال فعال که در ۲۴ ساعت آینده تمام می‌شوند — اعلان به همه اعضای پروژه. */
export async function notifyEndingCycles(): Promise<{ notified: number }> {
  const tomorrow = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10);

  const rows = await db
    .select({
      id: cycles.id,
      name: cycles.name,
      endDate: cycles.endDate,
      projectId: cycles.projectId,
      key: projects.key,
    })
    .from(cycles)
    .innerJoin(projects, eq(projects.id, cycles.projectId))
    .where(
      and(
        isNull(cycles.deletedAt),
        eq(cycles.status, "active"),
        lte(cycles.endDate, tomorrow)
      )
    );

  let notified = 0;
  for (const r of rows) {
    const memberIds = await listProjectMemberIds(r.projectId);
    for (const userId of memberIds) {
      const { skipped } = await notify({
        userId,
        type: "cycle_ended",
        title: `سایکل ${r.name} رو به پایان است`,
        body: `پایان: ${r.endDate}`,
        link: `/projects/${r.key}/cycles`,
        aggregateKey: `${r.id}:end`,
      });
      if (!skipped) notified++;
    }
  }
  return { notified };
}
