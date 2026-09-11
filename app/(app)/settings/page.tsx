/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { GithubIcon } from "@/components/ui/github-icon";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/lib/role-context";
import { createClient } from "@/lib/supabase/client";
import { deleteUserAccountAction } from "@/app/actions/auth";

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

  // Self Account Deletion State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    setName(profile.name || "");
    setRoleTitle(profile.roleTitle || "");
    setGithub(profile.github || "");
    if (profile.avatar && profile.avatar.startsWith("http")) {
      setAvatarUrl(profile.avatar);
    }
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
      const finalAvatar = avatarUrl.trim() || (github.trim() ? `https://github.com/${github.trim().replace(/^@/, "")}.png` : name.charAt(0) || "ک");
      
      const res = await updateProfile({
        name: name.trim() || "کاربر RadarCheck",
        roleTitle: roleTitle.trim() || (isAdmin ? "مدیرعامل و ادمین ارشد" : "توسعه‌دهنده / کاربر عادی"),
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
      setProfileError(err instanceof Error ? err.message : "خطای سیستمی در ذخیره اطلاعات");
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
      setPasswordError(err instanceof Error ? err.message : "خطای ارتباط با سرور");
    } finally {
      setPasswordSaving(false);
    }
  };

  const effectiveAvatar = avatarUrl.trim() || (github.trim() ? `https://github.com/${github.trim().replace(/^@/, "")}.png` : null);

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
              className={isAdmin ? "bg-amber-500/10 text-amber-500 border-amber-500/30" : ""}
            >
              {isAdmin ? "مدیر کل" : "کاربر عادی"}
            </Badge>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            اطلاعات فردی، هویت گیت‌هاب، رمز عبور و تنظیمات اختصاصی حساب خود را در این بخش مدیریت کنید.
          </p>
        </div>
      </div>

      {/* Profile Overview Banner */}
      <Card className="border-[var(--border)] bg-gradient-to-r from-[var(--surface-raised)] to-[var(--surface)]">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-start">
            <div className="relative group">
              <span className="flex size-20 shrink-0 items-center justify-center rounded-full text-white text-2xl font-bold overflow-hidden border-2 border-[var(--primary)] bg-[var(--primary)] shadow-md">
                {effectiveAvatar ? (
                  <img src={effectiveAvatar} alt={profile.name} className="size-full object-cover" />
                ) : (
                  profile.name?.charAt(0) || "ک"
                )}
              </span>
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">{profile.name}</h2>
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium border border-amber-500/20">
                    <Shield size={12} /> مدیر ارشد
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium border border-blue-500/20">
                    <User size={12} /> کاربر عادی
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--text-secondary)]">{profile.roleTitle}</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-[var(--text-muted)] pt-1">
                <span className="flex items-center gap-1">
                  <Mail size={13} /> {profile.email}
                </span>
                {profile.github && (
                  <a
                    href={`https://github.com/${profile.github}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[var(--primary)] hover:underline"
                  >
                    <GithubIcon size={13} /> github.com/{profile.github}
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile Form */}
      <Card className="border-[var(--border)]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="size-4 text-[var(--primary)]" />
            ویرایش اطلاعات فردی و شغلی
          </CardTitle>
          <CardDescription>
            نام و عنوان شغلی شما در تمام پروژه‌ها، ایشوها و گزارش‌های سازمانی نمایش داده خواهد شد.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            {profileError && (
              <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0" />
                اطلاعات پروفایل شما با موفقیت بروزرسانی شد.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-primary)]">
                  نام و نام خانوادگی <span className="text-red-500">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: آرتین امیری"
                  required
                  className="bg-[var(--surface-raised)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-primary)]">
                  عنوان شغلی / تخصصی
                </label>
                <div className="relative">
                  <Input
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    placeholder="مثال: Senior Frontend Developer"
                    className="bg-[var(--surface-raised)] pr-8"
                  />
                  <Briefcase className="size-3.5 absolute right-2.5 top-3 text-[var(--text-muted)]" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-primary)]">
                  آدرس ایمیل (غیرقابل تغییر مستقیم)
                </label>
                <Input
                  value={profile.email}
                  disabled
                  className="bg-[var(--surface)] text-[var(--text-muted)] cursor-not-allowed opacity-80"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[var(--text-primary)]">
                    نام کاربری GitHub
                  </label>
                  {github && (
                    <button
                      type="button"
                      onClick={handleFetchGithubAvatar}
                      className="text-[11px] text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles size={11} /> دریافت آواتار از گیت‌هاب
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    value={github}
                    onChange={(e) => setGithub(e.target.value)}
                    placeholder="مثال: Artin990"
                    className="bg-[var(--surface-raised)] pr-8 font-mono text-xs"
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
                    const message = err instanceof Error ? err.message : "خطای سیستمی در حذف اکانت";
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
