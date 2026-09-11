"use client";

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
import { type Member } from "@/components/features/types";
import { faNumber } from "@/lib/format";

const INITIAL_ORG_MEMBERS: Member[] = [];

export default function OrganizationMembersPage() {
  const { isAdmin } = useUserRole();
  const [members, setMembers] = useState<Member[]>(INITIAL_ORG_MEMBERS);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [github, setGithub] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "intern">("member");
  const [successMsg, setSuccessMsg] = useState("");

  // Invite Link
  const [copiedLink, setCopiedLink] = useState(false);
  const inviteLink = typeof window !== "undefined"
    ? `${window.location.origin}/register?org=flowdeck`
    : `https://flowdeck.dev/register?org=flowdeck`;

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("flowdeck_org_members");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMembers(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const saveMembers = (updated: Member[]) => {
    setMembers(updated);
    try {
      localStorage.setItem("flowdeck_org_members", JSON.stringify(updated));
    } catch {
      // ignore
    }
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

  const handleSubmit = (e: React.FormEvent) => {
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
    }

    setTimeout(() => {
      setSuccessMsg("");
      setModalOpen(false);
    }, 1200);
  };

  const handleDelete = (id: string) => {
    if (confirm("آیا از حذف این کاربر از دایرکتوری سازمان اطمینان دارید؟")) {
      const updated = members.filter((m) => m.id !== id);
      saveMembers(updated);
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
              دایرکتوری اعضای سازمان
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            بانک جامع اعضای فنی، مدیران و کارآموزان — اعضا را یکبار اضافه کنید و در تمامی پروژه‌ها استفاده نمایید
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleCopyInvite}
            className="gap-2 text-xs border-border bg-card shadow-xs"
          >
            {copiedLink ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <LinkIcon className="w-3.5 h-3.5" />
            )}
            {copiedLink ? "لینک کپی شد!" : "کپی لینک دعوت به سازمان"}
          </Button>

          {isAdmin && (
            <Button onClick={handleOpenAdd} className="gap-1.5 shadow-sm">
              <UserPlus className="w-4 h-4" />
              افزودن عضو جدید
            </Button>
          )}
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
                {isAdmin && <th className="py-3.5 px-4 text-center">عملیات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    عضوی با این مشخصات یافت نشد.
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
                            <DropdownMenuLabel>عملیات</DropdownMenuLabel>
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
                              حذف از سازمان
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
