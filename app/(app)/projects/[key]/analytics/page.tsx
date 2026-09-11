"use client";

import { use, useState, useMemo } from "react";
import {
  AlertTriangle,
  ShieldCheck,
  Award,
  CheckCircle2,
  TrendingUp,
  Star,
  Zap,
  Target,
  Sparkles,
} from "lucide-react";

import {
  MOCK_ISSUES,
  MOCK_MEMBERS,
  MOCK_PROJECTS,
} from "@/components/features/__fixtures__/mock-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ISSUE_TYPE_LABEL,
  type Member,
} from "@/components/features/types";
import { faNumber, faPercent, faShortDate } from "@/lib/format";

interface MemberStats {
  member: Member;
  assignedIssuesCount: number;
  completedIssuesCount: number;
  inProgressIssuesCount: number;
  blockedIssuesCount: number;
  totalAssignedPoints: number;
  completedPoints: number;
  contributionPercent: number;
  score: number;
  tier: "S" | "A" | "B" | "C";
  tierTitle: string;
  tierColor: string;
  tierBadgeColor: string;
  completedIssues: typeof MOCK_ISSUES;
}

export default function AnalyticsPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = use(params);
  const projectKey = (key || "PM").toUpperCase();
  const project = MOCK_PROJECTS.find((p) => p.key === projectKey) ?? MOCK_PROJECTS[0];

  const [activeTab, setActiveTab] = useState<"project" | "members">("members");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Global Project Calculations
  const scopedIssues = useMemo(
    () => MOCK_ISSUES.filter((i) => i.status !== "cancelled"),
    []
  );

  const totalProjectWeight = useMemo(
    () => scopedIssues.reduce((s, i) => s + i.estimate, 0),
    [scopedIssues]
  );

  const weightOf = (s: string) =>
    s === "done" ? 1 : s === "in_review" ? 0.8 : s === "in_progress" ? 0.4 : 0;

  const totalEarnedPoints = useMemo(
    () => scopedIssues.reduce((s, i) => s + i.estimate * weightOf(i.status), 0),
    [scopedIssues]
  );

  const totalDonePoints = useMemo(
    () =>
      scopedIssues
        .filter((i) => i.status === "done")
        .reduce((s, i) => s + i.estimate, 0),
    [scopedIssues]
  );

  const completion = totalProjectWeight > 0 ? totalEarnedPoints / totalProjectWeight : 0;

  const byType = useMemo(
    () =>
      scopedIssues.reduce<Record<string, number>>((acc, i) => {
        acc[i.type] = (acc[i.type] ?? 0) + 1;
        return acc;
      }, {}),
    [scopedIssues]
  );

  const blocked = scopedIssues.filter((i) => i.status === "blocked");
  const overdue = scopedIssues.filter(
    (i) => i.dueDate && new Date(i.dueDate) < new Date() && i.status !== "done"
  );
  const unassigned = scopedIssues.filter((i) => !i.assignee);

  // Individual Member Analytics Calculation
  const membersStats: MemberStats[] = useMemo(() => {
    return MOCK_MEMBERS.map((member) => {
      const memberIssues = scopedIssues.filter((i) => i.assignee?.id === member.id);
      const completedIssues = memberIssues.filter((i) => i.status === "done");
      const inProgressIssues = memberIssues.filter((i) => i.status === "in_progress" || i.status === "in_review");
      const blockedIssues = memberIssues.filter((i) => i.status === "blocked");

      const totalAssignedPoints = memberIssues.reduce((acc, i) => acc + i.estimate, 0);
      const completedPoints = completedIssues.reduce((acc, i) => acc + i.estimate, 0);

      // Contribution % out of all completed project points
      const contributionPercent = totalDonePoints > 0 ? (completedPoints / totalDonePoints) * 100 : 0;

      // Calculate performance score (0-100) based on delivery, velocity, and zero blockers
      let rawScore = 50;
      if (completedPoints > 0) {
        rawScore += Math.min(30, completedPoints * 2.5);
      }
      if (memberIssues.length > 0) {
        const completionRate = completedIssues.length / memberIssues.length;
        rawScore += completionRate * 20;
      }
      if (blockedIssues.length > 0) {
        rawScore -= blockedIssues.length * 5;
      }
      const score = Math.max(10, Math.min(99, Math.round(rawScore)));

      // Determine Tier & Performance Level
      let tier: "S" | "A" | "B" | "C" = "B";
      let tierTitle = "سطح استاندارد و باثبات (Reliable)";
      let tierColor = "text-emerald-500 border-emerald-500/20 bg-emerald-500/10";
      let tierBadgeColor = "bg-emerald-500 text-white";

      if (score >= 90 || contributionPercent >= 28) {
        tier = "S";
        tierTitle = "سطح ممتاز و کلیدی (Tier S — Star Contributor)";
        tierColor = "text-amber-500 border-amber-500/30 bg-amber-500/10";
        tierBadgeColor = "bg-amber-500 text-white";
      } else if (score >= 75 || contributionPercent >= 15) {
        tier = "A";
        tierTitle = "سطح بسیار تاثیرگذار (Tier A — High Velocity)";
        tierColor = "text-indigo-500 border-indigo-500/30 bg-indigo-500/10";
        tierBadgeColor = "bg-indigo-600 text-white";
      } else if (score < 55) {
        tier = "C";
        tierTitle = "نیازمند همراهی و راهنمایی (Tier C — In Training)";
        tierColor = "text-orange-500 border-orange-500/30 bg-orange-500/10";
        tierBadgeColor = "bg-orange-500 text-white";
      }

      return {
        member,
        assignedIssuesCount: memberIssues.length,
        completedIssuesCount: completedIssues.length,
        inProgressIssuesCount: inProgressIssues.length,
        blockedIssuesCount: blockedIssues.length,
        totalAssignedPoints,
        completedPoints,
        contributionPercent,
        score,
        tier,
        tierTitle,
        tierColor,
        tierBadgeColor,
        completedIssues,
      };
    }).sort((a, b) => b.completedPoints - a.completedPoints);
  }, [scopedIssues, totalDonePoints]);

  const selectedMemberStats = useMemo(() => {
    if (!selectedMemberId) return membersStats[0] || null;
    return membersStats.find((s) => s.member.id === selectedMemberId) || membersStats[0];
  }, [membersStats, selectedMemberId]);

  return (
    <section aria-label="آنالیتیکس و ارزیابی" className="space-y-[24px]">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--text-primary)]">
            آنالیتیکس و ارزیابی عملکرد — {projectKey}
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">
            سنجش وزنی پیشرفت پروژه و آنالیتیکس فردی میزان مشارکت اعضای تیم
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "project" | "members")}>
          <TabsList className="bg-[var(--surface-raised)] border border-[var(--border)]">
            <TabsTrigger value="members" className="gap-1.5 text-[13px]">
              <Award size={15} />
              آنالیتیکس فردی اعضا
            </TabsTrigger>
            <TabsTrigger value="project" className="gap-1.5 text-[13px]">
              <TrendingUp size={15} />
              تحلیل کلان پروژه
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* TAB 1: INDIVIDUAL MEMBER ANALYTICS */}
      {activeTab === "members" && (
        <div className="space-y-6">
          {/* Top Metric Summary Banner */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-indigo-500/5 to-transparent">
              <CardHeader className="pb-2">
                <CardDescription className="text-[12px] flex items-center gap-1.5">
                  <Award className="size-4 text-indigo-500" />
                  برترین مشارکت‌کننده
                </CardDescription>
                <CardTitle className="text-[17px] font-bold">
                  {membersStats[0]?.member.displayName || "—"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-[12px] text-[var(--text-muted)]">
                  {faPercent(membersStats[0]?.contributionPercent / 100 || 0, 1)} از کل پیشرفت تحویل‌شده
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-[12px] flex items-center gap-1.5">
                  <Target className="size-4 text-[var(--primary)]" />
                  کل استوری پوینت تحویلی
                </CardDescription>
                <CardTitle className="text-[18px] font-bold">
                  {faNumber(totalDonePoints)} پوینت
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-[12px] text-[var(--text-muted)]">
                  توسط {faNumber(membersStats.length)} عضو تیم
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-[12px] flex items-center gap-1.5">
                  <Sparkles className="size-4 text-amber-500" />
                  میانگین امتیاز عملکرد تیم
                </CardDescription>
                <CardTitle className="text-[18px] font-bold text-amber-500">
                  {faNumber(
                    Math.round(
                      membersStats.reduce((acc, m) => acc + m.score, 0) / (membersStats.length || 1)
                    )
                  )} / ۱۰۰
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-[12px] text-[var(--text-muted)]">
                  سطح کیفی A (بسیار مطلوب)
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-[12px] flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  تسک‌های تکمیل‌شده
                </CardDescription>
                <CardTitle className="text-[18px] font-bold text-emerald-500">
                  {faNumber(scopedIssues.filter((i) => i.status === "done").length)} ایشو
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-[12px] text-[var(--text-muted)]">
                  بدون احتساب تسک‌های منقضی
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Member Selection & Detailed Member Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left/Right Member List Selection */}
            <div className="space-y-3">
              <h2 className="text-[14px] font-bold text-[var(--text-secondary)] px-1">
                انتخاب عضو تیم جهت بررسی عمیق:
              </h2>
              <div className="space-y-2">
                {membersStats.map((stat, idx) => {
                  const isSelected = selectedMemberStats?.member.id === stat.member.id;
                  return (
                    <button
                      key={stat.member.id}
                      type="button"
                      onClick={() => setSelectedMemberId(stat.member.id)}
                      className={`w-full text-start rounded-[12px] border p-3.5 transition-all flex items-center justify-between ${
                        isSelected
                          ? "border-[var(--primary)] bg-[var(--surface-raised)] shadow-sm ring-1 ring-[var(--primary)]"
                          : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-raised)]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-full bg-[var(--primary)] text-white text-[13px] font-bold shadow-xs">
                          {stat.member.displayName.charAt(0)}
                        </span>
                        <div>
                          <div className="font-bold text-[13px] text-[var(--text-primary)] flex items-center gap-1.5">
                            {stat.member.displayName}
                            {idx === 0 && <Star size={13} className="text-amber-500 fill-amber-500" />}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                            سهم مشارکت: <strong>{faPercent(stat.contributionPercent / 100, 1)}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${stat.tierColor}`}>
                          Tier {stat.tier}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          {faNumber(stat.completedPoints)} pts
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detailed Member Deep-dive Panel */}
            {selectedMemberStats && (
              <div className="lg:col-span-2 space-y-4">
                <Card className="border-t-4 border-t-[var(--primary)]">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-12 items-center justify-center rounded-full bg-[var(--primary)] text-white text-[18px] font-bold shadow-md">
                          {selectedMemberStats.member.displayName.charAt(0)}
                        </span>
                        <div>
                          <CardTitle className="text-[17px] font-bold flex items-center gap-2">
                            {selectedMemberStats.member.displayName}
                            <Badge className={selectedMemberStats.tierBadgeColor}>
                              Tier {selectedMemberStats.tier}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="text-[12px] mt-0.5" dir="ltr">
                            {selectedMemberStats.member.githubLogin ? `@${selectedMemberStats.member.githubLogin}` : "شناسه گیت‌هاب ثبت نشده"}
                          </CardDescription>
                        </div>
                      </div>

                      <div className="text-end">
                        <span className="text-[11px] text-[var(--text-muted)] block">امتیاز عملکرد هوشمند</span>
                        <span className="text-[26px] font-black text-[var(--primary)]">
                          {faNumber(selectedMemberStats.score)}
                          <span className="text-[14px] font-normal text-[var(--text-muted)]"> / ۱۰۰</span>
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Performance Tier Explanation */}
                    <div className={`rounded-[10px] border p-3 text-[13px] flex items-center gap-2.5 ${selectedMemberStats.tierColor}`}>
                      <Zap className="size-5 shrink-0" />
                      <div>
                        <strong>ارزیابی عملکرد:</strong> {selectedMemberStats.tierTitle}
                      </div>
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-3">
                        <span className="text-[11px] text-[var(--text-muted)] block mb-1">سهم در کل پروژه</span>
                        <span className="text-[18px] font-bold text-[var(--text-primary)]">
                          {faPercent(selectedMemberStats.contributionPercent / 100, 1)}
                        </span>
                      </div>

                      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-3">
                        <span className="text-[11px] text-[var(--text-muted)] block mb-1">استوری پوینت تحویلی</span>
                        <span className="text-[18px] font-bold text-emerald-600 dark:text-emerald-400">
                          {faNumber(selectedMemberStats.completedPoints)} pts
                        </span>
                      </div>

                      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-3">
                        <span className="text-[11px] text-[var(--text-muted)] block mb-1">تسک‌های تکمیل‌شده</span>
                        <span className="text-[18px] font-bold text-[var(--text-primary)]">
                          {faNumber(selectedMemberStats.completedIssuesCount)} ایشو
                        </span>
                      </div>

                      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-3">
                        <span className="text-[11px] text-[var(--text-muted)] block mb-1">در دست اقدام</span>
                        <span className="text-[18px] font-bold text-indigo-500">
                          {faNumber(selectedMemberStats.inProgressIssuesCount)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar of contribution */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[12px]">
                        <span className="text-[var(--text-muted)]">درصد وزنی مشارکت در خروجی پروژه</span>
                        <span className="font-bold text-[var(--text-primary)]">
                          {faPercent(selectedMemberStats.contributionPercent / 100, 1)}
                        </span>
                      </div>
                      <div className="w-full bg-[var(--surface-raised)] rounded-full h-3 overflow-hidden border border-[var(--border)]">
                        <div
                          className="bg-gradient-to-r from-[var(--primary)] to-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, selectedMemberStats.contributionPercent)}%` }}
                        />
                      </div>
                    </div>

                    {/* List of Tasks Done by this Person */}
                    <div className="space-y-3 pt-2">
                      <h3 className="text-[14px] font-bold text-[var(--text-primary)] flex items-center justify-between">
                        <span>ریز تسک‌های انجام‌شده توسط {selectedMemberStats.member.displayName}</span>
                        <Badge variant="outline" className="text-[11px]">
                          {faNumber(selectedMemberStats.completedIssues.length)} تسک تحویل‌شده
                        </Badge>
                      </h3>

                      {selectedMemberStats.completedIssues.length === 0 ? (
                        <div className="rounded-[10px] border border-dashed border-[var(--border)] p-6 text-center text-[13px] text-[var(--text-muted)]">
                          هنوز تسک نهایی‌شده‌ای برای این عضو ثبت نشده است.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {selectedMemberStats.completedIssues.map((issue) => (
                            <div
                              key={issue.id}
                              className="flex items-center justify-between rounded-[8px] border border-[var(--border)] bg-[var(--background)] p-3 text-[13px] hover:border-[var(--primary)] transition-colors"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-muted)]" dir="ltr">
                                  {issue.key}
                                </span>
                                <span className="font-medium text-[var(--text-primary)] truncate max-w-[280px]">
                                  {issue.title}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="secondary" className="text-[10px]">
                                  {ISSUE_TYPE_LABEL[issue.type]}
                                </Badge>
                                <span className="font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                  +{faNumber(issue.estimate)} pts
                                </span>
                                {issue.updatedAt && (
                                  <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline">
                                    {faShortDate(issue.updatedAt)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: OVERALL PROJECT ANALYTICS */}
      {activeTab === "project" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-[16px] md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>نرخ تکمیل وزنی کل پروژه</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[30px] font-bold text-[var(--primary)]">
                  {faPercent(completion, 1)}
                </p>
                <p className="text-[13px] text-[var(--text-muted)] mt-1">
                  {faNumber(totalEarnedPoints)} از {faNumber(totalProjectWeight)} استوری‌پوینت
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>توزیع نوع کار در پروژه</CardTitle>
              </CardHeader>
              <CardContent className="space-y-[8px]">
                {Object.entries(byType).map(([type, count]) => (
                  <div
                    key={type}
                    className="flex items-center justify-between text-[13px]"
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
                  سیگنال‌های ریسک پروژه
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-[8px] text-[13px]">
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
                <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
                شاخص سلامت کل پروژه
              </CardTitle>
            </CardHeader>
            <CardContent className="text-[14px] leading-[1.8] text-[var(--text-secondary)]">
              <p>
                سلامت فعلی: <strong>{project.healthReason || "بدون توضیح"}</strong>
              </p>
              <p className="mt-[8px] text-[var(--text-muted)] text-[13px]">
                محاسبه بر اساس: عقب‌افتادگی pace، تعداد بلاک‌شده، اورده‌و، و PRهای stale —
                مطابق استانداردهای هوش مهندسی Flowdeck.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
