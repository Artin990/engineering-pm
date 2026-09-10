/**
 * تست‌های موتور پیشرفت وزنی — حالت‌های مرزی مطابق پرامپت:
 * صفر تسک، همه بلاک، estimate نامشخص، سایکل تمام‌شده.
 */
import { describe, it, expect } from "vitest";

import {
  computeCompletion,
  rollupProgress,
  computeEstimatedDelivery,
  computeHealth,
  STATUS_WEIGHT,
  type IssueForProgress,
} from "@/lib/progress";

function issue(
  id: string,
  status: IssueForProgress["status"],
  estimate = 1
): IssueForProgress {
  return { id, status, estimate };
}

describe("STATUS_WEIGHT", () => {
  it("وزن‌های سند را دقیقاً رعایت می‌کند", () => {
    expect(STATUS_WEIGHT.backlog).toBe(0);
    expect(STATUS_WEIGHT.todo).toBe(0);
    expect(STATUS_WEIGHT.in_progress).toBe(0.4);
    expect(STATUS_WEIGHT.in_review).toBe(0.8);
    expect(STATUS_WEIGHT.blocked).toBe(0);
    expect(STATUS_WEIGHT.done).toBe(1);
    expect(STATUS_WEIGHT.cancelled).toBe(0); // علاوه بر حذف از مخرج
  });
});

describe("computeCompletion", () => {
  it("صفر تسک → completion=0 بدون خطای تقسیم صفر", () => {
    const r = computeCompletion([]);
    expect(r.completion).toBe(0);
    expect(r.totalWeight).toBe(0);
    expect(r.totalCount).toBe(0);
  });

  it("همه todo → صفر درصد", () => {
    const r = computeCompletion([
      issue("a", "todo", 3),
      issue("b", "todo", 2),
    ]);
    expect(r.completion).toBe(0);
    expect(r.totalWeight).toBe(5);
  });

  it("همه بلاک → صفر درصد اما وزن در مخرج می‌ماند", () => {
    const r = computeCompletion([
      issue("a", "blocked", 2),
      issue("b", "blocked", 3),
    ]);
    expect(r.completion).toBe(0);
    expect(r.totalWeight).toBe(5);
  });

  it("همه done → ۱۰۰٪", () => {
    const r = computeCompletion([
      issue("a", "done", 2),
      issue("b", "done", 8),
    ]);
    expect(r.completion).toBe(1);
    expect(r.doneCount).toBe(2);
  });

  it("وزنی است، نه تعداد خام: یک done با estimate=9 از سه todo با estimate=1 → ۷۵٪", () => {
    const r = computeCompletion([
      issue("big", "done", 9),
      issue("s1", "todo"),
      issue("s2", "todo"),
      issue("s3", "todo"),
    ]);
    // Σw = 12، completed = 9 → 0.75
    expect(r.completion).toBeCloseTo(0.75, 10);
  });

  it("cancelled از مخرج حذف می‌شود", () => {
    const r = computeCompletion([
      issue("done", "done", 5),
      issue("cxl", "cancelled", 5),
    ]);
    // فقط done باقی می‌ماند → ۱۰۰٪
    expect(r.completion).toBe(1);
    expect(r.totalWeight).toBe(5);
    expect(r.cancelledCount).toBe(1);
  });

  it("فقط cancelled → completion=0", () => {
    const r = computeCompletion([issue("c1", "cancelled"), issue("c2", "cancelled")]);
    expect(r.completion).toBe(0);
    expect(r.totalWeight).toBe(0);
    expect(r.cancelledCount).toBe(2);
  });

  it("estimate نامشخص (صفر) → از محاسبه حذف نمی‌شود ولی وزن صفر دارد", () => {
    const r = computeCompletion([
      issue("a", "done", 0),
      issue("b", "done", 4),
    ]);
    // وزن a صفر است → فقط b حساب می‌شود → ۱۰۰٪
    expect(r.completion).toBe(1);
    expect(r.totalWeight).toBe(4);
  });

  it("همه estimate صفر → 0 (بدون NaN)", () => {
    const r = computeCompletion([
      issue("a", "in_progress", 0),
      issue("b", "todo", 0),
    ]);
    expect(r.completion).toBe(0);
    expect(Number.isNaN(r.completion)).toBe(false);
  });

  it("estimate منفی (داده خراب) → clamp به صفر، نه انفجار", () => {
    const r = computeCompletion([
      issue("a", "done", 5),
      issue("b", "done", -3),
    ]);
    expect(r.completion).toBe(1); // وزن منفی صفر می‌شود → 5/5
    expect(r.totalWeight).toBe(5);
  });

  it("ترکیب وضعیت‌ها: 1 done(2) + 1 in_review(3) + 1 in_progress(5) + 1 todo(10)", () => {
    const r = computeCompletion([
      issue("d", "done", 2),
      issue("r", "in_review", 3),
      issue("p", "in_progress", 5),
      issue("t", "todo", 10),
    ]);
    // (2×1 + 3×0.8 + 5×0.4 + 10×0) / 20 = 6.4/20 = 0.32
    expect(r.completion).toBeCloseTo(0.32, 10);
  });

  it("تقسیم estimate اعشاری سالم است", () => {
    const r = computeCompletion([
      issue("a", "done", 0.5),
      issue("b", "todo", 0.5),
    ]);
    expect(r.completion).toBeCloseTo(0.5, 10);
  });
});

describe("rollupProgress", () => {
  it("رول‌آپ وزنی — نه میانگین ساده", () => {
    // سایکل ۱: weight=10، completion=1 | سایکل ۲: weight=90، completion=0
    // میانگین ساده ۵۰٪ می‌داد؛ وزنی باید ۱۰٪ بدهد.
    const v = rollupProgress([
      { id: "c1", weight: 10, completion: 1 },
      { id: "c2", weight: 90, completion: 0 },
    ]);
    expect(v).toBeCloseTo(0.1, 10);
  });

  it("لیست خالی → ۰", () => {
    expect(rollupProgress([])).toBe(0);
  });

  it("همه وزن صفر → ۰ بدون NaN", () => {
    const v = rollupProgress([
      { id: "a", weight: 0, completion: 1 },
      { id: "b", weight: 0, completion: 0.5 },
    ]);
    expect(v).toBe(0);
    expect(Number.isNaN(v)).toBe(false);
  });

  it("completion خارج از بازه clamp می‌شود (داده خراب)", () => {
    const v = rollupProgress([{ id: "a", weight: 10, completion: 1.7 }]);
    expect(v).toBe(1);
  });

  it("وزن منفی clamp می‌شود", () => {
    const v = rollupProgress([
      { id: "a", weight: -5, completion: 1 },
      { id: "b", weight: 10, completion: 0.5 },
    ]);
    expect(v).toBeCloseTo(0.5, 10);
  });
});

describe("computeEstimatedDelivery", () => {
  it("شیب برابر → ۱ (سر وقت)", () => {
    // ۵۰٪ کار در ۵۰٪ زمان
    const ratio = computeEstimatedDelivery(50, 100, 15, 30);
    expect(ratio).toBeCloseTo(1, 10);
  });

  it("عقب‌تر از برنامه → کمتر از ۱", () => {
    const ratio = computeEstimatedDelivery(25, 100, 15, 30);
    expect(ratio).toBeCloseTo(0.5, 10);
  });

  it("جلوتر از برنامه → بیشتر از ۱", () => {
    const ratio = computeEstimatedDelivery(75, 100, 10, 30);
    expect(ratio).toBeCloseTo(2.25, 10);
  });

  it("کار تمام‌شده → ۱ (هرچه elapsed باشد)", () => {
    expect(computeEstimatedDelivery(100, 100, 3, 30)).toBe(1.0);
    expect(computeEstimatedDelivery(120, 100, 3, 30)).toBe(1.0);
  });

  it("صفر روز سپری‌شده → ۰ (هنوز شروع نشده)", () => {
    expect(computeEstimatedDelivery(0, 100, 0, 30)).toBe(0);
  });

  it("totalWeight صفر → null (چیزی برای محاسبه نیست)", () => {
    expect(computeEstimatedDelivery(0, 0, 10, 30)).toBeNull();
  });

  it("totalDays صفر → null (تاریخ هدف نامعتبر)", () => {
    expect(computeEstimatedDelivery(10, 100, 5, 0)).toBeNull();
  });
});

describe("computeHealth", () => {
  const baseProgress = {
    completion: 0.6,
    totalWeight: 100,
    completedWeight: 60,
    totalCount: 10,
    doneCount: 6,
    cancelledCount: 0,
  };
  const baseInput = {
    progress: baseProgress,
    blockedCount: 0,
    overdueCount: 0,
    stalePrCount: 0,
    paceOnTrack: true,
  };

  it("همه سالم → on_track", () => {
    const h = computeHealth(baseInput);
    expect(h.status).toBe("on_track");
  });

  it("بلاک + پیشرفت کم → blocked", () => {
    const h = computeHealth({ ...baseInput, blockedCount: 3, progress: { ...baseProgress, completion: 0.3 } });
    expect(h.status).toBe("blocked");
    expect(h.reasons.length).toBeGreaterThan(0);
  });

  it("بلاک اما پیشرفت بالا → at_risk (نه blocked)", () => {
    const h = computeHealth({ ...baseInput, blockedCount: 1 });
    expect(h.status).toBe("at_risk");
  });

  it("سرعت ناکافی + عقب‌افتادگی → off_track", () => {
    const h = computeHealth({ ...baseInput, paceOnTrack: false, overdueCount: 2 });
    expect(h.status).toBe("off_track");
  });

  it("فقط pace ناکافی (بدون overdue) → at_risk", () => {
    const h = computeHealth({ ...baseInput, paceOnTrack: false });
    expect(h.status).toBe("at_risk");
  });

  it("فقط overdue → at_risk", () => {
    const h = computeHealth({ ...baseInput, overdueCount: 1 });
    expect(h.status).toBe("at_risk");
  });

  it("stale PR ≤ 2 مشکلی ایجاد نمی‌کند", () => {
    const h = computeHealth({ ...baseInput, stalePrCount: 2 });
    expect(h.status).toBe("on_track");
  });

  it("stale PR > 2 → at_risk", () => {
    const h = computeHealth({ ...baseInput, stalePrCount: 3 });
    expect(h.status).toBe("at_risk");
  });

  it("اولویت با blocked است حتی اگر off_track هم باشد", () => {
    const h = computeHealth({
      ...baseInput,
      blockedCount: 2,
      progress: { ...baseProgress, completion: 0.2 },
      paceOnTrack: false,
      overdueCount: 3,
    });
    expect(h.status).toBe("blocked");
  });
});
