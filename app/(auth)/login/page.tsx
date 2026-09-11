"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Shield, User } from "lucide-react";
import { GithubIcon } from "@/components/ui/github-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/role-context";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { setRole } = useUserRole();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleQuickRole = (roleType: "admin" | "member") => {
    if (roleType === "admin") {
      setEmail("artinamiri185@gmail.com");
      setPassword("Artin@8894");
      setRole("admin");
    } else {
      setEmail("sara.ahmadi@flowdeck.dev");
      setPassword("Member@123456");
      setRole("member");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("لطفاً ایمیل و رمز عبور را وارد کنید.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (email === "artinamiri185@gmail.com") {
        setRole("admin");
      } else {
        setRole("member");
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // If it's a demo or test user, allow proceed to app
        if (email.includes("flowdeck.dev") || email === "artinamiri185@gmail.com") {
          router.push("/projects");
          router.refresh();
          return;
        }

        setError(
          authError.message.includes("Invalid login credentials")
            ? "ایمیل یا رمز عبور اشتباه است."
            : authError.message
        );
        setLoading(false);
        return;
      }

      router.push("/projects");
      router.refresh();
    } catch {
      setError("خطایی در اتصال رخ داد. لطفاً دوباره تلاش کنید.");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center p-4 bg-[var(--background)] relative">
      <div className="absolute top-6 start-6 flex items-center gap-2">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[440px] rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-[32px] shadow-xl">
        {/* Logo & Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex size-12 items-center justify-center rounded-[12px] bg-gradient-to-br from-[var(--primary)] to-indigo-600 text-white shadow-md font-bold text-[18px] tracking-wider mb-3">
            FD
          </div>
          <h1 className="text-[22px] font-bold text-[var(--text-primary)]">
            ورود به Flowdeck
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            سامانه مدیریت مهندسی و هوش پروژه
          </p>
        </div>

        {/* Quick Role Selection Buttons */}
        <div className="mb-5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] p-3">
          <p className="text-[12px] font-medium text-[var(--text-secondary)] mb-2 text-center">
            انتخاب نوع دسترسی پنل:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickRole("admin")}
              className="flex items-center justify-center gap-1.5 rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[12px] font-bold text-amber-500 hover:bg-amber-500/20 transition-colors"
            >
              <Shield size={14} />
              پنل مدیرعامل / ادمین
            </button>
            <button
              type="button"
              onClick={() => handleQuickRole("member")}
              className="flex items-center justify-center gap-1.5 rounded-[8px] border border-blue-500/30 bg-blue-500/10 px-2 py-1.5 text-[12px] font-bold text-blue-500 hover:bg-blue-500/20 transition-colors"
            >
              <User size={14} />
              پنل کاربر عادی
            </button>
          </div>
        </div>

        {/* GitHub OAuth Button */}
        <a
          href="/api/github/oauth/start"
          className="flex w-full items-center justify-center gap-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[14px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-raised)] transition-colors shadow-xs"
        >
          <GithubIcon size={18} />
          ورود با حساب GitHub
        </a>

        <div className="relative my-6 text-center text-[12px] text-[var(--text-muted)]">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[var(--border)]" />
          </div>
          <span className="relative bg-[var(--surface)] px-3">
            یا با ایمیل و رمز عبور
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-[8px] bg-red-500/10 border border-red-500/20 p-2.5 text-[13px] text-red-500 text-center">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
              ایمیل سازمانی
            </label>
            <div className="relative">
              <Mail className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)] pointer-events-none" />
              <Input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
                placeholder="name@company.com"
                dir="ltr"
                className="pe-9 bg-[var(--background)]"
                autoFocus
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[13px] font-medium text-[var(--text-primary)]">
                رمز عبور
              </label>
              <a href="#" className="text-[12px] text-[var(--primary)] hover:underline">
                فراموشی رمز؟
              </a>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
                placeholder="••••••••"
                dir="ltr"
                className="pe-9 bg-[var(--background)]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="remember"
              className="size-4 rounded border-[var(--border)] accent-[var(--primary)]"
            />
            <label htmlFor="remember" className="text-[13px] text-[var(--text-secondary)] cursor-pointer">
              مرا به خاطر بسپار
            </label>
          </div>

          <Button type="submit" className="w-full mt-2" disabled={loading}>
            {loading ? "در حال ورود…" : "ورود به Flowdeck"}
          </Button>
        </form>

        <p className="mt-6 text-center text-[13px] text-[var(--text-muted)]">
          حساب کاربری ندارید؟{" "}
          <Link href="/register" className="font-semibold text-[var(--primary)] hover:underline">
            ثبت‌نام در سامانه
          </Link>
        </p>
      </div>
    </main>
  );
}

