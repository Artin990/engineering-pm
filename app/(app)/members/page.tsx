"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import {
  UserPlus,
  Shield,
  User,
  GraduationCap,
  Search,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  Link as LinkIcon,
  Check,
  CheckCircle2,
  Building2,
  Edit2,
  Copy,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GithubIcon } from "@/components/ui/github-icon";
import { useUserRole } from "@/lib/role-context";
import { type Member } from "@/components/features/types";
import { faNumber } from "@/lib/format";
import { deleteUserAccountAction } from "@/app/actions/auth";
import {
  getOrganizationInfo,
  removeOrgMemberAction,
  type OrgInfoResult,
} from "@/app/actions/organization";

const INITIAL_ORG_MEMBERS: Member[] = [];

export default function OrganizationMembersPage() {
  const { isAdmin } = useUserRole();
  const [members, setMembers] = useState<Member[]>(INITIAL_ORG_MEMBERS);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [orgInfo, setOrgInfo] = useState<OrgInfoResult | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [github, setGithub] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "intern">("member");
  const [successMsg, setSuccessMsg] = useState("");

  // Invite Copy States
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const activeInviteCode = orgInfo?.inviteCode || "RADAR-185";
  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/register?code=${activeInviteCode}`
      : `https://radarcheck.dev/register?code=${activeInviteCode}`;

  // Load from API & localStorage
  const fetchMembers = async () => {
    let localList: Member[] = [];
    try {
      const saved = localStorage.getItem("flowdeck_org_members");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          localList = parsed;
          setMembers(parsed);
        }
      }
    } catch {
      // ignore
    }

    // 1. Fetch organization details (Invite code, CEO info)
    try {
      const info = await getOrganizationInfo();
      if (info.ok) {
        setOrgInfo(info);
      }
    } catch {
      // ignore
    }

    // 2. Fetch members of the organization
    try {
      const res = await fetch("/api/v1/members");
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data) && json.data.length > 0) {
          const apiMembers: Member[] = json.data.map(
            (p: {
              id: string;
              displayName: string;
              email: string | null;
              avatarUrl: string | null;
              githubLogin: string | null;
              createdAt?: string;
              role?: string;
            }) => {
              const isAdminEmail =
                p.email &&
                [
                  "amiriartin185@gmil.com",
                  "amiriartin185@gmail.com",
                  "artinamiri185@gmail.com",
                ].includes(p.email.toLowerCase());
              return {
                id: p.id,
                displayName: p.displayName || p.email?.split("@")[0] || "کاربر جدید",
                email: p.email || "",
                avatarUrl: p.avatarUrl || null,
                githubLogin: p.githubLogin || null,
                role: isAdminEmail ? "admin" : (p.role as "admin" | "member" | "intern") || "member",
                status: "active",
                joinedAt: p.createdAt
                  ? new Date(p.createdAt).toLocaleDateString("fa-IR")
                  : "به‌تازگی",
              };
            }
          );

          // Merge without duplicate emails/ids
          const merged = [...apiMembers];
          for (const lm of localList) {
            if (
              !merged.some(
                (m) =>
                  (m.email &&
                    lm.email &&
                    m.email.toLowerCase() === lm.email.toLowerCase()) ||
                  m.id === lm.id
              )
            ) {
              merged.push(lm);
            }
          }

          setMembers(merged);
          try {
            localStorage.setItem("flowdeck_org_members", JSON.stringify(merged));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchMembers();
    const interval = setInterval(fetchMembers, 3500);
    return () => clearInterval(interval);
  }, []);

  const saveMembers = (updated: Member[]) => {
    setMembers(updated);
    try {
      localStorage.setItem("flowdeck_org_members", JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeInviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleOpenAdd = () => {
    setEditingMember(null);
    setName("");
    setEmail("");
    setGithub("");
    setRole("member");
    setSuccessMsg("");
    setModalOpen(true);
  };

  const handleOpenEdit = (m: Member) => {
    setEditingMember(m);
    setName(m.displayName);
    setEmail(m.email || "");
    setGithub(m.githubLogin || "");
    setRole(m.role || "member");
    setSuccessMsg("");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    if (editingMember) {
      const updated = members.map((m) =>
        m.id === editingMember.id
          ? {
              ...m,
              displayName: name.trim(),
              email: email.trim(),
              githubLogin: github.trim() || null,
              role,
            }
          : m
      );
      saveMembers(updated);
      setSuccessMsg(`مشخصات «${name}» با موفقیت ویرایش شد.`);

      try {
        await fetch("/api/v1/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingMember.id,
            displayName: name.trim(),
            email: email.trim(),
            githubLogin: github.trim() || null,
          }),
        });
      } catch {
        // ignore
      }
    } else {
      const newMember: Member = {
        id: `org-mem-${Date.now()}`,
        displayName: name.trim(),
        email: email.trim(),
        githubLogin: github.trim() || null,
        role,
        status: "active",
        joinedAt: "امروز",
      };
      const updated = [newMember, ...members];
      saveMembers(updated);
      setSuccessMsg(`عضو جدید «${name}» به دایرکتوری سازمان افزوده شد.`);

      try {
        await fetch("/api/v1/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: newMember.id,
            displayName: name.trim(),
            email: email.trim(),
            githubLogin: github.trim() || null,
          }),
        });
      } catch {
        // ignore
      }
    }

    setTimeout(() => {
      setSuccessMsg("");
      setModalOpen(false);
    }, 1200);
  };

  const handleDelete = async (id: string) => {
    // حذف سریع از سازمان و دیتابیس توسط ادمین
    const updated = members.filter((m) => m.id !== id);
    saveMembers(updated);

    try {
      await removeOrgMemberAction(id);
      await fetch(`/api/v1/members?id=${id}`, { method: "DELETE" });
      await deleteUserAccountAction(id);
    } catch (err) {
      console.warn("[Members] user delete notice:", err);
    }
  };

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchSearch =
        m.displayName.toLowerCase().includes(search.toLowerCase()) ||
        (m.email && m.email.toLowerCase().includes(search.toLowerCase())) ||
        (m.githubLogin && m.githubLogin.toLowerCase().includes(search.toLowerCase()));

      const matchRole = roleFilter === "all" || m.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [members, search, roleFilter]);

  const counts = useMemo(() => {
    return {
      admin: members.filter((m) => m.role === "admin").length,
      member: members.filter((m) => m.role === "member" || !m.role).length,
      intern: members.filter((m) => m.role === "intern").length,
    };
  }, [members]);

  if (!isAdmin) {
    return (
      <section className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="size-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20">
          <Shield className="size-7" />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          دسترسی محدود به مدیرعامل
        </h1>
        <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">
          مشاهده و مدیریت اعضای کل سازمان صرفاً در اختیار مدیرعامل است. شما می‌توانید از منوی پروژه‌ها به تسک‌ها و اعضای پروژه خود دسترسی داشته باشید.
        </p>
        <Button asChild className="mt-4 shadow-sm">
          <Link href="/projects">بازگشت به پروژه‌ها</Link>
        </Button>
      </section>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Building2 className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              اعضای کل سازمان و زیرمجموعه
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            مدیریت متمرکز پرسنل، رهگیر کد زیرمجموعه‌گیری و اعطای دسترسی به پروژه‌ها
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleOpenAdd} className="gap-1.5 shadow-sm">
            <UserPlus className="w-4 h-4" />
            افزودن عضو دستی
          </Button>
        </div>
      </div>

      {/* CEO Referral Code & Invite Banner */}
      <div className="rounded-2xl border border-[var(--primary)]/30 bg-gradient-to-r from-[var(--primary)]/10 via-[var(--surface-raised)] to-[var(--surface)] p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <Badge className="bg-[var(--primary)] text-white text-xs px-2.5 py-0.5 font-medium flex items-center gap-1">
                <Sparkles className="size-3" />
                کد زیرمجموعه‌گیری اختصاصی مدیرعامل
              </Badge>
              <span className="text-xs text-[var(--text-muted)] font-mono">
                {orgInfo?.workspaceName || "سازمان مهندسی RadarCheck"}
              </span>
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              پرسنل را با کد زیرمجموعه‌گیری به سازمان متصل کنید
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              این کد یا لینک اختصاصی را در اختیار اعضای تیم خود قرار دهید. با وارد کردن این کد در مرحله ثبت‌نام، کاربر به صورت خودکار زیرمجموعه شما شده و در این لیست قرار می‌گیرد و به پروژه‌ها، چت و تسک‌های مشترک دسترسی خواهد داشت.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {/* Code Box */}
            <div className="flex items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 shadow-xs">
              <div className="text-start">
                <span className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                  کد سازمان
                </span>
                <span className="text-base sm:text-lg font-mono font-bold text-[var(--primary)] tracking-wider">
                  {activeInviteCode}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyCode}
                className="h-8 gap-1.5 text-xs border-[var(--border)] bg-[var(--background)]"
              >
                {copiedCode ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copiedCode ? "کپی شد" : "کپی کد"}
              </Button>
            </div>

            {/* Link Button */}
            <Button
              onClick={handleCopyInvite}
              className="gap-2 text-xs sm:text-sm h-11 px-4 shadow-sm"
            >
              {copiedLink ? (
                <Check className="size-4 text-white" />
              ) : (
                <LinkIcon className="size-4" />
              )}
              {copiedLink ? "لینک ثبت‌نام کپی شد!" : "کپی لینک ثبت‌نام مستقیم"}
            </Button>
          </div>
        </div>
      </div>

      {/* Role Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">مدیران و رهبران</span>
              <div className="text-2xl font-bold">{faNumber(counts.admin)}</div>
              <span className="text-[11px] text-amber-500 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                اختیارات مدیریتی کل سازمان
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Shield className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">مهندسین و توسعه‌دهندگان</span>
              <div className="text-2xl font-bold">{faNumber(counts.member)}</div>
              <span className="text-[11px] text-blue-500 flex items-center gap-1">
                <User className="w-3 h-3" />
                تیم فنی فعال
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <User className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">کارآموزان (Interns)</span>
              <div className="text-2xl font-bold">{faNumber(counts.intern)}</div>
              <span className="text-[11px] text-purple-500 flex items-center gap-1">
                <GraduationCap className="w-3 h-3" />
                آموزش و مانیتورینگ عملکرد
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
              <GraduationCap className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border/80 bg-card/60 shadow-xs">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجو بر اساس نام، ایمیل یا اکانت گیت‌هاب…"
                className="pe-9 bg-background"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-36 bg-background">
                <SelectValue placeholder="نقش" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه نقش‌ها</SelectItem>
                <SelectItem value="admin">مدیر (Admin)</SelectItem>
                <SelectItem value="member">مهندس (Member)</SelectItem>
                <SelectItem value="intern">کارآموز (Intern)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-muted-foreground">
            مجموع: {faNumber(filteredMembers.length)} از {faNumber(members.length)} عضو سازمان
          </span>
        </CardContent>
      </Card>

      {/* Members Directory Table */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-medium">
                <th className="py-3.5 px-4 text-start">نام و نام خانوادگی</th>
                <th className="py-3.5 px-4 text-start">ایمیل سازمانی</th>
                <th className="py-3.5 px-4 text-start">حساب GitHub</th>
                <th className="py-3.5 px-4 text-start">سطح دسترسی و نقش</th>
                <th className="py-3.5 px-4 text-start">تاریخ عضویت</th>
                {isAdmin && <th className="py-3.5 px-4 text-center">عملیات مدیریت</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Users className="size-10 mx-auto text-[var(--text-muted)] mb-2 opacity-50" />
                    <p className="font-semibold text-sm">عضوی با این مشخصات یافت نشد.</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      کد زیرمجموعه‌گیری <code className="font-mono font-bold text-[var(--primary)]">{activeInviteCode}</code> را به پرسنل جدید بدهید تا ثبت‌نام نمایند.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                    {/* Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white ${
                            m.role === "admin"
                              ? "bg-amber-600"
                              : m.role === "intern"
                              ? "bg-purple-600"
                              : "bg-blue-600"
                          }`}
                        >
                          {m.displayName.charAt(0)}
                        </div>
                        <span className="font-semibold text-foreground">{m.displayName}</span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                      {m.email || "-"}
                    </td>

                    {/* GitHub */}
                    <td className="py-3.5 px-4">
                      {m.githubLogin ? (
                        <a
                          href={`https://github.com/${m.githubLogin}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted hover:bg-muted/80 border border-border text-foreground text-xs font-mono font-medium transition-colors"
                        >
                          <GithubIcon size={13} />
                          <span>@{m.githubLogin}</span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">متصل نشده</span>
                      )}
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          m.role === "admin"
                            ? "default"
                            : m.role === "intern"
                            ? "secondary"
                            : "outline"
                        }
                        className="text-xs"
                      >
                        {m.role === "admin"
                          ? "مدیر ارشد (Admin)"
                          : m.role === "intern"
                          ? "کارآموز (Intern)"
                          : "مهندس تیم (Member)"}
                      </Badge>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-xs text-muted-foreground font-mono">
                      {m.joinedAt || "۱۴۰۳/۰۴/۰۱"}
                    </td>

                    {/* Actions */}
                    {isAdmin && (
                      <td className="py-3.5 px-4 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-xs">
                            <DropdownMenuLabel>عملیات پرسنلی</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenEdit(m)}>
                              <Edit2 className="w-3.5 h-3.5 ms-1" />
                              ویرایش مشخصات
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(m.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5 ms-1" />
                              حذف و اخراج از سازمان
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  {editingMember ? "ویرایش مشخصات عضو" : "افزودن عضو جدید به سازمان"}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setModalOpen(false)}
                className="h-8 w-8 p-0 rounded-full"
              >
                ✕
              </Button>
            </div>

            {successMsg ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto animate-bounce" />
                <p className="text-sm font-semibold text-emerald-500">{successMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">نام و نام خانوادگی</label>
                  <Input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: رضا کریمی"
                    className="bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">ایمیل سازمانی</label>
                  <Input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="reza@company.com"
                    className="bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">نام کاربری GitHub (اختیاری)</label>
                  <div className="relative">
                    <GithubIcon className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
                    <Input
                      value={github}
                      onChange={(e) => setGithub(e.target.value)}
                      placeholder="اکانت گیت‌هاب (مثال: reza-dev)"
                      className="bg-background pe-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">نقش در سازمان</label>
                  <Select
                    value={role}
                    onValueChange={(val: "admin" | "member" | "intern") => setRole(val)}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">مهندس فنی (Member)</SelectItem>
                      <SelectItem value="intern">کارآموز (Intern)</SelectItem>
                      <SelectItem value="admin">مدیر ارشد (Admin)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalOpen(false)}
                  >
                    انصراف
                  </Button>
                  <Button type="submit" className="gap-1.5">
                    {editingMember ? "ذخیره تغییرات" : "افزودن عضو"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
