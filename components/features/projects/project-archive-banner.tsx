"use client";

import { useState } from "react";
import { CheckCircle2, Archive, Sparkles, Loader2, Award, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/lib/role-context";
import { faNumber, faDate } from "@/lib/format";

interface ProjectArchiveBannerProps {
  projectKey: string;
  status: string;
  progress: number;
  archivedAt?: string | null;
  successRate?: number | null;
}

export function ProjectArchiveBanner({
  projectKey,
  status,
  progress,
  archivedAt,
  successRate = 100,
}: ProjectArchiveBannerProps) {
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(false);
  const [isArchived, setIsArchived] = useState(status === "archived" || status === "completed");
  const [error, setError] = useState("");

  const handleArchive = async () => {
    if (!isAdmin) {
      setError("تنها مدیرعامل یا کارفرما مجاز به تایید نهایی و بایگانی پروژه است.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/v1/projects/${encodeURIComponent(projectKey)}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ successRate: 100 }),
      });

      if (res.ok) {
        setIsArchived(true);
        // Refresh page to show updated status
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        const json = await res.json();
        setError(json.error || "خطا در تایید و بایگانی پروژه.");
      }
    } catch {
      setError("خطای برقراری ارتباط با سرور.");
    } finally {
      setLoading(false);
    }
  };

  // 1. If project is already archived/completed (US7 Board Card)
  if (isArchived) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">
                پروژه تکمیل‌شده و ثبت در بورد بایگانی (US7)
              </h2>
              <Badge className="bg-emerald-600 text-white text-xs px-2">
                تایید کارفرما
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              این پروژه با نرخ موفقیت {faNumber(successRate ?? 100)}٪ به پایان رسیده و توسط مدیرعامل در تاریخ{" "}
              {archivedAt ? faDate(archivedAt) : "اخیر"} به طور رسمی تایید گردید.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 font-mono text-xs py-1 px-2.5">
            ۱۰۰٪ انجام‌شده
          </Badge>
        </div>
      </div>
    );
  }

  // 2. If project progress is 100% and waiting for employer sign-off (US7)
  if (progress >= 100) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">
                پروژه به ۱۰۰٪ پیشرفت رسید! آماده تایید نهایی کارفرما
              </h2>
              <Badge variant="secondary" className="text-xs px-2">
                در انتظار تایید
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              تمام تسک‌های این پروژه به پایان رسیده‌اند. مدیرعامل یا کارفرما می‌تواند با کلیک روی دکمه زیر، پروژه را رسماً تحویل گرفته و به بورد انجام‌شده‌ها منتقل کند.
            </p>
            {error && <p className="text-xs text-red-500 font-medium mt-1">{error}</p>}
          </div>
        </div>

        <div className="shrink-0 self-end md:self-auto">
          <Button
            onClick={handleArchive}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                در حال ثبت تاییدیه...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                تایید نهایی و بایگانی پروژه
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
