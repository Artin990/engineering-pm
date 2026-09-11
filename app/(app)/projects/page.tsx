"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CircleDot,
  GitBranch,
  GitPullRequest,
  Plus,
  Search,
  X,
  Layers,
  AlertCircle,
  Calendar,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProgressRing } from "@/components/features/dashboard/progress-ring";
import {
  PROJECT_HEALTH_LABEL,
  PROJECT_STATUS_LABEL,
  type Project,
  type ProjectStatus,
} from "@/components/features/types";
import { faNumber, faDate } from "@/lib/format";
import { useUserRole } from "@/lib/role-context";

interface ApiProjectItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status?: Project["status"];
  health?: Project["health"];
  targetDate?: string | null;
}

export default function ProjectsPage() {
  const { isAdmin } = useUserRole();
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  // New project form state
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [teamName, setTeamName] = useState("تیم مهندسی");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchProjects = async () => {
    setLoading(true);

    // 1. First load from localStorage for instant offline/persisted data
    let localProjects: Project[] = [];
    try {
      const saved = localStorage.getItem("flowdeck_projects_list");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localProjects = parsed;
          setProjectsList(parsed);
        }
      }
    } catch {
      // ignore
    }

    // 2. Fetch from API to sync with DB
    try {
      const res = await fetch("/api/v1/projects");
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          const mapped: Project[] = json.data.map((p: ApiProjectItem) => ({
            id: p.id,
            key: p.key,
            name: p.name,
            description: p.description,
            status: p.status || "active",
            health: p.health || "on_track",
            targetDate: p.targetDate ? String(p.targetDate).split("T")[0] : null,
            owner: null,
            teamName: "تیم مهندسی",
            progress: 0,
            counts: {
              todo: 0,
              inProgress: 0,
              inReview: 0,
              blocked: 0,
              done: 0,
              backlog: 0,
              cancelled: 0,
            },
            openPrs: 0,
            mergedPrs: 0,
          }));

          // Merge without duplicate keys
          const merged = [...mapped];
          for (const lp of localProjects) {
            if (!merged.some((m) => m.key === lp.key)) {
              merged.push(lp);
            }
          }
          setProjectsList(merged);
          try {
            localStorage.setItem("flowdeck_projects_list", JSON.stringify(merged));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // Fallback to local
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    return projectsList.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.key.toLowerCase().includes(search.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase()));

      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [projectsList, search, statusFilter]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) {
      setError("نام و کلید پروژه الزامی است.");
      return;
    }

    const cleanKey = key.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!cleanKey) {
      setError("کلید پروژه باید حداقل یک کاراکتر لاتین یا عدد باشد.");
      return;
    }

    if (projectsList.some((p) => p.key === cleanKey)) {
      setError("پروژه‌ای با این کلید قبلاً وجود دارد.");
      return;
    }

    setSaving(true);
    setError("");

    const newProject: Project = {
      id: `p-${Date.now()}`,
      key: cleanKey,
      name: name.trim(),
      description: description.trim() || null,
      status: "active",
      health: "on_track",
      targetDate: targetDate || null,
      owner: null,
      teamName: teamName.trim() || "تیم مهندسی",
      progress: 0,
      counts: {
        todo: 0,
        inProgress: 0,
        inReview: 0,
        blocked: 0,
        done: 0,
        backlog: 0,
        cancelled: 0,
      },
      openPrs: 0,
      mergedPrs: 0,
    };

    // 1. Immediately persist to localStorage and React state
    const updatedList = [newProject, ...projectsList];
    setProjectsList(updatedList);
    try {
      localStorage.setItem("flowdeck_projects_list", JSON.stringify(updatedList));
      localStorage.setItem(
        `flowdeck_project_store_${cleanKey}`,
        JSON.stringify({
          project: newProject,
          issues: [],
          cycles: [],
          milestones: [],
          members: [
            { id: "artin-1", displayName: "آرتین امیری", githubLogin: "artin-amiri", email: "artinamiri185@gmail.com", role: "admin", status: "active", joinedAt: "امروز" },
            { id: "sara-1", displayName: "سارا احمدی", githubLogin: "sara-ahmadi", email: "sara.ahmadi@flowdeck.dev", role: "member", status: "active", joinedAt: "امروز" },
          ],
        })
      );
    } catch {
      // ignore
    }

    // 2. Direct sync with Supabase PostgreSQL Database via API
    try {
      const res = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          key: cleanKey,
          description: description.trim() || undefined,
          targetDate: targetDate || undefined,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data?.id) {
          const persistedProject = { ...newProject, id: json.data.id };
          setProjectsList((prev) =>
            prev.map((p) => (p.key === cleanKey ? persistedProject : p))
          );
          try {
            const listSaved = localStorage.getItem("flowdeck_projects_list");
            if (listSaved) {
              const list: Project[] = JSON.parse(listSaved);
              const updated = list.map((p) => (p.key === cleanKey ? persistedProject : p));
              localStorage.setItem("flowdeck_projects_list", JSON.stringify(updated));
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // Offline or network error - already stored locally
    }

    setName("");
    setKey("");
    setDescription("");
    setTargetDate("");
    setError("");
    setSaving(false);
    setCreateOpen(false);
  };

  return (
    <section aria-label="پروژه‌ها" className="p-[24px] space-y-[24px] max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-[16px]">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--text-primary)]">
            پروژه‌های ورک‌اسپیس
          </h1>
          <p className="text-[14px] text-[var(--text-muted)] mt-1">
            {faNumber(projectsList.length)} پروژه فعال در سازمان
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-[10px]">
          <div className="relative">
            <Search className="absolute end-[12px] top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی نام یا کلید پروژه…"
              className="w-[240px] pe-[36px] bg-[var(--surface)]"
              aria-label="جستجوی پروژه"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-[var(--surface)]">
              <SelectValue placeholder="وضعیت" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((st) => (
                <SelectItem key={st} value={st}>
                  {PROJECT_STATUS_LABEL[st]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5 shadow-sm">
              <Plus className="size-4" />
              پروژه جدید
            </Button>
          )}
        </div>
      </header>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-5 animate-pulse" />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-[48px] text-center">
          <Layers className="size-12 text-[var(--text-muted)] mb-3" />
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
            پروژه‌ای با این مشخصات یافت نشد
          </h3>
          <p className="text-[13px] text-[var(--text-muted)] mt-1 max-w-sm">
            می‌توانید فیلتر جستجو را پاک کنید {isAdmin ? "یا پروژه جدیدی بسازید." : "یا منتظر ایجاد پروژه توسط مدیر باشید."}
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); }}>
              پاک کردن فیلترها
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                ساخت پروژه جدید
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.key}`}
              className="group rounded-[10px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] hover:-translate-y-1 hover:shadow-md"
            >
              <Card className="h-full border-[var(--border)] bg-[var(--surface)] group-hover:border-[var(--primary)] transition-colors">
                <CardHeader className="pb-[12px]">
                  <div className="flex items-start justify-between gap-[12px]">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="flex items-center gap-[8px] text-[16px]">
                        <span className="rounded-[6px] bg-[var(--primary)] px-[7px] py-[2px] text-[11px] font-mono font-bold text-white uppercase">
                          {project.key}
                        </span>
                        <span className="truncate">{project.name}</span>
                      </CardTitle>
                      <CardDescription className="mt-[6px] line-clamp-2 text-[13px]">
                        {project.description || "بدون توضیحات ثبت‌شده"}
                      </CardDescription>
                    </div>
                    <ProgressRing value={project.progress} size={54} strokeWidth={5} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-[12px]">
                  <div className="flex flex-wrap items-center gap-[6px]">
                    <Badge variant="secondary" className="text-[11px]">
                      {PROJECT_STATUS_LABEL[project.status]}
                    </Badge>
                    <Badge
                      variant={
                        project.health === "on_track"
                          ? "success"
                          : project.health === "at_risk"
                            ? "warning"
                            : "destructive"
                      }
                      className="text-[11px]"
                    >
                      {PROJECT_HEALTH_LABEL[project.health]}
                    </Badge>
                    {project.counts.blocked > 0 && (
                      <Badge variant="destructive" className="text-[11px]">
                        {faNumber(project.counts.blocked)} بلاک
                      </Badge>
                    )}
                    {project.targetDate && (
                      <Badge variant="outline" className="text-[11px] gap-1 border-[var(--border)] text-[var(--text-muted)]">
                        <Calendar className="size-3 text-[var(--primary)]" />
                        {faDate(project.targetDate)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-[var(--border)] pt-[12px] text-[12px] text-[var(--text-muted)]">
                    <span className="flex items-center gap-[4px]">
                      <CircleDot className="size-3.5 text-blue-500" />
                      {faNumber(project.counts.inProgress)} در حال انجام
                    </span>
                    <span className="flex items-center gap-[4px]">
                      <GitPullRequest className="size-3.5 text-purple-500" />
                      {faNumber(project.openPrs)} PR باز
                    </span>
                    <span className="flex items-center gap-[4px] truncate max-w-[100px]">
                      <GitBranch className="size-3.5 text-emerald-500" />
                      {project.teamName || "تیم مهندسی"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* New Project Dialog */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="w-full max-w-[500px] rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-[24px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h2 className="text-[17px] font-bold text-[var(--text-primary)]">
                ایجاد پروژه جدید
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-[8px] p-1 text-[var(--text-muted)] hover:bg-[var(--surface-raised)]"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-[8px] bg-red-500/10 border border-red-500/20 p-2.5 text-[13px] text-red-500">
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            <form onSubmit={handleCreateProject} className="mt-4 space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  نام پروژه <span className="text-red-500">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (error) setError(""); }}
                  placeholder="مثال: بازطراحی سامانه پرداخت"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                    کلید پروژه (لاتین) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={key}
                    onChange={(e) => { setKey(e.target.value); if (error) setError(""); }}
                    placeholder="مثال: PAY"
                    className="font-mono uppercase text-start"
                    maxLength={6}
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                    نام تیم
                  </label>
                  <Input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="تیم مهندسی"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  توضیحات
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="شرح مختصری از اهداف و دستاوردهای پروژه..."
                  className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--background)] p-2.5 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[13px] font-medium text-[var(--text-primary)]">
                    تاریخ هدف (سررسید پروژه)
                  </label>
                  {targetDate && (
                    <span className="text-[12px] font-medium text-[var(--primary)]">
                      تقویم شمسی: {faDate(targetDate)}
                    </span>
                  )}
                </div>
                <Input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="bg-[var(--background)]"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  انصراف
                </Button>
                <Button type="submit" disabled={saving} className="gap-1.5">
                  <Plus size={16} />
                  {saving ? "در حال ایجاد…" : "ایجاد پروژه"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

