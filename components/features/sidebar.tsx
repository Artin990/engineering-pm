"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  FolderKanban,
  CheckSquare,
  Layers,
  Map,
  Activity,
  BarChart3,
  Settings,
  Layers3,
  Target,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { GithubIcon } from "@/components/ui/github-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { faNumber } from "@/lib/format";
import { MOCK_PROJECTS } from "@/components/features/__fixtures__/mock-data";

/**
 * Sidebar اصلی اپلیکیشن — RTL (سمت راست) با قابلیت باز و بسته شدن.
 */
export function Sidebar() {
  const pathname = usePathname();
  const params = useParams<{ key?: string }>();
  const currentKey = (params?.key || "PM").toUpperCase();
  const currentProject = MOCK_PROJECTS.find((p) => p.key === currentKey) || MOCK_PROJECTS[0];

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar_collapsed", String(next));
  };

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)] text-start z-30 transition-all duration-300 ease-in-out ${
        collapsed ? "w-[72px] p-[10px]" : "w-[260px] p-[16px]"
      }`}
    >
      {/* App Header */}
      <div className={`mb-[16px] flex items-center ${collapsed ? "flex-col gap-2" : "justify-between"}`}>
        <Link
          href="/projects"
          className="flex items-center gap-[10px] text-[15px] font-bold text-[var(--text-primary)] transition-opacity hover:opacity-80"
          title="سامانه مدیریت مهندسی"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white shadow-sm font-mono text-[14px]">
            EPM
          </span>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="leading-tight">Engineering PM</span>
              <span className="text-[11px] font-normal text-[var(--text-muted)]">سامانه مهندسی</span>
            </div>
          )}
        </Link>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleCollapsed}
            type="button"
            className="flex size-8 items-center justify-center rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] transition-colors"
            title={collapsed ? "باز کردن سایدبار" : "بستن سایدبار"}
          >
            {collapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
          </button>
          {!collapsed && <ThemeToggle />}
        </div>
      </div>

      {/* Workspace / Project Quick Switcher */}
      {!collapsed ? (
        <div className="mb-[16px] rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-[10px]">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mb-[4px]">
            <span>پروژه فعال</span>
            <span className="font-mono text-[10px] uppercase bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)]">
              {currentProject.key}
            </span>
          </div>
          <Link
            href={`/projects/${currentProject.key}`}
            className="flex items-center justify-between rounded-[6px] text-[13px] font-semibold text-[var(--text-primary)] hover:text-[var(--primary)] transition-colors"
          >
            <span className="truncate">{currentProject.name}</span>
            <span className="text-[11px] text-[var(--text-muted)]">
              {Math.round(currentProject.progress * 100)}%
            </span>
          </Link>
        </div>
      ) : (
        <div className="mb-[16px] flex justify-center">
          <Link
            href={`/projects/${currentProject.key}`}
            title={`پروژه: ${currentProject.name}`}
            className="flex size-9 items-center justify-center rounded-[8px] bg-[var(--surface-raised)] font-mono text-[11px] font-bold text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors"
          >
            {currentProject.key.slice(0, 2)}
          </Link>
        </div>
      )}

      {/* Global Navigation */}
      <nav aria-label="ناوبری اصلی" className="flex-1 space-y-[4px] overflow-y-auto pr-[2px]">
        {!collapsed && (
          <div className="text-[11px] font-semibold text-[var(--text-muted)] px-[12px] py-[4px]">
            بخش‌ها
          </div>
        )}

        <Link
          href="/projects"
          aria-current={pathname === "/projects" ? "page" : undefined}
          title="همه پروژه‌ها"
          className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} rounded-[10px] px-[12px] py-[8px] text-[13px] font-medium transition-colors ${
            pathname === "/projects"
              ? "bg-[var(--primary)] text-white"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"
          }`}
        >
          <span className="flex items-center gap-[8px]">
            <FolderKanban size={16} />
            {!collapsed && "همه پروژه‌ها"}
          </span>
          {!collapsed && (
            <span
              className={`rounded-full px-[6px] py-[1px] text-[11px] ${
                pathname === "/projects" ? "bg-white/20 text-white" : "bg-[var(--surface-raised)] text-[var(--text-muted)]"
              }`}
            >
              {faNumber(MOCK_PROJECTS.length)}
            </span>
          )}
        </Link>

        {/* Current Project Sub-links if inside a project */}
        <div className="pt-[8px] pb-[4px]">
          {!collapsed && (
            <div className="text-[11px] font-semibold text-[var(--text-muted)] px-[12px] py-[4px] flex items-center justify-between">
              <span>منوی پروژه ({currentProject.key})</span>
            </div>
          )}

          <div className="space-y-[2px] mt-1">
            {[
              { href: `/projects/${currentProject.key}`, label: "نمای کلی", icon: Layers3, exact: true },
              { href: `/projects/${currentProject.key}/issues`, label: "ایشوها و بورد", icon: CheckSquare },
              { href: `/projects/${currentProject.key}/cycles`, label: "سایکل‌ها", icon: Layers },
              { href: `/projects/${currentProject.key}/roadmap`, label: "رودمپ", icon: Map },
              { href: `/projects/${currentProject.key}/milestones`, label: "مایلستون‌ها", icon: Target },
              { href: `/projects/${currentProject.key}/github`, label: "گیت‌هاب", icon: GithubIcon },
              { href: `/projects/${currentProject.key}/activity`, label: "فعالیت", icon: Activity },
              { href: `/projects/${currentProject.key}/analytics`, label: "آنالیتیکس", icon: BarChart3 },
              { href: `/projects/${currentProject.key}/settings`, label: "تنظیمات", icon: Settings },
            ].map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center ${collapsed ? "justify-center" : "gap-[8px]"} rounded-[8px] px-[12px] py-[7px] text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"
                  }`}
                >
                  <Icon size={16} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] pt-[12px] text-[12px] space-y-[8px]">
        {!collapsed ? (
          <div className="flex items-center justify-between rounded-[8px] bg-[var(--surface-raised)] p-[8px]">
            <div className="flex items-center gap-[8px]">
              <span className="flex size-7 items-center justify-center rounded-full bg-[var(--primary)] text-white text-[11px] font-bold">
                آ
              </span>
              <div className="flex flex-col">
                <span className="text-[12px] font-medium text-[var(--text-primary)]">آرتین امیری</span>
                <span className="text-[10px] text-[var(--text-muted)]">ادمین سیستم</span>
              </div>
            </div>
            <Link href="/login" className="text-[11px] text-[var(--primary)] hover:underline">
              خروج
            </Link>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="flex size-8 items-center justify-center rounded-full bg-[var(--primary)] text-white text-[12px] font-bold" title="آرتین امیری (ادمین)">
              آ
            </span>
          </div>
        )}
        {!collapsed && (
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] px-[4px]">
            <span>نسخه ۰.۱</span>
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              سیستم آنلاین
            </span>
          </div>
        )}
      </footer>
    </aside>
  );
}

