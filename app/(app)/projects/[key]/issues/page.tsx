"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Search, SortAsc } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { faNumber } from "@/lib/format";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_STATUS_LABEL,
  type Issue,
  type IssuePriority,
  type IssueStatus,
} from "@/components/features/types";
import { IssuesTable } from "@/components/features/issues/issues-table";
import { IssuesBoard } from "@/components/features/issues/issues-board";
import { IssueDetailPanel } from "@/components/features/issues/issue-detail-panel";
import { CreateIssueDialog } from "@/components/features/issues/create-issue-dialog";
import {
  getIssuesByProject,
  issues as defaultIssues,
} from "@/components/features/__fixtures__/mock-data";

type SortField = "updatedAt" | "priority" | "estimate" | "dueDate";

const SORT_LABELS: Record<SortField, string> = {
  updatedAt: "آخرین به‌روزرسانی",
  priority: "اولویت",
  estimate: "تخمین",
  dueDate: "سررسید",
};

const PRIORITY_ORDER: IssuePriority[] = ["urgent", "high", "medium", "low", "none"];

const ALL_STATUSES: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
];

export default function IssuesPage() {
  const params = useParams<{ key: string }>();
  const projectKey = (params?.key || "PM").toUpperCase();

  const [view, setView] = useState("board");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Issue | null>(null);

  // Issues state initialized with project issues
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setError(false);
    setIssues(null);
    const t = setTimeout(() => {
      const projectScoped = getIssuesByProject(projectKey);
      setIssues(projectScoped.length > 0 ? projectScoped : defaultIssues);
    }, 250);
    return () => clearTimeout(t);
  }, [projectKey]);

  useEffect(() => {
    load();
  }, [load]);

  // Handle Drag & Drop move
  const handleIssueMove = (issueId: string, newStatus: IssueStatus) => {
    setIssues((prev) => {
      if (!prev) return prev;
      return prev.map((i) =>
        i.id === issueId ? { ...i, status: newStatus, updatedAt: new Date().toISOString() } : i
      );
    });
    if (selected && selected.id === issueId) {
      setSelected((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  // Handle creating a new issue
  const handleCreateIssue = (newIssue: Issue) => {
    setIssues((prev) => [newIssue, ...(prev || [])]);
  };

  // Handle updating an existing issue
  const handleUpdateIssue = (updated: Issue) => {
    setIssues((prev) => {
      if (!prev) return prev;
      return prev.map((i) => (i.id === updated.id ? updated : i));
    });
    setSelected(updated);
  };

  // Handle deleting an issue
  const handleDeleteIssue = (issueId: string) => {
    setIssues((prev) => {
      if (!prev) return prev;
      return prev.filter((i) => i.id !== issueId);
    });
    if (selected?.id === issueId) {
      setSelected(null);
    }
  };

  // Keyboard shortcuts: `c` create, `/` or Ctrl+K focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        setCreateOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!issues) return [];
    let out = issues;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (i) => i.title.toLowerCase().includes(q) || i.key.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all")
      out = out.filter((i) => i.status === (statusFilter as IssueStatus));
    if (priorityFilter !== "all")
      out = out.filter((i) => i.priority === (priorityFilter as IssuePriority));
    return out;
  }, [issues, search, statusFilter, priorityFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sortField) {
        case "priority":
          return (
            PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
          );
        case "estimate":
          return b.estimate - a.estimate;
        case "dueDate": {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        }
        default:
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    });
    return arr;
  }, [filtered, sortField]);

  return (
    <div className="flex flex-col gap-[16px] p-[20px] max-w-full">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--text-primary)]">
            مدیریت ایشوها — {projectKey}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            بورد کانبان، نمای جدولی، فیلترها و بررسی تسک‌ها
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5 shadow-sm">
          <Plus size={16} />
          ساخت ایشو جدید
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-[10px] rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute end-[12px] top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جست‌وجو در عنوان یا کلید ایشو… (Ctrl+K)"
            className="pe-9 bg-[var(--background)]"
            dir="rtl"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-[var(--background)]">
            <SelectValue placeholder="وضعیت" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه وضعیت‌ها</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ISSUE_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[150px] bg-[var(--background)]">
            <SelectValue placeholder="اولویت" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه اولویت‌ها</SelectItem>
            {PRIORITY_ORDER.map((p) => (
              <SelectItem key={p} value={p}>
                {ISSUE_PRIORITY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="bg-[var(--background)] gap-1.5">
              <SortAsc size={15} />
              مرتب‌سازی: {SORT_LABELS[sortField]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>مرتب‌سازی بر اساس</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(SORT_LABELS) as SortField[]).map((f) => (
              <DropdownMenuItem
                key={f}
                onClick={() => setSortField(f)}
                className={cn(sortField === f && "bg-[var(--surface)] font-semibold")}
              >
                {SORT_LABELS[f]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* List / Board toggle */}
      <Tabs value={view} onValueChange={setView}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="board">بورد کانبان</TabsTrigger>
            <TabsTrigger value="list">لیست جدولی</TabsTrigger>
          </TabsList>
          {issues !== null && (
            <span className="text-[13px] text-[var(--text-muted)] font-medium">
              {filtered.length === 0
                ? "نتیجه‌ای یافت نشد"
                : `${faNumber(sorted.length)} ایشو یافت شد`}
            </span>
          )}
        </div>

        <TabsContent value="board" className="mt-[16px]">
          {issues === null ? (
            <div className="flex gap-[12px] overflow-x-auto pb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[360px] w-[280px] rounded-[10px] shrink-0" />
              ))}
            </div>
          ) : (
            <IssuesBoard
              issues={sorted}
              onIssueMove={handleIssueMove}
              onIssueClick={setSelected}
            />
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-[16px]">
          <IssuesTable
            issues={sorted}
            loading={issues === null}
            error={error}
            onRetry={load}
            onRowClick={setSelected}
            onCreate={() => setCreateOpen(true)}
          />
        </TabsContent>
      </Tabs>

      {/* Issue Detail Panel */}
      <IssueDetailPanel
        issue={selected}
        onClose={() => setSelected(null)}
        onUpdateIssue={handleUpdateIssue}
        onDeleteIssue={handleDeleteIssue}
      />

      {/* Create Issue Dialog */}
      <CreateIssueDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectKey={projectKey}
        onCreate={handleCreateIssue}
      />
    </div>
  );
}

