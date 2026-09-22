"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Eye,
  EyeOff,
  User,
  Mail,
  Lock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { GithubIcon } from "@/components/ui/github-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/role-context";
import { useI18n } from "@/lib/i18n/context";
import { syncUserProfile } from "@/app/actions/auth";
import { isValidIranianNationalId } from "@/lib/validators/national-id";
import { isUserAdminEmail } from "@/lib/auth/admin-check";

function RegisterForm() {
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { setUserSession } = useUserRole();
  const { t, locale, dir } = useI18n();

  const [isCeo, setIsCeo] = useState(false);
  const [nationalId, setNationalId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [isEmailConfirmationPending, setIsEmailConfirmationPending] = useState(false);
  const [isCeoPendingVerification, setIsCeoPendingVerification] = useState(false);

  useEffect(() => {
    const roleParam = searchParams.get("role") || searchParams.get("type");
    if (roleParam === "ceo" || roleParam === "admin") {
      setIsCeo(true);
    }
    const errParam = searchParams.get("error");
    if (errParam) {
      setError(decodeURIComponent(errParam));
    }
    const codeParam = searchParams.get("code") || searchParams.get("invite") || searchParams.get("ref");
    if (codeParam) {
      setInviteCode(codeParam.toUpperCase());
    }
  }, [searchParams]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedCode = inviteCode.trim().toUpperCase();

    if (!trimmedName || !trimmedEmail || !password) {
      setError("لطفاً تمامی فیلدهای الزامی را تکمیل نمایید.");
      return;
    }

    if (trimmedName.length < 2) {
      setError("نام و نام خانوادگی باید حداقل ۲ کاراکتر باشد.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("فرمت ایمیل وارد شده نامعتبر است.");
      return;
    }

    if (password.length < 6) {
      setError("کلمه عبور باید حداقل ۶ کاراکتر باشد.");
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      setError("کلمه عبور با تکرار آن یکسان نیست.");
      return;
    }

    if (isCeo) {
      const cleanNationalId = nationalId.replace(/\D/g, "");
      if (!isValidIranianNationalId(cleanNationalId)) {
        setError("کد ملی ۱۰ رقمی مدیرعامل نامعتبر است. لطفاً کد ملی معتبر وارد نمایید.");
        return;
      }
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
      setError("متغیرهای محیطی اتصال به Supabase در پنل ورسل تنظیم نشده‌اند (NEXT_PUBLIC_SUPABASE_URL).");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            name: trimmedName,
            full_name: trimmedName,
            display_name: trimmedName,
            invite_code: isCeo ? undefined : (trimmedCode || undefined),
            national_id: isCeo ? nationalId.trim() : undefined,
            role: isCeo ? "admin" : "member",
          },
        },
      });

      if (signUpError) {
        let msg = "خطا در ایجاد حساب کاربری.";
        if (
          signUpError.message.includes("User already registered") ||
          signUpError.message.includes("already registered") ||
          signUpError.message.includes("unique constraint")
        ) {
          msg = "حساب کاربری با این ایمیل قبلاً ایجاد شده است. لطفاً وارد شوید.";
        } else if (signUpError.message.includes("Password should be")) {
          msg = "کلمه عبور انتخابی بیش از حد ساده یا کوتاه است.";
        } else {
          msg = signUpError.message;
        }
        setError(msg);
        setLoading(false);
        return;
      }

      if (data?.user) {
        const isAdmin = isUserAdminEmail(trimmedEmail);

        // همگام‌سازی کاربر و احراز هویت در دیتابیس
        await syncUserProfile({
          id: data.user.id,
          email: trimmedEmail,
          name: trimmedName,
          inviteCode: isCeo ? null : (trimmedCode || null),
          nationalId: isCeo ? nationalId.trim() : null,
          isCeo: isCeo,
        });

        // اگر ثبت‌نام به عنوان مدیرعامل جدید است و ایمیل در لیست سوپرادمین‌ها نیست: وضعیت در انتظار تایید
        if (isCeo && !isAdmin) {
          setRegisteredEmail(trimmedEmail);
          setIsCeoPendingVerification(true);
          setLoading(false);
          return;
        }

        // اگر سشن بلافاصله فعال است
        if (data.session) {
          setUserSession({
            id: data.user.id,
            name: trimmedName,
            email: trimmedEmail,
          });
          window.location.href = "/projects";
          return;
        }

        // در غیر این صورت، نیاز به تأیید ایمیل است
        setRegisteredEmail(trimmedEmail);
        setIsEmailConfirmationPending(true);
        setLoading(false);
      }
    } catch {
      setError("خطایی در ایجاد حساب کاربری رخ داد. لطفاً مجدداً تلاش نمایید.");
      setLoading(false);
    }
  };

  const handleGithubOAuth = async () => {
    setOauthLoading(true);
    setError("");
    try {
      const codeToPass = inviteCode.trim().toUpperCase();
      const callbackUrl = codeToPass
        ? `${window.location.origin}/callback?invite=${encodeURIComponent(codeToPass)}`
        : `${window.location.origin}/callback`;

      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: callbackUrl,
          scopes: "read:user user:email repo",
        },
      });

      if (oauthErr) {
        setError("خطا در ثبت‌نام با GitHub: " + oauthErr.message);
        setOauthLoading(false);
      }
    } catch {
      setError("خطا در شروع فرایند ثبت‌نام با GitHub.");
      setOauthLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center p-4 bg-[var(--background)] relative" dir={dir}>
      <div className="absolute top-6 start-6 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[460px] rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-[32px] shadow-xl">
        {/* Logo & Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative h-12 w-48 mb-2">
            <Image
              src="/Flow-Deck-Logo.png"
              alt="FlowDeck"
              fill
              sizes="200px"
              className="object-contain logo-light dark:hidden"
              priority
            />
            <Image
              src="/Flow-Deck-Logo-for-dark-mode.png"
              alt="FlowDeck"
              fill
              sizes="200px"
              className="object-contain logo-dark hidden dark:block"
              priority
            />
          </div>
          <h1 className="text-[20px] font-bold text-[var(--text-primary)]">
            {t.auth.registerTitle}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            {t.auth.registerSubtitle}
          </p>
        </div>

        {isCeoPendingVerification ? (
          <div className="space-y-4 rounded-[12px] bg-amber-500/10 border border-amber-500/20 p-5 text-center animate-in fade-in">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="size-6" />
            </div>
            <h2 className="text-[16px] font-bold text-[var(--text-primary)]">
              مدارک در انتظار تایید هویت پلتفرم (US1)
            </h2>
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
              اطلاعات حساب کاربری و کد ملی شما با موفقیت ثبت شد. حساب‌های مدیرعامل پس از تایید هویت توسط تیم پشتیبانی فعال می‌شوند.
            </p>
            <div className="p-3 bg-[var(--surface)] rounded-lg text-xs text-muted-foreground border font-mono" dir="ltr">
              {registeredEmail}
            </div>
            <div className="pt-3">
              <Link href="/login">
                <Button className="w-full">
                  بازگشت به صفحه ورود
                </Button>
              </Link>
            </div>
          </div>
        ) : isEmailConfirmationPending ? (
          <div className="space-y-4 rounded-[12px] bg-emerald-500/10 border border-emerald-500/20 p-5 text-center animate-in fade-in">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-6" />
            </div>
            <h2 className="text-[16px] font-bold text-[var(--text-primary)]">
              ثبت‌نام با موفقیت انجام شد!
            </h2>
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
              لینک فعال‌سازی به آدرس <span className="font-semibold text-[var(--text-primary)]" dir="ltr">{registeredEmail}</span> ارسال گردید. لطفاً برای فعال‌سازی حساب، روی لینک ارسالی کلیک نمایید.
            </p>
            <div className="pt-3">
              <Link href="/login">
                <Button className="w-full">
                  رفتن به صفحه ورود
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Role / Onboarding Selector (US1 & US2) */}
            <div className="flex rounded-xl bg-[var(--background)] p-1 border mb-4">
              <button
                type="button"
                onClick={() => { setIsCeo(false); setError(""); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  !isCeo
                    ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                عضو تیم (با کد دعوت)
              </button>
              <button
                type="button"
                onClick={() => { setIsCeo(true); setError(""); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  isCeo
                    ? "bg-[var(--surface)] text-[var(--primary)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                مدیرعامل / کارفرما (با کد ملی)
              </button>
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
              ثبت‌نام سریع با GitHub
            </Button>

            <div className="relative my-6 text-center text-[12px] text-[var(--text-muted)]">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[var(--border)]" />
              </div>
              <span className="relative bg-[var(--surface)] px-3">
                یا تکمیل مشخصات فردی
              </span>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-[8px] bg-red-500/10 border border-red-500/20 p-3 text-[13px] text-red-500">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Register Form */}
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="reg-name" className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  نام و نام خانوادگی
                </label>
                <div className="relative">
                  <User className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)] pointer-events-none" />
                  <Input
                    id="reg-name"
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => { setName(e.target.value); if (error) setError(""); }}
                    placeholder="مثال: علی رضایی"
                    className="pe-9 bg-[var(--background)]"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  ایمیل سازمانی
                </label>
                <div className="relative">
                  <Mail className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)] pointer-events-none" />
                  <Input
                    id="reg-email"
                    name="email"
                    type="email"
                    dir="ltr"
                    autoComplete="username email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
                    placeholder="name@company.com"
                    className="pe-9 text-start bg-[var(--background)]"
                    required
                  />
                </div>
              </div>

              {/* Conditional Field: National ID for CEO vs Invite Code for Member */}
              {isCeo ? (
                <div>
                  <label htmlFor="reg-national-id" className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                    کد ملی ۱۰ رقمی مدیرعامل (جهت احراز هویت الزامی است)
                  </label>
                  <div className="relative">
                    <ShieldCheck className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)] pointer-events-none" />
                    <Input
                      id="reg-national-id"
                      name="nationalId"
                      dir="ltr"
                      maxLength={10}
                      value={nationalId}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setNationalId(val);
                        if (error) setError("");
                      }}
                      placeholder="0012345678"
                      className="pe-9 text-start font-mono tracking-widest bg-[var(--background)]"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    احراز هویت مدیرعامل طبق استاندارد الگوریتم ریاضی کشور بررسی می‌گردد.
                  </p>
                </div>
              ) : (
                <div>
                  <label htmlFor="reg-code" className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                    کد زیرمجموعه‌گیری مدیرعامل (اختیاری)
                  </label>
                  <div className="relative">
                    <Building2 className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)] pointer-events-none" />
                    <Input
                      id="reg-code"
                      name="inviteCode"
                      dir="ltr"
                      value={inviteCode}
                      onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); if (error) setError(""); }}
                      placeholder="مثال: RADAR-185"
                      className="pe-9 text-start font-mono uppercase bg-[var(--background)]"
                    />
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    در صورت دریافت کد از مدیرعامل، اینجا وارد نمایید تا مستقیماً به پروژه‌ها متصل شوید.
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="reg-password" className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  کلمه عبور (حداقل ۶ کاراکتر)
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    tabIndex={-1}
                    aria-label={showPassword ? "مخفی کردن کلمه عبور" : "نمایش کلمه عبور"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <Input
                    id="reg-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    dir="ltr"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
                    placeholder="••••••••"
                    className="pe-9 text-start bg-[var(--background)]"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-confirm-password" className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  تکرار کلمه عبور
                </label>
                <div className="relative">
                  <Lock className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)] pointer-events-none" />
                  <Input
                    id="reg-confirm-password"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    dir="ltr"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(""); }}
                    placeholder="••••••••"
                    className="pe-9 text-start bg-[var(--background)]"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)] pt-1">
                <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
                <span>اطلاعات شما با استاندارد RLS و رمزنگاری امن محافظت می‌شود.</span>
              </div>

              <Button type="submit" className="w-full mt-2" disabled={loading || oauthLoading}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    در حال ایجاد حساب…
                  </span>
                ) : (
                  "تأیید و ساخت حساب کاربری"
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-[13px] text-[var(--text-muted)]">
              قبلاً حساب کاربری داشته‌اید؟{" "}
              <Link href="/login" className="font-semibold text-[var(--primary)] hover:underline">
                وارد شوید
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="size-8 animate-spin text-[var(--primary)]" /></div>}>
      <RegisterForm />
    </Suspense>
  );
}
