"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Mail, Lock, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { GithubIcon } from "@/components/ui/github-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/role-context";
import { syncUserProfile } from "@/app/actions/auth";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/projects";
  const urlError = searchParams.get("error");

  const supabase = createClient();
  const { setUserSession } = useUserRole();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState(urlError ? decodeURIComponent(urlError) : "");

  // Forgot password state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      setError("لطفاً ایمیل و رمز عبور خود را وارد کنید.");
      return;
    }

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("فرمت ایمیل وارد شده صحیح نیست.");
      return;
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
      setError("متغیرهای محیطی اتصال به Supabase در پنل ورسل تنظیم نشده‌اند (NEXT_PUBLIC_SUPABASE_URL).");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        let msg = "خطا در ورود به حساب کاربری.";
        if (authError.message.includes("Invalid login credentials")) {
          msg = "ایمیل یا رمز عبور اشتباه است.";
        } else if (authError.message.includes("Email not confirmed")) {
          msg = "ایمیل شما هنوز تأیید نشده است. لطفاً صندوق ورودی ایمیل خود را بررسی کنید.";
        } else if (authError.message.includes("Too many requests")) {
          msg = "تلاش‌های ناموفق بیش از حد مجاز. لطفاً دقایقی دیگر تلاش کنید.";
        } else {
          msg = authError.message;
        }
        setError(msg);
        setLoading(false);
        return;
      }

      if (data?.user) {
        const userMeta = data.user.user_metadata || {};
        const userName = userMeta.name || userMeta.full_name || email.split("@")[0];

        // ذخیره در سشن کلاینت
        setUserSession({
          id: data.user.id,
          email: data.user.email || email.trim(),
          name: userName,
          avatar: userMeta.avatar_url || userMeta.picture,
          github: userMeta.user_name || userMeta.github_login,
        });

        // همگام‌سازی غیربلاک‌کننده در دیتابیس
        try {
          await syncUserProfile({
            id: data.user.id,
            email: data.user.email || email.trim(),
            name: userName,
            avatarUrl: userMeta.avatar_url || userMeta.picture,
            githubLogin: userMeta.user_name || userMeta.github_login,
          });
        } catch (syncErr) {
          console.warn("[Login] syncUserProfile non-fatal note:", syncErr);
        }

        window.location.href = redirectTo;
      }
    } catch (err: unknown) {
      console.error("[Login] error:", err);
      const message = err instanceof Error ? err.message : "خطایی در برقراری ارتباط رخ داد. لطفاً اتصال اینترنت خود را بررسی نمایید.";
      setError(message);
      setLoading(false);
    }
  };

  const handleGithubOAuth = async () => {
    setOauthLoading(true);
    setError("");
    try {
      const inviteCode = searchParams.get("code") || searchParams.get("invite") || "";
      const callbackUrl = inviteCode
        ? `${window.location.origin}/callback?invite=${encodeURIComponent(inviteCode)}`
        : `${window.location.origin}/callback`;

      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: callbackUrl,
          scopes: "read:user user:email repo",
        },
      });

      if (oauthErr) {
        setError("خطا در اتصال به حساب GitHub: " + oauthErr.message);
        setOauthLoading(false);
      }
    } catch {
      setError("خطا در شروع فرایند ورود با GitHub.");
      setOauthLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError("لطفاً ایمیل خود را وارد نمایید.");
      return;
    }

    setForgotLoading(true);
    setForgotError("");

    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/callback?next=/projects/settings`,
      });

      if (resetErr) {
        setForgotError(resetErr.message);
      } else {
        setForgotSuccess(true);
      }
    } catch {
      setForgotError("خطا در ارسال ایمیل بازیابی رمز عبور.");
    } finally {
      setForgotLoading(false);
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
          <div className="relative h-12 w-48 mb-2">
            <Image
              src="/Flow-Deck-Logo.png"
              alt="RadarCheck"
              fill
              sizes="200px"
              className="object-contain dark:hidden"
              priority
            />
            <Image
              src="/Flow-Deck-Logo-for-dark-mode.png"
              alt="RadarCheck"
              fill
              sizes="200px"
              className="object-contain hidden dark:block"
              priority
            />
          </div>
          <h1 className="text-[20px] font-bold text-[var(--text-primary)]">
            ورود به سامانه
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            مدیریت پروژه + مدیریت مهندسی + هوش گیت‌هاب
          </p>
        </div>

        {/* GitHub OAuth Button */}
        <Button
          type="button"
          variant="outline"
          onClick={handleGithubOAuth}
          disabled={oauthLoading || loading}
          className="flex w-full items-center justify-center gap-2.5 rounded-[10px] border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[14px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-raised)] transition-colors shadow-xs"
        >
          {oauthLoading ? <Loader2 className="size-4 animate-spin" /> : <GithubIcon size={18} />}
          ورود با حساب GitHub
        </Button>

        <div className="relative my-6 text-center text-[12px] text-[var(--text-muted)]">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[var(--border)]" />
          </div>
          <span className="relative bg-[var(--surface)] px-3">
            یا با ایمیل و رمز عبور
          </span>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-[8px] bg-red-500/10 border border-red-500/20 p-3 text-[13px] text-red-500">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
              ایمیل سازمانی
            </label>
            <div className="relative">
              <Mail className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)] pointer-events-none" />
              <Input
                id="email"
                name="email"
                type="email"
                dir="ltr"
                autoComplete="username email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
                placeholder="name@company.com"
                className="pe-9 text-start bg-[var(--background)]"
                autoFocus
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-[13px] font-medium text-[var(--text-primary)]">
                رمز عبور
              </label>
              <button
                type="button"
                onClick={() => { setShowForgotModal(true); setForgotSuccess(false); setForgotError(""); }}
                className="text-[12px] text-[var(--primary)] hover:underline focus:outline-hidden cursor-pointer"
              >
                فراموشی رمز؟
              </button>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                tabIndex={-1}
                aria-label={showPassword ? "مخفی کردن رمز" : "نمایش رمز"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                dir="ltr"
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
                placeholder="••••••••"
                className="pe-9 text-start bg-[var(--background)]"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="remember"
              name="remember"
              defaultChecked
              className="size-4 rounded border-[var(--border)] accent-[var(--primary)]"
            />
            <label htmlFor="remember" className="text-[13px] text-[var(--text-secondary)] cursor-pointer select-none">
              مرا به خاطر بسپار
            </label>
          </div>

          <Button type="submit" className="w-full mt-2" disabled={loading || oauthLoading}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                در حال احراز هویت…
              </span>
            ) : (
              "ورود به RadarCheck"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-[13px] text-[var(--text-muted)]">
          حساب کاربری ندارید؟{" "}
          <Link href="/register" className="font-semibold text-[var(--primary)] hover:underline">
            ثبت‌نام در سامانه
          </Link>
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-[400px] rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 mb-4 text-[var(--text-primary)]">
              <Lock className="size-5 text-[var(--primary)]" />
              <h2 className="text-[16px] font-bold">بازیابی رمز عبور</h2>
            </div>

            {forgotSuccess ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-[8px] bg-emerald-500/10 border border-emerald-500/20 p-3 text-[13px] text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                  <span>لینک بازیابی رمز عبور به ایمیل شما ارسال گردید. لطفاً ایمیل خود را بررسی نمایید.</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowForgotModal(false)}
                >
                  بستن
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">
                  ایمیل حساب کاربری خود را وارد کنید تا لینک بازیابی کلمه عبور برای شما ارسال شود.
                </p>

                {forgotError && (
                  <div className="flex items-start gap-2 rounded-[8px] bg-red-500/10 border border-red-500/20 p-2.5 text-[12px] text-red-500">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <div>
                  <Input
                    type="email"
                    dir="ltr"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="bg-[var(--background)]"
                    autoFocus
                    required
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        در حال ارسال…
                      </span>
                    ) : (
                      "ارسال لینک بازیابی"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForgotModal(false)}
                    disabled={forgotLoading}
                  >
                    انصراف
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen w-full items-center justify-center p-4 bg-[var(--background)]">
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-[14px]">
            <Loader2 className="size-5 animate-spin text-[var(--primary)]" />
            <span>در حال بارگذاری صفحه ورود…</span>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
