"use client";

import { use, useState } from "react";
import {
  Settings,
  Users,
  Check,
  AlertTriangle,
  Trash2,
  UserPlus,
  X,
  Link as LinkIcon,
  Copy,
  CheckCheck,
  Shield,
  Lock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProjectByKey } from "@/components/features/__fixtures__/mock-data";
import { faNumber, faDate } from "@/lib/format";
import { useUserRole } from "@/lib/role-context";
import { useProjectStore, removeProjectFromLocalStorage } from "@/lib/project-store";
import { deleteUserAccountAction } from "@/app/actions/auth";
import { deleteProjectAction } from "@/app/actions/issues";

export default function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = use(params);
  const normalizedKey = (key || "PM").toUpperCase();
  const fallbackProject = getProjectByKey(normalizedKey)!;

  const { project: storeProject, updateProject, members, addMember, deleteMember } = useProjectStore();
  const project = storeProject || fallbackProject;

  const { isAdmin, profile, logout } = useUserRole();

  const [name, setName] = useState(project?.name || fallbackProject.name);
  const [description, setDescription] = useState(project?.description || "");
  const [targetDate, setTargetDate] = useState(project?.targetDate || "");
  const [saved, setSaved] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberGithub, setNewMemberGithub] = useState("");

  // Project Deletion State (Admin / CEO Only)
  const [deleteProjectModalOpen, setDeleteProjectModalOpen] = useState(false);
  const [deleteProjectConfirmText, setDeleteProjectConfirmText] = useState("");
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [deleteProjectError, setDeleteProjectError] = useState("");

  // Self Account Deletion State
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Invite Link State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState("contributor");
  const [copied, setCopied] = useState(false);
  const inviteLink = typeof window !== "undefined"
    ? `${window.location.origin}/register?invite=${project.key.toLowerCase()}&role=${inviteRole}`
    : `https://radarcheck.dev/invite?project=${project.key.toLowerCase()}&role=${inviteRole}`;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    updateProject({ name: name.trim(), description: description.trim(), targetDate: targetDate || null });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!newMemberName.trim()) return;

    const newId = `m-${Date.now()}`;
    addMember({
      id: newId,
      displayName: newMemberName.trim(),
      avatarUrl: null,
      githubLogin: newMemberGithub.trim() || undefined,
      role: "member",
      status: "active",
      joinedAt: "امروز",
    });

    try {
      await fetch(`/api/v1/projects/${project.key}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: newMemberName.trim(),
          githubLogin: newMemberGithub.trim() || undefined,
          role: "contributor",
        }),
      });
    } catch {
      // ignore
    }

    setNewMemberName("");
    setNewMemberGithub("");
    setAddMemberOpen(false);
  };

  const handleRemoveMember = async (id: string) => {
    if (!isAdmin) return;
    deleteMember(id);
    try {
      await fetch(`/api/v1/projects/${project.key}/members?userId=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } catch {
      // ignore
    }
  };

  return (
    <section aria-label="تنظیمات پروژه" className="space-y-[24px] max-w-4xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--text-primary)]">
            تنظیمات پروژه — {project.key}
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">
            مدیریت اطلاعات پایه، دسترسی اعضا و تنظیمات پیشرفته
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={isAdmin ? "default" : "secondary"}
            className="gap-1 py-1 px-2.5 text-[12px]"
          >
            {isAdmin ? <Shield size={14} className="text-amber-400" /> : <Lock size={14} />}
            نقش فعال: {profile.roleTitle}
          </Badge>
        </div>
      </header>

      {/* Role Restriction Banner for Normal Users */}
      {!isAdmin && (
        <div className="rounded-[12px] border border-blue-500/20 bg-blue-500/10 p-4 text-[13px] text-blue-600 dark:text-blue-400 flex items-start gap-3">
          <Lock className="size-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">دسترسی فقط خواندنی (نقش: کاربر عادی)</p>
            <p className="text-[12px] text-[var(--text-muted)]">
              شما به عنوان کاربر عادی به این پروژه دسترسی دارید. امکان ویرایش اطلاعات پایه، افزودن/حذف اعضا و حذف پروژه صرفاً برای <strong>مدیرعامل و ادمین ارشد</strong> امکان‌پذیر است. شما می‌توانید تسک‌های خود را در بخش ایشوها پیگیری و ثبت کنید.
            </p>
          </div>
        </div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-[8px] text-[16px]">
            <Settings className="size-4 text-[var(--primary)]" />
            اطلاعات پایه پروژه
          </CardTitle>
          <CardDescription>
            نام، توضیحات و تاریخ هدف برای محاسبات پیشرفت
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="grid gap-[16px] max-w-lg">
            <label className="grid gap-[6px] text-[13px] font-medium">
              نام پروژه
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isAdmin}
                className={!isAdmin ? "opacity-75 cursor-not-allowed bg-[var(--surface-raised)]" : ""}
              />
            </label>
            <label className="grid gap-[6px] text-[13px] font-medium">
              کد پروژه (لاتین)
              <Input value={project.key} dir="ltr" className="font-mono uppercase" disabled />
            </label>
            <label className="grid gap-[6px] text-[13px] font-medium">
              توضیحات
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!isAdmin}
                rows={2}
                className={`w-full rounded-[10px] border border-[var(--border)] bg-[var(--background)] p-2.5 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] resize-none ${
                  !isAdmin ? "opacity-75 cursor-not-allowed bg-[var(--surface-raised)]" : ""
                }`}
              />
            </label>
            <label className="grid gap-[6px] text-[13px] font-medium">
              <div className="flex items-center justify-between">
                <span>تاریخ هدف (سررسید پروژه)</span>
                {targetDate && (
                  <span className="text-[12px] font-normal text-[var(--primary)]">
                    تقویم شمسی: {faDate(targetDate)}
                  </span>
                )}
              </div>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                disabled={!isAdmin}
                className={!isAdmin ? "opacity-75 cursor-not-allowed bg-[var(--surface-raised)]" : ""}
              />
            </label>
            {isAdmin && (
              <div className="flex items-center gap-3 pt-2">
                <Button type="submit">ذخیره تغییرات</Button>
                {saved && (
                  <span className="flex items-center gap-1.5 text-[13px] font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                    <Check size={16} />
                    تغییرات با موفقیت ذخیره شد
                  </span>
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-[8px] text-[16px]">
                <Users className="size-4 text-[var(--primary)]" />
                اعضای پروژه ({faNumber(members.length)})
              </CardTitle>
              <CardDescription className="mt-1">
                افرادی که به این پروژه دسترسی دارند
              </CardDescription>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setInviteModalOpen(true)} className="gap-1.5">
                  <LinkIcon size={14} />
                  تولید لینک دعوت
                </Button>
                <Button size="sm" onClick={() => setAddMemberOpen(true)} className="gap-1.5">
                  <UserPlus size={14} />
                  افزودن مستقیم
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-[10px]">
          {members.length === 0 ? (
            <p className="text-[13px] text-[var(--text-muted)] py-4 text-center">
              هنوز عضوی به این پروژه افزوده نشده است. از دکمه‌های بالا برای دعوت یا افزودن اعضا استفاده کنید.
            </p>
          ) : (
            members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-[10px] border border-[var(--border)] p-[12px] bg-[var(--background)]"
              >
                <span className="flex items-center gap-[10px] text-[14px] font-medium">
                  <span className="flex size-8 items-center justify-center rounded-full bg-[var(--primary)] text-[12px] font-semibold text-white">
                    {m.displayName.charAt(0)}
                  </span>
                  <div>
                    <div className="font-semibold text-[13px]">{m.displayName}</div>
                    {m.githubLogin && (
                      <span dir="ltr" className="text-[11px] text-[var(--text-muted)] block">
                        @{m.githubLogin}
                      </span>
                    )}
                  </div>
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">عضو تیم</Badge>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.id)}
                      className="rounded p-1 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                      title="حذف از پروژه"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Danger Zone — Admin / CEO Only */}
      {isAdmin && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-[8px] text-[16px] text-red-500">
              <AlertTriangle className="size-4" />
              ناحیه بحرانی مدیریت پروژه (مخصوص مدیرعامل)
            </CardTitle>
            <CardDescription>
              عملیات حساس و غیرقابل بازگشت روی پروژه {project.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                حذف دائمی این پروژه ({project.name} — {project.key})
              </p>
              <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                با حذف پروژه، کلیه ایشوها، تسک‌ها، چرخه‌ها (Cycles)، مایلستون‌ها، فایل‌ها و آمار آن برای همیشه از پایگاه‌داده حذف خواهند شد.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5 shadow-sm"
              onClick={() => {
                setDeleteProjectError("");
                setDeleteProjectConfirmText("");
                setDeleteProjectModalOpen(true);
              }}
            >
              <Trash2 className="size-4" />
              حذف دائمی این پروژه
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Account Deletion Danger Zone for Regular User */}
      <Card className="border-red-500/30 bg-red-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-[8px] text-[16px] text-red-500">
            <AlertTriangle className="size-4" />
            حساب کاربری و حذف دائمی اکانت
          </CardTitle>
          <CardDescription>
            مدیریت حضور شما در سامانه و حذف کامل داده‌های کاربری
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">
              حذف دائمی حساب کاربری ({profile.name})
            </p>
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
              با حذف اکانت، تمام اطلاعات پروفایل، دسترسی‌ها و نشست‌های فعال شما از پایگاه داده حذف خواهند شد.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setDeleteError("");
              setDeleteConfirmationText("");
              setDeleteAccountModalOpen(true);
            }}
          >
            حذف حساب کاربری من
          </Button>
        </CardContent>
      </Card>

      {/* Delete Project Confirmation Modal (Admin Only) */}
      {deleteProjectModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => !isDeletingProject && setDeleteProjectModalOpen(false)}
        >
          <div
            className="w-full max-w-[490px] rounded-[12px] border border-red-500/40 bg-[var(--surface)] p-[24px] shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="size-5" />
                <h2 className="text-[17px] font-bold">
                  تأیید حذف دائمی پروژه {project.name}
                </h2>
              </div>
              <button
                type="button"
                disabled={isDeletingProject}
                onClick={() => setDeleteProjectModalOpen(false)}
                className="rounded-[8px] p-1 text-[var(--text-muted)] hover:bg-[var(--surface-raised)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-[8px] bg-red-500/10 border border-red-500/20 p-3.5 text-[13px] text-red-600 dark:text-red-400 space-y-1.5">
              <p className="font-bold">⚠️ هشدار مدیریتی: این عملیات غیرقابل برگشت است!</p>
              <p className="text-[12px] leading-relaxed">
                شما در حال حذف کامل پروژه <strong>{project.name}</strong> با کلید <strong>{project.key}</strong> هستید. تمام داده‌های مرتبط از پایگاه‌داده و پنل اعضا برای همیشه پاک خواهند شد.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-[13px] font-medium text-[var(--text-primary)]">
                جهت تأیید، کلید پروژه <code className="bg-[var(--surface-raised)] px-2 py-0.5 rounded text-red-500 font-mono font-bold">{project.key}</code> یا عبارت <code className="bg-[var(--surface-raised)] px-2 py-0.5 rounded text-red-500 font-bold">حذف</code> را وارد نمایید:
              </label>
              <Input
                value={deleteProjectConfirmText}
                onChange={(e) => setDeleteProjectConfirmText(e.target.value)}
                placeholder={project.key}
                disabled={isDeletingProject}
                className="font-mono text-start"
                dir="ltr"
                autoFocus
              />
            </div>

            {deleteProjectError && (
              <p className="text-[12px] text-red-500 bg-red-500/10 p-2 rounded border border-red-500/20">
                {deleteProjectError}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={isDeletingProject}
                onClick={() => setDeleteProjectModalOpen(false)}
              >
                انصراف
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={
                  isDeletingProject ||
                  (deleteProjectConfirmText.trim().toUpperCase() !== project.key.toUpperCase() &&
                    deleteProjectConfirmText.trim() !== "حذف" &&
                    deleteProjectConfirmText.trim().toUpperCase() !== "DELETE")
                }
                onClick={async () => {
                  setIsDeletingProject(true);
                  setDeleteProjectError("");
                  try {
                    const res = await deleteProjectAction(project.key);
                    if (res.ok) {
                      removeProjectFromLocalStorage(project.key);
                      window.location.href = "/projects?deleted=" + encodeURIComponent(project.key);
                    } else {
                      setDeleteProjectError(res.error || "خطا در حذف پروژه از سرور");
                      setIsDeletingProject(false);
                    }
                  } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : "خطای سیستمی در حذف پروژه";
                    setDeleteProjectError(message);
                    setIsDeletingProject(false);
                  }
                }}
              >
                {isDeletingProject ? "در حال حذف کامل پروژه..." : "تأیید و حذف دائمی پروژه"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {deleteAccountModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => !isDeletingAccount && setDeleteAccountModalOpen(false)}
        >
          <div
            className="w-full max-w-[480px] rounded-[12px] border border-red-500/40 bg-[var(--surface)] p-[24px] shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="size-5" />
                <h2 className="text-[17px] font-bold">
                  تأییدیه حذف دائمی حساب کاربری
                </h2>
              </div>
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={() => setDeleteAccountModalOpen(false)}
                className="rounded-[8px] p-1 text-[var(--text-muted)] hover:bg-[var(--surface-raised)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-[8px] bg-red-500/10 border border-red-500/20 p-3 text-[13px] text-red-600 dark:text-red-400 space-y-1">
              <p className="font-bold">⚠️ هشدار: این عملیات غیرقابل بازگشت است!</p>
              <p className="text-[12px]">
                پروفایل، عضویت در پروژه‌ها، تسک‌ها و حساب کاربری ایمیل <strong>{profile.email}</strong> برای همیشه از سرور و پایگاه‌داده حذف می‌شود.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-[13px] font-medium text-[var(--text-primary)]">
                جهت تأیید، عبارت <code className="bg-[var(--surface-raised)] px-1.5 py-0.5 rounded text-red-500 font-bold">DELETE</code> یا <code className="bg-[var(--surface-raised)] px-1.5 py-0.5 rounded text-red-500 font-bold">حذف</code> را تایپ کنید:
              </label>
              <Input
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="DELETE"
                disabled={isDeletingAccount}
                className="font-mono text-start"
                dir="ltr"
              />
            </div>

            {deleteError && (
              <p className="text-[12px] text-red-500">{deleteError}</p>
            )}

            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={isDeletingAccount}
                onClick={() => setDeleteAccountModalOpen(false)}
              >
                انصراف
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={
                  isDeletingAccount ||
                  (deleteConfirmationText.trim().toUpperCase() !== "DELETE" &&
                    deleteConfirmationText.trim() !== "حذف")
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
                {isDeletingAccount ? "در حال حذف حساب..." : "تأیید و حذف دائمی اکانت"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {addMemberOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setAddMemberOpen(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-[24px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h2 className="text-[17px] font-bold text-[var(--text-primary)]">
                افزودن عضو جدید
              </h2>
              <button
                type="button"
                onClick={() => setAddMemberOpen(false)}
                className="rounded-[8px] p-1 text-[var(--text-muted)] hover:bg-[var(--surface-raised)]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="mt-4 space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  نام کامل <span className="text-red-500">*</span>
                </label>
                <Input
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="مثال: مریم حسینی"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  نام کاربری GitHub
                </label>
                <Input
                  value={newMemberGithub}
                  onChange={(e) => setNewMemberGithub(e.target.value)}
                  placeholder="maryam-hosseini"
                  dir="ltr"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
                <Button type="button" variant="outline" onClick={() => setAddMemberOpen(false)}>
                  انصراف
                </Button>
                <Button type="submit" disabled={!newMemberName.trim()}>
                  افزودن عضو
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Link Modal */}
      {inviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setInviteModalOpen(false)}
        >
          <div
            className="w-full max-w-[460px] rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-[24px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <LinkIcon className="size-5 text-[var(--primary)]" />
                <h2 className="text-[17px] font-bold text-[var(--text-primary)]">
                  تولید لینک دعوت به پروژه
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="rounded-[8px] p-1 text-[var(--text-muted)] hover:bg-[var(--surface-raised)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-[13px] text-[var(--text-muted)]">
                هر شخصی که این لینک را داشته باشد می‌تواند به پروژه <strong>{project.name}</strong> ملحق شود.
              </p>

              <div>
                <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  نقش دسترسی دعوت‌شونده
                </label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="انتخاب نقش" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">مشاهده‌کننده (Viewer - فقط خواندنی)</SelectItem>
                    <SelectItem value="contributor">همکار (Contributor - ثبت و ویرایش تسک‌ها)</SelectItem>
                    <SelectItem value="lead">مدیر فنی (Lead - دسترسی کامل پروژه)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  لینک اختصاصی دعوت
                </label>
                <div className="flex items-center gap-2">
                  <Input value={inviteLink} readOnly dir="ltr" className="font-mono text-[12px] bg-[var(--background)] select-all" />
                  <Button type="button" onClick={handleCopyInvite} className="shrink-0 gap-1.5">
                    {copied ? <CheckCheck size={16} className="text-emerald-300" /> : <Copy size={16} />}
                    {copied ? "کپی شد!" : "کپی"}
                  </Button>
                </div>
              </div>

              <div className="rounded-[8px] bg-[var(--surface-raised)] p-3 text-[12px] text-[var(--text-muted)] flex items-start gap-2">
                <Shield size={16} className="text-[var(--primary)] shrink-0 mt-0.5" />
                <span>این لینک دارای اعتبارسنجی خودکار RLS در سوپابیس است و دسترسی بر اساس نقش تعیین‌شده محدود می‌گردد.</span>
              </div>

              <div className="mt-6 flex justify-end border-t border-[var(--border)] pt-4">
                <Button type="button" variant="outline" onClick={() => setInviteModalOpen(false)}>
                  بستن
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

