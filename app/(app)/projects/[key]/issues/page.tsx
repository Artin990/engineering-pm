"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Search, SortAsc, UserCheck, AlertCircle, Check, X } from "lucide-react";
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
import { useUserRole } from "@/lib/role-context";
import { useProjectStore } from "@/lib/project-store";
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

  const { isMember, profile } = useUserRole();
  const { issues, addIssue, updateIssue, deleteIssue } = useProjectStore();

  const [view, setView] = useState("board");
  const [scopeFilter, setScopeFilter] = useState<"all" | "my">("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [createOpen, setCreateOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestType, setRequestType] = useState<"blocker" | "help" | "review">("blocker");
  const [requestText, setRequestText] = useState("");
  const [selected, setSelected] = useState<Issue | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  // Handle status changes (drag and drop or menu)
  const handleStatusChange = (issueId: string, nextStatus: IssueStatus) => {
    updateIssue(issueId, { status: nextStatus });
    if (selected && selected.id === issueId) {
      setSelected({ ...selected, status: nextStatus });
    }
  };

  // Handle creating a new issue
  const handleCreate = (newIssue: Issue) => {
    addIssue(newIssue);
  };

  // Handle deleting an issue
  const handleDeleteIssue = (issueId: string) => {
    deleteIssue(issueId);
    if (selected?.id === issueId) {
      setSelected(null);
    }
  };

  // Handle Request Submission
  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestText.trim()) return;

    setRequestSubmitted(true);
    setTimeout(() => {
      setRequestSubmitted(false);
      setRequestModalOpen(false);
      setRequestText("");
    }, 1800);
  };

  // Keyboard shortcuts
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

    // Filter by My Tasks if selected
    if (scopeFilter === "my") {
      out = out.filter(
        (i) =>
          i.assignee?.displayName.includes(profile.name) ||
          (isMember && i.assignee?.id === "m1")
      );
    }

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
  }, [issues, search, statusFilter, priorityFilter, scopeFilter, profile.name, isMember]);

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
            ایشوها و بورد کاری — {projectKey}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            {isMember
              ? `نمای وظایف برای ${profile.name} (ثبت پیشرفت و گزارش موانع)`
              : "مدیریت تسک‌ها، تخصیص منابع و پایش وضعیت پیشرفت"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Member Blocker / Request Dialog Button */}
          <Button
            variant="outline"
            onClick={() => setRequestModalOpen(true)}
            className="gap-1.5 border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
          >
            <AlertCircle size={15} />
            ثبت گزارش مانع / درخواست
          </Button>

          <Button onClick={() => setCreateOpen(true)} className="gap-1.5 shadow-sm">
            <Plus size={16} />
            ساخت ایشو جدید
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-[10px] rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-3">
        {/* Scope Selector: All Tasks vs My Tasks */}
        <div className="flex items-center gap-1 rounded-[8px] bg-[var(--surface-raised)] p-1 border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setScopeFilter("all")}
            className={`px-3 py-1 text-[12px] font-medium rounded-[6px] transition-colors ${
              scopeFilter === "all"
                ? "bg-[var(--primary)] text-white font-bold shadow-xs"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            همه تسک‌ها
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter("my")}
            className={`px-3 py-1 text-[12px] font-medium rounded-[6px] transition-colors flex items-center gap-1.5 ${
              scopeFilter === "my"
                ? "bg-[var(--primary)] text-white font-bold shadow-xs"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <UserCheck size={13} />
            تسک‌های من
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-[10px] flex-1 justify-end">
          <div className="relative min-w-[200px] max-w-sm flex-1">
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
            <SelectTrigger className="w-[150px] bg-[var(--background)]">
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
            <SelectTrigger className="w-[140px] bg-[var(--background)]">
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
              onIssueMove={handleStatusChange}
              onIssueClick={setSelected}
            />
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-[16px]">
          <IssuesTable
            issues={sorted}
            loading={false}
            error={false}
            onRetry={() => {}}
            onRowClick={setSelected}
            onCreate={() => setCreateOpen(true)}
          />
        </TabsContent>
      </Tabs>

      {/* Issue Detail Panel */}
      <IssueDetailPanel
        issue={selected}
        onClose={() => setSelected(null)}
        onUpdateIssue={(updates) => {
          if (selected) updateIssue(selected.id, updates);
        }}
        onDeleteIssue={handleDeleteIssue}
      />

      {/* Create Issue Dialog */}
      <CreateIssueDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectKey={projectKey}
        onCreate={handleCreate}
      />

      {/* Request / Blocker Modal */}
      {requestModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setRequestModalOpen(false)}
        >
          <div
            className="w-full max-w-[460px] rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-[24px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-5 text-amber-500" />
                <h2 className="text-[17px] font-bold text-[var(--text-primary)]">
                  ثبت گزارش مانع یا درخواست پشتیبانی
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setRequestModalOpen(false)}
                className="rounded-[8px] p-1 text-[var(--text-muted)] hover:bg-[var(--surface-raised)]"
              >
                <X size={18} />
              </button>
            </div>

            {requestSubmitted ? (
              <div className="py-8 text-center space-y-2">
                <div className="inline-flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mb-2">
                  <Check size={24} />
                </div>
                <h3 className="text-[16px] font-bold text-[var(--text-primary)]">
                  درخواست شما با موفقیت به مدیر پروژه ارسال شد
                </h3>
                <p className="text-[12px] text-[var(--text-muted)]">
                  اطلاع‌رسانی بلادرنگ برای ادمین و اعضای تیم ثبت گردید.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRequestSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                    نوع درخواست
                  </label>
                  <Select
                    value={requestType}
                    onValueChange={(v: "blocker" | "help" | "review") => setRequestType(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blocker">مسدودکننده فنی (Blocker — کار من متوقف شده)</SelectItem>
                      <SelectItem value="help">درخواست کمک / راهنمایی معماری</SelectItem>
                      <SelectItem value="review">درخواست بازبینی سریع PR / کد</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                    شرح درخواست یا مانع <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={requestText}
                    onChange={(e) => setRequestText(e.target.value)}
                    placeholder="توضیح دهید چه عاملی مانع پیشرفت شما شده است یا به چه کمکی نیاز دارید..."
                    className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--background)] p-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] resize-none"
                    autoFocus
                  />
                </div>

                <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
                  <Button type="button" variant="outline" onClick={() => setRequestModalOpen(false)}>
                    انصراف
                  </Button>
                  <Button type="submit" disabled={!requestText.trim()}>
                    ارسال به مدیر پروژه
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
