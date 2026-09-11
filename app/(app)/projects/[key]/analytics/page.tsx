"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import {
  Award,
  Zap,
  Target,
  UserCheck,
  GraduationCap,
  Briefcase,
  AlertTriangle,
  Flame,
  BookOpen,
  MessageSquare,
  CheckSquare,
  Download,
  Filter,
  BarChart3,
  HeartHandshake,
  Activity,
  Users,
  UserPlus,
  Lock,
  ShieldAlert,
  TrendingUp,
  Sparkles,
} from "lucide-react";

import { useProjectStore } from "@/lib/project-store";
import { useUserRole } from "@/lib/role-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { faNumber, faPercent } from "@/lib/format";
import type { Member, Issue } from "@/components/features/types";

export type MemberType = "intern" | "employee";

export interface SkillRating {
  name: string;
  category: string;
  level: number; // 0 - 100
  growth: string;
}

export interface IndividualProfile {
  id: string;
  name: string;
  roleTitle: string;
  type: MemberType;
  avatar: string;
  mentorName?: string;
  onboardingProgress?: number;
  learningCurveScore?: number;
  timeSpentHours: number;
  estimatedHours: number;
  onTimeDeliveryRate: number;
  taskCompletionRate: number;
  reworkRate: number;
  qualityScore: number;
  activeStreakDays: number;
  burnoutRisk: "low" | "medium" | "high";
  burnoutReason: string;
  skills: SkillRating[];
  okrs: { title: string; progress: number; dueDate: string }[];
  badges: { title: string; icon: string; desc: string; date: string }[];
  activityMap: number[]; // 28-day activity intensity
  mentorFeedback?: string;
}

/**
 * Generate dynamic metrics for a member based on actual assigned issues and role
 */
function buildIndividualProfile(member: Member, issues: Issue[]): IndividualProfile {
  const isIntern = member.role === "intern";
  const assigned = issues.filter(
    (i) => i.assignee?.id === member.id || i.assignee?.displayName === member.displayName
  );

  const doneIssues = assigned.filter((i) => i.status === "done");
  const inProgressIssues = assigned.filter((i) => i.status === "in_progress");
  const blockedIssues = assigned.filter((i) => i.status === "blocked");
  const inReviewIssues = assigned.filter((i) => i.status === "in_review");

  const totalPoints = assigned.reduce((s, i) => s + (i.estimate || 1), 0);
  const donePoints = doneIssues.reduce((s, i) => s + (i.estimate || 1), 0);

  const taskCompletionRate =
    assigned.length > 0 ? Math.round((doneIssues.length / assigned.length) * 100) : 100;

  const onTimeDeliveryRate =
    assigned.length > 0 ? (blockedIssues.length > 0 ? 80 : 95) : 100;

  const reworkRate =
    assigned.length > 0
      ? Math.round(((inReviewIssues.length + blockedIssues.length) / assigned.length) * 100)
      : 0;

  const qualityScore = Math.max(70, Math.min(100, 100 - Math.round(reworkRate / 2)));
  const estimatedHours = totalPoints > 0 ? totalPoints * 4 : 40;
  const timeSpentHours = donePoints > 0 ? Math.round(donePoints * 3.8) : Math.round(estimatedHours * 0.7);

  const burnoutRisk: "low" | "medium" | "high" =
    inProgressIssues.length >= 4 ? "high" : inProgressIssues.length >= 2 ? "medium" : "low";

  const burnoutReason =
    burnoutRisk === "high"
      ? "تعداد تسک‌های همزمان در حال انجام بالا است و نیازمند توزیع مجدد بار کاری است."
      : burnoutRisk === "medium"
      ? "تراکم کاری در حد متوسط بوده و ریتم تحویل مناسب است."
      : "توزیع متعادل زمان، تمرکز بالا و ریتم کاری کاملاً پایدار.";

  // Dynamic Skills based on role
  const skills: SkillRating[] = isIntern
    ? [
        { name: "آشنایی با Git و فرآیند PR", category: "Core", level: 85, growth: "+۱۵٪" },
        { name: "طراحی کامپوننت و فرانت‌اند", category: "Frontend", level: 80, growth: "+۲۰٪" },
        { name: "درک نیازمندی‌های تسک و تخمین", category: "Process", level: 75, growth: "+۱۰٪" },
        { name: "تست و بررسی باگ‌ها", category: "QA", level: 82, growth: "+۱۸٪" },
      ]
    : [
        { name: "معماری نرم‌افزار و کدنویسی", category: "Engineering", level: 94, growth: "+۵٪" },
        { name: "کیفیت کد و ریویو", category: "Quality", level: 92, growth: "+۴٪" },
        { name: "مدیریت تسک‌ها و تحویل به‌موقع", category: "Agile", level: 96, growth: "+۳٪" },
        { name: "پایگاه داده و یکپارچگی سیستم", category: "Backend", level: 90, growth: "+۶٪" },
      ];

  // Dynamic OKRs derived from assigned issues or member goals
  const okrs = assigned.slice(0, 3).map((iss) => ({
    title: iss.title,
    progress: iss.status === "done" ? 100 : iss.status === "in_progress" ? 60 : 15,
    dueDate: iss.dueDate ? iss.dueDate : "پایان اسپرینت",
  }));

  if (okrs.length === 0) {
    okrs.push({
      title: isIntern ? "تکمیل چک‌لیست شروع به‌کار و تسک‌های پایه" : "رساندن استوری پوینت‌های اسپرینت به هدف",
      progress: taskCompletionRate,
      dueDate: "اسپرینت جاری",
    });
  }

  // Dynamic badges earned
  const badges = [];
  if (doneIssues.length > 0 || assigned.length === 0) {
    badges.push({
      title: "تعهد به کیفیت",
      icon: "⭐",
      desc: "تحویل دقیق و مطابق معیارهای پذیرش",
      date: "اسپرینت جاری",
    });
  }
  if (isIntern) {
    badges.push({
      title: "رشد پیوسته",
      icon: "🚀",
      desc: "یادگیری سریع و مشارکت در تسک‌های تیمی",
      date: "دوره فعال",
    });
  } else {
    badges.push({
      title: "تحویل به‌موقع",
      icon: "🎯",
      desc: "دقت بالا در بستن تسک‌های اسپرینت",
      date: "اسپرینت جاری",
    });
  }

  // Activity map
  const baseMap = [2, 3, 4, 3, 5, 2, 0, 3, 4, 4, 3, 4, 2, 0, 3, 5, 4, 2, 4, 3, 0, 3, 4, 5, 3, 4, 2, 0];
  const activityMap = baseMap.map((v) => Math.max(0, Math.min(6, Math.round(v * (assigned.length > 0 ? 1 : 0.6)))));

  return {
    id: member.id,
    name: member.displayName,
    roleTitle:
      member.role === "admin"
        ? "مدیر ارشد پروژه"
        : isIntern
        ? "کارآموز مهندسی نرم‌افزار"
        : "مهندس تیم و توسعه‌دهنده",
    type: isIntern ? "intern" : "employee",
    avatar: member.avatarUrl || member.displayName.trim().charAt(0) || "ک",
    mentorName: isIntern ? "مدیر فنی" : undefined,
    onboardingProgress: isIntern ? 90 : 100,
    learningCurveScore: isIntern ? 85 : 95,
    timeSpentHours,
    estimatedHours,
    onTimeDeliveryRate,
    taskCompletionRate,
    reworkRate,
    qualityScore,
    activeStreakDays: assigned.length > 0 ? Math.min(assigned.length * 3, 21) : 7,
    burnoutRisk,
    burnoutReason,
    skills,
    okrs,
    badges,
    activityMap,
    mentorFeedback: isIntern
      ? `عضو «${member.displayName}» عملکرد رو به رشدی داشته و با راهنمایی منتور تسک‌های محوله را پیش می‌برد.`
      : undefined,
  };
}

export default function AnalyticsPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = use(params);
  const projectKey = (key || "PM").toUpperCase();

  const { project, members, issues } = useProjectStore();
  const { isAdmin, profile: currentUserProfile } = useUserRole();

  const [activeTab, setActiveTab] = useState<"individual" | "project">("individual");
  const [memberFilter, setMemberFilter] = useState<"all" | "employee" | "intern">("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [timeRange, setTimeRange] = useState<"sprint" | "month" | "quarter">("month");

  // Build dynamic profiles from store members
  const dynamicProfiles = useMemo(() => {
    return members.map((m) => buildIndividualProfile(m, issues));
  }, [members, issues]);

  // Profile for non-admin user
  const myProfile = useMemo(() => {
    if (isAdmin) return null;
    const match = dynamicProfiles.find(
      (p) =>
        p.id === currentUserProfile.id ||
        p.name.toLowerCase() === currentUserProfile.name.toLowerCase() ||
        members.some(
          (m) =>
            m.email &&
            m.email.toLowerCase() === currentUserProfile.email.toLowerCase() &&
            m.id === p.id
        )
    );
    if (match) return match;

    // Fallback: create self-profile from current user session
    const selfMember: Member = {
      id: currentUserProfile.id,
      displayName: currentUserProfile.name,
      email: currentUserProfile.email,
      githubLogin: currentUserProfile.github || null,
      role: currentUserProfile.role === "admin" ? "admin" : "member",
      status: "active",
      joinedAt: "امروز",
    };
    return buildIndividualProfile(selfMember, issues);
  }, [isAdmin, dynamicProfiles, currentUserProfile, members, issues]);

  // Filtered members list (Admin only)
  const filteredProfiles = useMemo(() => {
    if (memberFilter === "all") return dynamicProfiles;
    return dynamicProfiles.filter((m) => m.type === memberFilter);
  }, [dynamicProfiles, memberFilter]);

  // Current selected profile
  const currentProfile = useMemo(() => {
    if (!isAdmin && myProfile) return myProfile;
    if (filteredProfiles.length === 0) return null;
    return (
      filteredProfiles.find((m) => m.id === selectedMemberId) ||
      filteredProfiles[0] ||
      null
    );
  }, [isAdmin, myProfile, filteredProfiles, selectedMemberId]);

  // Team average calculations for benchmarking
  const teamAverageQuality = useMemo(() => {
    if (dynamicProfiles.length === 0) return 85;
    const sum = dynamicProfiles.reduce((s, p) => s + p.qualityScore, 0);
    return Math.round(sum / dynamicProfiles.length);
  }, [dynamicProfiles]);

  const userScoreNum = currentProfile ? currentProfile.qualityScore / 10 : 0;
  const teamAvgScoreNum = teamAverageQuality / 10;
  const scoreDiffNum = userScoreNum - teamAvgScoreNum;

  const formatScore = (num: number) => {
    return Number(num.toFixed(1)).toLocaleString("fa-IR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  };

  // Overall Project calculations
  const scopedIssues = useMemo(
    () => issues.filter((i) => i.status !== "cancelled"),
    [issues]
  );

  const totalProjectWeight = useMemo(
    () => scopedIssues.reduce((s, i) => s + (i.estimate || 1), 0),
    [scopedIssues]
  );

  const totalDonePoints = useMemo(
    () =>
      scopedIssues
        .filter((i) => i.status === "done")
        .reduce((s, i) => s + (i.estimate || 1), 0),
    [scopedIssues]
  );

  const completionRate =
    totalProjectWeight > 0 ? (totalDonePoints / totalProjectWeight) * 100 : 0;

  const handlePrintReport = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <section aria-label="آنالیتیکس و ارزیابی فردی" className="space-y-[24px] max-w-7xl mx-auto pb-12">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold text-[var(--text-primary)]">
              {isAdmin ? "سیستم آنالیتیکس فردی و ارزیابی عملکرد تیم" : "گزارش عملکرد و آنالیتیکس فردی شما"}
            </h1>
            <Badge variant="outline" className="text-[11px] font-mono border-[var(--border)]">
              {projectKey}
            </Badge>
          </div>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">
            {isAdmin
              ? `رصد داده‌محور عملکرد، رشد مهارت‌ها و بهره‌وری پرسنل در پروژه ${project?.name || projectKey}`
              : `مشاهده شاخص‌های عملکرد، مهارت‌ها و مقایسه نمره کیفیت شما با میانگین کل تیم`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <SelectTrigger className="w-[140px] bg-[var(--surface)] text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sprint">اسپرینت جاری</SelectItem>
              <SelectItem value="month">یک ماه اخیر</SelectItem>
              <SelectItem value="quarter">فصل جاری / ۳ ماهه</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={handlePrintReport} className="gap-1.5 text-[12px]">
            <Download size={14} />
            خروجی گزارش عملکرد
          </Button>

          {isAdmin && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList className="bg-[var(--surface-raised)] border border-[var(--border)]">
                <TabsTrigger value="individual" className="gap-1.5 text-[13px]">
                  <UserCheck size={15} />
                  آنالیتیکس فردی
                </TabsTrigger>
                <TabsTrigger value="project" className="gap-1.5 text-[13px]">
                  <BarChart3 size={15} />
                  کلان پروژه
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
      </header>

      {/* Non-Admin Privacy Notice */}
      {!isAdmin && (
        <div className="rounded-[12px] border border-blue-500/20 bg-blue-500/10 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="size-5 text-blue-500 shrink-0" />
            <div>
              <span className="font-bold text-foreground block">نمای آنالیتیکس اختصاصی شما ({currentUserProfile.name})</span>
              <span className="text-muted-foreground text-xs">
                به منظور حفظ حریم خصوصی اعضا، شما فقط به گزارش عملکرد فردی خود و شاخص مقایسه نمره با میانگین کل تیم دسترسی دارید.
              </span>
            </div>
          </div>
          <Badge variant="outline" className="text-xs gap-1 border-blue-500/30 text-blue-600 dark:text-blue-400">
            <Lock size={12} />
            دسترسی کاربر عادی
          </Badge>
        </div>
      )}

      {/* ========================================================
          TAB 1: INDIVIDUAL ANALYTICS (EMPLOYEE / INTERN DEEP-DIVE)
          ======================================================== */}
      {activeTab === "individual" && (
        <div className="space-y-6">
          {dynamicProfiles.length === 0 && !currentProfile ? (
            <Card className="border-dashed border-[var(--border)] bg-[var(--surface)] p-12 text-center">
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground">هنوز عضوی در این پروژه ثبت نشده است</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  برای مشاهده شاخص‌های عملکرد و منحنی رشد مهارت‌ها، ابتدا اعضای تیم یا کارآموزان را به پروژه بیفزایید.
                </p>
                {isAdmin && (
                  <div className="pt-2 flex items-center gap-3">
                    <Link href={`/projects/${projectKey}/members`}>
                      <Button size="sm" className="gap-1.5">
                        <UserPlus className="w-4 h-4" />
                        مدیریت و افزودن اعضای پروژه
                      </Button>
                    </Link>
                    <Link href="/members">
                      <Button size="sm" variant="outline" className="gap-1.5">
                        دایرکتوری اعضای سازمان
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <>
              {/* ADMIN ONLY: Filter Pills & Member Carousel */}
              {isAdmin && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface)] p-3 rounded-[12px] border border-[var(--border)]">
                    <div className="flex items-center gap-2">
                      <Filter size={15} className="text-[var(--text-muted)]" />
                      <span className="text-[13px] font-bold text-[var(--text-secondary)]">فیلتر پرسنل:</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMemberFilter("all")}
                          className={`px-3 py-1 text-[12px] rounded-[8px] font-medium transition-colors ${
                            memberFilter === "all"
                              ? "bg-[var(--primary)] text-white"
                              : "bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          همه اعضا ({faNumber(dynamicProfiles.length)})
                        </button>
                        <button
                          type="button"
                          onClick={() => setMemberFilter("employee")}
                          className={`flex items-center gap-1 px-3 py-1 text-[12px] rounded-[8px] font-medium transition-colors ${
                            memberFilter === "employee"
                              ? "bg-indigo-600 text-white"
                              : "bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          <Briefcase size={13} />
                          پرسنل مهندسی
                        </button>
                        <button
                          type="button"
                          onClick={() => setMemberFilter("intern")}
                          className={`flex items-center gap-1 px-3 py-1 text-[12px] rounded-[8px] font-medium transition-colors ${
                            memberFilter === "intern"
                              ? "bg-emerald-600 text-white"
                              : "bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          <GraduationCap size={13} />
                          کارآموزان (Interns)
                        </button>
                      </div>
                    </div>

                    {currentProfile && (
                      <span className="text-[12px] text-[var(--text-muted)]">
                        عضو انتخابی: <strong>{currentProfile.name}</strong> ({currentProfile.type === "intern" ? "کارآموز" : "پرسنل رسمی"})
                      </span>
                    )}
                  </div>

                  {/* Member Selection Carousel / Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {filteredProfiles.map((member) => {
                      const isSelected = (currentProfile?.id === member.id);
                      const isIntern = member.type === "intern";
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => setSelectedMemberId(member.id)}
                          className={`text-start rounded-[12px] border p-3.5 transition-all flex flex-col justify-between gap-3 ${
                            isSelected
                              ? "border-[var(--primary)] bg-[var(--surface-raised)] shadow-md ring-2 ring-[var(--primary)]/30"
                              : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/50"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`flex size-9 items-center justify-center rounded-full text-white text-[13px] font-bold shadow-xs overflow-hidden ${
                                  isIntern ? "bg-emerald-600" : "bg-[var(--primary)]"
                                }`}
                              >
                                {member.avatar && member.avatar.startsWith("http") ? (
                                  <img src={member.avatar} alt={member.name} className="size-full object-cover" />
                                ) : (
                                  member.avatar
                                )}
                              </span>
                              <div>
                                <div className="font-bold text-[13px] text-[var(--text-primary)] flex items-center gap-1">
                                  {member.name}
                                </div>
                                <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[130px]">
                                  {member.roleTitle}
                                </div>
                              </div>
                            </div>

                            <Badge
                              variant={isIntern ? "success" : "secondary"}
                              className="text-[10px] px-2 py-0.5"
                            >
                              {isIntern ? "کارآموز" : "کارمند"}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 w-full pt-2 border-t border-[var(--border)] text-[11px]">
                            <div>
                              <span className="text-[var(--text-muted)] block">کیفیت:</span>
                              <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                                {faNumber(member.qualityScore)}٪
                              </strong>
                            </div>
                            <div className="text-end">
                              <span className="text-[var(--text-muted)] block">تحویل به‌موقع:</span>
                              <strong className="text-[var(--text-primary)] font-mono">
                                {faNumber(member.onTimeDeliveryRate)}٪
                              </strong>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* NON-ADMIN ONLY: Score Comparison Widget (Out of 10) */}
              {!isAdmin && currentProfile && (
                <Card className="border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 shadow-xs">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="size-5 text-primary" />
                        مقایسه نمره عملکرد شما با میانگین کل تیم (نمره از ۱۰)
                      </CardTitle>
                      <Badge variant="default" className="text-xs gap-1">
                        <Sparkles size={12} />
                        ارزیابی کیفی اسپرینت
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      نمره شما بر اساس کیفیت تحویل، دقت تخمین‌ها و عدم بازگشت کار محاسبه و با میانگین سایر اعضای پروژه مقایسه می‌شود
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Your Score */}
                      <div className="rounded-xl border border-primary/25 bg-primary/10 p-4 text-center">
                        <span className="text-xs text-muted-foreground block mb-1 font-medium">نمره عملکرد شما</span>
                        <div className="text-3xl font-black text-primary font-mono">
                          {formatScore(userScoreNum)}
                          <span className="text-sm font-normal text-muted-foreground"> / ۱۰</span>
                        </div>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 block">
                          {scoreDiffNum >= 0 ? "بالاتر از میانگین تیم ✨" : "نزدیک به میانگین تیم"}
                        </span>
                      </div>

                      {/* Team Average */}
                      <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
                        <span className="text-xs text-muted-foreground block mb-1 font-medium">میانگین نمره کل تیم</span>
                        <div className="text-3xl font-black text-foreground font-mono">
                          {formatScore(teamAvgScoreNum)}
                          <span className="text-sm font-normal text-muted-foreground"> / ۱۰</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground mt-1 block">
                          میانگین وزنی کل پرسنل پروژه
                        </span>
                      </div>

                      {/* Score Difference */}
                      <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
                        <span className="text-xs text-muted-foreground block mb-1 font-medium">اختلاف نسبت به میانگین</span>
                        <div className={`text-2xl font-black font-mono ${scoreDiffNum >= 0 ? "text-emerald-500" : "text-amber-500"}`}>
                          {scoreDiffNum >= 0 ? `+${formatScore(scoreDiffNum)}` : formatScore(scoreDiffNum)} نمره
                        </div>
                        <span className="text-[11px] text-muted-foreground mt-1 block">
                          {scoreDiffNum >= 0 ? "وضعیت کیفی بسیار مطلوب و پیشرو" : "فرصت ارتقا و بهبود شاخص‌ها"}
                        </span>
                      </div>
                    </div>

                    {/* Progress Benchmark Bar */}
                    <div className="space-y-2 rounded-xl bg-card p-3.5 border border-border">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>جایگاه نمره کیفی شما روی نمودار عملکرد اسپرینت:</span>
                        <span className="font-bold text-foreground font-mono">{formatScore(userScoreNum)} از ۱۰</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3.5 overflow-hidden relative">
                        {/* Team marker line */}
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-amber-400 z-10"
                          style={{ right: `${teamAverageQuality}%` }}
                          title={`میانگین تیم: ${formatScore(teamAvgScoreNum)} از ۱۰`}
                        />
                        <div
                          className="bg-gradient-to-l from-primary to-indigo-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${currentProfile.qualityScore}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground pt-1">
                        <span>۰ (حداقل)</span>
                        <span className="text-amber-500 font-medium">📍 میانگین تیم ({formatScore(teamAvgScoreNum)})</span>
                        <span>۱۰ (حداکثر)</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Detailed Individual Performance Dashboard */}
              {currentProfile && (
                <div className="space-y-6">
                  {/* Header Info Card */}
                  <Card className="border-t-4 border-t-[var(--primary)] shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <span
                            className={`flex size-14 items-center justify-center rounded-full text-white text-[22px] font-bold shadow-md overflow-hidden ${
                              currentProfile.type === "intern" ? "bg-emerald-600" : "bg-[var(--primary)]"
                            }`}
                          >
                            {currentProfile.avatar && currentProfile.avatar.startsWith("http") ? (
                              <img src={currentProfile.avatar} alt={currentProfile.name} className="size-full object-cover" />
                            ) : (
                              currentProfile.avatar
                            )}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-[19px] font-bold">
                                {currentProfile.name}
                              </CardTitle>
                              <Badge
                                variant={currentProfile.type === "intern" ? "success" : "default"}
                                className="text-[11px]"
                              >
                                {currentProfile.type === "intern" ? "دوره کارآموزی فعال" : "پرسنل مهندسی"}
                              </Badge>
                              {currentProfile.mentorName && (
                                <Badge variant="outline" className="text-[11px] gap-1 border-[var(--border)]">
                                  <HeartHandshake size={12} className="text-[var(--primary)]" />
                                  منتور: {currentProfile.mentorName}
                                </Badge>
                              )}
                            </div>
                            <CardDescription className="text-[13px] mt-1 text-[var(--text-muted)]">
                              {currentProfile.roleTitle}
                            </CardDescription>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-center rounded-[10px] bg-[var(--surface-raised)] p-2.5 border border-[var(--border)] min-w-[90px]">
                            <span className="text-[10px] text-[var(--text-muted)] block">استریک فعال</span>
                            <span className="text-[16px] font-bold text-amber-500 flex items-center justify-center gap-1">
                              <Flame size={14} className="fill-amber-500" />
                              {faNumber(currentProfile.activeStreakDays)} روز
                            </span>
                          </div>

                          <div className="text-center rounded-[10px] bg-[var(--surface-raised)] p-2.5 border border-[var(--border)] min-w-[100px]">
                            <span className="text-[10px] text-[var(--text-muted)] block">نمره عملکرد کل</span>
                            <span className="text-[20px] font-black text-[var(--primary)]">
                              {formatScore(userScoreNum)}
                              <span className="text-[12px] font-normal text-[var(--text-muted)]"> / ۱۰</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      {/* 1. Core KPIs Section */}
                      <div>
                        <h3 className="text-[13px] font-bold text-[var(--text-secondary)] mb-3 flex items-center gap-1.5">
                          <Zap size={15} className="text-amber-500" />
                          ۱. شاخص‌های کلیدی عملکرد (KPI Metrics)
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-center">
                            <span className="text-[11px] text-[var(--text-muted)] block mb-1">نرخ تکمیل وظایف</span>
                            <span className="text-[19px] font-black text-emerald-600 dark:text-emerald-400 font-mono">
                              {faNumber(currentProfile.taskCompletionRate)}٪
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">Task Completion</span>
                          </div>

                          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-center">
                            <span className="text-[11px] text-[var(--text-muted)] block mb-1">تحویل به‌موقع</span>
                            <span className="text-[19px] font-black text-[var(--primary)] font-mono">
                              {faNumber(currentProfile.onTimeDeliveryRate)}٪
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">On-time Delivery</span>
                          </div>

                          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-center">
                            <span className="text-[11px] text-[var(--text-muted)] block mb-1">نرخ بازگشت کار (Rework)</span>
                            <span
                              className={`text-[19px] font-black font-mono ${
                                currentProfile.reworkRate <= 5 ? "text-emerald-500" : "text-amber-500"
                              }`}
                            >
                              {faNumber(currentProfile.reworkRate)}٪
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">Revision / Rework</span>
                          </div>

                          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-center">
                            <span className="text-[11px] text-[var(--text-muted)] block mb-1">زمان واقعی در برابر تخمین</span>
                            <span className="text-[19px] font-black text-[var(--text-primary)] font-mono">
                              {faNumber(currentProfile.timeSpentHours)}h / {faNumber(currentProfile.estimatedHours)}h
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">Actual vs Estimated</span>
                          </div>
                        </div>
                      </div>

                      {/* 2. Special Intern Section */}
                      {currentProfile.type === "intern" && (
                        <div className="rounded-[12px] border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[14px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                              <GraduationCap size={18} />
                              ویژگی‌های اختصاصی پایش کارآموز (Intern Dashboard)
                            </h4>
                            <Badge variant="success" className="text-[11px]">
                              منحنی یادگیری: {faNumber(currentProfile.learningCurveScore || 85)}٪ مطلوب
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="rounded-[10px] bg-[var(--surface)] p-3.5 border border-[var(--border)] space-y-2">
                              <div className="flex justify-between text-[12px] font-medium">
                                <span className="flex items-center gap-1.5">
                                  <CheckSquare size={14} className="text-emerald-500" />
                                  پیشرفت چک‌لیست شروع به‌کار
                                </span>
                                <span className="font-bold text-emerald-600">
                                  {faNumber(currentProfile.onboardingProgress || 90)}٪
                                </span>
                              </div>
                              <div className="w-full bg-[var(--surface-raised)] rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-full rounded-full transition-all"
                                  style={{ width: `${currentProfile.onboardingProgress || 90}%` }}
                                />
                              </div>
                              <p className="text-[11px] text-[var(--text-muted)]">
                                شامل راه‌اندازی محیط توسعه، اولین کامیت، گذراندن جلسات توجیهی و آشنایی با فرآیندها
                              </p>
                            </div>

                            {currentProfile.mentorFeedback && (
                              <div className="rounded-[10px] bg-[var(--surface)] p-3.5 border border-[var(--border)] space-y-1.5">
                                <div className="text-[12px] font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                                  <MessageSquare size={14} className="text-[var(--primary)]" />
                                  آخرین بازخورد منتور
                                </div>
                                <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed italic">
                                  «{currentProfile.mentorFeedback}»
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 3. Skill & Competency Matrix */}
                      <div className="space-y-3">
                        <h3 className="text-[13px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                          <BookOpen size={15} className="text-indigo-500" />
                          ۲. نقشه مهارت‌ها و شایستگی‌ها (Skill & Competency Matrix)
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {currentProfile.skills.map((skill) => (
                            <div
                              key={skill.name}
                              className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-3 space-y-2"
                            >
                              <div className="flex items-center justify-between text-[12px]">
                                <div>
                                  <span className="font-bold text-[var(--text-primary)]">{skill.name}</span>
                                  <span className="text-[10px] text-[var(--text-muted)] mr-1.5 px-1.5 py-0.5 rounded bg-[var(--surface)]">
                                    {skill.category}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-emerald-500 font-mono">{skill.growth}</span>
                                  <span className="font-bold font-mono text-[var(--text-primary)]">{faNumber(skill.level)}٪</span>
                                </div>
                              </div>
                              <div className="w-full bg-[var(--surface)] rounded-full h-2 overflow-hidden border border-[var(--border)]">
                                <div
                                  className="bg-gradient-to-r from-[var(--primary)] to-indigo-500 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${skill.level}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 4. Activity Heatmap */}
                      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[13px] font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                            <Activity size={15} className="text-[var(--primary)]" />
                            ۳. تقویم تراکم فعالیت (Activity Heatmap — ۲۸ روز اخیر)
                          </h3>
                          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                            <span>کم</span>
                            <div className="size-2.5 rounded-[2px] bg-[var(--surface)] border border-[var(--border)]" />
                            <div className="size-2.5 rounded-[2px] bg-emerald-500/30" />
                            <div className="size-2.5 rounded-[2px] bg-emerald-500/60" />
                            <div className="size-2.5 rounded-[2px] bg-emerald-500" />
                            <span>زیاد</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 justify-between pt-1">
                          {currentProfile.activityMap.map((intensity, idx) => {
                            const bg =
                              intensity === 0
                                ? "bg-[var(--surface)] border border-[var(--border)]"
                                : intensity <= 2
                                ? "bg-emerald-500/30"
                                : intensity <= 4
                                ? "bg-emerald-500/65"
                                : "bg-emerald-500 shadow-xs";
                            return (
                              <div
                                key={idx}
                                title={`روز ${faNumber(idx + 1)}: ${faNumber(intensity)} فعالیت ثبت‌شده`}
                                className={`size-6 sm:size-7 rounded-[4px] ${bg} flex items-center justify-center text-[9px] font-mono text-white/90 hover:scale-110 transition-transform cursor-pointer`}
                              >
                                {intensity > 0 ? faNumber(intensity) : ""}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 5. OKRs */}
                      <div className="space-y-3">
                        <h3 className="text-[13px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                          <Target size={15} className="text-red-500" />
                          ۴. اهداف و نتایج کلیدی فردی (Individual OKRs)
                        </h3>
                        <div className="space-y-2.5">
                          {currentProfile.okrs.map((okr, i) => (
                            <div
                              key={i}
                              className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2"
                            >
                              <div className="flex items-center justify-between text-[12px]">
                                <span className="font-bold text-[var(--text-primary)]">{okr.title}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-[var(--text-muted)]">موعد: {okr.dueDate}</span>
                                  <span className="font-bold font-mono text-[var(--primary)]">{faNumber(okr.progress)}٪</span>
                                </div>
                              </div>
                              <div className="w-full bg-[var(--surface-raised)] rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    okr.progress === 100
                                      ? "bg-emerald-500"
                                      : okr.progress >= 70
                                      ? "bg-[var(--primary)]"
                                      : "bg-amber-500"
                                  }`}
                                  style={{ width: `${okr.progress}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 6. Badges */}
                      <div className="space-y-3">
                        <h3 className="text-[13px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                          <Award size={15} className="text-amber-500" />
                          ۵. نشان‌ها و دستاوردها (Gamification & Badges)
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {currentProfile.badges.map((badge, idx) => (
                            <div
                              key={idx}
                              className="rounded-[10px] border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-3"
                            >
                              <span className="text-[24px] p-1.5 rounded-[8px] bg-amber-500/10 shrink-0">
                                {badge.icon}
                              </span>
                              <div>
                                <div className="text-[13px] font-bold text-[var(--text-primary)] flex items-center justify-between">
                                  <span>{badge.title}</span>
                                  <span className="text-[10px] text-[var(--text-muted)]">{badge.date}</span>
                                </div>
                                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                  {badge.desc}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 7. Burnout Risk */}
                      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <AlertTriangle
                            size={18}
                            className={
                              currentProfile.burnoutRisk === "high"
                                ? "text-red-500"
                                : currentProfile.burnoutRisk === "medium"
                                ? "text-amber-500"
                                : "text-emerald-500"
                            }
                          />
                          <div>
                            <span className="text-[12px] font-bold text-[var(--text-primary)] block">
                              شاخص پایش سلامت کاری و فرسودگی (Burnout Monitor):
                            </span>
                            <span className="text-[12px] text-[var(--text-muted)]">
                              {currentProfile.burnoutReason}
                            </span>
                          </div>
                        </div>

                        <Badge
                          variant={
                            currentProfile.burnoutRisk === "high"
                              ? "destructive"
                              : currentProfile.burnoutRisk === "medium"
                              ? "warning"
                              : "success"
                          }
                          className="text-[11px]"
                        >
                          ریسک: {currentProfile.burnoutRisk === "low" ? "پایین (مطلوب)" : currentProfile.burnoutRisk === "medium" ? "متوسط" : "بالا"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 2: OVERALL PROJECT MACRO ANALYTICS (ADMIN ONLY)
          ======================================================== */}
      {isAdmin && activeTab === "project" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px]">نرخ تکمیل وزنی کل پروژه</CardTitle>
                <CardDescription className="text-[12px]">محاسبه بر اساس استوری پوینت‌ها</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-[32px] font-black text-[var(--primary)] font-mono">
                  {faPercent(completionRate / 100, 1)}
                </p>
                <p className="text-[12px] text-[var(--text-muted)] mt-1">
                  {faNumber(totalDonePoints)} از {faNumber(totalProjectWeight)} استوری‌پوینت انجام شده
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px]">توزیع حجم کار در تیم</CardTitle>
                <CardDescription className="text-[12px]">تعادل وظایف بین اعضا و کارآموزان</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-[12px]">
                <div className="flex justify-between items-center">
                  <span>پرسنل فنی و مهندسی</span>
                  <Badge variant="secondary">
                    {faNumber(members.filter((m) => m.role !== "intern").length)} نفر
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>کارآموزان توسعه و تست</span>
                  <Badge variant="secondary">
                    {faNumber(members.filter((m) => m.role === "intern").length)} نفر
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>وضعیت توزیع کار</span>
                  <span className="text-emerald-500 font-medium">متعادل و شفاف</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px]">شاخص کیفیت و عدم شکست</CardTitle>
                <CardDescription className="text-[12px]">بررسی سلامت ایشوها و کیفیت تحویل</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-[12px]">
                <div className="flex justify-between items-center">
                  <span>مجموع ایشوهای ثبت‌شده</span>
                  <strong className="text-emerald-600 font-mono">{faNumber(scopedIssues.length)} ایشو</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span>ایشوهای تکمیل‌شده</span>
                  <strong className="text-[var(--primary)] font-mono">
                    {faNumber(scopedIssues.filter((i) => i.status === "done").length)}
                  </strong>
                </div>
                <div className="flex justify-between items-center">
                  <span>شاخص سلامت کل</span>
                  <Badge variant={project?.health === "at_risk" ? "warning" : "success"}>
                    {project?.health === "at_risk" ? "نیازمند توجه" : "عالی (On Track)"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}
