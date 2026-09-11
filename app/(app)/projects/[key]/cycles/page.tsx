"use client";

import { use, useState } from "react";
import { Plus, Rocket, X, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectStore } from "@/lib/project-store";
import { CYCLE_STATUS_LABEL, type Cycle, type CycleStatus } from "@/components/features/types";
import { faDate, faNumber, faPercent } from "@/lib/format";

export default function CyclesPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = use(params);
  const { cycles, addCycle } = useProjectStore();
  const [createOpen, setCreateOpen] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<CycleStatus>("planned");

  const handleCreateCycle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCycle: Cycle = {
      id: `c-${Date.now()}`,
      name: name.trim(),
      goal: goal.trim() || undefined,
      startDate: startDate || new Date().toISOString().slice(0, 10),
      endDate: endDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      status,
      progress: 0,
      totalEstimate: 0,
      doneEstimate: 0,
    };

    addCycle(newCycle);
    setName("");
    setGoal("");
    setStartDate("");
    setEndDate("");
    setCreateOpen(false);
  };

  return (
    <section aria-label="سایکل‌ها" className="space-y-[20px] max-w-5xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--text-primary)]">
            سایکل‌ها (اسپرینت‌ها) — {key}
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">
            برنامه‌ریزی دوره‌ای، اهداف اسپرینت و محاسبه پیشرفت وزنی
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5 shadow-sm">
          <Plus size={16} />
          سایکل جدید
        </Button>
      </header>

      {cycles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-[48px] text-center">
          <Layers className="size-12 text-[var(--text-muted)] mb-3" />
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
            هنوز سایکلی برای این پروژه تعریف نشده است
          </h3>
          <p className="text-[13px] text-[var(--text-muted)] mt-1 max-w-sm">
            می‌توانید اولین سایکل یا اسپرینت خود را برای برنامه‌ریزی و ارزیابی پیشرفت بسازید.
          </p>
          <div className="mt-4">
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus size={15} />
              ایجاد اولین سایکل
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-2">
          {cycles.map((cycle) => (
            <Card key={cycle.id} className="border-[var(--border)] bg-[var(--surface)] shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-[16px]">
                    <Rocket size={16} className="text-[var(--primary)]" />
                    {cycle.name}
                  </CardTitle>
                  <Badge
                    variant={
                      cycle.status === "active"
                        ? "default"
                        : cycle.status === "completed"
                          ? "success"
                          : "secondary"
                    }
                    className="text-[11px]"
                  >
                    {CYCLE_STATUS_LABEL[cycle.status]}
                  </Badge>
                </div>
                <p className="text-[13px] text-[var(--text-muted)] mt-1">
                  {faDate(cycle.startDate)} تا {faDate(cycle.endDate)}
                </p>
                {cycle.goal && (
                  <p className="text-[13px] text-[var(--text-secondary)] mt-1 bg-[var(--surface-raised)] p-2 rounded-[8px]">
                    🎯 <strong>هدف:</strong> {cycle.goal}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-[12px]">
                <div>
                  <div className="mb-[5px] flex items-center justify-between text-[13px]">
                    <span>پیشرفت وزنی اسپرینت</span>
                    <span className="font-semibold">
                      {faPercent(cycle.progress ?? 0)}
                    </span>
                  </div>
                  <div className="h-[8px] w-full overflow-hidden rounded-full bg-[var(--surface-raised)]">
                    <div
                      className="h-full rounded-full bg-[var(--primary)] transition-[width_0.4s_ease-in-out]"
                      style={{ width: `${(cycle.progress ?? 0) * 100}%` }}
                      role="progressbar"
                      aria-valuenow={Math.round((cycle.progress ?? 0) * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[13px] text-[var(--text-muted)] border-t border-[var(--border)] pt-2.5">
                  <span>
                    استوری‌پوینت: {faNumber(cycle.doneEstimate ?? 0)} از{" "}
                    {faNumber(cycle.totalEstimate ?? 0)}
                  </span>
                  <span>
                    {faNumber(cycle.totalEstimate && cycle.doneEstimate ? cycle.totalEstimate - cycle.doneEstimate : 0)}{" "}
                    باقی‌مانده
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Cycle Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="w-full max-w-[480px] rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-[24px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h2 className="text-[17px] font-bold text-[var(--text-primary)]">
                ساخت سایکل جدید
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-[8px] p-1 text-[var(--text-muted)] hover:bg-[var(--surface-raised)]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCycle} className="mt-4 space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  نام اسپرینت / سایکل <span className="text-red-500">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: اسپرینت ۳"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  هدف اصلی سایکل
                </label>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  rows={2}
                  placeholder="مثال: تحویل ماژول پرداخت و تست‌های نهایی"
                  className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--background)] p-2.5 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[13px] font-medium text-[var(--text-primary)]">
                      تاریخ شروع
                    </label>
                    {startDate && (
                      <span className="text-[11px] text-[var(--primary)]">
                        {faDate(startDate)}
                      </span>
                    )}
                  </div>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[13px] font-medium text-[var(--text-primary)]">
                      تاریخ پایان
                    </label>
                    {endDate && (
                      <span className="text-[11px] text-[var(--primary)]">
                        {faDate(endDate)}
                      </span>
                    )}
                  </div>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  وضعیت اولیه
                </label>
                <Select value={status} onValueChange={(v) => setStatus(v as CycleStatus)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">برنامه‌ریزی‌شده</SelectItem>
                    <SelectItem value="active">فعال</SelectItem>
                    <SelectItem value="completed">پایان‌یافته</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  انصراف
                </Button>
                <Button type="submit" className="gap-1.5" disabled={!name.trim()}>
                  <Plus size={16} />
                  ایجاد سایکل
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
