"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, toggleLocale } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={locale === "fa" ? "تغییر زبان به انگلیسی" : "Switch language to Persian"}
      onClick={toggleLocale}
      className={`relative flex items-center gap-1.5 px-2.5 h-8 text-xs font-semibold rounded-[8px] transition-all hover:bg-[var(--surface-raised)] border border-[var(--border)] ${className}`}
      title={locale === "fa" ? "تغییر زبان به انگلیسی (English)" : "Switch to Persian (فارسی)"}
    >
      <Languages className="size-3.5 text-[var(--text-muted)]" />
      <span className="uppercase tracking-wider text-[11px] font-bold text-[var(--text-primary)]">
        {locale === "fa" ? "EN" : "فا"}
      </span>
    </Button>
  );
}
