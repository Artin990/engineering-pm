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
import { GithubIcon } from "@/components/ui/github-icon";
import { useUserRole } from "@/lib/role-context";
import { useProjectStore } from "@/lib/project-store";
import { type Member } from "@/components/features/types";
import { faNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { getOrganizationMembersAction } from "@/app/actions/organization";

interface OrgMemberItem {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  githubLogin?: string | null;
  isAssignedToProject?: boolean;
  projectRole?: "lead" | "contributor" | "viewer" | "admin" | "member" | "intern";
}

export default function MembersPage() {
  const params = useParams<{ key: string }>();
  const projectKey = (params?.key || "PM").toUpperCase();

  const { isAdmin } = useUserRole();
  const { addMember, updateMember, deleteMember } = useProjectStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "assigned" | "unassigned">("all");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // Organization members state
  const [orgMembers, setOrgMembers] = useState<OrgMemberItem[]>([]);
  const [selectedOrgUserIds, setSelectedOrgUserIds] = useState<string[]>([]);
  const [bulkRole, setBulkRole] = useState<"admin" | "member" | "intern">("member");
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");

  // Single invite form state
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

  // Comprehensive loading from all available database sources + localStorage
  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setRefreshing(true);

    const accumulatedMembers = new Map<string, OrgMemberItem>();
    const assignedIds = new Set<string>();
    const assignedEmails = new Set<string>();
    const assignedRolesMap = new Map<string, "lead" | "contributor" | "viewer" | "admin" | "member" | "intern">();

    // 1. Fetch from Project Members API Route (gets DB project members and org members)
    try {
      const res = await fetch(`/api/v1/projects/${projectKey}/members`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.projectMembers)) {
          json.projectMembers.forEach((pm: {
            id: string;
            userId?: string;
            displayName: string;
            email: string;
            githubLogin: string | null;
            role: "lead" | "contributor" | "viewer" | "admin" | "member" | "intern";
          }) => {
            const uId = pm.userId || pm.id;
            if (uId) assignedIds.add(uId);
            if (pm.email) assignedEmails.add(pm.email.toLowerCase().trim());
            if (uId) assignedRolesMap.set(uId, pm.role);
          });
        }

        if (Array.isArray(json.orgMembers)) {
          json.orgMembers.forEach((om: OrgMemberItem) => {
            const uId = om.userId || om.id;
            if (uId) {
              const isAssigned =
                assignedIds.has(uId) ||
                (om.email ? assignedEmails.has(om.email.toLowerCase().trim()) : false) ||
                Boolean(om.isAssignedToProject);

              accumulatedMembers.set(uId, {
                id: uId,
                userId: uId,
                displayName: om.displayName || om.email?.split("@")[0] || "کاربر سازمان",
                email: om.email || "",
                avatarUrl: om.avatarUrl,
                githubLogin: om.githubLogin,
                isAssignedToProject: isAssigned,
                projectRole: assignedRolesMap.get(uId) || om.projectRole || "member",
              });
            }
          });
        }
      }
    } catch (err) {
      console.warn("[loadData] project members route err:", err);
    }

    // 2. Fetch from direct Server Action to PostgreSQL Database
    try {
      const actionRes = await getOrganizationMembersAction();
      if (actionRes.ok && Array.isArray(actionRes.data) && actionRes.data.length > 0) {
        actionRes.data.forEach((p: { id: string; displayName?: string; email?: string | null; githubLogin?: string | null; avatarUrl?: string | null }) => {
          if (p && p.id) {
            const existing = accumulatedMembers.get(p.id);
            accumulatedMembers.set(p.id, {
              id: p.id,
              userId: p.id,
              displayName: p.displayName || p.email?.split("@")[0] || "کاربر سازمان",
              email: p.email || "",
              avatarUrl: p.avatarUrl || existing?.avatarUrl || null,
              githubLogin: p.githubLogin || existing?.githubLogin || null,
              isAssignedToProject: assignedIds.has(p.id) || existing?.isAssignedToProject || false,
              projectRole: assignedRolesMap.get(p.id) || existing?.projectRole || "member",
            });
          }
        });
      }
    } catch (err) {
      console.warn("[loadData] getOrganizationMembersAction err:", err);
    }

    // 3. Fallback to /api/v1/members if needed
    try {
      const memRes = await fetch("/api/v1/members");
      if (memRes.ok) {
        const memJson = await memRes.json();
        if (Array.isArray(memJson.data)) {
          memJson.data.forEach((p: { id: string; displayName?: string; email?: string | null; githubLogin?: string | null; avatarUrl?: string | null }) => {
            if (p && p.id) {
              const existing = accumulatedMembers.get(p.id);
              accumulatedMembers.set(p.id, {
                id: p.id,
                userId: p.id,
                displayName: p.displayName || p.email?.split("@")[0] || "کاربر سازمان",
                email: p.email || "",
                avatarUrl: p.avatarUrl || existing?.avatarUrl || null,
                githubLogin: p.githubLogin || existing?.githubLogin || null,
                isAssignedToProject: assignedIds.has(p.id) || existing?.isAssignedToProject || false,
                projectRole: assignedRolesMap.get(p.id) || existing?.projectRole || "member",
              });
            }
          });
        }
      }
    } catch (err) {
      console.warn("[loadData] /api/v1/members err:", err);
    }

    // 4. Instant cache fallback from localStorage flowdeck_org_members
    try {
      const saved = localStorage.getItem("flowdeck_org_members");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach((m: { id: string; displayName?: string; email?: string; githubLogin?: string | null; avatarUrl?: string | null }) => {
            if (m && m.id && !accumulatedMembers.has(m.id)) {
              accumulatedMembers.set(m.id, {
                id: m.id,
                userId: m.id,
                displayName: m.displayName || m.email?.split("@")[0] || "کاربر سازمان",
                email: m.email || "",
                avatarUrl: m.avatarUrl || null,
                githubLogin: m.githubLogin || null,
                isAssignedToProject: assignedIds.has(m.id) || false,
                projectRole: assignedRolesMap.get(m.id) || "member",
              });
            }
          });
        }
      }
    } catch {
      // ignore
    }

    const finalList = Array.from(accumulatedMembers.values());
    if (finalList.length > 0) {
      setOrgMembers(finalList);
      try {
        localStorage.setItem("flowdeck_org_members", JSON.stringify(finalList));
      } catch {
        // ignore
      }
    }

    setLoading(false);
    setRefreshing(false);
  }, [projectKey]);

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => loadData(false), 4000);

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
      clearInterval(interval);
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

  // Handle adding member from Organization list with Instant Optimistic UI
  const handleAddOrgMemberToProject = async (orgMember: OrgMemberItem, customRole: "admin" | "member" | "intern" = "member") => {
    const targetUserId = orgMember.userId || orgMember.id;
    if (!targetUserId) return;

    // 1. Instant Optimistic UI Update (Immediate visual feedback)
    setOrgMembers((prev) =>
      prev.map((om) =>
        om.userId === targetUserId ||
        om.id === targetUserId ||
        (om.email && orgMember.email && om.email.toLowerCase().trim() === orgMember.email.toLowerCase().trim())
          ? { ...om, isAssignedToProject: true, projectRole: customRole }
          : om
      )
    );

    addMember({
      id: targetUserId,
      displayName: orgMember.displayName,
      email: orgMember.email,
      githubLogin: orgMember.githubLogin || null,
      role: customRole,
      status: "active",
      joinedAt: "امروز",
    });

    setActionSuccessMsg(`عضو «${orgMember.displayName}» با موفقیت به این پروژه اضافه شد و دسترسی او فعال گردید.`);
    setTimeout(() => setActionSuccessMsg(""), 3500);

    // 2. Background Server Sync
    try {
      await fetch(`/api/v1/projects/${projectKey}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUserId,
          id: targetUserId,
          displayName: orgMember.displayName,
          email: orgMember.email,
          githubLogin: orgMember.githubLogin || undefined,
          role: customRole === "admin" ? "lead" : customRole === "intern" ? "viewer" : "contributor",
        }),
      });
    } catch (err) {
      console.warn("[handleAddOrgMemberToProject err]:", err);
    }
  };

  // Handle bulk add of selected organization members with Instant Optimistic UI
  const handleBulkAddOrgMembers = async () => {
    if (selectedOrgUserIds.length === 0) return;
    const targetIds = [...selectedOrgUserIds];
    setSelectedOrgUserIds([]);

    // 1. Instant Optimistic UI Update
    setOrgMembers((prev) =>
      prev.map((om) =>
        targetIds.includes(om.userId) || targetIds.includes(om.id)
          ? { ...om, isAssignedToProject: true, projectRole: bulkRole }
          : om
      )
    );

    targetIds.forEach((uId) => {
      const found = orgMembers.find((om) => om.userId === uId || om.id === uId);
      if (found) {
        addMember({
          id: uId,
          displayName: found.displayName,
          email: found.email,
          githubLogin: found.githubLogin || null,
          role: bulkRole,
          status: "active",
          joinedAt: "امروز",
        });
      }
    });

    setActionSuccessMsg(`${faNumber(targetIds.length)} عضو با موفقیت به این پروژه افزوده شدند.`);
    setTimeout(() => setActionSuccessMsg(""), 3500);

    // 2. Background Server Sync
    try {
      await fetch(`/api/v1/projects/${projectKey}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: targetIds,
          role: bulkRole === "admin" ? "lead" : bulkRole === "intern" ? "viewer" : "contributor",
        }),
      });
    } catch (err) {
      console.warn("[handleBulkAddOrgMembers err]:", err);
    }
  };

  // Handle member removal with Instant Optimistic UI
  const handleRemoveMember = async (memberId: string, displayName: string) => {
    if (!confirm(`آیا از حذف «${displayName}» از این پروژه مطمئن هستید؟ دسترسی او به این پروژه قطع خواهد شد.`)) {
      return;
    }

    // 1. Instant Optimistic UI Update
    setOrgMembers((prev) =>
      prev.map((om) =>
        om.userId === memberId || om.id === memberId ? { ...om, isAssignedToProject: false } : om
      )
    );
    deleteMember(memberId);
    setActionSuccessMsg(`عضو «${displayName}» از این پروژه خارج شد.`);
    setTimeout(() => setActionSuccessMsg(""), 3000);

    // 2. Background Server Sync
    try {
      await fetch(`/api/v1/projects/${projectKey}/members?userId=${encodeURIComponent(memberId)}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.warn("[handleRemoveMember err]:", err);
    }
  };

  // Handle role update
  const handleRoleChange = async (memberId: string, newRole: "admin" | "member" | "intern") => {
    updateMember(memberId, { role: newRole });
    setOrgMembers((prev) =>
      prev.map((om) =>
        om.userId === memberId || om.id === memberId ? { ...om, projectRole: newRole } : om
      )
    );
    try {
      await fetch(`/api/v1/projects/${projectKey}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: memberId,
          role: newRole,
        }),
      });
    } catch (err) {
      console.warn("[handleRoleChange err]:", err);
    }
  };

  // Handle new custom external member invitation
  const handleCreateCustomMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteError("نام و ایمیل عضو الزامی است.");
      return;
    }

    setInviteError("");
    const memberId = `mem-${Date.now()}`;

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
          displayName: inviteName.trim(),
          email: inviteEmail.trim(),
          githubLogin: inviteGithub.trim() || undefined,
          role: inviteRole,
        }),
      });

      if (res.ok) {
        addMember(newMem);
        setInviteSuccessMsg(`عضو «${inviteName}» با موفقیت افزوده شد.`);
        setInviteName("");
        setInviteEmail("");
        setInviteGithub("");
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

  // Filter organization members with search and active tabs
  const filteredOrgMembers = useMemo(() => {
    return orgMembers.filter((om) => {
      const matchSearch =
        om.displayName.toLowerCase().includes(search.toLowerCase()) ||
        (om.email && om.email.toLowerCase().includes(search.toLowerCase())) ||
        (om.githubLogin && om.githubLogin.toLowerCase().includes(search.toLowerCase()));

      if (!matchSearch) return false;

      if (filterTab === "assigned") return om.isAssignedToProject;
      if (filterTab === "unassigned") return !om.isAssignedToProject;
      return true;
    });
  }, [orgMembers, search, filterTab]);

  const assignedCount = useMemo(() => orgMembers.filter((m) => m.isAssignedToProject).length, [orgMembers]);
  const unassignedCount = useMemo(() => orgMembers.filter((m) => !m.isAssignedToProject).length, [orgMembers]);

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
            مشاهده، انتخاب و انتساب اعضای سازمان به پروژه {projectKey} جهت دسترسی به تسک‌ها و کارت پروژه
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
            بروزرسانی لیست
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
              دعوت عضو با ایمیل
            </Button>
          )}
        </div>
      </div>

      {/* Global Success Notification */}
      {actionSuccessMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
          <span className="font-medium">{actionSuccessMsg}</span>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">کل افراد ثبت‌نام شده در سازمان</span>
              <div className="text-2xl font-bold">{faNumber(orgMembers.length)}</div>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Building2 className="w-3 h-3 text-primary" />
                حساب‌های کاربری فعال در زیرمجموعه
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
              <span className="text-xs font-medium text-muted-foreground">عضو در پروژه {projectKey}</span>
              <div className="text-2xl font-bold text-emerald-500">{faNumber(assignedCount)}</div>
              <span className="text-[11px] text-emerald-500 flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                کارت پروژه برای این افراد فعال است
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <UserCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">آماده برای انتساب و افزودن</span>
              <div className="text-2xl font-bold text-amber-500">{faNumber(unassignedCount)}</div>
              <span className="text-[11px] text-amber-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                قابل افزودن با یک کلیک
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <UserPlus className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Unified Assignment & Members Panel */}
      <Card className="border-border/80 bg-card shadow-sm">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base text-foreground">
                <Building2 className="w-5 h-5 text-primary" />
                انتخاب و انتساب اعضای سازمان به این پروژه
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                از لیست زیر می‌توانید اعضای سازمان را انتخاب کنید تا به پروژه اضافه شوند یا اعضای فعلی را مدیریت نمایید.
              </CardDescription>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/60 text-xs">
              <button
                type="button"
                onClick={() => setFilterTab("all")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  filterTab === "all"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                همه اعضا ({faNumber(orgMembers.length)})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("assigned")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  filterTab === "assigned"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                عضو در پروژه ({faNumber(assignedCount)})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("unassigned")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  filterTab === "unassigned"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                خارج از پروژه ({faNumber(unassignedCount)})
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Search Bar & Multi-Select Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[260px] max-w-md">
              <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجوی نام، ایمیل یا یوزرنیم گیت‌هاب اعضا…"
                className="pe-9 bg-background"
              />
            </div>

            {isAdmin && selectedOrgUserIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 animate-in fade-in p-1.5 bg-primary/10 border border-primary/30 rounded-xl">
                <span className="text-xs font-semibold text-primary px-2">
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
                  className="h-8 text-xs gap-1.5 shadow-sm"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  افزودن همزمان به پروژه
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

          {/* Members List Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-xl border border-border bg-muted/20 animate-pulse p-4" />
              ))}
            </div>
          ) : filteredOrgMembers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background/50 p-8 text-center text-xs text-muted-foreground space-y-2">
              <Users className="w-8 h-8 text-muted-foreground/50 mx-auto" />
              <p className="font-semibold text-foreground">عضوی با این مشخصات یافت نشد.</p>
              <p>می‌توانید فیلتر جستجو را پاک کنید یا از دکمه «دعوت عضو با ایمیل» استفاده فرمایید.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredOrgMembers.map((om) => {
                const isSelected = selectedOrgUserIds.includes(om.userId);
                const isAssigned = om.isAssignedToProject;
                const currentRole: "admin" | "member" | "intern" =
                  om.projectRole === "lead" || om.projectRole === "admin"
                    ? "admin"
                    : om.projectRole === "viewer" || om.projectRole === "intern"
                    ? "intern"
                    : "member";

                return (
                  <div
                    key={om.userId}
                    className={`relative flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                      isAssigned
                        ? "bg-emerald-500/[0.03] border-emerald-500/30 hover:border-emerald-500/60"
                        : isSelected
                        ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary"
                        : "bg-background border-border/80 hover:border-primary/50"
                    }`}
                  >
                    {/* Checkbox and Profile Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {isAdmin && !isAssigned && (
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
                      )}

                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs ${
                          isAssigned
                            ? currentRole === "admin"
                              ? "bg-amber-600"
                              : currentRole === "intern"
                              ? "bg-purple-600"
                              : "bg-emerald-600"
                            : "bg-muted-foreground/60 text-foreground"
                        }`}
                      >
                        {om.displayName.charAt(0)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-foreground truncate">
                            {om.displayName}
                          </span>
                          {isAssigned ? (
                            <Badge variant="outline" className="text-[10px] py-0 h-4 px-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-medium">
                              عضو پروژه
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] py-0 h-4 px-1.5 text-muted-foreground">
                              خارج از پروژه
                            </Badge>
                          )}
                        </div>

                        <div className="text-[11px] text-muted-foreground font-mono truncate mt-0.5" dir="ltr">
                          {om.email}
                        </div>

                        {om.githubLogin && (
                          <a
                            href={`https://github.com/${om.githubLogin}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground font-mono mt-0.5"
                            dir="ltr"
                          >
                            <GithubIcon size={10} />
                            <span>@{om.githubLogin}</span>
                            <ExternalLink size={9} />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Actions and Role Control */}
                    <div className="flex items-center gap-2 ms-3 shrink-0">
                      {isAssigned ? (
                        <>
                          {isAdmin ? (
                            <Select
                              value={currentRole}
                              onValueChange={(val: "admin" | "member" | "intern") => {
                                handleRoleChange(om.userId, val);
                              }}
                            >
                              <SelectTrigger className="w-28 h-7 text-[11px] bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">
                                  <span className="text-amber-500 font-medium flex items-center gap-1">
                                    <Shield size={11} />
                                    مدیر (Admin)
                                  </span>
                                </SelectItem>
                                <SelectItem value="member">
                                  <span className="text-blue-500 font-medium flex items-center gap-1">
                                    <User size={11} />
                                    مهندس (Member)
                                  </span>
                                </SelectItem>
                                <SelectItem value="intern">
                                  <span className="text-purple-500 font-medium flex items-center gap-1">
                                    <GraduationCap size={11} />
                                    کارآموز (Intern)
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-[11px] text-muted-foreground font-medium">
                              {currentRole === "admin" ? "مدیر" : currentRole === "intern" ? "کارآموز" : "مهندس"}
                            </span>
                          )}

                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveMember(om.userId, om.displayName)}
                              className="h-7 px-2 text-[11px] text-red-500 hover:text-red-600 hover:bg-red-500/10 gap-1"
                              title="حذف دسترسی از این پروژه"
                            >
                              <UserMinus size={13} />
                              حذف
                            </Button>
                          )}
                        </>
                      ) : (
                        isAdmin && (
                          <Button
                            size="sm"
                            onClick={() => handleAddOrgMemberToProject(om, "member")}
                            className="h-7 text-[11px] px-3 gap-1 shadow-xs bg-primary text-white hover:bg-primary/90 cursor-pointer"
                          >
                            <UserPlus size={13} />
                            افزودن به پروژه +
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal for external users */}
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
                  <label className="font-semibold text-foreground">ایمیل کاری یا سازمانی</label>
                  <Input
                    required
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="pouria@company.com"
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
                      placeholder="octocat"
                      className="bg-background pe-9 font-mono text-start"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">نقش در پروژه</label>
                  <Select
                    value={inviteRole}
                    onValueChange={(val: "admin" | "member" | "intern") => setInviteRole(val)}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">مهندس / توسعه‌دهنده (Member)</SelectItem>
                      <SelectItem value="intern">کارآموز (Intern)</SelectItem>
                      <SelectItem value="admin">مدیر پروژه (Admin)</SelectItem>
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
                    افزودن و ارسال دعوت
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
