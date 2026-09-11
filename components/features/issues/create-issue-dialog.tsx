"use client";

import { useState } from "react";
import { X, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ISSUE_PRIORITY_LABEL,
  ISSUE_STATUS_LABEL,
  ISSUE_TYPE_LABEL,
  type Issue,
  type IssuePriority,
  type IssueStatus,
  type IssueType,
} from "@/components/features/types";
import { useProjectStore } from "@/lib/project-store";
import { faDate } from "@/lib/format";

interface CreateIssueDialogProps {
  open: boolean;
  onClose: () => void;
  projectKey: string;
  onCreate: (newIssue: Issue) => void;
}

export function CreateIssueDialog({
  open,
  onClose,
  projectKey,
  onCreate,
}: CreateIssueDialogProps) {
  const { members, milestones, cycles } = useProjectStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<IssueType>("feature");
  const [status, setStatus] = useState<IssueStatus>("todo");
  const [priority, setPriority] = useState<IssuePriority>("medium");
  const [estimate, setEstimate] = useState("3");
  const [assigneeId, setAssigneeId] = useState<string>("none");
  const [milestoneId, setMilestoneId] = useState<string>("none");
  const [cycleId, setCycleId] = useState<string>("none");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("لطفاً عنوان ایشو را وارد کنید.");
      return;
    }

    const assignedMember = members.find((m) => m.id === assigneeId) || null;
    const randId = `i-${Date.now()}`;
    const randNum = Math.floor(100 + Math.random() * 900);

    const newIssue: Issue = {
      id: randId,
      key: `${projectKey.toUpperCase()}-${randNum}`,
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      status,
      priority,
      estimate: Number(estimate) || 1,
      assignee: assignedMember,
      milestoneId: milestoneId !== "none" ? milestoneId : undefined,
      cycleId: cycleId !== "none" ? cycleId : undefined,
      dueDate: dueDate || undefined,
      labels: [
        {
          id: `lbl-${type}`,
          name: ISSUE_TYPE_LABEL[type],
          color: type === "bug" ? "#ef4444" : type === "feature" ? "#3b82f6" : "#8b5cf6",
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      prCount: 0,
      prOpenCount: 0,
    };

    onCreate(newIssue);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[620px] rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-[24px] shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-[14px]">
          <div>
            <h2 className="text-[18px] font-bold text-[var(--text-primary)]">
              ایجاد ایشوی جدید
            </h2>
            <p className="text-[13px] text-[var(--text-muted)]">
              پروژه {projectKey.toUpperCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-[8px] bg-red-500/10 border border-red-500/20 p-3 text-[13px] text-red-500">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5">
              عنوان ایشو <span className="text-red-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError("");
              }}
              placeholder="مثال: پیاده‌سازی احراز هویت دومرحله‌ای"
              autoFocus
              className="w-full"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5">
              توضیحات و جزئیات
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="توضیحاتی در مورد وظیفه، معیار پذیرش، یا گام‌های اجرا..."
              className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--background)] p-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] resize-none"
            />
          </div>

          {/* Type, Priority, Status Row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-muted)] mb-1">
                نوع کار
              </label>
              <Select value={type} onValueChange={(v) => setType(v as IssueType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ISSUE_TYPE_LABEL) as IssueType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {ISSUE_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[var(--text-muted)] mb-1">
                اولویت
              </label>
              <Select value={priority} onValueChange={(v) => setPriority(v as IssuePriority)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ISSUE_PRIORITY_LABEL) as IssuePriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {ISSUE_PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[var(--text-muted)] mb-1">
                وضعیت اولیه
              </label>
              <Select value={status} onValueChange={(v) => setStatus(v as IssueStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ISSUE_STATUS_LABEL) as IssueStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {ISSUE_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignee, Story Points, Due Date */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-muted)] mb-1">
                مسئول
              </label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="انتخاب مسئول" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون مسئول</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[var(--text-muted)] mb-1">
                تخمین (Story Points)
              </label>
              <Select value={estimate} onValueChange={setEstimate}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["1", "2", "3", "5", "8", "13", "21"].map((pt) => (
                    <SelectItem key={pt} value={pt}>
                      {pt} امتیاز
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[12px] font-medium text-[var(--text-muted)]">
                  تاریخ سررسید
                </label>
                {dueDate && (
                  <span className="text-[11px] font-medium text-[var(--primary)]">
                    {faDate(dueDate)}
                  </span>
                )}
              </div>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-[var(--background)]"
              />
            </div>
          </div>

          {/* Milestone & Cycle */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-muted)] mb-1">
                مایلستون
              </label>
              <Select value={milestoneId} onValueChange={setMilestoneId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="بدون مایلستون" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون مایلستون</SelectItem>
                  {milestones.map((ms) => (
                    <SelectItem key={ms.id} value={ms.id}>
                      {ms.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[var(--text-muted)] mb-1">
                سایکل (اسپرینت)
              </label>
              <Select value={cycleId} onValueChange={setCycleId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="بدون سایکل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون سایکل</SelectItem>
                  {cycles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.status === "active" ? "فعال" : "آینده"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              انصراف
            </Button>
            <Button type="submit" className="gap-1.5">
              <Plus size={16} />
              ایجاد ایشو
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
