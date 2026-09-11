/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  User,
  Shield,
  KeyRound,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Mail,
  Briefcase,
  Sparkles,
  Building2,
  LogOut,
  Copy,
  Check,
  Users,
  ArrowRightLeft,
  Loader2,
} from "lucide-react";
import { GithubIcon } from "@/components/ui/github-icon";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/lib/role-context";
import { createClient } from "@/lib/supabase/client";
import { deleteUserAccountAction } from "@/app/actions/auth";
import {
  getOrganizationInfo,
  joinOrganizationByCode,
  leaveCurrentOrgAction,
  type OrgInfoResult,
} from "@/app/actions/organization";

export default function UserSettingsPage() {
  const { profile, isAdmin, updateProfile, logout } = useUserRole();
  const supabase = createClient();

  // Profile Form State
  const [name, setName] = useState(profile.name || "");
  const [roleTitle, setRoleTitle] = useState(profile.roleTitle || "");
  const [github, setGithub] = useState(profile.github || "");
  const [avatarUrl, setAvatarUrl] = useState(
    profile.avatar && profile.avatar.startsWith("http") ? profile.avatar : ""
  );

  // Status feedback
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Password Change State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Organization & Subordinate State
  const [orgInfo, setOrgInfo] = useState<OrgInfoResult | null>(null);
  const [newOrgCode, setNewOrgCode] = useState("");
  const [isJoiningOrg, setIsJoiningOrg] = useState(false);
  const [isLeavingOrg, setIsLeavingOrg] = useState(false);
  const [orgMessage, setOrgMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedOrgCode, setCopiedOrgCode] = useState(false);

  // Self Account Deletion State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const fetchOrg = async () => {
    try {
      const res = await getOrganizationInfo();
      if (res.ok) setOrgInfo(res);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    setName(profile.name || "");
    setRoleTitle(profile.roleTitle || "");
    setGithub(profile.github || "");
    if (profile.avatar && profile.avatar.startsWith("http")) {
      setAvatarUrl(profile.avatar);
    }
    fetchOrg();
  }, [profile]);

  // Sync GitHub Avatar shortcut
  const handleFetchGithubAvatar = () => {
    if (!github.trim()) return;
    const cleanGh = github.trim().replace(/^@/, "");
    const generatedUrl = `https://github.com/${cleanGh}.png`;
    setAvatarUrl(generatedUrl);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError("");
    setProfileSuccess(false);

    try {
      const finalAvatar =
        avatarUrl.trim() ||
        (github.trim()
          ? `https://github.com/${github.trim().replace(/^@/, "")}.png`
          : name.charAt(0) || "ک");

      const res = await updateProfile({
        name: name.trim() || "کاربر RadarCheck",
        roleTitle:
          roleTitle.trim() ||
          (isAdmin ? "مدیرعامل و ادمین ارشد" : "توسعه‌دهنده / کاربر عادی"),
        github: github.trim().replace(/^@/, "") || undefined,
        avatar: finalAvatar,
      });

      if (res.ok) {
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 3500);
      } else {
        setProfileError(res.error || "خطا در ذخیره‌سازی اطلاعات");
      }
    } catch (err: unknown) {
      setProfileError(
        err instanceof Error ? err.message : "خطای سیستمی در ذخیره اطلاعات"
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError("کلمه عبور جدید باید حداقل ۶ کاراکتر باشد.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("تکرار کلمه عبور با کلمه عبور جدید یکسان نیست.");
      return;
    }

    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordError(error.message || "خطا در تغییر رمز عبور");
      } else {
        setPasswordSuccess(true);
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPasswordSuccess(false), 4000);
      }
    } catch (err: unknown) {
      setPasswordError(
        err instanceof Error ? err.message : "خطای ارتباط با سرور"
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleJoinOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgCode.trim()) return;

    setIsJoiningOrg(true);
    setOrgMessage(null);

    try {
      const res = await joinOrganizationByCode(newOrgCode.trim());
      if (res.ok) {
        setOrgMessage({
          type: "success",
          text: `با موفقیت به سازمان «${res.workspaceName || "جدید"}» (مدیرعامل: ${res.ownerName || "مدیر ارشد"}) پیوستید.`,
        });
        setNewOrgCode("");
        await fetchOrg();
      } else {
        setOrgMessage({
          type: "error",
          text: res.error || "کد زیرمجموعه‌گیری نامعتبر است.",
        });
      }
    } catch {
      setOrgMessage({
        type: "error",
        text: "خطایی در برقراری ارتباط رخ داد. لطفاً مجدداً تلاش کنید.",
      });
    } finally {
      setIsJoiningOrg(false);
    }
  };

  const handleLeaveOrganization = async () => {
    if (
      !confirm(
        "آیا از خروج از این سازمان اطمینان دارید؟ با خروج، پروژه‌ها و گفتگوهای این مجموعه از دسترس شما خارج می‌شود."
      )
    ) {
      return;
    }

    setIsLeavingOrg(true);
    setOrgMessage(null);

    try {
      const res = await leaveCurrentOrgAction();
      if (res.ok) {
        setOrgMessage({
          type: "success",
          text: "با موفقیت از مجموعه خارج شدید. اکنون می‌توانید با کد جدید به سازمان دیگری بپیوندید.",
        });
        await fetchOrg();
      } else {
        setOrgMessage({
          type: "error",
          text: res.error || "خطا در خروج از سازمان",
        });
      }
    } catch {
      setOrgMessage({
        type: "error",
        text: "خطای سیستمی در پردازش درخواست خروج.",
      });
    } finally {
      setIsLeavingOrg(false);
    }
  };

  const effectiveAvatar =
    avatarUrl.trim() ||
    (github.trim()
      ? `https://github.com/${github.trim().replace(/^@/, "")}.png`
      : null);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              تنظیمات حساب کاربری
            </h1>
            <Badge
              variant={isAdmin ? "default" : "secondary"}
              className="gap-1 text-xs"
            >
              <Shield className="size-3" />
              {isAdmin ? "مدیرعامل (Admin)" : "کاربر عادی (Member)"}
            </Badge>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            مدیریت مشخصات شخصی، وضعیت سازمان و رمز عبور
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="gap-1.5 text-xs text-[var(--text-muted)] hover:text-red-500 hover:border-red-500/30"
          >
            خروج از حساب کاربری
          </Button>
        </div>
      </div>

      {/* Profile Information */}
      <Card className="border-[var(--border)]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="size-4 text-[var(--primary)]" />
            مشخصات فردی و پروفایل عمومی
          </CardTitle>
          <CardDescription>
            این اطلاعات در بورد پروژه‌ها، لیست اعضا و بخش نظرات برای همکاران نمایش داده می‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {profileError && (
              <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0" />
                اطلاعات حساب کاربری شما با موفقیت ذخیره و همگام گردید.
              </div>
            )}

            {/* Avatar & Display Preview */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)]">
              <div className="relative size-16 shrink-0 rounded-full overflow-hidden bg-[var(--primary)]/10 border-2 border-[var(--border)] flex items-center justify-center text-xl font-bold text-[var(--primary)]">
                {effectiveAvatar ? (
                  <img
                    src={effectiveAvatar}
                    alt={name}
                    className="size-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  name.charAt(0) || "ک"
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm text-[var(--text-primary)] truncate">
                  {name || "کاربر RadarCheck"}
                </h3>
                <p className="text-xs text-[var(--text-muted)] font-mono truncate">
                  {profile.email}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] py-0 px-2">
                    {roleTitle || "توسعه‌دهنده"}
                  </Badge>
                  {github && (
                    <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 font-mono">
                      <GithubIcon size={12} /> @{github}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-primary)]">
                  نام و نام خانوادگی
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: علی رضایی"
                  className="bg-[var(--surface-raised)]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-primary)]">
                  عنوان شغلی / تخصصی
                </label>
                <Input
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="مثال: Senior Frontend Engineer"
                  className="bg-[var(--surface-raised)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-primary)] flex items-center justify-between">
                  <span>ایمیل حساب (غیرقابل تغییر)</span>
                  <Mail className="size-3.5 text-[var(--text-muted)]" />
                </label>
                <Input
                  value={profile.email}
                  disabled
                  className="bg-[var(--surface-raised)] opacity-70 cursor-not-allowed font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-primary)] flex items-center justify-between">
                  <span>نام کاربری GitHub</span>
                  {github && (
                    <button
                      type="button"
                      onClick={handleFetchGithubAvatar}
                      className="text-[10px] text-[var(--primary)] hover:underline cursor-pointer"
                    >
                      دریافت خودکار آواتار
                    </button>
                  )}
                </label>
                <div className="relative">
                  <Input
                    value={github}
                    onChange={(e) => setGithub(e.target.value)}
                    placeholder="reza-dev"
                    className="bg-[var(--surface-raised)] font-mono text-xs pr-8"
                  />
                  <GithubIcon className="size-3.5 absolute right-2.5 top-3 text-[var(--text-muted)]" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-primary)]">
                آدرس مستقیم تصویر آواتار (اختیاری)
              </label>
              <Input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://avatars.githubusercontent.com/u/..."
                className="bg-[var(--surface-raised)] font-mono text-xs"
              />
              <p className="text-[11px] text-[var(--text-muted)]">
                می‌توانید یک لینک مستقیم تصویر قرار دهید یا با وارد کردن یوزرنیم گیت‌هاب دکمه دریافت آواتار را بزنید.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={profileSaving} className="gap-2">
                {profileSaving ? (
                  "در حال ذخیره..."
                ) : (
                  <>
                    <Save className="size-4" /> ذخیره تغییرات پروفایل
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Organization & Referral Code Section */}
      <Card className="border-[var(--border)]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="size-4 text-[var(--primary)]" />
            سازمان و زیرمجموعه
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? "اطلاعات سازمان و کد زیرمجموعه‌گیری مدیرعامل جهت عضویت پرسنل تیم"
              : "مدیریت عضویت در مجموعه، خروج از سازمان یا انتقال به سازمان جدید"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {orgMessage && (
            <div
              className={`p-3 rounded-md text-xs flex items-center gap-2 ${
                orgMessage.type === "success"
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400"
              }`}
            >
              {orgMessage.type === "success" ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <AlertCircle className="size-4 shrink-0" />
              )}
              {orgMessage.text}
            </div>
          )}

          {isAdmin ? (
            /* CEO View */
            <div className="rounded-xl bg-gradient-to-r from-[var(--primary)]/10 to-[var(--surface-raised)] p-5 border border-[var(--primary)]/20 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-[var(--text-muted)] font-medium">
                    کد زیرمجموعه‌گیری اختصاصی شما (جهت ارائه به پرسنل):
                  </div>
                  <div className="text-2xl font-mono font-bold text-[var(--primary)] tracking-wider mt-1">
                    {orgInfo?.inviteCode || "RADAR-185"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(orgInfo?.inviteCode || "RADAR-185");
                      setCopiedOrgCode(true);
                      setTimeout(() => setCopiedOrgCode(false), 2000);
                    }}
                    className="gap-1.5 text-xs bg-[var(--background)]"
                  >
                    {copiedOrgCode ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {copiedOrgCode ? "کپی شد" : "کپی کد"}
                  </Button>
                  <Button asChild size="sm" className="gap-1.5 text-xs">
                    <Link href="/members">
                      <Users className="size-3.5" />
                      مشاهده اعضای زیرمجموعه
                    </Link>
                  </Button>
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                پرسنل با وارد کردن این کد در هنگام ثبت‌نام، به طور مستقیم به این سازمان ملحق می‌شوند و پروژه‌ها، چت روم و تسک‌های مربوطه برای آن‌ها نمایش داده خواهد شد.
              </p>
            </div>
          ) : (
            /* Regular Member View */
            <div className="space-y-5">
              {/* Current Organization Details */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)]">
                <div className="space-y-1">
                  <div className="text-xs text-[var(--text-muted)]">مجموعه فعال شما:</div>
                  <div className="text-base font-bold text-[var(--text-primary)]">
                    {orgInfo?.workspaceName || "سازمان مهندسی RadarCheck"}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    مدیرعامل / رهبر سازمان:{" "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {orgInfo?.ownerName || "مدیر ارشد"}
                    </span>{" "}
                    {orgInfo?.ownerEmail && (
                      <span className="text-[var(--text-muted)] font-mono">
                        ({orgInfo.ownerEmail})
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLeaveOrganization}
                  disabled={isLeavingOrg}
                  className="shrink-0 gap-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:border-red-500/30"
                >
                  {isLeavingOrg ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <LogOut className="size-3.5" />
                  )}
                  خروج از این مجموعه
                </Button>
              </div>

              {/* Join New Organization */}
              <form
                onSubmit={handleJoinOrganization}
                className="p-4 rounded-xl border border-dashed border-[var(--border)] space-y-3"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <ArrowRightLeft className="size-4 text-[var(--primary)]" />
                  پیوستن به مجموعه یا سازمان جدید
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  اگر کد زیرمجموعه‌گیری جدیدی از کارفرما یا مدیرعامل دریافت کرده‌اید، آن را وارد کرده و تأیید نمایید:
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <div className="relative flex-1">
                    <Building2 className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)] pointer-events-none" />
                    <Input
                      dir="ltr"
                      value={newOrgCode}
                      onChange={(e) => setNewOrgCode(e.target.value.toUpperCase())}
                      placeholder="مثال: RADAR-185"
                      className="pe-9 font-mono uppercase bg-[var(--surface-raised)]"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isJoiningOrg || !newOrgCode.trim()}
                    className="shrink-0 gap-1.5 text-xs"
                  >
                    {isJoiningOrg ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    اعمال و پیوستن به سازمان
                  </Button>
                </div>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security & Password */}
      <Card className="border-[var(--border)]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="size-4 text-[var(--primary)]" />
            امنیت و تغییر کلمه عبور
          </CardTitle>
          <CardDescription>
            جهت افزایش امنیت حساب خود، می‌توانید کلمه عبور جدید تعیین نمایید.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {passwordError && (
              <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0" />
                رمز عبور شما با موفقیت تغییر یافت.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-primary)]">
                  کلمه عبور جدید
                </label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="حداقل ۶ کاراکتر"
                  className="bg-[var(--surface-raised)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-primary)]">
                  تکرار کلمه عبور جدید
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="تکرار کلمه عبور"
                  className="bg-[var(--surface-raised)]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="outline"
                disabled={passwordSaving || !newPassword}
                className="gap-2"
              >
                {passwordSaving ? (
                  "در حال بروزرسانی..."
                ) : (
                  <>
                    <KeyRound className="size-4" /> بروزرسانی رمز عبور
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone: Delete Account */}
      <Card className="border-red-500/30 bg-red-500/[0.02]">
        <CardHeader>
          <CardTitle className="text-base text-red-600 dark:text-red-400 flex items-center gap-2">
            <Trash2 className="size-4" />
            ناحیه خطرناک — حذف حساب کاربری
          </CardTitle>
          <CardDescription>
            با حذف حساب، تمام اطلاعات کاربری، عضویت در پروژه‌ها و دسترسی‌های شما به طور برگشت‌ناپذیر از پایگاه‌داده حذف خواهند شد.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg bg-red-500/5 border border-red-500/20">
            <div>
              <div className="text-sm font-semibold text-red-600 dark:text-red-400">
                حذف دائمی حساب کاربری ({profile.email})
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                پس از حذف، بلافاصله از سیستم خارج شده و اطلاعات شما قابل بازیابی نخواهد بود.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleteConfirmationText("");
                setDeleteError("");
                setDeleteModalOpen(true);
              }}
              className="shrink-0 gap-1.5"
            >
              <Trash2 size={14} />
              حذف حساب کاربری من
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Modal */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setDeleteModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-red-500/40 bg-[var(--surface)] p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="p-2.5 rounded-full bg-red-500/10 border border-red-500/30">
                <Trash2 className="size-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[var(--text-primary)]">
                  تأیید نهایی حذف حساب کاربری
                </h3>
                <p className="text-xs text-[var(--text-muted)]">این عملیات غیرقابل بازگشت است</p>
              </div>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              آیا مطمئن هستید که می‌خواهید حساب کاربری{" "}
              <strong className="text-[var(--text-primary)]">{profile.email}</strong> را به طور کامل از سیستم حذف کنید؟
            </p>

            {deleteError && (
              <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs">
                {deleteError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--text-primary)]">
                جهت تأیید، کلمه <span className="font-bold text-red-500 font-mono">حذف</span> یا{" "}
                <span className="font-bold text-red-500 font-mono">DELETE</span> را تایپ کنید:
              </label>
              <Input
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="حذف"
                className="text-center font-bold border-red-500/40 focus-visible:ring-red-500"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteModalOpen(false)}
                disabled={isDeletingAccount}
              >
                انصراف
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={
                  isDeletingAccount ||
                  (deleteConfirmationText.trim().toLowerCase() !== "حذف" &&
                    deleteConfirmationText.trim().toUpperCase() !== "DELETE")
                }
                onClick={async () => {
                  setIsDeletingAccount(true);
                  setDeleteError("");
                  try {
                    const res = await deleteUserAccountAction();
                    if (res.ok) {
                      await logout();
                      window.location.href = "/login?deleted=true";
                    } else {
                      setDeleteError(res.error || "خطا در حذف حساب کاربری");
                      setIsDeletingAccount(false);
                    }
                  } catch (err: unknown) {
                    const message =
                      err instanceof Error
                        ? err.message
                        : "خطای سیستمی در حذف اکانت";
                    setDeleteError(message);
                    setIsDeletingAccount(false);
                  }
                }}
              >
                {isDeletingAccount ? "در حال حذف..." : "تأیید و حذف دائمی اکانت"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
