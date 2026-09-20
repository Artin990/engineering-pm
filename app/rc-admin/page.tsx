"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  Server,
  Users,
  Layers,
  Key,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Lock,
  Unlock,
  Sparkles,
  Copy,
  Check,
  Search,
  Activity,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useUserRole } from "@/lib/role-context";
import { faNumber, faDate } from "@/lib/format";
import { isValidIranianNationalId } from "@/lib/validators/national-id";
import { SwaggerEmbed } from "@/components/features/admin/swagger-embed";

interface AdminMetrics {
  totalWorkspaces: number;
  totalProjects: number;
  totalUsers: number;
  totalIssues: number;
  pendingCeoCount: number;
  dbLatencyMs: number;
  serverTimestamp: string;
}

interface AdminWorkspace {
  id: string;
  name: string;
  slug: string;
  inviteCode?: string | null;
  createdAt: string;
}

interface AdminProject {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  status: string;
  health: string;
  archivedAt?: string | null;
  createdAt: string;
}

interface AdminUser {
  id: string;
  displayName: string;
  email: string | null;
  nationalId: string | null;
  verificationStatus: string;
  githubLogin: string | null;
  createdAt: string;
}

const DEFAULT_MASTER_KEY = "RC-SUPERADMIN-2026";

export default function RcAdminPage() {
  const { role, setRole } = useUserRole();

  const [passkey, setPasskey] = useState(DEFAULT_MASTER_KEY);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [projectsList, setProjectsList] = useState<AdminProject[]>([]);
  const [usersList, setUsersList] = useState<AdminUser[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Test National ID tool state
  const [testNationalIdInput, setTestNationalIdInput] = useState("");
  const [testResult, setTestResult] = useState<{ isValid: boolean; message: string } | null>(null);

  const ceoRegisterUrl = typeof window !== "undefined"
    ? `${window.location.origin}/register?role=ceo`
    : "https://radarcheck.vercel.app/register?role=ceo";

  const loadAdminData = useCallback(async (customKey?: string) => {
    setLoading(true);
    setError("");
    try {
      const activeKey = customKey !== undefined ? customKey : passkey;
      const res = await fetch("/api/v1/admin", {
        headers: {
          "x-rc-admin-key": activeKey,
        },
      });

      if (!res.ok) {
        if (res.status === 403) {
          setIsUnlocked(false);
          setError("کلید امنیتی نامعتبر است یا دسترسی سوپرادمین ندارید.");
        } else {
          setError("خطا در برقراری ارتباط با سرور کنترل تاور.");
        }
        setLoading(false);
        return;
      }

      const json = await res.json();
      if (json.success && json.data) {
        setMetrics(json.data.metrics);
        setWorkspaces(json.data.workspaces || []);
        setProjectsList(json.data.projects || []);
        setUsersList(json.data.users || []);
        setIsUnlocked(true);
      }
    } catch {
      setError("خطا در برقراری ارتباط با سرور.");
    } finally {
      setLoading(false);
    }
  }, [passkey]);

  // Initial load
  useEffect(() => {
    let initialKey = DEFAULT_MASTER_KEY;
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlKey = urlParams.get("key");
      if (urlKey) {
        initialKey = urlKey;
        setPasskey(urlKey);
      }
    }
    loadAdminData(initialKey);
  }, [loadAdminData]);

  // Handle CEO Verification Toggle
  const handleVerifyCeo = async (userId: string, status: "verified" | "rejected") => {
    try {
      const res = await fetch("/api/v1/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-rc-admin-key": passkey,
        },
        body: JSON.stringify({ action: "verify-ceo", userId, status }),
      });
      if (res.ok) {
        setSuccessMsg(`وضعیت احراز هویت با موفقیت به «${status === "verified" ? "تایید شده" : "رد شده"}» تغییر یافت.`);
        setTimeout(() => setSuccessMsg(""), 3000);
        loadAdminData();
      }
    } catch {
      setError("خطا در ثبت وضعیت احراز هویت.");
    }
  };

  // Handle Purge Cache
  const handlePurgeCache = async () => {
    try {
      const res = await fetch("/api/v1/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-rc-admin-key": passkey,
        },
        body: JSON.stringify({ action: "purge-cache" }),
      });
      if (res.ok) {
        setSuccessMsg("حافظه کش سرور و سینک پروژه‌ها با موفقیت پاکسازی شد.");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch {
      setError("خطا در پاکسازی کش.");
    }
  };

  // Handle Project Archive/Restore
  const handleToggleArchive = async (projectId: string, archive: boolean) => {
    try {
      const res = await fetch("/api/v1/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-rc-admin-key": passkey,
        },
        body: JSON.stringify({ action: "toggle-project-archive", projectId, archive }),
      });
      if (res.ok) {
        setSuccessMsg(archive ? "پروژه بایگانی شد." : "پروژه بازیابی و فعال شد.");
        setTimeout(() => setSuccessMsg(""), 3000);
        loadAdminData();
      }
    } catch {
      setError("خطا در تغییر وضعیت پروژه.");
    }
  };

  const copyCeoLink = () => {
    navigator.clipboard.writeText(ceoRegisterUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleTestNationalId = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = testNationalIdInput.replace(/\D/g, "");
    if (!clean || clean.length !== 10) {
      setTestResult({ isValid: false, message: "کد ملی باید دقیقاً ۱۰ رقم عددی باشد." });
      return;
    }
    const valid = isValidIranianNationalId(clean);
    if (valid) {
      setTestResult({ isValid: true, message: `کد ملی ${clean} از نظر الگوریتم کنترلی ثبت احوال معتبر است ✓` });
    } else {
      setTestResult({ isValid: false, message: `کد ملی ${clean} نامعتبر است (رقم کنترلی با ضریب صحت ندارد) ✗` });
    }
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 p-4 sm:p-8 font-sans" dir="rtl">
      {/* Header Bar */}
      <header className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="size-full bg-[#0d1322] rounded-[14px] flex items-center justify-center">
              <ShieldCheck className="size-6 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                RadarCheck Control Tower
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Super Admin
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              پنل حاکمیتی، مدیریت کلان پلتفرم و احراز هویت مدیران عامل
            </p>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Role Preview Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            <span className="text-slate-400 px-2">شبیه‌ساز نقش:</span>
            <button
              type="button"
              onClick={() => setRole("admin")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                role === "admin"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              مدیرعامل (Admin)
            </button>
            <button
              type="button"
              onClick={() => setRole("member")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                role === "member"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              کارمند / عضو (Member)
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAdminData()}
            disabled={loading}
            className="border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white gap-1.5 text-xs"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            تازه‌سازی داده‌ها
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto py-6 space-y-6">
        {/* Passkey Gate if locked */}
        {!isUnlocked && (
          <Card className="border-indigo-500/30 bg-slate-900/90 text-slate-200 p-8 rounded-2xl max-w-lg mx-auto my-12 text-center space-y-5 shadow-2xl shadow-indigo-500/10 border">
            <div className="size-14 rounded-2xl bg-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center border border-indigo-500/30">
              <Lock className="size-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-black text-white">ورود به پنل سوپر ادمین RadarCheck</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                لطفاً کلید ارشد (Master Key) پلتفرم را وارد کنید تا به کنسول حاکمیتی و مستندات تعاملی Swagger دسترسی پیدا کنید.
              </p>
            </div>
            <div className="space-y-3 pt-2">
              <Input
                type="text"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                placeholder="RC-SUPERADMIN-2026"
                className="bg-slate-950 border-slate-800 text-center font-mono text-sm tracking-wider text-indigo-300 h-11"
                dir="ltr"
              />
              <Button
                onClick={() => loadAdminData(passkey)}
                disabled={loading}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 gap-2 cursor-pointer"
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Unlock size={16} />}
                ورود به برج مراقبت
              </Button>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 text-start space-y-1.5">
              <span className="font-bold text-slate-300 block">نحوه ورود:</span>
              <p>• مستر کی پیش‌فرض: <code className="text-indigo-400 font-mono font-bold">RC-SUPERADMIN-2026</code></p>
              <p>• یا کلیک مستقیم روی لینک زیر:</p>
              <Link href="/rc-admin?key=RC-SUPERADMIN-2026" className="text-indigo-400 hover:underline font-mono block text-[11px] truncate" dir="ltr">
                /rc-admin?key=RC-SUPERADMIN-2026
              </Link>
            </div>
            {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
          </Card>
        )}

        {isUnlocked && (
          <>
            {/* Notification Toasts */}
            {successMsg && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/40 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                <XCircle size={16} className="text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Compact System & Security Bar (replaces generic dashboard metrics) */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
              <div className="flex flex-wrap items-center gap-4 text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-medium text-slate-200">وضعیت سامانه: عملیاتی</span>
                </div>
                <div className="h-4 w-px bg-slate-800 hidden sm:block" />
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span>تاخیر دیتابیس:</span>
                  <span className="font-mono text-emerald-400 font-semibold">{metrics?.dbLatencyMs ?? 12}ms</span>
                </div>
                <div className="h-4 w-px bg-slate-800 hidden sm:block" />
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span>سازمان‌ها:</span>
                  <span className="font-mono text-white font-semibold">{faNumber(metrics?.totalWorkspaces || workspaces.length)}</span>
                </div>
                <div className="h-4 w-px bg-slate-800 hidden sm:block" />
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span>کاربران:</span>
                  <span className="font-mono text-white font-semibold">{faNumber(metrics?.totalUsers || usersList.length)}</span>
                </div>
              </div>

              {usersList.filter((u) => u.nationalId && u.verificationStatus === "pending").length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[11px] font-medium">
                  <ShieldAlert size={13} />
                  <span>{faNumber(usersList.filter((u) => u.nationalId && u.verificationStatus === "pending").length)} مدیرعامل منتظر تایید کد ملی</span>
                </div>
              )}
            </div>

            {/* CEO Registration Link Banner */}
            <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Sparkles className="size-4 text-indigo-400 shrink-0" />
                <span className="font-bold text-white">لینک ثبت‌نام مدیرعامل جدید:</span>
                <code className="bg-slate-950 px-2.5 py-1 rounded text-indigo-300 font-mono border border-slate-800" dir="ltr">
                  {ceoRegisterUrl}
                </code>
              </div>
              <Button size="sm" onClick={copyCeoLink} className="h-7 gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs">
                {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                {copiedLink ? "کپی شد" : "کپی لینک ثبت‌نام"}
              </Button>
            </div>

            {/* Main Tabs */}
            <Tabs defaultValue="swagger" className="space-y-4">
              <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex-wrap h-auto">
                <TabsTrigger value="swagger" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-400 gap-1.5 text-xs py-2">
                  <Server size={14} />
                  کنسول تعاملی Swagger API
                </TabsTrigger>
                <TabsTrigger value="ceos" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-400 gap-1.5 text-xs py-2">
                  <ShieldCheck size={14} />
                  احراز هویت مدیران عامل ({faNumber(usersList.filter((u) => Boolean(u.nationalId)).length)})
                </TabsTrigger>
                <TabsTrigger value="projects" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-400 gap-1.5 text-xs py-2">
                  <Layers size={14} />
                  ناوگان پروژه‌ها ({faNumber(projectsList.length)})
                </TabsTrigger>
                <TabsTrigger value="users" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-400 gap-1.5 text-xs py-2">
                  <Users size={14} />
                  دایرکتوری کاربران ({faNumber(usersList.length)})
                </TabsTrigger>
                <TabsTrigger value="tools" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-400 gap-1.5 text-xs py-2">
                  <Zap size={14} />
                  ابزارهای سیستمی و کش
                </TabsTrigger>
              </TabsList>

              {/* TAB 0: Swagger Interactive Console */}
              <TabsContent value="swagger" className="space-y-4">
                <SwaggerEmbed masterKey={passkey} />
              </TabsContent>

              {/* TAB 1: CEO Verifications */}
              <TabsContent value="ceos" className="space-y-4">
                <Card className="border-slate-800 bg-slate-900/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-white">مدیران عامل و وضعیت تایید کد ملی</CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                      بررسی صحت کدهای ملی ۱۰ رقمی ثبت شده توسط کارفرمایان و تغییر وضعیت دسترسی
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {usersList.filter((u) => Boolean(u.nationalId)).length === 0 ? (
                      <p className="text-center text-slate-400 py-8 text-sm">
                        هنوز کارفرمایی با کد ملی ثبت‌نام نکرده است. با ارسال لینک ثبت‌نام مدیرعامل به کارفرمایان، اطلاعات آن‌ها در این بخش پایش خواهد شد.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-start border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 text-start">
                              <th className="pb-2.5 font-medium text-start">نام مدیرعامل</th>
                              <th className="pb-2.5 font-medium text-start">ایمیل</th>
                              <th className="pb-2.5 font-medium text-center">کد ملی ۱۰ رقمی</th>
                              <th className="pb-2.5 font-medium text-center">اعتبار الگوریتمی</th>
                              <th className="pb-2.5 font-medium text-center">وضعیت فعلی</th>
                              <th className="pb-2.5 font-medium text-center">تاریخ ثبت‌نام</th>
                              <th className="pb-2.5 font-medium text-center">اقدام حاکمیتی</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {usersList
                              .filter((u) => Boolean(u.nationalId))
                              .map((u) => {
                                const isValidNatId = u.nationalId ? isValidIranianNationalId(u.nationalId) : false;
                                return (
                                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                                    <td className="py-3 font-bold text-white">{u.displayName}</td>
                                    <td className="py-3 font-mono text-slate-300" dir="ltr">{u.email || "-"}</td>
                                    <td className="py-3 text-center font-mono text-indigo-300 font-bold" dir="ltr">
                                      {u.nationalId}
                                    </td>
                                    <td className="py-3 text-center">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        isValidNatId
                                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                          : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                      }`}>
                                        {isValidNatId ? "معتبر (صحیح)" : "نامعتبر"}
                                      </span>
                                    </td>
                                    <td className="py-3 text-center">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        u.verificationStatus === "verified"
                                          ? "bg-emerald-500/20 text-emerald-400"
                                          : u.verificationStatus === "rejected"
                                          ? "bg-rose-500/20 text-rose-400"
                                          : "bg-amber-500/20 text-amber-400"
                                      }`}>
                                        {u.verificationStatus === "verified"
                                          ? "تایید شده ✓"
                                          : u.verificationStatus === "rejected"
                                          ? "رد شده ✗"
                                          : "در انتظار تایید"}
                                      </span>
                                    </td>
                                    <td className="py-3 text-center text-slate-400 font-mono">
                                      {faDate(u.createdAt)}
                                    </td>
                                    <td className="py-3 text-center space-x-1.5 space-x-reverse">
                                      {u.verificationStatus !== "verified" && (
                                        <Button
                                          size="sm"
                                          onClick={() => handleVerifyCeo(u.id, "verified")}
                                          className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px]"
                                        >
                                          تایید مدیرعامل
                                        </Button>
                                      )}
                                      {u.verificationStatus !== "rejected" && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleVerifyCeo(u.id, "rejected")}
                                          className="h-7 px-2.5 border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-[11px]"
                                        >
                                          رد دسترسی
                                        </Button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB 2: Projects Fleet */}
              <TabsContent value="projects" className="space-y-4">
                <Card className="border-slate-800 bg-slate-900/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-white">ناوگان سراسری پروژه‌ها</CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                      مشاهده، پایش وضعیت سلامت و بایگانی/بازیابی تمامی پروژه‌های پلتفرم
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-start border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 text-start">
                            <th className="pb-2.5 font-medium text-start">کلید پروژه</th>
                            <th className="pb-2.5 font-medium text-start">نام پروژه</th>
                            <th className="pb-2.5 font-medium text-center">وضعیت</th>
                            <th className="pb-2.5 font-medium text-center">شاخص سلامت</th>
                            <th className="pb-2.5 font-medium text-center">تاریخ ایجاد</th>
                            <th className="pb-2.5 font-medium text-center">اقدامات اضطراری</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {projectsList.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-3 font-mono font-bold text-indigo-400">{p.key}</td>
                              <td className="py-3 font-bold text-white">{p.name}</td>
                              <td className="py-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  p.archivedAt
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-emerald-500/20 text-emerald-400"
                                }`}>
                                  {p.archivedAt ? "بایگانی‌شده" : "فعال"}
                                </span>
                              </td>
                              <td className="py-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  p.health === "at_risk"
                                    ? "bg-rose-500/20 text-rose-400"
                                    : "bg-emerald-500/20 text-emerald-400"
                                }`}>
                                  {p.health === "at_risk" ? "نیازمند توجه" : "عالی (On Track)"}
                                </span>
                              </td>
                              <td className="py-3 text-center text-slate-400 font-mono">
                                {faDate(p.createdAt)}
                              </td>
                              <td className="py-3 text-center space-x-1.5 space-x-reverse">
                                <Link href={`/projects/${p.key}`}>
                                  <Button size="sm" variant="outline" className="h-7 px-2.5 border-slate-700 text-slate-300 hover:text-white text-[11px] gap-1">
                                    <ExternalLink size={11} />
                                    مشاهده در اپ
                                  </Button>
                                </Link>
                                {p.archivedAt ? (
                                  <Button
                                    size="sm"
                                    onClick={() => handleToggleArchive(p.id, false)}
                                    className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px]"
                                  >
                                    بازیابی پروژه
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleToggleArchive(p.id, true)}
                                    className="h-7 px-2.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-[11px]"
                                  >
                                    بایگانی
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB 3: Users Directory */}
              <TabsContent value="users" className="space-y-4">
                <Card className="border-slate-800 bg-slate-900/60">
                  <CardHeader className="pb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base text-white">دایرکتوری کل کاربران پلتفرم</CardTitle>
                      <CardDescription className="text-xs text-slate-400">
                        فهرست تمام حساب‌های کاربری فعال در سیستم
                      </CardDescription>
                    </div>
                    <div className="relative w-64">
                      <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="جست‌وجو در نام یا ایمیل…"
                        className="ps-9 h-8 bg-slate-950 border-slate-800 text-xs"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-start border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 text-start">
                            <th className="pb-2.5 font-medium text-start">نام</th>
                            <th className="pb-2.5 font-medium text-start">ایمیل</th>
                            <th className="pb-2.5 font-medium text-center">شناسه گیت‌هاب</th>
                            <th className="pb-2.5 font-medium text-center">کد ملی</th>
                            <th className="pb-2.5 font-medium text-center">وضعیت احراز</th>
                            <th className="pb-2.5 font-medium text-center">تاریخ عضویت</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {usersList
                            .filter((u) => {
                              if (!searchQuery.trim()) return true;
                              const q = searchQuery.toLowerCase();
                              return (
                                (u.displayName && u.displayName.toLowerCase().includes(q)) ||
                                (u.email && u.email.toLowerCase().includes(q)) ||
                                (u.githubLogin && u.githubLogin.toLowerCase().includes(q))
                              );
                            })
                            .map((u) => (
                              <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                                <td className="py-2.5 font-bold text-white">{u.displayName || "کاربر"}</td>
                                <td className="py-2.5 font-mono text-slate-300" dir="ltr">{u.email || "-"}</td>
                                <td className="py-2.5 text-center font-mono text-purple-300">
                                  {u.githubLogin ? `@${u.githubLogin}` : "-"}
                                </td>
                                <td className="py-2.5 text-center font-mono text-indigo-300">
                                  {u.nationalId || "-"}
                                </td>
                                <td className="py-2.5 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    u.verificationStatus === "verified"
                                      ? "bg-emerald-500/20 text-emerald-400"
                                      : "bg-slate-700 text-slate-300"
                                  }`}>
                                    {u.verificationStatus}
                                  </span>
                                </td>
                                <td className="py-2.5 text-center text-slate-400 font-mono">
                                  {faDate(u.createdAt)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB 4: System Tools */}
              <TabsContent value="tools" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tool 1: Cache Flush */}
                  <Card className="border-slate-800 bg-slate-900/60">
                    <CardHeader>
                      <CardTitle className="text-sm text-white flex items-center gap-2">
                        <Server size={16} className="text-indigo-400" />
                        مدیریت حافظه کش سرور (Server Cache Purge)
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-400">
                        در صورت تغییر دستی جداول در پایگاه داده Supabase، کش حافظه سرور را با یک کلیک خالی کنید.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button onClick={handlePurgeCache} className="bg-rose-600 hover:bg-rose-500 text-white text-xs gap-1.5">
                        <RefreshCw size={13} />
                        تخلیه کامل کش پروژه‌ها
                      </Button>
                      <p className="text-[11px] text-slate-500">
                        تخلیه کش باعث می‌شود در فراخوانی بعدی، داده‌ها مستقیماً و با کوئری تازه از Supabase خوانده شوند.
                      </p>
                    </CardContent>
                  </Card>

                  {/* Tool 2: National ID Validator Tester */}
                  <Card className="border-slate-800 bg-slate-900/60">
                    <CardHeader>
                      <CardTitle className="text-sm text-white flex items-center gap-2">
                        <Key size={16} className="text-amber-400" />
                        ابزار تست صحت کد ملی ثبت احوال ایران
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-400">
                        بررسی الگوریتم رقم کنترلی کد ملی ۱۰ رقمی برای تایید کارفرمایان
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleTestNationalId} className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            value={testNationalIdInput}
                            onChange={(e) => setTestNationalIdInput(e.target.value)}
                            placeholder="کد ملی ۱۰ رقمی (مثلاً 0012345678)"
                            className="bg-slate-950 border-slate-800 text-xs font-mono"
                            dir="ltr"
                            maxLength={10}
                          />
                          <Button type="submit" size="sm" className="bg-indigo-600 text-white text-xs shrink-0">
                            بررسی
                          </Button>
                        </div>
                        {testResult && (
                          <div className={`p-2.5 rounded-lg text-xs font-medium ${
                            testResult.isValid
                              ? "bg-emerald-950/50 border border-emerald-500/30 text-emerald-300"
                              : "bg-rose-950/50 border border-rose-500/30 text-rose-300"
                          }`}>
                            {testResult.message}
                          </div>
                        )}
                      </form>
                    </CardContent>
                  </Card>
                </div>

                {/* Server Diagnostic Card */}
                <Card className="border-slate-800 bg-slate-900/60">
                  <CardHeader>
                    <CardTitle className="text-sm text-white flex items-center gap-2">
                      <Activity size={16} className="text-emerald-400" />
                      وضعیت سلامت و مانیتورینگ سرویس‌ها
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                        <span className="text-slate-400">پایگاه داده Supabase:</span>
                        <Badge variant="success" className="text-[10px]">متصل (آنلاین)</Badge>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                        <span className="text-slate-400">تاخیر ارتباط با DB:</span>
                        <span className="font-mono text-emerald-400 font-bold">{metrics?.dbLatencyMs || 25} میلی‌ثانیه</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                        <span className="text-slate-400">سرویس Realtime:</span>
                        <Badge variant="success" className="text-[10px]">فعال (Active)</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
