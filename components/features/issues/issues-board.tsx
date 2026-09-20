"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lock, CheckCircle2, RotateCcw, ShieldAlert, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { faNumber } from "@/lib/format";
import { useUserRole } from "@/lib/role-context";
import {
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_ORDER,
  type Issue,
  type IssueStatus,
} from "@/components/features/types";
import { IssuePriorityIcon } from "@/components/features/issues/issue-priority-icon";

function AssigneeAvatar({ name }: { name?: string | null }) {
  if (!name) return null;
  return (
    <span
      title={name}
      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)] text-[11px] font-bold text-white"
    >
      {name.trim().charAt(0)}
    </span>
  );
}

function IssueCardBody({
  issue,
  isAdmin,
  onMoveToStatus,
}: {
  issue: Issue;
  isAdmin: boolean;
  onMoveToStatus?: (status: IssueStatus) => void;
}) {
  const isLockedForMember = !isAdmin && (issue.status === "in_review" || issue.status === "done" || issue.status === "cancelled");

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span dir="ltr" className="text-[12px] font-bold text-[var(--text-muted)]">
            {issue.key}
          </span>
          {isLockedForMember && (
            <span
              title="این کارت در اختیار و بررسی کارفرماست"
              className="inline-flex items-center gap-0.5 rounded-[4px] bg-amber-500/15 px-1 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
            >
              <Lock size={10} />
              {issue.status === "in_review" ? "بررسی کارفرما" : "قفل کارفرما"}
            </span>
          )}
        </div>
        <IssuePriorityIcon priority={issue.priority} />
      </div>
      <p className="mt-[4px] line-clamp-2 text-[14px] font-medium leading-6 text-[var(--text-primary)]">
        {issue.title}
      </p>

      {/* Admin Quick Review Actions for in_review column */}
      {isAdmin && issue.status === "in_review" && onMoveToStatus && (
        <div
          className="mt-2.5 flex items-center gap-1.5 border-t border-[var(--border)] pt-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onMoveToStatus("done")}
            className="h-6 flex-1 gap-1 px-1.5 text-[11px] font-medium text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400"
            title="تأیید نهایی و انتقال به انجام‌شده"
          >
            <CheckCircle2 size={12} />
            تأیید کارفرما
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onMoveToStatus("in_progress")}
            className="h-6 gap-1 px-1.5 text-[11px] font-medium text-amber-600 hover:bg-amber-500/15 dark:text-amber-400"
            title="ارجاع مجدد به در حال انجام جهت اصلاحات"
          >
            <RotateCcw size={11} />
            بازگشت
          </Button>
        </div>
      )}

      <div className="mt-[8px] flex items-center justify-between">
        <span className="text-[12px] text-[var(--text-muted)]">
          {faNumber(issue.estimate)} امتیاز
        </span>
        <AssigneeAvatar name={issue.assignee?.displayName} />
      </div>
    </>
  );
}

function SortableIssueCard({
  issue,
  isAdmin,
  onOpen,
  onMoveToStatus,
}: {
  issue: Issue;
  isAdmin: boolean;
  onOpen: (issue: Issue) => void;
  onMoveToStatus?: (issueId: string, status: IssueStatus) => void;
}) {
  // Members cannot move cards that are already in_review, done, or cancelled
  const isDragDisabled = !isAdmin && (issue.status === "in_review" || issue.status === "done" || issue.status === "cancelled");

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: issue.id,
      data: { type: "issue", issue },
      disabled: isDragDisabled,
    });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(issue)}
      className={cn(
        "touch-none rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-[12px] shadow-xs transition-colors hover:border-[var(--primary)]",
        isDragDisabled ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-30 border-dashed border-[var(--primary)]"
      )}
    >
      <IssueCardBody
        issue={issue}
        isAdmin={isAdmin}
        onMoveToStatus={onMoveToStatus ? (status) => onMoveToStatus(issue.id, status) : undefined}
      />
    </div>
  );
}

function BoardColumn({
  status,
  issues,
  isAdmin,
  onOpen,
  onMoveToStatus,
}: {
  status: IssueStatus;
  issues: Issue[];
  isAdmin: boolean;
  onOpen: (issue: Issue) => void;
  onMoveToStatus?: (issueId: string, status: IssueStatus) => void;
}) {
  const isRestrictedTarget = !isAdmin && (status === "done" || status === "cancelled");

  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: "column", status },
  });

  return (
    <div
      ref={setNodeRef}
      data-column-id={status}
      className={cn(
        "flex w-[280px] shrink-0 flex-col rounded-[10px] border border-[var(--border)] bg-[var(--background)] transition-colors",
        isOver && (isRestrictedTarget ? "border-rose-500/60 bg-rose-500/5" : "border-[var(--primary)]/60 bg-[var(--primary)]/5"),
        status === "in_review" && "border-amber-500/30",
        isRestrictedTarget && "border-dashed"
      )}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] p-[12px]">
        <div className="flex items-center gap-1.5">
          <span className="text-[14px] font-semibold text-[var(--text-primary)]">
            {ISSUE_STATUS_LABEL[status]}
          </span>
          {isRestrictedTarget && (
            <span
              title="انتقال به این ستون فقط در اختیار کارفرما است"
              className="inline-flex items-center gap-0.5 text-rose-500 text-[11px]"
            >
              <Lock size={12} />
            </span>
          )}
          {status === "in_review" && (
            <span
              title="مرحله بازبینی نهایی کارفرما"
              className="inline-flex items-center gap-0.5 text-amber-500 text-[11px]"
            >
              <Eye size={12} />
            </span>
          )}
        </div>
        <Badge variant="secondary">{faNumber(issues.length)}</Badge>
      </div>

      {status === "in_review" && (
        <div className="mx-2 mt-2 rounded-[6px] bg-amber-500/10 px-2 py-1 text-[11px] text-amber-600 dark:text-amber-400">
          {isAdmin ? "⚡ نیاز به بازبینی و تأیید/جایگذاری کارفرما" : "🔒 تحویل به کارفرما جهت بازبینی و تایید نهایی"}
        </div>
      )}

      {isRestrictedTarget && (
        <div className="mx-2 mt-2 rounded-[6px] bg-rose-500/10 px-2 py-1 text-[10.5px] text-rose-600 dark:text-rose-400 flex items-center gap-1">
          <ShieldAlert size={12} className="shrink-0" />
          <span>تأیید نهایی فقط توسط کارفرما</span>
        </div>
      )}

      <SortableContext
        id={status}
        items={issues.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-[140px] flex-1 flex-col gap-[8px] p-[8px]">
          {issues.map((issue) => (
            <SortableIssueCard
              key={issue.id}
              issue={issue}
              isAdmin={isAdmin}
              onOpen={onOpen}
              onMoveToStatus={onMoveToStatus}
            />
          ))}
          {issues.length === 0 && (
            <div className="flex h-full min-h-[90px] items-center justify-center rounded-[10px] border border-dashed border-[var(--border)] text-[12px] text-[var(--text-muted)] p-2 text-center">
              {isRestrictedTarget
                ? "فقط کارفرما مجاز به انتقال کارت به این ستون است"
                : "برای انتقال، کارت را اینجا رها کنید"}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

type ColumnsState = Record<IssueStatus, string[]>;

function buildColumns(issues: Issue[]): ColumnsState {
  const cols = {} as ColumnsState;
  for (const s of ISSUE_STATUS_ORDER) cols[s] = [];
  for (const i of issues) {
    if (cols[i.status]) {
      cols[i.status].push(i.id);
    } else {
      cols.backlog.push(i.id);
    }
  }
  return cols;
}

export function IssuesBoard({
  issues,
  onIssueMove,
  onIssueClick,
}: {
  issues: Issue[];
  onIssueMove?: (issueId: string, newStatus: IssueStatus) => void;
  onIssueClick?: (issue: Issue) => void;
}) {
  const { isAdmin } = useUserRole();
  const [columns, setColumns] = useState<ColumnsState>(() => buildColumns(issues));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [permissionAlert, setPermissionAlert] = useState<string | null>(null);
  const initialColumnRef = useRef<IssueStatus | null>(null);

  // Clear alert after 4 seconds
  useEffect(() => {
    if (!permissionAlert) return;
    const t = setTimeout(() => setPermissionAlert(null), 4000);
    return () => clearTimeout(t);
  }, [permissionAlert]);

  // Re-sync local state when the incoming issue set changes (filters, store updates)
  const signature = issues.map((i) => `${i.id}:${i.status}`).join(",");
  useEffect(() => {
    setColumns(buildColumns(issues));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const issuesById = useMemo(() => {
    const m = new Map<string, Issue>();
    for (const i of issues) m.set(i.id, i);
    return m;
  }, [issues]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findColumn = (id: string): IssueStatus | null => {
    if ((ISSUE_STATUS_ORDER as readonly string[]).includes(id)) {
      return id as IssueStatus;
    }
    for (const s of ISSUE_STATUS_ORDER) {
      if (columns[s]?.includes(id)) return s;
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const currentId = String(event.active.id);
    const fromCol = findColumn(currentId);

    // If member tries to drag a card from review/done/cancelled, prevent it
    if (!isAdmin && (fromCol === "in_review" || fromCol === "done" || fromCol === "cancelled")) {
      setPermissionAlert(
        fromCol === "in_review"
          ? "🔒 این تسک در مرحله بازبینی کارفرما قرار دارد و فقط کارفرما می‌تواند آن را تأیید یا دوباره جایگذاری کند."
          : "🔒 تسک‌های بسته شده فقط توسط کارفرما قابل جابه‌جایی مجدد هستند."
      );
      return;
    }

    setActiveId(currentId);
    initialColumnRef.current = fromCol;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const currentActiveId = String(active.id);
    const currentOverId = String(over.id);

    const from = findColumn(currentActiveId);
    const to = findColumn(currentOverId);

    if (!from || !to || from === to) return;

    // Prevent member from dragging over restricted columns
    if (!isAdmin && (to === "done" || to === "cancelled")) {
      return;
    }

    setColumns((prev) => {
      const fromItems = (prev[from] || []).filter((id) => id !== currentActiveId);
      const toItems = (prev[to] || []).filter((id) => id !== currentActiveId);

      const overIndex = (prev[to] || []).indexOf(currentOverId);
      const insertIndex = overIndex >= 0 ? overIndex : toItems.length;

      toItems.splice(insertIndex, 0, currentActiveId);

      return {
        ...prev,
        [from]: fromItems,
        [to]: toItems,
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    const initialCol = initialColumnRef.current;
    initialColumnRef.current = null;

    if (!over) {
      setColumns(buildColumns(issues));
      return;
    }

    const currentActiveId = String(active.id);
    const currentOverId = String(over.id);

    const targetColumn = findColumn(currentOverId) || findColumn(currentActiveId);

    // Role check: Normal members can only move tasks up to "in_review"
    if (!isAdmin && (targetColumn === "done" || targetColumn === "cancelled")) {
      setPermissionAlert(
        "⚠️ محدودیت دسترسی: کاربران عادی حداکثر تا ستون «در بازبینی» می‌توانند تسک‌ها را انتقال دهند. تأیید نهایی و بستن کارت فقط در اختیار کارفرما است."
      );
      setColumns(buildColumns(issues));
      return;
    }

    // Role check: Normal members cannot move a card out of "in_review"
    if (!isAdmin && (initialCol === "in_review" || initialCol === "done" || initialCol === "cancelled")) {
      setPermissionAlert(
        "🔒 این تسک در مرحله بررسی کارفرما قرار دارد. کارفرما باید آن را بررسی، تأیید یا مجدداً جایگذاری کند."
      );
      setColumns(buildColumns(issues));
      return;
    }

    if (targetColumn && initialCol && targetColumn !== initialCol) {
      onIssueMove?.(currentActiveId, targetColumn);
    } else if (targetColumn) {
      // Reorder within the same column
      setColumns((prev) => {
        const items = [...(prev[targetColumn] || [])];
        const oldIndex = items.indexOf(currentActiveId);
        const newIndex = items.indexOf(currentOverId);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          return {
            ...prev,
            [targetColumn]: arrayMove(items, oldIndex, newIndex),
          };
        }
        return prev;
      });
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    initialColumnRef.current = null;
    setColumns(buildColumns(issues));
  };

  const activeIssue = activeId ? issuesById.get(activeId) : null;

  return (
    <div className="relative">
      {/* Role Alert Toast Banner */}
      {permissionAlert && (
        <div className="sticky top-2 z-30 mb-3 flex items-center justify-between gap-3 rounded-[10px] border border-amber-500/40 bg-amber-500/15 p-3 text-[13px] font-medium text-amber-700 shadow-md backdrop-blur-md dark:text-amber-300 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{permissionAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setPermissionAlert(null)}
            className="rounded p-1 text-amber-700/70 hover:bg-amber-500/20 dark:text-amber-300/70"
          >
            ✕
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-[12px] overflow-x-auto pb-4">
          {ISSUE_STATUS_ORDER.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              issues={(columns[status] || [])
                .map((id) => issuesById.get(id))
                .filter((i): i is Issue => Boolean(i))}
              isAdmin={isAdmin}
              onOpen={(issue) => onIssueClick?.(issue)}
              onMoveToStatus={onIssueMove}
            />
          ))}
        </div>
        <DragOverlay>
          {activeIssue ? (
            <div className="w-[264px] cursor-grabbing rounded-[10px] border border-[var(--primary)] bg-[var(--surface-raised)] p-[12px] shadow-lg">
              <IssueCardBody issue={activeIssue} isAdmin={isAdmin} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

