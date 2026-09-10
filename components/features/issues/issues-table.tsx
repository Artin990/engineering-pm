"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { faDate, faNumber } from "@/lib/format";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_STATUS_LABEL,
  type Issue,
} from "@/components/features/types";
import { IssuePriorityIcon } from "@/components/features/issues/issue-priority-icon";
import { IssueTypeBadge } from "@/components/features/issues/issue-type-badge";

function AssigneeAvatar({ name }: { name?: string | null }) {
  if (!name) return <span className="text-[var(--text-muted)]">—</span>;
  return (
    <span
      title={name}
      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)] text-[11px] font-bold text-white"
    >
      {name.trim().charAt(0)}
    </span>
  );
}

function isOverdue(dueDate?: string | null, status?: Issue["status"]) {
  if (!dueDate || status === "done" || status === "cancelled") return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

export function IssuesTable({
  issues,
  loading = false,
  error = false,
  onRetry,
  onRowClick,
  onCreate,
}: {
  issues: Issue[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onRowClick: (issue: Issue) => void;
  onCreate: () => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Issue>[]>(
    () => [
      {
        accessorKey: "key",
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="inline-flex items-center gap-1 font-semibold hover:text-[var(--text-primary)]"
          >
            کلید
            <ArrowUpDown size={12} />
          </button>
        ),
        cell: ({ row }) => (
          <span dir="ltr" className="font-bold text-[var(--text-primary)]">
            {row.original.key}
          </span>
        ),
      },
      {
        accessorKey: "type",
        header: "نوع",
        cell: ({ row }) => <IssueTypeBadge type={row.original.type} />,
      },
      {
        accessorKey: "title",
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="inline-flex items-center gap-1 font-semibold hover:text-[var(--text-primary)]"
          >
            عنوان
            <ArrowUpDown size={12} />
          </button>
        ),
        cell: ({ row }) => (
          <span className="block max-w-[320px] truncate text-[var(--text-primary)]">
            {row.original.title}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "وضعیت",
        cell: ({ row }) => (
          <Badge variant="secondary">{ISSUE_STATUS_LABEL[row.original.status]}</Badge>
        ),
      },
      {
        accessorKey: "priority",
        header: "اولویت",
        cell: ({ row }) => (
          <Badge variant="outline" className="gap-1 whitespace-nowrap">
            <IssuePriorityIcon priority={row.original.priority} />
            {ISSUE_PRIORITY_LABEL[row.original.priority]}
          </Badge>
        ),
      },
      {
        accessorKey: "assignee",
        header: "مسئول",
        cell: ({ row }) => (
          <AssigneeAvatar name={row.original.assignee?.displayName} />
        ),
      },
      {
        accessorKey: "estimate",
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="inline-flex items-center gap-1 font-semibold hover:text-[var(--text-primary)]"
          >
            تخمین
            <ArrowUpDown size={12} />
          </button>
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {faNumber(row.original.estimate)} امتیاز
          </span>
        ),
      },
      {
        accessorKey: "dueDate",
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="inline-flex items-center gap-1 font-semibold hover:text-[var(--text-primary)]"
          >
            سررسید
            <ArrowUpDown size={12} />
          </button>
        ),
        cell: ({ row }) => {
          const overdue = isOverdue(row.original.dueDate, row.original.status);
          if (!row.original.dueDate)
            return <span className="text-[var(--text-muted)]">—</span>;
          return (
            <span
              className={cn(
                "whitespace-nowrap",
                overdue ? "font-semibold text-red-500" : undefined
              )}
            >
              {faDate(row.original.dueDate)}
            </span>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: issues,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-[40px] text-center">
        <p className="text-[14px] text-[var(--text-secondary)]">
          خطا در بارگذاری ایشوها
        </p>
        <Button onClick={onRetry}>تلاش مجدد</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-[16px]">
        <div className="flex flex-col gap-[8px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-[40px] text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--background)] text-[var(--text-muted)]">
          <Inbox size={22} />
        </span>
        <div>
          <p className="font-semibold text-[var(--text-primary)]">
            ایشویی یافت نشد
          </p>
          <p className="mt-1 text-[14px] text-[var(--text-muted)]">
            با فیلترهای فعلی چیزی پیدا نشد. ایشوی جدید بسازید.
          </p>
        </div>
        <Button onClick={onCreate}>ساخت ایشو</Button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[10px] border border-[var(--border)] bg-[var(--surface)]">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id} className="whitespace-nowrap">
                  {h.isPlaceholder
                    ? null
                    : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              onClick={() => onRowClick(row.original)}
              className="cursor-pointer hover:bg-[var(--background)]"
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="whitespace-nowrap">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between gap-4 border-t border-[var(--border)] p-[12px]">
          <p className="text-[14px] text-[var(--text-muted)]">
            صفحه {faNumber(table.getState().pagination.pageIndex + 1)} از{" "}
            {faNumber(table.getPageCount())}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              قبلی
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              بعدی
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
