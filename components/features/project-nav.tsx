"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  Layers3,
  CheckSquare,
  Layers,
  Map,
  Target,
  Activity,
  BarChart3,
  Settings,
} from "lucide-react";
import { GithubIcon } from "@/components/ui/github-icon";

const TABS = [
  { href: "", label: "نمای کلی", icon: Layers3 },
  { href: "issues", label: "ایشوها و بورد", icon: CheckSquare },
  { href: "cycles", label: "سایکل‌ها", icon: Layers },
  { href: "roadmap", label: "رودمپ", icon: Map },
  { href: "milestones", label: "مایلستون‌ها", icon: Target },
  { href: "github", label: "گیت‌هاب", icon: GithubIcon },
  { href: "activity", label: "فعالیت", icon: Activity },
  { href: "analytics", label: "آنالیتیکس", icon: BarChart3 },
  { href: "settings", label: "تنظیمات", icon: Settings },
] as const;

/**
 * ناوبری تب‌های پروژه — RTL، فعال‌سازی با pathname واقعی.
 */
export function ProjectNav() {
  const pathname = usePathname();
  const params = useParams<{ key: string }>();
  const projectKey = params?.key;

  if (!projectKey) return null;

  return (
    <nav
      aria-label="ناوبری پروژه"
      className="sticky top-0 z-20 flex gap-[6px] overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md px-[20px] py-[8px] scrollbar-none"
    >
      {TABS.map((tab) => {
        const href = tab.href
          ? `/projects/${projectKey}/${tab.href}`
          : `/projects/${projectKey}`;
        const active =
          tab.href === ""
            ? pathname === `/projects/${projectKey}`
            : pathname === href || pathname.startsWith(`${href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-[6px] whitespace-nowrap rounded-[8px] px-[12px] py-[7px] text-[13px] font-medium transition-all ${
              active
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Icon size={14} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
