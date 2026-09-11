"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  UserPlus,
  Shield,
  User,
  GraduationCap,
  Check,
  Search,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  Link as LinkIcon,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
import { useProjectStore } from "@/lib/project-store";
import { type Member } from "@/components/features/types";
import { faNumber } from "@/lib/format";
import { deleteUserAccountAction } from "@/app/actions/auth";

export default function MembersPage() {
  const params = useParams<{ key: string }>();
  const projectKey = (params?.key || "PM").toUpperCase();

  const { isAdmin } = useUserRole();
  const { members, issues, addMember, updateMember, deleteMember } = useProjectStore();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [orgMembers, setOrgMembers] = useState<Member[]>([]);

  // Fetch registered organization members
  useEffect(() => {
    async function loadOrgMembers() {
      try {
        const res = await fetch("/api/v1/members");
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data)) {
            setOrgMembers(
              json.data.map((p: {
                id: string;
                displayName: string;
                email: string | null;
                githubLogin: string | null;
              }) => ({
                id: p.id,
                displayName: p.displayName || p.email?.split("@")[0] || "کاربر",
                email: p.email || "",
                githubLogin: p.githubLogin || null,
                role: "member",
                status: "active",
                joinedAt: "امروز",
              }))
            );
          }
        }
      } catch {
        // ignore
      }
    }
    loadOrgMembers();
  }, []);

  // Invite Form State
  const [selectedOrgMemberId, setSelectedOrgMemberId] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteGithub, setInviteGithub] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "intern">("member");
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState("");

  // Quick invite link
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const inviteLink = typeof window !== "undefined"
    ? `${window.location.origin}/register?invite=${projectKey.toLowerCase()}-${Date.now().toString(36)}`
    : `https://flowdeck.dev/register?invite=${projectKey.toLowerCase()}`;

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setInviteLinkCopied(true);
    setTimeout(() => setInviteLinkCopied(false), 2000);
  };

  const handleSelectOrgMember = (selectedId: string) => {
    setSelectedOrgMemberId(selectedId);
    const found = orgMembers.find((om) => om.id === selectedId);
    if (found) {
      setInviteName(found.displayName);
      setInviteEmail(found.email || "");
      setInviteGithub(found.githubLogin || "");
    }
  };

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    const matchedOrg = orgMembers.find(
      (om) => om.email?.toLowerCase() === inviteEmail.trim().toLowerCase()
    );
    const memberId = selectedOrgMemberId || matchedOrg?.id || `mem-${Date.now()}`;

    const newMem: Member = {
      id: memberId,
      displayName: inviteName.trim(),
      email: inviteEmail.trim(),
      githubLogin: inviteGithub.trim() || null,
      role: inviteRole,
      status: "active",
      joinedAt: "امروز",
    };

    addMember(newMem);
    setInviteSuccessMsg(`عضو «${inviteName}» با موفقیت به پروژه افزوده شد.`);
    setInviteName("");
    setInviteEmail("");
    setInviteGithub("");
    setSelectedOrgMemberId(null);
    setTimeout(() => {
      setInviteSuccessMsg("");
      setInviteModalOpen(false);
    }, 1500);
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

  // Counts by role
  const roleCounts = useMemo(() => {
    return {
      admin: members.filter((m) => m.role === "admin").length,
      member: members.filter((m) => m.role === "member" || !m.role).length,
      intern: members.filter((m) => m.role === "intern").length,
    };
  }, [members]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              مدیریت اعضای تیم و کارآموزان
            </h1>
            <Badge variant="outline" className="font-mono text-xs">
              {projectKey}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            مشاهده، تخصیص نقش‌ها، اتصال حساب گیت‌هاب و ارسال دعوت‌نامه به تیم
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={copyInviteLink}
            className="gap-2 text-xs h-9 border-border bg-card"
          >
            {inviteLinkCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <LinkIcon className="w-3.5 h-3.5" />
            )}
            {inviteLinkCopied ? "لینک کپی شد!" : "کپی لینک دعوت اختصاصی"}
          </Button>

          {isAdmin && (
            <Button
              onClick={() => setInviteModalOpen(true)}
              className="gap-1.5 h-9 text-xs shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              دعوت عضو جدید
            </Button>
          )}
        </div>
      </div>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">مدیران پروژه</span>
              <div className="text-2xl font-bold">{faNumber(roleCounts.admin)}</div>
              <span className="text-[11px] text-amber-500 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                دسترسی کامل مدیریتی
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
              <span className="text-xs font-medium text-muted-foreground">اعضای فنی و مهندسین</span>
              <div className="text-2xl font-bold">{faNumber(roleCounts.member)}</div>
              <span className="text-[11px] text-blue-500 flex items-center gap-1">
                <User className="w-3 h-3" />
                توسعه‌دهندگان اصلی
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
              <div className="text-2xl font-bold">{faNumber(roleCounts.intern)}</div>
              <span className="text-[11px] text-purple-500 flex items-center gap-1">
                <GraduationCap className="w-3 h-3" />
                تحت ارزیابی و مانیتورینگ
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
              <GraduationCap className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Toolbar */}
      <Card className="border-border/80 bg-card/60">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجو بر اساس نام، ایمیل یا یوزرنیم گیت‌هاب…"
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
            نمایش {faNumber(filteredMembers.length)} از {faNumber(members.length)} عضو
          </span>
        </CardContent>
      </Card>

      {/* Members Table */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-medium">
                <th className="py-3 px-4 text-start">نام عضو</th>
                <th className="py-3 px-4 text-start">ایمیل</th>
                <th className="py-3 px-4 text-start">حساب GitHub</th>
                <th className="py-3 px-4 text-start">نقش در پروژه</th>
                <th className="py-3 px-4 text-start">ایشوهای فعال</th>
                <th className="py-3 px-4 text-start">تاریخ عضویت</th>
                {isAdmin && <th className="py-3 px-4 text-center">عملیات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    عضوی با این مشخصات یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => {
                  const assignedCount = issues.filter(
                    (i) => i.assignee?.id === m.id || i.assignee?.displayName === m.displayName
                  ).length;

                  return (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      {/* Name & Avatar */}
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
                          <div>
                            <span className="font-semibold text-foreground block">
                              {m.displayName}
                            </span>
                            {m.status === "invited" && (
                              <span className="text-[10px] text-amber-500 font-medium">
                                در انتظار تایید دعوت
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                        {m.email || `${m.githubLogin || "member"}@flowdeck.dev`}
                      </td>

                      {/* GitHub Account */}
                      <td className="py-3.5 px-4">
                        {m.githubLogin ? (
                          <a
                            href={`https://github.com/${m.githubLogin}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/80 hover:bg-muted border border-border text-foreground text-xs font-mono font-medium transition-colors"
                          >
                            <GithubIcon size={13} />
                            <span>@{m.githubLogin}</span>
                            <ExternalLink className="w-3 h-3 text-muted-foreground" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">متصل نشده</span>
                        )}
                      </td>

                      {/* Role Selector */}
                      <td className="py-3.5 px-4">
                        {isAdmin ? (
                          <Select
                            value={m.role || "member"}
                            onValueChange={(val: "admin" | "member" | "intern") => {
                              updateMember(m.id, { role: val });
                            }}
                          >
                            <SelectTrigger className="w-32 h-7 text-xs bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                <span className="flex items-center gap-1 text-amber-500 font-medium">
                                  <Shield className="w-3 h-3" />
                                  مدیر (Admin)
                                </span>
                              </SelectItem>
                              <SelectItem value="member">
                                <span className="flex items-center gap-1 text-blue-500 font-medium">
                                  <User className="w-3 h-3" />
                                  مهندس (Member)
                                </span>
                              </SelectItem>
                              <SelectItem value="intern">
                                <span className="flex items-center gap-1 text-purple-500 font-medium">
                                  <GraduationCap className="w-3 h-3" />
                                  کارآموز (Intern)
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
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
                              ? "مدیر"
                              : m.role === "intern"
                              ? "کارآموز"
                              : "عضو مهندسی"}
                          </Badge>
                        )}
                      </td>

                      {/* Active Issues */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground">
                          {faNumber(assignedCount)} ایشو
                        </span>
                      </td>

                      {/* Joined Date */}
                      <td className="py-3.5 px-4 text-xs text-muted-foreground font-mono">
                        {m.joinedAt || "۱۴۰۳/۰۴/۰۱"}
                      </td>

                      {/* Admin Actions */}
                      {isAdmin && (
                        <td className="py-3.5 px-4 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs">
                              <DropdownMenuLabel>عملیات کاربر</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => {
                                  const gh = prompt("نام کاربری جدید در GitHub:", m.githubLogin || "");
                                  if (gh !== null) {
                                    updateMember(m.id, { githubLogin: gh.trim() });
                                  }
                                }}
                              >
                                ویرایش حساب GitHub
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={async () => {
                                  deleteMember(m.id);
                                  try {
                                    await deleteUserAccountAction(m.id);
                                  } catch (err) {
                                    console.warn("[ProjectMembers] delete notice:", err);
                                  }
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="w-3.5 h-3.5 ms-1" />
                                حذف سریع کاربر
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-foreground">دعوت عضو جدید به پروژه</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInviteModalOpen(false)}
                className="h-8 w-8 p-0 rounded-full"
              >
                ✕
              </Button>
            </div>

            {inviteSuccessMsg ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto animate-bounce" />
                <p className="text-sm font-semibold text-emerald-500">{inviteSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleCreateMember} className="space-y-4 text-xs sm:text-sm">
                {orgMembers.length > 0 && (
                  <div className="space-y-1.5 p-2.5 rounded-[8px] bg-primary/5 border border-primary/20">
                    <label className="font-semibold text-foreground flex items-center gap-1.5">
                      <UserPlus size={14} className="text-primary" />
                      انتخاب سریع از اعضای ثبت‌نام شده در سازمان:
                    </label>
                    <Select onValueChange={handleSelectOrgMember}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="یک کاربر از اعضای سازمان را انتخاب کنید..." />
                      </SelectTrigger>
                      <SelectContent>
                        {orgMembers.map((om) => (
                          <SelectItem key={om.id} value={om.id}>
                            {om.displayName} {om.email ? `(${om.email})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">نام و نام‌خانوادگی</label>
                  <Input
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="مثال: پوریا کریمی"
                    className="bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">ایمیل سازمانی یا کاری</label>
                  <Input
                    required
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="ایمیل کاری را وارد کنید (pouria@company.com)"
                    className="bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">نام کاربری GitHub (اختیاری)</label>
                  <div className="relative">
                    <GithubIcon className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
                    <Input
                      value={inviteGithub}
                      onChange={(e) => setInviteGithub(e.target.value)}
                      placeholder="نام کاربری گیت‌هاب (مثال: octocat)"
                      className="bg-background pe-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">نقش کاربری</label>
                  <Select
                    value={inviteRole}
                    onValueChange={(val: "admin" | "member" | "intern") => setInviteRole(val)}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">مهندس / عضو تیم (Member)</SelectItem>
                      <SelectItem value="intern">کارآموز (Intern)</SelectItem>
                      <SelectItem value="admin">مدیر ارشد (Admin)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setInviteModalOpen(false)}
                  >
                    انصراف
                  </Button>
                  <Button type="submit" className="gap-1.5">
                    <UserPlus className="w-4 h-4" />
                    ارسال دعوت‌نامه
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
