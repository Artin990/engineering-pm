"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleDot, Search, SortAsc } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  const [view, setView] = useState("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Issue | null>(null);

  // Mock loading state — data source is mocked for now
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setError(false);
    setIssues(null);
    const t = setTimeout(() => {
      // Simulated fetch — replaced by real query later
      setIssues([]);
    }, 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    <div className="flex flex-col gap-[16px] p-[20px]">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--text-primary)]">ایشوها</h1>
          <p className="mt-1 text-[14px] text-[var(--text-muted)]">
            مدیریت و پیگیری ایشوهای پروژه
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <CircleDot size={16} />
          ساخت ایشو
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-[12px]">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute end-[12px] top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جست‌وجو… (Ctrl+K یا /)"
            className="pe-9"
            dir="rtl"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]">
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
          <SelectTrigger className="w-[170px]">
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
            <Button variant="outline">
              <SortAsc size={16} />
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
        <TabsList>
          <TabsTrigger value="list">لیست</TabsTrigger>
          <TabsTrigger value="board">بورد</TabsTrigger>
        </TabsList>
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
        <TabsContent value="board" className="mt-[16px]">
          {issues === null ? (
            <div className="flex gap-[12px]">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[300px] w-[280px] rounded-[10px]" />
              ))}
            </div>
          ) : (
            <IssuesBoard issues={sorted} onIssueClick={setSelected} />
          )}
        </TabsContent>
      </Tabs>

      {/* Result count */}
      {issues !== null && (
        <p className="text-[14px] text-[var(--text-muted)]">
          {filtered.length === 0
            ? "نتیجه‌ای یافت نشد"
            : `${sorted.length.toLocaleString("fa-IR")} ایشو`}
        </p>
      )}

      <IssueDetailPanel issue={selected} onClose={() => setSelected(null)} />

      {/* Create dialog — placeholder (Wave 2+) */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="w-[400px] rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-[20px]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[16px] font-bold text-[var(--text-primary)]">
              ساخت ایشو
            </h2>
            <p className="mt-2 text-[14px] text-[var(--text-muted)]">
              فرم ساخت ایشو در موج بعدی اضافه می‌شود.
            </p>
            <div className="mt-[16px] flex justify-end">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                بستن
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
