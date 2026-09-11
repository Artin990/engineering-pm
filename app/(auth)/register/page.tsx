"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, User, Mail } from "lucide-react";
import { GithubIcon } from "@/components/ui/github-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      setError("لطفاً تمامی فیلدها را پر کنید.");
      return;
    }

    if (password.length < 6) {
      setError("رمز عبور باید حداقل ۶ کاراکتر باشد.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name.trim(),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        router.push("/projects");
        router.refresh();
      } else {
        setSuccess(true);
        setLoading(false);
      }
    } catch {
      setError("خطایی رخ داد. لطفاً دوباره تلاش کنید.");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center p-4 bg-[var(--background)] relative">
      <div className="absolute top-6 start-6 flex items-center gap-2">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[420px] rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-[32px] shadow-xl">
        {/* Logo & Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex size-12 items-center justify-center rounded-[12px] bg-gradient-to-br from-[var(--primary)] to-indigo-600 text-white shadow-md font-bold text-[18px] tracking-wider mb-3">
            FD
          </div>
          <h1 className="text-[22px] font-bold text-[var(--text-primary)]">
            ایجاد حساب کاربری Flowdeck
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            سامانه یکپارچه مدیریت پروژه‌های مهندسی
          </p>
        </div>

        {/* GitHub OAuth Button */}
        <a
          href="/api/github/oauth/start"
          className="flex w-full items-center justify-center gap-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[14px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-raised)] transition-colors shadow-xs"
        >
          <GithubIcon size={18} />
          ثبت‌نام سریع با GitHub
        </a>

        <div className="relative my-6 text-center text-[12px] text-[var(--text-muted)]">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[var(--border)]" />
          </div>
          <span className="relative bg-[var(--surface)] px-3">
            یا ثبت مشخصات فردی
          </span>
        </div>

        {success ? (
          <div className="mb-4 rounded-[8px] bg-emerald-500/10 border border-emerald-500/20 p-4 text-[13px] text-emerald-600 dark:text-emerald-400 text-center space-y-2">
            <p className="font-semibold">ثبت‌نام شما با موفقیت انجام شد!</p>
            <p className="text-[12px]">در صورت نیاز، ایمیل تایید برای شما ارسال شد. اکنون می‌توانید وارد شوید.</p>
            <Link href="/login" className="inline-block mt-2 font-bold text-[var(--primary)] hover:underline">
              رفتن به صفحه ورود
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-[8px] bg-red-500/10 border border-red-500/20 p-2.5 text-[13px] text-red-500 text-center">
                {error}
              </div>
            )}

            {/* Register Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
              نام و نام خانوادگی
            </label>
            <div className="relative">
              <User className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)] pointer-events-none" />
              <Input
                value={name}
                onChange={(e) => { setName(e.target.value); if (error) setError(""); }}
                placeholder="مثال: علی رضایی"
                className="pe-9 bg-[var(--background)]"
                autoFocus
              />
            </div>
          </div>

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
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
              رمز عبور (حداقل ۶ کاراکتر)
            </label>
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

          <Button type="submit" className="w-full mt-2" disabled={loading}>
            {loading ? "در حال ایجاد حساب…" : "تأیید و ساخت حساب کاربری"}
          </Button>
        </form>
        </>
        )}

        <p className="mt-6 text-center text-[13px] text-[var(--text-muted)]">
          قبلاً حساب کاربری داشته‌اید؟{" "}
          <Link href="/login" className="font-semibold text-[var(--primary)] hover:underline">
            وارد شوید
          </Link>
        </p>
      </div>
    </main>
  );
}

