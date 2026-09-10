/**
 * موتور پیشرفت وزنی — OpenClaw (موج ۲).
 *
 * فرمول‌ها:
 *   Completion% = Σ(w_i × statusWeight_i) ÷ Σ w_i
 *   وزن هر ایشو = estimate (استوری‌پوینت، پیش‌فرض ۱)
 *   وزن وضعیت:
 *     Backlog:0 | Todo:0 | In Progress:0.4 | In Review:0.8 | Blocked:0 | Done:1 | Cancelled: حذف
 *
 * همه خروجی‌ها pure function و قابل تست.
 */

// ─── Types ──────────────────────────────────────────────────────

export type IssueStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "blocked"
  | "done"
  | "cancelled";

export interface IssueForProgress {
  id: string;
  status: IssueStatus;
  estimate: number; // story points — default 1
}

export interface ProgressResult {
  /** درصد پیشرفت وزنی ۰–۱ */
  completion: number;
  /** مجموع وزن‌های مؤثر (بدون cancelled) */
  totalWeight: number;
  /** وزن انجام‌شده (done × estimate) */
  completedWeight: number;
  /** تعداد کل ایشوها (شامل cancelled برای آمار) */
  totalCount: number;
  /** تعداد ایشو done */
  doneCount: number;
  /** تعداد ایشو cancelled */
  cancelledCount: number;
}

export type HealthStatus = "on_track" | "at_risk" | "off_track" | "blocked";

export interface HealthInput {
  /** نتیجه progress فعلی پروژه */
  progress: ProgressResult;
  /** تعداد ایشو‌هایی که status=blocked */
  blockedCount: number;
  /** تعداد ایشو‌هایی که past due_date هستن و done نیستن */
  overdueCount: number;
  /** تعداد PRهای stale (باز بیش از ۱۴ روز بدون فعالیت) */
  stalePrCount: number;
  /** آیا سرعت burn-down فعلی برای رسیدن به target کافی است؟ */
  paceOnTrack: boolean;
}

export interface HealthResult {
  status: HealthStatus;
  reasons: string[];
}

/** مجموع ایشو‌های سایکل/مایلستون — برای رول‌آپ پروژه */
export interface SubProgress {
  id: string;
  weight: number; // وزن این زیرمجموعه (مثلاً مجموع estimateهای سایکل)
  completion: number; // ۰–۱
}

// ─── Status Weights ─────────────────────────────────────────────

export const STATUS_WEIGHT: Record<IssueStatus, number> = {
  backlog: 0,
  todo: 0,
  in_progress: 0.4,
  in_review: 0.8,
  blocked: 0,
  done: 1,
  cancelled: 0, // حذف از مخرج — این مقدار فقط نشانه‌ست
};

/** آیا این وضعیت باید از مجموع وزن حذف شود؟ */
function isCancelled(status: IssueStatus): boolean {
  return status === "cancelled";
}

// ─── Core: Weighted Completion ───────────────────────────────────

/**
 * محاسبه درصد پیشرفت وزنی یک لیست ایشو.
 * فرمول: Σ(estimate × statusWeight) ÷ Σ(estimate) — بدون cancelled.
 * اگر هیچ ایشو غیر-cancelled نباشد ۰ برمی‌گرداند (بدون خطای تقسیم صفر).
 */
export function computeCompletion(issues: IssueForProgress[]): ProgressResult {
  const active = issues.filter((i) => !isCancelled(i.status));
  const cancelled = issues.filter((i) => isCancelled(i.status));

  if (active.length === 0) {
    return {
      completion: 0,
      totalWeight: 0,
      completedWeight: 0,
      totalCount: issues.length,
      doneCount: 0,
      cancelledCount: cancelled.length,
    };
  }

  let totalWeight = 0;
  let completedWeight = 0;
  let doneCount = 0;

  for (const issue of active) {
    const w = Math.max(issue.estimate, 0); // estimate نمی‌تواند منفی باشد
    totalWeight += w;
    completedWeight += w * STATUS_WEIGHT[issue.status];
    if (issue.status === "done") doneCount++;
  }

  return {
    completion: totalWeight > 0 ? completedWeight / totalWeight : 0,
    totalWeight,
    completedWeight,
    totalCount: issues.length,
    doneCount,
    cancelledCount: cancelled.length,
  };
}

// ─── Rollup: SubProgress → Weighted Parent ──────────────────────

/**
 * رول‌آپ وزنی از زیرمجموعه‌ها (سایکل‌ها یا مایلستون‌ها) به سطح بالاتر.
 * هر زیرمجموعه یک weight و completion دارد.
 * فرمول: Σ(weight_i × completion_i) ÷ Σ(weight_i)
 *
 * ⚠️ weight زیرمجموعه باید = مجموع estimate ایشو‌هایش باشد، نه تعداد خام.
 */
export function rollupProgress(subs: SubProgress[]): number {
  if (subs.length === 0) return 0;

  let totalWeight = 0;
  let weightedCompletion = 0;

  for (const sub of subs) {
    const w = Math.max(sub.weight, 0);
    totalWeight += w;
    weightedCompletion += w * Math.max(0, Math.min(1, sub.completion));
  }

  return totalWeight > 0 ? weightedCompletion / totalWeight : 0;
}

// ─── Estimated Delivery ─────────────────────────────────────────

/**
 * پیشرفت تحویل تخمینی: شیب burndown واقعی ÷ شیب موردنیاز تا target_date.
 *
 * @param completedWeight - وزن انجام‌شده در بازه‌ی اندازه‌گیری (مثلاً اول سایکل تا الان)
 * @param totalWeight - مجموع وزن کل سایکل/پروژه
 * @param elapsedDays - روزهای گذشته از شروع
 * @param totalDays - کل روزهای بازه (start → target_date)
 * @returns نسبت ≥۰؛ ≥۱ یعنی سر وقت، <۱ یعنی عقب‌ایم.
 *         اگر totalDays یا totalWeight صفر باشد، null برمی‌گرداند.
 */
export function computeEstimatedDelivery(
  completedWeight: number,
  totalWeight: number,
  elapsedDays: number,
  totalDays: number
): number | null {
  if (totalWeight <= 0 || totalDays <= 0) return null;

  const remainingWeight = totalWeight - completedWeight;
  if (remainingWeight <= 0) return 1.0; // قبلاً تموم شده

  const actualRate = elapsedDays > 0 ? completedWeight / elapsedDays : 0;
  const requiredRate = totalWeight / totalDays;

  if (requiredRate <= 0) return null;
  return actualRate / requiredRate;
}

// ─── Health ─────────────────────────────────────────────────────

/**
 * محاسبه سلامت پروژه بر اساس ترکیب معیارها.
 * ترتیب ارزیابی (بدترین → بهترین): Blocked > Off Track > At Risk > On Track
 */
export function computeHealth(input: HealthInput): HealthResult {
  const reasons: string[] = [];

  // Blocked: هر ایشوی بلاک‌شده یا سرعت کاملاً ناکافی
  if (input.blockedCount > 0 && input.progress.completion < 0.5) {
    reasons.push(`${input.blockedCount} ایشو بلاک شده و پیشرفت زیر ۵۰٪`);
    return { status: "blocked", reasons };
  }

  // Off Track: سرعت ناکافی + عقب‌افتادگی بالا
  if (!input.paceOnTrack && input.overdueCount > 0) {
    reasons.push(`سرعت سوزاندن ناکافی و ${input.overdueCount} ایشو دیر شده`);
    if (input.stalePrCount > 0) {
      reasons.push(`${input.stalePrCount} PR متروک`);
    }
    return { status: "off_track", reasons };
  }

  // At Risk: یک یا چند فاکتور هشدار
  if (input.overdueCount > 0) {
    reasons.push(`${input.overdueCount} ایشو از موعد گذشته`);
  }
  if (input.stalePrCount > 2) {
    reasons.push(`${input.stalePrCount} PR متروک (باز بیش از ۱۴ روز)`);
  }
  if (input.blockedCount > 0) {
    reasons.push(`${input.blockedCount} ایشو بلاک شده`);
  }
  if (!input.paceOnTrack) {
    reasons.push("سرعت سوزاندن کمتر از حد لازم");
  }

  if (reasons.length > 0) {
    return { status: "at_risk", reasons };
  }

  return { status: "on_track", reasons: ["روی زمان‌بندی"] };
}
