"use client";

import { use, useState, useMemo } from "react";
import {
  Award,
  CheckCircle2,
  Star,
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
} from "lucide-react";

import {
  MOCK_ISSUES,
  MOCK_MEMBERS,
  MOCK_PROJECTS,
} from "@/components/features/__fixtures__/mock-data";
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

// Data store for team members (Full-time & Interns)
const DEFAULT_INDIVIDUALS: IndividualProfile[] = [
  {
    id: "artin-1",
    name: "آرتین امیری",
    roleTitle: "مدیر ارشد فنی / معمار نرم‌افزار",
    type: "employee",
    avatar: "آ",
    timeSpentHours: 142,
    estimatedHours: 130,
    onTimeDeliveryRate: 96,
    taskCompletionRate: 94,
    reworkRate: 4,
    qualityScore: 98,
    activeStreakDays: 14,
    burnoutRisk: "low",
    burnoutReason: "توزیع متعادل زمان و بهره‌وری بالا",
    skills: [
      { name: "معماری سیستم و Next.js", category: "Backend/Frontend", level: 98, growth: "+۵٪" },
      { name: "پایگاه داده و Supabase", category: "Database", level: 95, growth: "+۴٪" },
      { name: "طراحی کامپوننت و UX", category: "UI/UX", level: 92, growth: "+۳٪" },
      { name: "کد ریویو و منتورینگ", category: "Leadership", level: 96, growth: "+۶٪" },
      { name: "یکپارچه‌سازی گیت‌هاب", category: "DevOps", level: 94, growth: "+۲٪" },
    ],
    okrs: [
      { title: "پیاده‌سازی ماژول آنالیتیکس جامع و هوش پروژه", progress: 95, dueDate: "۱۴۰۴/۰۲/۱۵" },
      { title: "کاهش خطاهای بیلد به صفر و استانداردسازی کدبیس", progress: 100, dueDate: "۱۴۰۴/۰۱/۳۰" },
      { title: "نظارت و هدایت فنی دوره‌های کارآموزی", progress: 85, dueDate: "۱۴۰۴/۰۳/۰۱" },
    ],
    badges: [
      { title: "معمار برتر", icon: "⭐", desc: "طراحی ساختار مقیاس‌پذیر و پایدار", date: "اسفند ۱۴۰۳" },
      { title: "استریک طلایی", icon: "🔥", desc: "۱۴ روز تعهد و تحویل پیوسته", date: "فروردین ۱۴۰۴" },
      { title: "کیفیت بی‌نقص", icon: "🛡️", desc: "کمترین نرخ بازگشت و ریویو", date: "فروردین ۱۴۰۴" },
    ],
    activityMap: [3, 4, 5, 2, 6, 4, 0, 3, 5, 6, 4, 5, 3, 0, 4, 6, 5, 3, 6, 5, 0, 4, 5, 6, 5, 4, 3, 0],
  },
  {
    id: "sara-1",
    name: "سارا احمدی",
    roleTitle: "توسعه‌دهنده فرانت‌اند (عضو تیم)",
    type: "employee",
    avatar: "س",
    timeSpentHours: 128,
    estimatedHours: 120,
    onTimeDeliveryRate: 91,
    taskCompletionRate: 89,
    reworkRate: 7,
    qualityScore: 92,
    activeStreakDays: 8,
    burnoutRisk: "low",
    burnoutReason: "ریتم کاری منظم و پایدار",
    skills: [
      { name: "React و TypeScript", category: "Frontend", level: 88, growth: "+۸٪" },
      { name: "TailwindCSS و استایل‌دهی", category: "UI/UX", level: 94, growth: "+۵٪" },
      { name: "مدیریت فرم‌ها و اعتبارسنجی", category: "Frontend", level: 85, growth: "+۱۰٪" },
      { name: "تست‌نویسی کامپوننت‌ها", category: "Testing", level: 78, growth: "+۱۲٪" },
    ],
    okrs: [
      { title: "بازطراحی صفحات ورود و ثبت‌نام با استانداردهای جدید", progress: 90, dueDate: "۱۴۰۴/۰۲/۱۰" },
      { title: "پیاده‌سازی قابلیت ریسپانسیو سایدبار و فرم‌ها", progress: 100, dueDate: "۱۴۰۴/۰۱/۲۵" },
    ],
    badges: [
      { title: "تحویل دقیق", icon: "🎯", desc: "تحویل به‌موقع تسک‌های اسپرینت", date: "فروردین ۱۴۰۴" },
      { title: "کد تمیز", icon: "✨", desc: "رعایت کامل استانداردهای تایپ‌اسکریپت", date: "فروردین ۱۴۰۴" },
    ],
    activityMap: [2, 3, 4, 3, 5, 2, 0, 3, 4, 4, 3, 4, 2, 0, 3, 5, 4, 2, 4, 3, 0, 3, 4, 5, 3, 4, 2, 0],
  },
  {
    id: "reza-intern",
    name: "رضا محمدی",
    roleTitle: "کارآموز مهندسی نرم‌افزار و فرانت‌اند",
    type: "intern",
    avatar: "ر",
    mentorName: "آرتین امیری",
    onboardingProgress: 92,
    learningCurveScore: 86,
    timeSpentHours: 96,
    estimatedHours: 85,
    onTimeDeliveryRate: 84,
    taskCompletionRate: 82,
    reworkRate: 14,
    qualityScore: 84,
    activeStreakDays: 6,
    burnoutRisk: "medium",
    burnoutReason: "نیاز به همراهی بیشتر در بازه تخمین زمان تسک‌ها",
    skills: [
      { name: "جاوااسکریپت و تایپ‌اسکریپت", category: "Core", level: 75, growth: "+۲۲٪" },
      { name: "مفاهیم React و هوک‌ها", category: "Frontend", level: 80, growth: "+۲۵٪" },
      { name: "آشنایی با Git و فرآیند PR", category: "Version Control", level: 84, growth: "+۱۸٪" },
      { name: "طراحی کامپوننت با Tailwind", category: "UI/UX", level: 82, growth: "+۲۰٪" },
      { name: "دیباگ و رفع ارورها", category: "Problem Solving", level: 70, growth: "+۱۵٪" },
    ],
    okrs: [
      { title: "تکمیل چک‌لیست آنبوردینگ و تسک‌های پایه اسپرینت", progress: 92, dueDate: "۱۴۰۴/۰۲/۰۱" },
      { title: "یادگیری الگوهای ساختار پروژه و کامپوننت‌های مشترک", progress: 85, dueDate: "۱۴۰۴/۰۲/۲۰" },
      { title: "ارسال حداقل ۱۰ پول ریکوئست موفق با ریویوی کامل", progress: 70, dueDate: "۱۴۰۴/۰۳/۱۵" },
    ],
    badges: [
      { title: "رشد سریع", icon: "🚀", desc: "بیشترین جهش مهارتی در ماه اول کارآموزی", date: "فروردین ۱۴۰۴" },
      { title: "اولین PR موفق", icon: "🌱", desc: "مرج اولین پول ریکوئست در پروژه", date: "فروردین ۱۴۰۴" },
      { title: "یادگیرنده مشتاق", icon: "📚", desc: "مشارکت فعال در جلسات منتورینگ", date: "فروردین ۱۴۰۴" },
    ],
    mentorFeedback: "رضا انگیزه فوق‌العاده‌ای در یادگیری دارد؛ سرعت درک مفاهیم React بسیار بالا است. پیشنهاد می‌شود در تخمین ساعات تسک‌ها با منتور هماهنگ‌تر عمل کند.",
    activityMap: [1, 2, 3, 2, 4, 1, 0, 2, 3, 3, 2, 3, 1, 0, 2, 4, 3, 1, 3, 2, 0, 2, 3, 4, 2, 3, 1, 0],
  },
  {
    id: "mina-intern",
    name: "مینا کریمی",
    roleTitle: "کارآموز توسعه محصول و تضمین کیفیت (QA)",
    type: "intern",
    avatar: "م",
    mentorName: "سارا احمدی",
    onboardingProgress: 88,
    learningCurveScore: 81,
    timeSpentHours: 88,
    estimatedHours: 80,
    onTimeDeliveryRate: 88,
    taskCompletionRate: 85,
    reworkRate: 11,
    qualityScore: 87,
    activeStreakDays: 5,
    burnoutRisk: "low",
    burnoutReason: "روند یادگیری باثبات و همراهی عالی با منتور",
    skills: [
      { name: "تست دستی و ثبت دقیق سناریو", category: "QA/Testing", level: 85, growth: "+۲۸٪" },
      { name: "مفاهیم API و بررسی ریسپانس‌ها", category: "Backend/API", level: 72, growth: "+۱۸٪" },
      { name: "بررسی دسترسی‌پذیری و ریسپانسیو", category: "UI/UX", level: 80, growth: "+۲۲٪" },
      { name: "مستندسازی و گزارش باگ", category: "Documentation", level: 88, growth: "+۲۰٪" },
    ],
    okrs: [
      { title: "پوشش تست برای فرم‌های ثبت اطلاعات و ورود", progress: 90, dueDate: "۱۴۰۴/۰۲/۰۵" },
      { title: "بررسی ریسپانسیو داشبورد روی سایزهای مختلف", progress: 80, dueDate: "۱۴۰۴/۰۲/۲۵" },
    ],
    badges: [
      { title: "دیده‌بان باگ", icon: "🔍", desc: "کشف و گزارش دقیق باگ‌های حیاتی", date: "فروردین ۱۴۰۴" },
      { title: "دقت بالا", icon: "🎯", desc: "گزارش‌نویسی استاندارد و باجزئیات", date: "فروردین ۱۴۰۴" },
    ],
    mentorFeedback: "مینا دقت بالایی در کشف رفتارهای غیرمنتظره UI دارد و مستندات باگ‌ها را با حداکثر شفافیت تنظیم می‌کند.",
    activityMap: [1, 2, 2, 3, 3, 1, 0, 1, 3, 2, 2, 3, 1, 0, 2, 3, 3, 1, 2, 2, 0, 1, 2, 3, 2, 2, 1, 0],
  },
];

export default function AnalyticsPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = use(params);
  const projectKey = (key || "PM").toUpperCase();
  const project = MOCK_PROJECTS.find((p) => p.key === projectKey) ?? MOCK_PROJECTS[0];

  const [activeTab, setActiveTab] = useState<"individual" | "project">("individual");
  const [memberFilter, setMemberFilter] = useState<"all" | "employee" | "intern">("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("artin-1");
  const [timeRange, setTimeRange] = useState<"sprint" | "month" | "quarter">("month");

  // Filtered members list
  const filteredMembers = useMemo(() => {
    if (memberFilter === "all") return DEFAULT_INDIVIDUALS;
    return DEFAULT_INDIVIDUALS.filter((m) => m.type === memberFilter);
  }, [memberFilter]);

  const currentMember = useMemo(() => {
    return DEFAULT_INDIVIDUALS.find((m) => m.id === selectedMemberId) || DEFAULT_INDIVIDUALS[0];
  }, [selectedMemberId]);

  // Overall Project calculations
  const scopedIssues = useMemo(
    () => MOCK_ISSUES.filter((i) => i.status !== "cancelled"),
    []
  );

  const totalProjectWeight = useMemo(
    () => scopedIssues.reduce((s, i) => s + i.estimate, 0),
    [scopedIssues]
  );

  const totalDonePoints = useMemo(
    () =>
      scopedIssues
        .filter((i) => i.status === "done")
        .reduce((s, i) => s + i.estimate, 0),
    [scopedIssues]
  );

  const completionRate = totalProjectWeight > 0 ? (totalDonePoints / totalProjectWeight) * 100 : 0;

  const handlePrintReport = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <section aria-label="آنالیتیکس و ارزیابی فردی" className="space-y-[24px] max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold text-[var(--text-primary)]">
              سیستم آنالیتیکس فردی و ارزیابی عملکرد
            </h1>
            <Badge variant="outline" className="text-[11px] font-mono border-[var(--border)]">
              {projectKey}
            </Badge>
          </div>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">
            رصد داده‌محور عملکرد، رشد مهارت‌ها و بهره‌وری کارمندان و کارآموزان Flowdeck
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
        </div>
      </header>

      {/* ========================================================
          TAB 1: INDIVIDUAL ANALYTICS (EMPLOYEE / INTERN DEEP-DIVE)
          ======================================================== */}
      {activeTab === "individual" && (
        <div className="space-y-6">
          {/* Filter Pills (All / Employees / Interns) */}
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
                  همه اعضا ({faNumber(DEFAULT_INDIVIDUALS.length)})
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
                  کارمندان مهندسی
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

            <span className="text-[12px] text-[var(--text-muted)]">
              انتخاب شده: <strong>{currentMember.name}</strong> ({currentMember.type === "intern" ? "کارآموز" : "کارمند رسمی"})
            </span>
          </div>

          {/* Member Selection Carousel / Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {filteredMembers.map((member) => {
              const isSelected = selectedMemberId === member.id;
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
                      <span className={`flex size-9 items-center justify-center rounded-full text-white text-[13px] font-bold shadow-xs ${
                        isIntern ? "bg-emerald-600" : "bg-[var(--primary)]"
                      }`}>
                        {member.avatar}
                      </span>
                      <div>
                        <div className="font-bold text-[13px] text-[var(--text-primary)] flex items-center gap-1">
                          {member.name}
                          {member.id === "artin-1" && <Star size={12} className="text-amber-500 fill-amber-500" />}
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

          {/* Detailed Individual Performance Dashboard */}
          <div className="space-y-6">
            {/* Header Info Card */}
            <Card className="border-t-4 border-t-[var(--primary)] shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <span className={`flex size-14 items-center justify-center rounded-full text-white text-[22px] font-bold shadow-md ${
                      currentMember.type === "intern" ? "bg-emerald-600" : "bg-[var(--primary)]"
                    }`}>
                      {currentMember.avatar}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-[19px] font-bold">
                          {currentMember.name}
                        </CardTitle>
                        <Badge
                          variant={currentMember.type === "intern" ? "success" : "default"}
                          className="text-[11px]"
                        >
                          {currentMember.type === "intern" ? "دوره کارآموزی فعال" : "پرسنل مهندسی"}
                        </Badge>
                        {currentMember.mentorName && (
                          <Badge variant="outline" className="text-[11px] gap-1 border-[var(--border)]">
                            <HeartHandshake size={12} className="text-[var(--primary)]" />
                            منتور: {currentMember.mentorName}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-[13px] mt-1 text-[var(--text-muted)]">
                        {currentMember.roleTitle}
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-center rounded-[10px] bg-[var(--surface-raised)] p-2.5 border border-[var(--border)] min-w-[90px]">
                      <span className="text-[10px] text-[var(--text-muted)] block">استریک فعال</span>
                      <span className="text-[16px] font-bold text-amber-500 flex items-center justify-center gap-1">
                        <Flame size={14} className="fill-amber-500" />
                        {faNumber(currentMember.activeStreakDays)} روز
                      </span>
                    </div>

                    <div className="text-center rounded-[10px] bg-[var(--surface-raised)] p-2.5 border border-[var(--border)] min-w-[100px]">
                      <span className="text-[10px] text-[var(--text-muted)] block">امتیاز کیفیت کل</span>
                      <span className="text-[20px] font-black text-[var(--primary)]">
                        {faNumber(currentMember.qualityScore)}
                        <span className="text-[12px] font-normal text-[var(--text-muted)]"> / ۱۰۰</span>
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* 1. Core KPIs Section (4 Columns) */}
                <div>
                  <h3 className="text-[13px] font-bold text-[var(--text-secondary)] mb-3 flex items-center gap-1.5">
                    <Zap size={15} className="text-amber-500" />
                    ۱. شاخص‌های کلیدی عملکرد (KPI Metrics)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-center">
                      <span className="text-[11px] text-[var(--text-muted)] block mb-1">نرخ تکمیل وظایف</span>
                      <span className="text-[19px] font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {faNumber(currentMember.taskCompletionRate)}٪
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">Task Completion</span>
                    </div>

                    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-center">
                      <span className="text-[11px] text-[var(--text-muted)] block mb-1">تحویل به‌موقع</span>
                      <span className="text-[19px] font-black text-[var(--primary)] font-mono">
                        {faNumber(currentMember.onTimeDeliveryRate)}٪
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">On-time Delivery</span>
                    </div>

                    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-center">
                      <span className="text-[11px] text-[var(--text-muted)] block mb-1">نرخ بازگشت کار (Rework)</span>
                      <span className={`text-[19px] font-black font-mono ${
                        currentMember.reworkRate <= 5 ? "text-emerald-500" : "text-amber-500"
                      }`}>
                        {faNumber(currentMember.reworkRate)}٪
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">Revision / Rework</span>
                    </div>

                    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-center">
                      <span className="text-[11px] text-[var(--text-muted)] block mb-1">زمان واقعی در برابر تخمین</span>
                      <span className="text-[19px] font-black text-[var(--text-primary)] font-mono">
                        {faNumber(currentMember.timeSpentHours)}h / {faNumber(currentMember.estimatedHours)}h
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">Actual vs Estimated</span>
                    </div>
                  </div>
                </div>

                {/* 2. Special Intern Section / Learning Curve (If Intern) */}
                {currentMember.type === "intern" && (
                  <div className="rounded-[12px] border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[14px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                        <GraduationCap size={18} />
                        ویژگی‌های اختصاصی پایش کارآموز (Intern Dashboard)
                      </h4>
                      <Badge variant="success" className="text-[11px]">
                        منحنی یادگیری: {faNumber(currentMember.learningCurveScore || 85)}٪ مطلوب
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Onboarding Checklist Progress */}
                      <div className="rounded-[10px] bg-[var(--surface)] p-3.5 border border-[var(--border)] space-y-2">
                        <div className="flex justify-between text-[12px] font-medium">
                          <span className="flex items-center gap-1.5">
                            <CheckSquare size={14} className="text-emerald-500" />
                            پیشرفت چک‌لیست آنبوردینگ و شروع به‌کار
                          </span>
                          <span className="font-bold text-emerald-600">{faNumber(currentMember.onboardingProgress || 90)}٪</span>
                        </div>
                        <div className="w-full bg-[var(--surface-raised)] rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all"
                            style={{ width: `${currentMember.onboardingProgress || 90}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          شامل راه‌اندازی محیط توسعه، اولین کامیت، گذراندن جلسات توجیهی و آشنایی با فرآیندها
                        </p>
                      </div>

                      {/* Mentor Feedback Box */}
                      <div className="rounded-[10px] bg-[var(--surface)] p-3.5 border border-[var(--border)] space-y-1.5">
                        <div className="text-[12px] font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                          <MessageSquare size={14} className="text-[var(--primary)]" />
                          آخرین بازخورد منتور ({currentMember.mentorName})
                        </div>
                        <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed italic">
                          «{currentMember.mentorFeedback}»
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Skill & Competency Matrix (7. رشد مهارت و شایستگی) */}
                <div className="space-y-3">
                  <h3 className="text-[13px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <BookOpen size={15} className="text-indigo-500" />
                    ۲. نقشه مهارت‌ها و شایستگی‌ها (Skill & Competency Matrix)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentMember.skills.map((skill) => (
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

                {/* 4. Activity Heatmap (9. تقویم فعالیت به سبک گیتهاب) */}
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
                    {currentMember.activityMap.map((intensity, idx) => {
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

                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-1">
                    <span>الگوی کاری: فعالیت مداوم در طول روزهای کاری و استراحت منظم در آخر هفته</span>
                    <span className="flex items-center gap-1 font-medium text-emerald-600">
                      <CheckCircle2 size={13} />
                      تعادل کار و زندگی مطلوب
                    </span>
                  </div>
                </div>

                {/* 5. OKRs & Individual Goals (8. اهداف و OKR فردی) */}
                <div className="space-y-3">
                  <h3 className="text-[13px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <Target size={15} className="text-red-500" />
                    ۴. اهداف و نتایج کلیدی فردی (Individual OKRs)
                  </h3>
                  <div className="space-y-2.5">
                    {currentMember.okrs.map((okr, i) => (
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

                {/* 6. Badges & Achievements (17. گیمیفیکیشن و نشان‌های افتخار) */}
                <div className="space-y-3">
                  <h3 className="text-[13px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <Award size={15} className="text-amber-500" />
                    ۵. نشان‌ها و دستاوردها (Gamification & Badges)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {currentMember.badges.map((badge, idx) => (
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

                {/* 7. Burnout Risk & Flags (10. هشدارها و پرچم‌های خودکار) */}
                <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle size={18} className={
                      currentMember.burnoutRisk === "high"
                        ? "text-red-500"
                        : currentMember.burnoutRisk === "medium"
                          ? "text-amber-500"
                          : "text-emerald-500"
                    } />
                    <div>
                      <span className="text-[12px] font-bold text-[var(--text-primary)] block">
                        شاخص پایش سلامت کاری و فرسودگی (Burnout Monitor):
                      </span>
                      <span className="text-[12px] text-[var(--text-muted)]">
                        {currentMember.burnoutReason}
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant={
                      currentMember.burnoutRisk === "high"
                        ? "destructive"
                        : currentMember.burnoutRisk === "medium"
                          ? "warning"
                          : "success"
                    }
                    className="text-[11px]"
                  >
                    ریسک: {currentMember.burnoutRisk === "low" ? "پایین (مطلوب)" : currentMember.burnoutRisk === "medium" ? "متوسط" : "بالا"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: OVERALL PROJECT MACRO ANALYTICS
          ======================================================== */}
      {activeTab === "project" && (
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
                <CardDescription className="text-[12px]">تعادل وظایف بین پرسنل و کارآموزان</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-[12px]">
                <div className="flex justify-between items-center">
                  <span>کارمندان ارشد و مهندسی</span>
                  <Badge variant="secondary">۲ نفر (۶۵٪ بار کاری)</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>کارآموزان توسعه و تست</span>
                  <Badge variant="secondary">۲ نفر (۳۵٪ بار کاری)</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>وضعیت توزیع کار</span>
                  <span className="text-emerald-500 font-medium">متعادل و بدون گلوگاه</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px]">شاخص کیفیت و عدم شکست</CardTitle>
                <CardDescription className="text-[12px]">بررسی ریویوها و پول ریکوئست‌ها</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-[12px]">
                <div className="flex justify-between items-center">
                  <span>میانگین کیفیت تیم</span>
                  <strong className="text-emerald-600 font-mono">۹۱ / ۱۰۰</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span>نرخ تایید در اولین ریویو</span>
                  <strong className="text-[var(--primary)] font-mono">۸۴٪</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span>شاخص سلامت کل</span>
                  <Badge variant="success">عالی (On Track)</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}
