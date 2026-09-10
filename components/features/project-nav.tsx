"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "نمای کلی" },
  { href: "issues", label: "ایشوها" },
  { href: "cycles", label: "سایکل‌ها" },
  { href: "roadmap", label: "رودمپ" },
  { href: "milestones", label: "مایلستون‌ها" },
  { href: "github", label: "گیت‌هاب" },
  { href: "activity", label: "فعالیت" },
  { href: "analytics", label: "آنالیتیکس" },
  { href: "settings", label: "تنظیمات" },
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
      className="flex gap-[5px] overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)] px-[16px] py-[10px]"
    >
      {TABS.map((tab) => {
        const href = tab.href
          ? `/projects/${projectKey}/${tab.href}`
          : `/projects/${projectKey}`;
        const active =
          tab.href === ""
            ? pathname === `/projects/${projectKey}`
            : pathname.startsWith(href);
        return (
          <Link
            key={tab.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-[10px] px-[14px] py-[9px] text-[14px] font-medium transition-[background-color_0.15s_ease-in-out] ${
              active
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
