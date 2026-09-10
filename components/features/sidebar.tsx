"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { faNumber } from "@/lib/format";

/**
 * Sidebar اصلی اپلیکیشن — RTL (سمت راست).
 * ناوبری سراسری: پروژه‌ها + اعلان‌ها + تنظیمات.
 */
export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/projects", label: "پروژه‌ها", badge: faNumber(2) },
  ];

  return (
    <aside className="flex w-[250px] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)] p-[16px]">
      <div className="mb-[20px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-[8px] text-[16px] font-semibold">
          <span className="flex size-8 items-center justify-center rounded-[10px] bg-[var(--primary)] text-white">
            ⚙
          </span>
          Engineering PM
        </Link>
        <ThemeToggle />
      </div>

      <nav aria-label="ناوبری اصلی" className="flex-1 space-y-[5px]">
        {navItems.map((item) => {
          const active =
            item.href === "/projects"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center justify-between rounded-[10px] px-[14px] py-[9px] text-[14px] font-medium transition-[background-color_0.15s_ease-in-out] ${
                active
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"
              }`}
            >
              {item.label}
              <span
                className={`rounded-full px-[8px] text-[12px] ${
                  active ? "bg-white/20" : "bg-[var(--surface-raised)]"
                }`}
              >
                {item.badge}
              </span>
            </Link>
          );
        })}
      </nav>

      <footer className="border-t border-[var(--border)] pt-[12px] text-[12px] text-[var(--text-muted)]">
        <a
          href="/api/github/oauth/start"
          className="mb-[8px] block rounded-[8px] px-[8px] py-[6px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
        >
          اتصال حساب GitHub
        </a>
        نسخه ۰.۱ — موج ۲
      </footer>
    </aside>
  );
}
