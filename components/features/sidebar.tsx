/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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
  Shield,
  User,
  Users,
  MessageSquare,
  Menu,
  X,
} from "lucide-react";
import { GithubIcon } from "@/components/ui/github-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { useUserRole } from "@/lib/role-context";
import { getProjectByKey } from "@/components/features/__fixtures__/mock-data";

/**
 * Sidebar اصلی اپلیکیشن RadarCheck — RTL (سمت راست) با ریسپانسیو کامل و همبرگر منو در موبایل.
 */
export function Sidebar() {
  const pathname = usePathname();
  const params = useParams<{ key?: string }>();
  const currentKey = (params?.key || "PM").toUpperCase();
  const currentProject = getProjectByKey(currentKey);

  const { profile, logout, isAdmin } = useUserRole();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
  }, []);

  // Close mobile drawer on route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar_collapsed", String(next));
  };

  const navLinks = [
    { href: "/projects", label: "همه پروژه‌ها", icon: FolderKanban, exact: true },
    ...(isAdmin ? [{ href: "/members", label: "اعضای کل سازمان", icon: Users, exact: true }] : []),
    { href: "/chat", label: "اتاق گفتگوی زنده تیم", icon: MessageSquare, badge: "۱۰ دقیقه", exact: true },
  ];

  const projectLinks = params?.key
    ? [
        { href: `/projects/${currentKey}`, label: "نمای کلی", icon: Layers3, exact: true },
        { href: `/projects/${currentKey}/issues`, label: "ایشوها و بورد", icon: CheckSquare },
        { href: `/projects/${currentKey}/cycles`, label: "سایکل‌ها", icon: Layers },
        { href: `/projects/${currentKey}/roadmap`, label: "رودمپ", icon: Map },
        { href: `/projects/${currentKey}/milestones`, label: "مایلستون‌ها", icon: Target },
        { href: `/projects/${currentKey}/github`, label: "گیت‌هاب", icon: GithubIcon },
        { href: `/projects/${currentKey}/members`, label: "اعضا و دسترسی‌ها", icon: Users },
        { href: `/projects/${currentKey}/activity`, label: "فعالیت", icon: Activity },
        { href: `/projects/${currentKey}/analytics`, label: "آنالیتیکس و ارزیابی", icon: BarChart3 },
        { href: `/projects/${currentKey}/settings`, label: "تنظیمات پروژه", icon: Settings },
      ]
    : [];

  const renderNavContent = (isMobile = false) => (
    <>
      {/* App Header */}
      <div className={`mb-[16px] flex items-center ${!isMobile && collapsed ? "flex-col gap-2" : "justify-between"}`}>
        <Link
          href="/projects"
          className="flex items-center gap-[10px] text-[15px] font-bold text-[var(--text-primary)] transition-opacity hover:opacity-85"
          title="RadarCheck — سامانه مدیریت مهندسی"
          onClick={() => isMobile && setMobileOpen(false)}
        >
          {!isMobile && collapsed ? (
            <div className="relative size-9 shrink-0 overflow-hidden rounded-[8px] bg-transparent p-1 shadow-xs border border-[var(--border)]">
              <Image
                src="/Flow-Deck-Logo.png"
                alt="FlowDeck"
                fill
                sizes="36px"
                className="object-contain object-left dark:hidden"
              />
              <Image
                src="/Flow-Deck-Logo-for-dark-mode.png"
                alt="FlowDeck"
                fill
                sizes="36px"
                className="object-contain object-left hidden dark:block"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative h-8 w-32 shrink-0">
                <Image
                  src="/Flow-Deck-Logo.png"
                  alt="FlowDeck Logo"
                  fill
                  sizes="130px"
                  className="object-contain object-right dark:hidden"
                  priority
                />
                <Image
                  src="/Flow-Deck-Logo-for-dark-mode.png"
                  alt="FlowDeck Logo"
                  fill
                  sizes="130px"
                  className="object-contain object-right hidden dark:block"
                  priority
                />
              </div>
            </div>
          )}
        </Link>
        <div className="flex items-center gap-1">
          {!isMobile && (
            <button
              onClick={toggleCollapsed}
              type="button"
              className="flex size-8 items-center justify-center rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] transition-colors"
              title={collapsed ? "باز کردن سایدبار" : "بستن سایدبار"}
            >
              {collapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
            </button>
          )}
          {isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              type="button"
              className="flex size-8 items-center justify-center rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--surface-raised)] transition-colors"
            >
              <X size={18} />
            </button>
          )}
          {(isMobile || !collapsed) && <ThemeToggle />}
        </div>
      </div>

      {/* Role Pill */}
      {isMobile || !collapsed ? (
        <div className="mb-[12px] rounded-[8px] border border-[var(--border)] bg-[var(--surface-raised)] p-2">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mb-1.5">
            <span className="flex items-center gap-1">
              {isAdmin ? <Shield size={12} className="text-amber-500" /> : <User size={12} className="text-blue-500" />}
              سطح دسترسی
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                isAdmin
                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                  : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
              }`}
            >
              {isAdmin ? "مدیرعامل" : "عضو عادی"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-[var(--text-primary)]">
              {profile.roleTitle}
            </span>
          </div>
        </div>
      ) : (
        <div className="mb-[12px] flex justify-center">
          <div
            className={`flex size-8 items-center justify-center rounded-[8px] ${
              isAdmin
                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
            }`}
            title={`سطح دسترسی: ${isAdmin ? "مدیر کل" : "عضو عادی"}`}
          >
            {isAdmin ? <Shield size={14} /> : <User size={14} />}
          </div>
        </div>
      )}

      {/* Project Active Pill */}
      {params?.key && (
        isMobile || !collapsed ? (
          <div className="mb-[16px] rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-[10px]">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mb-[4px]">
              <span>پروژه فعال</span>
              <span className="font-mono text-[10px] uppercase bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                {currentKey}
              </span>
            </div>
            <Link
              href={`/projects/${currentKey}`}
              onClick={() => isMobile && setMobileOpen(false)}
              className="flex items-center justify-between rounded-[6px] text-[13px] font-semibold text-[var(--text-primary)] hover:text-[var(--primary)] transition-colors"
            >
              <span className="truncate">{currentProject?.name || `پروژه ${currentKey}`}</span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {Math.round((currentProject?.progress || 0) * 100)}%
              </span>
            </Link>
          </div>
        ) : (
          <div className="mb-[16px] flex justify-center">
            <Link
              href={`/projects/${currentKey}`}
              title={`پروژه: ${currentKey}`}
              className="flex size-9 items-center justify-center rounded-[8px] bg-[var(--surface-raised)] font-mono text-[11px] font-bold text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors"
            >
              {currentKey.slice(0, 2)}
            </Link>
          </div>
        )
      )}

      {/* Navigation Links */}
      <nav aria-label="ناوبری اصلی" className="flex-1 space-y-[4px] overflow-y-auto pr-[2px]">
        {(isMobile || !collapsed) && (
          <div className="text-[11px] font-semibold text-[var(--text-muted)] px-[12px] py-[4px]">
            بخش‌های اصلی
          </div>
        )}

        {navLinks.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={!isMobile && collapsed ? item.label : undefined}
              onClick={() => isMobile && setMobileOpen(false)}
              className={`flex items-center ${!isMobile && collapsed ? "justify-center" : "justify-between"} rounded-[10px] px-[12px] py-[8px] text-[13px] font-medium transition-colors ${
                active
                  ? "bg-[var(--primary)] text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"
              }`}
            >
              <span className="flex items-center gap-[8px]">
                <Icon size={16} />
                {(isMobile || !collapsed) && item.label}
              </span>
              {(isMobile || !collapsed) && item.badge && (
                <span className="rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 text-[10px] font-mono">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Current Project Sub-links */}
        {params?.key && projectLinks.length > 0 && (
          <div className="pt-[8px] pb-[4px]">
            {(isMobile || !collapsed) && (
              <div className="text-[11px] font-semibold text-[var(--text-muted)] px-[12px] py-[4px] flex items-center justify-between">
                <span>منوی پروژه ({currentKey})</span>
              </div>
            )}

            <div className="space-y-[2px] mt-1">
              {projectLinks.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={!isMobile && collapsed ? item.label : undefined}
                    onClick={() => isMobile && setMobileOpen(false)}
                    className={`flex items-center ${!isMobile && collapsed ? "justify-center" : "gap-[8px]"} rounded-[8px] px-[12px] py-[7px] text-[13px] font-medium transition-colors ${
                      active
                        ? "bg-[var(--primary)] text-white shadow-sm"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"
                    }`}
                  >
                    <Icon size={16} />
                    {(isMobile || !collapsed) && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Footer User Info */}
      <footer className="border-t border-[var(--border)] pt-[12px] text-[12px] space-y-[8px]">
        {isMobile || !collapsed ? (
          <div className="flex items-center justify-between rounded-[8px] bg-[var(--surface-raised)] p-[8px]">
            <Link
              href="/settings"
              onClick={() => isMobile && setMobileOpen(false)}
              className="flex items-center gap-[8px] min-w-0 hover:opacity-85 transition-opacity flex-1"
              title="مشاهده و ویرایش مشخصات حساب کاربری"
            >
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-white text-[12px] font-bold overflow-hidden border border-[var(--border)] ${isAdmin ? "bg-[var(--primary)]" : "bg-blue-600"}`}>
                {profile.avatar && profile.avatar.startsWith("http") ? (
                  <img src={profile.avatar} alt={profile.name} className="size-full object-cover" />
                ) : (
                  profile.name?.charAt(0) || "ک"
                )}
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-[12px] font-medium text-[var(--text-primary)] truncate">{profile.name}</span>
                <span className="text-[10px] text-[var(--text-muted)] truncate">{profile.roleTitle}</span>
              </div>
            </Link>
            <div className="flex items-center gap-1.5 shrink-0 ms-1">
              <Link
                href="/settings"
                onClick={() => isMobile && setMobileOpen(false)}
                title="تنظیمات پروفایل"
                className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--surface)] transition-colors"
              >
                <Settings size={14} />
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  window.location.href = "/login";
                }}
                className="text-[11px] text-[var(--primary)] hover:underline cursor-pointer"
              >
                خروج
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <Link
              href="/settings"
              className={`flex size-8 items-center justify-center rounded-full text-white text-[12px] font-bold overflow-hidden border border-[var(--border)] hover:ring-2 hover:ring-[var(--primary)] transition-all ${isAdmin ? "bg-[var(--primary)]" : "bg-blue-600"}`}
              title={`تنظیمات حساب: ${profile.name} (${profile.roleTitle})`}
            >
              {profile.avatar && profile.avatar.startsWith("http") ? (
                <img src={profile.avatar} alt={profile.name} className="size-full object-cover" />
              ) : (
                profile.name?.charAt(0) || "ک"
              )}
            </Link>
          </div>
        )}
        {(isMobile || !collapsed) && (
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] px-[4px]">
            <span>RadarCheck v1.0</span>
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              متصل به سوپابیس
            </span>
          </div>
        )}
      </footer>
    </>
  );

  return (
    <>
      {/* 1. Mobile Top Bar with Hamburger Button (lg:hidden) */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex size-9 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors"
            title="باز کردن منو"
          >
            <Menu size={20} />
          </button>
          <Link href="/projects" className="flex items-center gap-2">
            <div className="relative h-6 w-24">
              <Image
                src="/Flow-Deck-Logo.png"
                alt="FlowDeck"
                fill
                sizes="100px"
                className="object-contain object-right dark:hidden"
              />
              <Image
                src="/Flow-Deck-Logo-for-dark-mode.png"
                alt="FlowDeck"
                fill
                sizes="100px"
                className="object-contain object-right hidden dark:block"
              />
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/settings"
            className="flex size-8 items-center justify-center rounded-full bg-[var(--primary)] text-white text-[11px] font-bold"
          >
            {profile.name?.charAt(0) || "ک"}
          </Link>
        </div>
      </header>

      {/* 2. Mobile Drawer (Slide-Over from Right side / RTL) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer Sidebar explicitly anchored to the Right (راست) */}
          <aside
            className="fixed inset-y-0 right-0 z-50 w-[285px] h-full flex flex-col border-l border-[var(--border)] bg-[var(--surface)] p-[16px] text-start shadow-2xl animate-in slide-in-from-right duration-200 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {renderNavContent(true)}
          </aside>
        </div>
      )}

      {/* 3. Desktop Sidebar (hidden on mobile, flex on lg) */}
      <aside
        className={`hidden lg:flex sticky top-0 h-screen shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)] text-start z-30 transition-all duration-300 ease-in-out ${
          collapsed ? "w-[72px] p-[10px]" : "w-[260px] p-[16px]"
        }`}
      >
        {renderNavContent(false)}
      </aside>
    </>
  );
}
