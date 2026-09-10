import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

export type NotificationType =
  | "assigned" | "mentioned" | "commented" | "review_requested"
  | "deadline_soon" | "cycle_ended" | "status_suggested";

/** پنجره ضداسپم — رویدادهای تکراری در این بازه یکی می‌شوند (ثانیه). */
const ANTI_SPAM_WINDOW_SEC: Record<NotificationType, number> = {
  assigned: 3600,
  mentioned: 3600,
  commented: 900, // کامنت‌های پیاپی → یک اعلان
  review_requested: 3600,
  deadline_soon: 86400, // روزی یک‌بار
  cycle_ended: 86400,
  status_suggested: 3600,
};

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  /** کلید تجمیع — مثلاً `comment:issue-uuid`. */
  aggregateKey?: string;
};

/**
 * ایجاد اعلان با aggregation + throttle.
 * اگر اعلانی با همان dedupeKey در پنجره زمانی وجود داشت، skip می‌شود.
 */
export async function notify(input: NotifyInput) {
  const windowSec = ANTI_SPAM_WINDOW_SEC[input.type];
  const dedupeKey = input.aggregateKey ? `${input.type}:${input.aggregateKey}` : null;

  if (dedupeKey) {
    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, input.userId),
          eq(notifications.dedupeKey, dedupeKey)
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(1);

    if (existing.length > 0) {
      // بررسی تازگی: اگر رکورد تازه‌تر از پنجره است، skip
      const [latest] = await db
        .select({ createdAt: notifications.createdAt })
        .from(notifications)
        .where(eq(notifications.id, existing[0].id))
        .limit(1);
      if (latest) {
        const ageSec = (Date.now() - new Date(latest.createdAt).getTime()) / 1000;
        if (ageSec < windowSec) return { skipped: true as const };
      }
    }
  }

  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      dedupeKey,
    })
    .returning();

  return { skipped: false as const, notification: row };
}

export async function listUserNotifications(userId: string, limit = 20) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(Math.min(limit, 100));
}

export async function markNotificationRead(notificationId: string, userId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      )
    );
}

export async function markAllRead(userId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
