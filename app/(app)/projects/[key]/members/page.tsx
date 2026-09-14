"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  UserPlus,
  Shield,
  User,
  GraduationCap,
  Check,
  Search,
  MoreHorizontal,
  ExternalLink,
  Link as LinkIcon,
  CheckCircle2,
  Users,
  UserCheck,
  UserMinus,
  RefreshCw,
  Sparkles,
  Building2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { createClient } from "@/lib/supabase/client";

interface OrgMemberItem {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  githubLogin?: string | null;
  orgRole?: string;
  isAssignedToProject?: boolean;
}

export default function MembersPage() {
  const params = useParams<{ key: string }>();
  const projectKey = (params?.key || "PM").toUpperCase();

  const { isAdmin } = useUserRole();
  const { members, issues, addMember, updateMember, deleteMember } = useProjectStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // Organization members state
  const [orgMembers, setOrgMembers] = useState<OrgMemberItem[]>([]);
  const [orgSearch, setOrgSearch] = useState("");
  const [selectedOrgUserIds, setSelectedOrgUserIds] = useState<string[]>([]);
  const [bulkRole, setBulkRole] = useState<"admin" | "member" | "intern">("member");
  const [isProcessingOrgAction, setIsProcessingOrgAction] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");

  // Single invite form state
  const [selectedOrgMemberId, setSelectedOrgMemberId] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteGithub, setInviteGithub] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "intern">("member");
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState("");
  const [inviteError, setInviteError] = useState("");

  // Quick invite link state
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/register?invite=${projectKey.toLowerCase()}-${Date.now().toString(36)}`
      : `https://flowdeck.dev/register?invite=${projectKey.toLowerCase()}`;

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setInviteLinkCopied(true);
    setTimeout(() => setInviteLinkCopied(false), 2000);
  };

  // Load project members & organization members from API
  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectKey}/members`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.orgMembers)) {
          setOrgMembers(json.orgMembers);
        }
        if (Array.isArray(json.projectMembers)) {
          json.projectMembers.forEach((pm: {
            id: string;
            displayName: string;
            email: string;
            githubLogin: string | null;
            role: "lead" | "contributor" | "viewer" | "admin" | "member" | "intern";
          }) => {
            const mappedRole: "admin" | "member" | "intern" =
              pm.role === "lead" || pm.role === "admin"
                ? "admin"
                : pm.role === "viewer" || pm.role === "intern"
                ? "intern"
                : "member";

            const existing = members.find((m) => m.id === pm.id);
            if (!existing) {
              addMember({
                id: pm.id,
                displayName: pm.displayName,
                email: pm.email,
                githubLogin: pm.githubLogin,
                role: mappedRole,
                status: "active",
                joinedAt: "امروز",
              });
            }
          });
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectKey, members, addMember]);

  useEffect(() => {
    loadData(true);

    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    try {
      const supabase = createClient();
      channel = supabase
        .channel(`radarcheck_project_${projectKey}_members_ui`)
        .on("broadcast", { event: "project_updated" }, () => {
          loadData(false);
        })
        .subscribe();
    } catch {
      // ignore
    }

    return () => {
      if (channel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch {
          // ignore
        }
      }
    };
  }, [projectKey, loadData]);

  // Handle single member add from Organization list
  const handleAddOrgMemberToProject = async (orgMember: OrgMemberItem, customRole: "admin" | "member" | "intern" = "member") => {
    setIsProcessingOrgAction(true);
    setActionSuccessMsg("");
    try {
      const res = await fetch(`/api/v1/projects/${projectKey}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: orgMember.userId,
          role: customRole === "admin" ? "lead" : customRole === "intern" ? "viewer" : "contributor",
        }),
      });

      if (res.ok) {
        addMember({
          id: orgMember.userId,
          displayName: orgMember.displayName,
          email: orgMember.email,
          githubLogin: orgMember.githubLogin || null,
          role: customRole,
          status: "active",
          joinedAt: "امروز",
        });

        setOrgMembers((prev) =>
          prev.map((om) =>
            om.userId === orgMember.userId ? { ...om, isAssignedToProject: true } : om
          )
        );

        setActionSuccessMsg(`عضو «${orgMember.displayName}» با موفقیت به پروژه اضافه شد.`);
        setTimeout(() => setActionSuccessMsg(""), 3000);
      }
    } catch {
      // error
    } finally {
      setIsProcessingOrgAction(false);
    }
  };

  // Handle bulk add of selected organization members
  const handleBulkAddOrgMembers = async () => {
    if (selectedOrgUserIds.length === 0) return;
    setIsProcessingOrgAction(true);
    setActionSuccessMsg("");
    try {
      const res = await fetch(`/api/v1/projects/${projectKey}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: selectedOrgUserIds,
          role: bulkRole === "admin" ? "lead" : bulkRole === "intern" ? "viewer" : "contributor",
        }),
      });

      if (res.ok) {
        selectedOrgUserIds.forEach((uId) => {
          const found = orgMembers.find((om) => om.userId === uId);
          if (found) {
            addMember({
              id: found.userId,
              displayName: found.displayName,
              email: found.email,
              githubLogin: found.githubLogin || null,
              role: bulkRole,
              status: "active",
              joinedAt: "امروز",
            });
          }
        });

        setOrgMembers((prev) =>
          prev.map((om) =>
            selectedOrgUserIds.includes(om.userId) ? { ...om, isAssignedToProject: true } : om
          )
        );

        setActionSuccessMsg(`${faNumber(selectedOrgUserIds.length)} عضو با موفقیت به پروژه افزوده شدند.`);
        setSelectedOrgUserIds([]);
        setTimeout(() => setActionSuccessMsg(""), 3500);
      }
    } catch {
      // error
    } finally {
      setIsProcessingOrgAction(false);
    }
  };

  // Handle member removal
  const handleRemoveMember = async (memberId: string, displayName: string) => {
    if (!confirm(`آیا از حذف «${displayName}» از این پروژه مطمئن هستید؟`)) {
      return;
    }

    try {
      deleteMember(memberId);
      setOrgMembers((prev) =>
        prev.map((om) =>
          om.userId === memberId || om.id === memberId ? { ...om, isAssignedToProject: false } : om
        )
      );

      await fetch(`/api/v1/projects/${projectKey}/members?userId=${encodeURIComponent(memberId)}`, {
        method: "DELETE",
      });

      setActionSuccessMsg(`عضو «${displayName}» از این پروژه خارج شد.`);
      setTimeout(() => setActionSuccessMsg(""), 3000);
    } catch {
      // ignore
    }
  };

  // Handle role update
  const handleRoleChange = async (memberId: string, newRole: "admin" | "member" | "intern") => {
    updateMember(memberId, { role: newRole });
    try {
      await fetch(`/api/v1/projects/${projectKey}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: memberId,
          role: newRole,
        }),
      });
    } catch {
      // ignore
    }
  };

  // Handle GitHub handle update
  const handleGithubChange = async (memberId: string, github: string) => {
    updateMember(memberId, { githubLogin: github });
    try {
      await fetch(`/api/v1/projects/${projectKey}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: memberId,
          githubLogin: github,
        }),
      });
    } catch {
      // ignore
    }
  };

  // Handle new custom invitation
  const handleSelectOrgMemberForInvite = (selectedId: string) => {
    setSelectedOrgMemberId(selectedId);
    const found = orgMembers.find((om) => om.id === selectedId || om.userId === selectedId);
    if (found) {
      setInviteName(found.displayName);
      setInviteEmail(found.email || "");
      setInviteGithub(found.githubLogin || "");
    }
  };

  const handleCreateCustomMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteError("نام و ایمیل عضو الزامی است.");
      return;
    }

    setInviteError("");
    const memberId = selectedOrgMemberId || `mem-${Date.now()}`;

    const newMem: Member = {
      id: memberId,
      displayName: inviteName.trim(),
      email: inviteEmail.trim(),
      githubLogin: inviteGithub.trim() || null,
      role: inviteRole,
      status: "active",
      joinedAt: "امروز",
    };

    try {
      const res = await fetch(`/api/v1/projects/${projectKey}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedOrgMemberId || undefined,
          displayName: inviteName.trim(),
          email: inviteEmail.trim(),
          githubLogin: inviteGithub.trim() || undefined,
          role: inviteRole,
        }),
      });

      if (res.ok) {
        addMember(newMem);
        setInviteSuccessMsg(`عضو «${inviteName}» با موفقیت به پروژه افزوده شد.`);
        setInviteName("");
        setInviteEmail("");
        setInviteGithub("");
        setSelectedOrgMemberId(null);
        setTimeout(() => {
          setInviteSuccessMsg("");
          setInviteModalOpen(false);
          loadData(false);
        }, 1500);
      }
    } catch {
      addMember(newMem);
      setInviteModalOpen(false);
    }
  };

  // Filter project members
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

  // Filter organization members
  const filteredOrgMembers = useMemo(() => {
    return orgMembers.filter((om) => {
      const matchSearch =
        om.displayName.toLowerCase().includes(orgSearch.toLowerCase()) ||
        (om.email && om.email.toLowerCase().includes(orgSearch.toLowerCase())) ||
        (om.githubLogin && om.githubLogin.toLowerCase().includes(orgSearch.toLowerCase()));
      return matchSearch;
    });
  }, [orgMembers, orgSearch]);

  const unassignedOrgMembers = useMemo(() => {
    const memberIds = new Set(members.map((m) => m.id));
    return filteredOrgMembers.filter(
      (om) => !om.isAssignedToProject && !memberIds.has(om.userId) && !memberIds.has(om.id)
    );
  }, [filteredOrgMembers, members]);

  // Role counts
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
              اعضا و دسترسی‌های پروژه
            </h1>
            <Badge variant="outline" className="font-mono text-xs font-bold uppercase bg-primary/10 text-primary border-primary/30">
              {projectKey}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            انتخاب و انتساب اعضای سازمان، تعیین سطوح دسترسی فنی و پیگیری افراد فعال در پروژه
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="gap-1.5 text-xs h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            بروزرسانی
          </Button>

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
            {inviteLinkCopied ? "لینک کپی شد!" : "کپی لینک دعوت"}
          </Button>

          {isAdmin && (
            <Button
              onClick={() => setInviteModalOpen(true)}
              className="gap-1.5 h-9 text-xs shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              دعوت عضو خارج از سازمان
            </Button>
          )}
        </div>
      </div>

      {/* Global Success Feedback Notification */}
      {actionSuccessMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
          <span className="font-medium">{actionSuccessMsg}</span>
        </div>
      )}

      {/* Role Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-card border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">کل اعضای پروژه</span>
              <div className="text-2xl font-bold">{faNumber(members.length)}</div>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3 text-primary" />
                افراد با دسترسی به کارت پروژه
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">مدیران پروژه</span>
              <div className="text-2xl font-bold text-amber-500">{faNumber(roleCounts.admin)}</div>
              <span className="text-[11px] text-amber-500 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                دسترسی مدیریتی
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
              <span className="text-xs font-medium text-muted-foreground">اعضای مهندسی</span>
              <div className="text-2xl font-bold text-blue-500">{faNumber(roleCounts.member)}</div>
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
              <span className="text-xs font-medium text-muted-foreground">کارآموزان</span>
              <div className="text-2xl font-bold text-purple-500">{faNumber(roleCounts.intern)}</div>
              <span className="text-[11px] text-purple-500 flex items-center gap-1">
                <GraduationCap className="w-3 h-3" />
                تحت مانیتورینگ
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
              <GraduationCap className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 1: Selective Organization Member Assignment (مخصوص مدیرعامل) */}
      {isAdmin && (
        <Card className="border-primary/30 bg-primary/5 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base text-foreground">
                  <Building2 className="w-5 h-5 text-primary" />
                  انتخاب و انتساب اعضای سازمان به این پروژه
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  شما به عنوان مدیرعامل می‌توانید افراد ثبت‌نام شده در سازمان را به‌صورت انتخابی (Selective) به این پروژه اضافه کنید تا کارت پروژه برای آن‌ها فعال شود.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs gap-1">
                <Sparkles className="w-3 h-3 text-primary" />
                {faNumber(orgMembers.length)} عضو ثبت‌نام شده در سازمان
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Search and Bulk Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px] max-w-sm">
                <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  placeholder="جستجو در اعضای سازمان (نام، ایمیل، گیت‌هاب)…"
                  className="pe-9 bg-background text-xs"
                />
              </div>

              {selectedOrgUserIds.length > 0 && (
                <div className="flex items-center gap-2 animate-in fade-in">
                  <span className="text-xs font-semibold text-primary">
                    {faNumber(selectedOrgUserIds.length)} عضو انتخاب شد:
                  </span>
                  <Select
                    value={bulkRole}
                    onValueChange={(val: "admin" | "member" | "intern") => setBulkRole(val)}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">مهندس (Member)</SelectItem>
                      <SelectItem value="intern">کارآموز (Intern)</SelectItem>
                      <SelectItem value="admin">مدیر (Admin)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleBulkAddOrgMembers}
                    disabled={isProcessingOrgAction}
                    className="h-8 text-xs gap-1.5 shadow-sm"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {isProcessingOrgAction ? "در حال افزودن…" : "افزودن همزمان به پروژه"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedOrgUserIds([])}
                    className="h-8 text-xs text-muted-foreground"
                  >
                    لغو
                  </Button>
                </div>
              )}
            </div>

            {/* Org Members Cards Grid */}
            {orgMembers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-background/50 p-6 text-center text-xs text-muted-foreground space-y-2">
                <p>هنوز عضوی به عنوان زیرمجموعه در سازمان شما ثبت‌نام نکرده است.</p>
                <p>کد معرف یا لینک ثبت‌نام سازمان را برای همکاران بفرستید تا در سازمان عضو شوند.</p>
              </div>
            ) : unassignedOrgMembers.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center text-xs text-emerald-600 dark:text-emerald-400">
                ✓ تمام اعضای ثبت‌نام شده سازمان در حال حاضر به این پروژه دسترسی دارند یا عضوی با این جستجو یافت نشد.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {unassignedOrgMembers.map((om) => {
                  const isSelected = selectedOrgUserIds.includes(om.userId);
                  return (
                    <div
                      key={om.userId}
                      className={`relative flex items-center justify-between p-3 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary"
                          : "bg-background border-border/80 hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOrgUserIds((prev) => [...prev, om.userId]);
                            } else {
                              setSelectedOrgUserIds((prev) => prev.filter((id) => id !== om.userId));
                            }
                          }}
                          className="size-4 rounded border-border text-primary focus:ring-primary accent-[var(--primary)] cursor-pointer"
                        />
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {om.displayName.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs text-foreground truncate">
                            {om.displayName}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono truncate">
                            {om.email}
                          </div>
                          {om.githubLogin && (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5" dir="ltr">
                              <GithubIcon size={10} />
                              <span>@{om.githubLogin}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="ms-2 shrink-0">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleAddOrgMemberToProject(om, "member")}
                          disabled={isProcessingOrgAction}
                          className="h-7 text-[11px] px-2.5 gap-1 hover:bg-primary hover:text-white transition-colors"
                        >
                          <UserPlus className="w-3 h-3" />
                          افزودن
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SECTION 2: Filter and Search for Current Project Members */}
      <Card className="border-border/80 bg-card/60">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجو در اعضای فعال این پروژه…"
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
            نمایش {faNumber(filteredMembers.length)} از {faNumber(members.length)} عضو فعال
          </span>
        </CardContent>
      </Card>

      {/* SECTION 3: Active Project Members Table */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-medium">
                <th className="py-3 px-4 text-start">نام عضو</th>
                <th className="py-3 px-4 text-start">ایمیل</th>
                <th className="py-3 px-4 text-start">حساب GitHub</th>
                <th className="py-3 px-4 text-start">سطح دسترسی در پروژه</th>
                <th className="py-3 px-4 text-start">ایشوهای فعال</th>
                <th className="py-3 px-4 text-start">تاریخ عضویت</th>
                {isAdmin && <th className="py-3 px-4 text-center">عملیات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground space-y-2">
                    <Users className="w-8 h-8 text-muted-foreground/50 mx-auto" />
                    <p className="font-medium text-foreground">هنوز هیچ عضوی به این پروژه افزوده نشده است.</p>
                    <p className="text-xs text-muted-foreground">
                      {isAdmin
                        ? "از بخش بالای صفحه، اعضای سازمان را انتخاب و به پروژه متصل کنید."
                        : "تنها افراد دارای دسترسی مجاز به مشاهده تسک‌ها هستند."}
                    </p>
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
                            <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-0.5">
                              <UserCheck className="w-2.5 h-2.5" />
                              فعال در پروژه
                            </span>
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
                              handleRoleChange(m.id, val);
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
                              <DropdownMenuLabel>عملیات عضو</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => {
                                  const gh = prompt("نام کاربری جدید در GitHub:", m.githubLogin || "");
                                  if (gh !== null) {
                                    handleGithubChange(m.id, gh.trim());
                                  }
                                }}
                              >
                                ویرایش حساب GitHub
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleRemoveMember(m.id, m.displayName)}
                                className="text-destructive focus:text-destructive gap-1.5"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                                حذف از این پروژه
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

      {/* Invite Modal for external members */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4" dir="rtl">
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
              <form onSubmit={handleCreateCustomMember} className="space-y-4 text-xs sm:text-sm">
                {inviteError && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-xs text-red-500">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{inviteError}</span>
                  </div>
                )}

                {orgMembers.length > 0 && (
                  <div className="space-y-1.5 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                    <label className="font-semibold text-foreground flex items-center gap-1.5">
                      <UserPlus size={14} className="text-primary" />
                      انتخاب سریع از اعضای ثبت‌نام شده در سازمان:
                    </label>
                    <Select onValueChange={handleSelectOrgMemberForInvite}>
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
                    className="bg-background font-mono text-start"
                    dir="ltr"
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
                      className="bg-background pe-9 font-mono text-start"
                      dir="ltr"
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
