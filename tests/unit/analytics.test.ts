/**
 * تست‌های آنالیتیکس — متریک‌ها و حالت‌های مرزی.
 * ❌ متریک ونتی (تعداد خام کامیت فردی) پیاده نشده و نباید شود.
 */
import { describe, it, expect } from "vitest";

import {
  completionRate,
  cycleVelocity,
  averageCycleTime,
  averageLeadTime,
  prThroughput,
  averageTimeToFirstReview,
  workDistribution,
  cycleBurndown,
  findStalePrs,
  countBlockedAndOverdue,
  type PullRequestForAnalytics,
  type ReviewForAnalytics,
} from "@/lib/analytics";
import type { IssueForAnalytics } from "@/lib/analytics";

const DAY = 86400000;
const NOW = new Date("2026-09-10T12:00:00Z");

function issue(p: Partial<IssueForAnalytics>): IssueForAnalytics {
  return {
    id: p.id ?? "i1",
    status: p.status ?? "todo",
    estimate: p.estimate ?? 1,
    assigneeId: p.assigneeId ?? null,
    cycleId: p.cycleId ?? null,
    createdAt: p.createdAt ?? new Date(NOW.getTime() - 10 * DAY),
    startedAt: p.startedAt ?? null,
    closedAt: p.closedAt ?? null,
  };
}

function pr(p: Partial<PullRequestForAnalytics> = {}): PullRequestForAnalytics {
  return {
    id: p.id ?? "pr1",
    state: p.state ?? "open",
    authorId: p.authorId ?? null,
    githubCreatedAt: p.githubCreatedAt ?? new Date(NOW.getTime() - 5 * DAY),
    mergedAt: p.mergedAt ?? null,
    closedAt: p.closedAt ?? null,
  };
}

describe("completionRate", () => {
  it("نسبت ساده done/active", () => {
    expect(completionRate(3, 4)).toBeCloseTo(0.75, 10);
  });

  it("صفر فعال → ۰ بدون NaN", () => {
    expect(completionRate(0, 0)).toBe(0);
    expect(Number.isNaN(completionRate(0, 0))).toBe(false);
  });
});

describe("cycleVelocity", () => {
  const issues = [
    issue({ id: "1", cycleId: "c1", status: "done", estimate: 3 }),
    issue({ id: "2", cycleId: "c1", status: "done", estimate: 5 }),
    issue({ id: "3", cycleId: "c1", status: "todo", estimate: 8 }), // حساب نمی‌شود
    issue({ id: "4", cycleId: "c2", status: "done", estimate: 13 }),
  ];

  it("فقط استوری‌پوینت done همان سایکل", () => {
    expect(cycleVelocity(issues, "c1")).toBe(8);
    expect(cycleVelocity(issues, "c2")).toBe(13);
  });

  it("سایکل خالی → ۰", () => {
    expect(cycleVelocity(issues, "c9")).toBe(0);
  });
});

describe("averageCycleTime / averageLeadTime", () => {
  it("میانگین زمان تکمیل (فقط done با closedAt)", () => {
    const issues = [
      issue({
        id: "1",
        status: "done",
        createdAt: new Date(NOW.getTime() - 4 * DAY),
        closedAt: new Date(NOW.getTime() - 2 * DAY), // 2 روز
      }),
      issue({
        id: "2",
        status: "done",
        createdAt: new Date(NOW.getTime() - 6 * DAY),
        closedAt: new Date(NOW.getTime() - 2 * DAY), // 4 روز
      }),
      issue({ id: "3", status: "todo" }), // حساب نمی‌شود
    ];
    expect(averageCycleTime(issues)).toBe(3 * DAY);
    expect(averageLeadTime(issues)).toBe(3 * DAY);
  });

  it("هیچ done → null", () => {
    expect(averageCycleTime([issue({ status: "todo" })])).toBeNull();
    expect(averageLeadTime([])).toBeNull();
  });

  it("cycle time با startedAt جایگزین createdAt می‌شود", () => {
    const issues = [
      issue({
        id: "1",
        status: "done",
        createdAt: new Date(NOW.getTime() - 10 * DAY),
        startedAt: new Date(NOW.getTime() - 4 * DAY),
        closedAt: new Date(NOW.getTime() - 2 * DAY), // از شروع کار: 2 روز
      }),
    ];
    // lead time از createdAt: 8 روز | cycle time از startedAt: 2 روز
    expect(averageCycleTime(issues)).toBe(2 * DAY);
    expect(averageLeadTime(issues)).toBe(8 * DAY);
  });
});

describe("prThroughput", () => {
  const prs = [
    pr({ id: "1", state: "merged", mergedAt: new Date(NOW.getTime() - 1 * DAY) }),
    pr({ id: "2", state: "merged", mergedAt: new Date(NOW.getTime() - 20 * DAY) }),
    pr({ id: "3", state: "open" }), // merge نشده
    pr({ id: "4", state: "closed", closedAt: new Date(NOW.getTime() - 1 * DAY) }), // بسته بدون merge
  ];

  it("فقط merge شده در بازه", () => {
    expect(prThroughput(prs, new Date(NOW.getTime() - 7 * DAY), NOW)).toBe(1);
    expect(prThroughput(prs, new Date(NOW.getTime() - 30 * DAY), NOW)).toBe(2);
  });

  it("بازه خالی → ۰", () => {
    expect(prThroughput(prs, new Date(NOW.getTime() + DAY), new Date(NOW.getTime() + 2 * DAY))).toBe(0);
  });
});

describe("averageTimeToFirstReview", () => {
  it("میانگین اولین ریویو", () => {
    const prs = [
      pr({ id: "p1", githubCreatedAt: new Date(NOW.getTime() - 4 * DAY) }),
      pr({ id: "p2", githubCreatedAt: new Date(NOW.getTime() - 6 * DAY) }),
    ];
    const reviews: ReviewForAnalytics[] = [
      // p1: دو ریویو — اولی باید انتخاب شود (NOW-2 → ۲ روز بعد از ساخت PR)
      { pullRequestId: "p1", reviewerId: "u1", state: "COMMENTED", submittedAt: new Date(NOW.getTime() - 1 * DAY) },
      { pullRequestId: "p1", reviewerId: "u2", state: "APPROVED", submittedAt: new Date(NOW.getTime() - 2 * DAY) },
      // p2: یک ریویو (NOW-4 → ۲ روز بعد از ساخت PR)
      { pullRequestId: "p2", reviewerId: "u1", state: "APPROVED", submittedAt: new Date(NOW.getTime() - 4 * DAY) },
    ];
    // (2 + 2) / 2 = 2 روز
    expect(averageTimeToFirstReview(prs, reviews)).toBe(2 * DAY);
  });

  it("بدون ریویو → null", () => {
    expect(averageTimeToFirstReview([pr()], [])).toBeNull();
  });

  it("ریویو قبل از ساخت PR (داده خراب) → حساب نمی‌شود", () => {
    const prs = [pr({ id: "p1", githubCreatedAt: NOW })];
    const reviews: ReviewForAnalytics[] = [
      { pullRequestId: "p1", reviewerId: "u1", state: "APPROVED", submittedAt: new Date(NOW.getTime() - DAY) },
    ];
    expect(averageTimeToFirstReview(prs, reviews)).toBeNull();
  });
});

describe("workDistribution", () => {
  it("توزیع بر اساس استوری‌پوینت، مرتب نزولی", () => {
    const issues = [
      issue({ id: "1", assigneeId: "u1", estimate: 2, status: "in_progress" }),
      issue({ id: "2", assigneeId: "u1", estimate: 3, status: "done" }),
      issue({ id: "3", assigneeId: "u2", estimate: 8, status: "todo" }),
      issue({ id: "4", assigneeId: null, estimate: 1, status: "backlog" }),
    ];
    const dist = workDistribution(issues);
    expect(dist).toEqual([
      { assigneeId: "u2", totalEstimate: 8, issueCount: 1 },
      { assigneeId: "u1", totalEstimate: 5, issueCount: 2 },
      { assigneeId: null, totalEstimate: 1, issueCount: 1 },
    ]);
  });

  it("cancelled از توزیع حذف می‌شود", () => {
    const dist = workDistribution([
      issue({ id: "1", assigneeId: "u1", estimate: 5, status: "cancelled" }),
      issue({ id: "2", assigneeId: "u1", estimate: 1, status: "todo" }),
    ]);
    expect(dist).toEqual([{ assigneeId: "u1", totalEstimate: 1, issueCount: 1 }]);
  });

  it("لیست خالی → آرایه خالی", () => {
    expect(workDistribution([])).toEqual([]);
  });
});

describe("cycleBurndown", () => {
  const start = new Date("2026-09-01T00:00:00Z");
  const end = new Date("2026-09-10T00:00:00Z"); // ۹ روز

  it("شروع = کل وزن، پایان = باقیمانده واقعی", () => {
    const issues = [
      issue({ id: "1", estimate: 5, status: "done", closedAt: new Date("2026-09-03T10:00:00Z") }),
      issue({ id: "2", estimate: 5, status: "done", closedAt: new Date("2026-09-05T10:00:00Z") }),
      issue({ id: "3", estimate: 10, status: "in_progress" }), // باز
    ];
    const points = cycleBurndown(issues, start, end);

    expect(points[0].remaining).toBe(20); // کل وزن
    expect(points[0].ideal).toBe(20);
    // بعد از بسته شدن 5+5 → باقیمانده 10
    expect(points[points.length - 1].remaining).toBe(10);
    // ایده‌آل نهایی صفر است
    expect(points[points.length - 1].ideal).toBe(0);
  });

  it("سری زمانی تا امروز (نه تا پایان سایکل) می‌رود — سایکل در جریان", () => {
    const issues = [issue({ id: "1", estimate: 10, status: "todo" })];
    const points = cycleBurndown(issues, start, end);
    // امروز 2026-09-10 → نقطه آخر باید 09-10 یا کمتر باشد (سایکل هنوز در جریان/تمام‌شده امروز)
    expect(points.length).toBeGreaterThanOrEqual(1);
    const last = new Date(points[points.length - 1].date);
    expect(last.getTime()).toBeLessThanOrEqual(end.getTime());
  });

  it("بدون ایشو → آرایه خالی", () => {
    expect(cycleBurndown([], start, end)).toEqual([]);
  });

  it("همه cancelled → آرایه خالی (وزن کل صفر)", () => {
    const points = cycleBurndown(
      [issue({ id: "1", status: "cancelled", estimate: 5 })],
      start,
      end
    );
    expect(points).toEqual([]);
  });

  it("بسته‌شدن خارج از بازه سایکل حساب نمی‌شود", () => {
    const issues = [
      issue({ id: "1", estimate: 5, status: "done", closedAt: new Date("2026-08-20T10:00:00Z") }),
      issue({ id: "2", estimate: 5, status: "todo" }),
    ];
    const points = cycleBurndown(issues, start, end);
    expect(points[points.length - 1].remaining).toBe(10); // فقط ایشوی باز مانده
  });

  it("سایکل تمام‌شده → سری تا endDate کامل می‌رود", () => {
    const issues = [
      issue({ id: "1", estimate: 4, status: "done", closedAt: new Date("2026-09-02T10:00:00Z") }),
    ];
    const pastEnd = new Date("2026-09-05T00:00:00Z");
    const points = cycleBurndown(issues, start, pastEnd);
    expect(points[points.length - 1].date).toBe("2026-09-05");
    expect(points[points.length - 1].remaining).toBe(0);
  });
});

describe("findStalePrs", () => {
  it("باز بیش از ۱۴ روز → متروک", () => {
    const prs = [
      pr({ id: "old-open", state: "open", githubCreatedAt: new Date(NOW.getTime() - 20 * DAY) }),
      pr({ id: "new-open", state: "open", githubCreatedAt: new Date(NOW.getTime() - 3 * DAY) }),
      pr({ id: "old-merged", state: "merged", githubCreatedAt: new Date(NOW.getTime() - 30 * DAY), mergedAt: NOW }),
      pr({ id: "old-draft", state: "draft", githubCreatedAt: new Date(NOW.getTime() - 15 * DAY) }),
    ];
    const stale = findStalePrs(prs, NOW);
    expect(stale.map((p) => p.id)).toEqual(["old-open", "old-draft"]);
  });

  it("مرز دقیقاً ۱۴ روز → متروک نیست", () => {
    const prs = [pr({ state: "open", githubCreatedAt: new Date(NOW.getTime() - 14 * DAY) })];
    expect(findStalePrs(prs, NOW)).toEqual([]);
  });

  it("آستانه سفارشی", () => {
    const prs = [pr({ state: "open", githubCreatedAt: new Date(NOW.getTime() - 5 * DAY) })];
    expect(findStalePrs(prs, NOW, 3).length).toBe(1);
    expect(findStalePrs(prs, NOW, 7).length).toBe(0);
  });
});

describe("countBlockedAndOverdue", () => {
  it("بلاک و عقب‌افتاده را جدا می‌شمارد", () => {
    const { blockedCount, overdueCount } = countBlockedAndOverdue(
      [
        { status: "blocked", dueDate: null },
        { status: "blocked", dueDate: new Date(NOW.getTime() - DAY) }, // هم بلاک، هم عقب‌افتاده
        { status: "todo", dueDate: new Date(NOW.getTime() - DAY) }, // عقب‌افتاده
        { status: "done", dueDate: new Date(NOW.getTime() - DAY) }, // done → عقب‌افتاده نیست
        { status: "cancelled", dueDate: new Date(NOW.getTime() - DAY) }, // cancelled → عقب‌افتاده نیست
        { status: "todo", dueDate: new Date(NOW.getTime() + DAY) }, // آینده
      ],
      NOW
    );
    // مطابق کوئری سند: overdue = due_date < now AND status NOT IN ('done','cancelled')
    // → ایشوی بلاک با موعد گذشته در هر دو شمارش می‌شود (منعکس‌کننده واقعیت: بلاک + دیر)
    expect(blockedCount).toBe(2);
    expect(overdueCount).toBe(2);
  });

  it("لیست خالی → صفر", () => {
    const r = countBlockedAndOverdue([], NOW);
    expect(r.blockedCount).toBe(0);
    expect(r.overdueCount).toBe(0);
  });
});
