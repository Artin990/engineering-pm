"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { faNumber } from "@/lib/format";
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

function IssueCardBody({ issue }: { issue: Issue }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span dir="ltr" className="text-[12px] font-bold text-[var(--text-muted)]">
          {issue.key}
        </span>
        <IssuePriorityIcon priority={issue.priority} />
      </div>
      <p className="mt-[4px] line-clamp-2 text-[14px] font-medium leading-6 text-[var(--text-primary)]">
        {issue.title}
      </p>
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
  onOpen,
}: {
  issue: Issue;
  onOpen: (issue: Issue) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: issue.id, data: { type: "issue" } });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(issue)}
      className={cn(
        "cursor-grab touch-none rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-[12px] shadow-sm transition-[0.15s_ease-in-out] hover:border-[var(--primary)] active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <IssueCardBody issue={issue} />
    </div>
  );
}

function ColumnDropTarget({ status }: { status: IssueStatus }) {
  return <SortableContext items={[]} strategy={verticalListSortingStrategy}><span data-column={status} /></SortableContext>;
}

function BoardColumn({
  status,
  issues,
  onOpen,
}: {
  status: IssueStatus;
  issues: Issue[];
  onOpen: (issue: Issue) => void;
}) {
  return (
    <div
      data-column-id={status}
      className="flex w-[280px] shrink-0 flex-col rounded-[10px] border border-[var(--border)] bg-[var(--background)]"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] p-[12px]">
        <span className="text-[14px] font-semibold text-[var(--text-primary)]">
          {ISSUE_STATUS_LABEL[status]}
        </span>
        <Badge variant="secondary">{faNumber(issues.length)}</Badge>
      </div>
      <SortableContext
        id={status}
        items={issues.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-[120px] flex-1 flex-col gap-[8px] p-[8px]">
          {issues.map((issue) => (
            <SortableIssueCard key={issue.id} issue={issue} onOpen={onOpen} />
          ))}
          {issues.length === 0 && (
            <div className="flex h-full min-h-[80px] items-center justify-center rounded-[10px] border border-dashed border-[var(--border)] text-[12px] text-[var(--text-muted)]">
              برای انتقال، کارت را اینجا رها کنید
            </div>
          )}
          {issues.length === 0 && <ColumnDropTarget status={status} />}
        </div>
      </SortableContext>
    </div>
  );
}

type ColumnsState = Record<IssueStatus, string[]>;

function buildColumns(issues: Issue[]): ColumnsState {
  const cols = {} as ColumnsState;
  for (const s of ISSUE_STATUS_ORDER) cols[s] = [];
  for (const i of issues) cols[i.status]?.push(i.id);
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
  const [columns, setColumns] = useState<ColumnsState>(() => buildColumns(issues));
  const [activeId, setActiveId] = useState<string | null>(null);

  // Re-sync local state when the incoming issue set changes (filters, etc.)
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
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findColumn = (id: string): IssueStatus | null => {
    if ((ISSUE_STATUS_ORDER as string[]).includes(id)) return id as IssueStatus;
    for (const s of ISSUE_STATUS_ORDER) {
      if (columns[s].includes(id)) return s;
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const from = findColumn(String(active.id));
    const to = findColumn(String(over.id));
    if (!from || !to || from === to) return;
    setColumns((prev) => {
      const next = { ...prev };
      next[from] = next[from].filter((id) => id !== String(active.id));
      next[to] = [...next[to], String(active.id)];
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const from = findColumn(String(active.id));
    const to = findColumn(String(over.id));
    if (!from || !to) return;
    if (from !== to) onIssueMove?.(String(active.id), to);
    setColumns((prev) => {
      const oldIndex = prev[from].indexOf(String(active.id));
      const newIndex = prev[to].indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;
      const moved = [...prev[to]];
      moved.splice(newIndex, 0, prev[from][oldIndex]);
      return {
        ...prev,
        [from]: prev[from].filter((id) => id !== String(active.id)),
        [to]: arrayMove(moved, newIndex, newIndex),
      };
    });
  };

  const activeIssue = activeId ? issuesById.get(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-[12px] overflow-x-auto pb-4">
        {ISSUE_STATUS_ORDER.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            issues={columns[status]
              .map((id) => issuesById.get(id))
              .filter((i): i is Issue => Boolean(i))}
            onOpen={(issue) => onIssueClick?.(issue)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeIssue ? (
          <div className="w-[264px] cursor-grabbing rounded-[10px] border border-[var(--primary)] bg-[var(--surface-raised)] p-[12px] shadow-[rgba(0,0,0,0.2)_0_4px_12px]">
            <IssueCardBody issue={activeIssue} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
