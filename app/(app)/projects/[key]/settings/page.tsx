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
import { MOCK_MEMBERS, MOCK_PROJECTS } from "@/components/features/__fixtures__/mock-data";
import { faNumber } from "@/lib/format";

export default function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = use(params);
  const project =
    MOCK_PROJECTS.find((p) => p.key === key.toUpperCase()) ?? MOCK_PROJECTS[0];

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [targetDate, setTargetDate] = useState(project.targetDate || "");
  const [saved, setSaved] = useState(false);
  const [members, setMembers] = useState(MOCK_MEMBERS);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberGithub, setNewMemberGithub] = useState("");

  // Invite Link State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState("contributor");
  const [copied, setCopied] = useState(false);
  const inviteLink = `https://engineering-pm.vercel.app/invite?project=${project.key.toLowerCase()}&role=${inviteRole}`;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    setMembers((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        displayName: newMemberName.trim(),
        avatarUrl: null,
        githubLogin: newMemberGithub.trim() || undefined,
      },
    ]);
    setNewMemberName("");
    setNewMemberGithub("");
    setAddMemberOpen(false);
  };

  const handleRemoveMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <section aria-label="تنظیمات پروژه" className="space-y-[24px] max-w-4xl mx-auto">
      <header>
        <h1 className="text-[20px] font-bold text-[var(--text-primary)]">
          تنظیمات پروژه — {project.key}
        </h1>
        <p className="text-[13px] text-[var(--text-muted)] mt-1">
          مدیریت اطلاعات پایه، دسترسی اعضا و تنظیمات پیشرفته
        </p>
      </header>

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
              <Input value={name} onChange={(e) => setName(e.target.value)} />
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
                rows={2}
                className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--background)] p-2.5 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] resize-none"
              />
            </label>
            <label className="grid gap-[6px] text-[13px] font-medium">
              تاریخ هدف (Target Date)
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </label>
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit">ذخیره تغییرات</Button>
              {saved && (
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                  <Check size={16} />
                  تغییرات با موفقیت ذخیره شد
                </span>
              )}
            </div>
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
          </div>
        </CardHeader>
        <CardContent className="space-y-[10px]">
          {members.map((m) => (
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
                <button
                  type="button"
                  onClick={() => handleRemoveMember(m.id)}
                  className="rounded p-1 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                  title="حذف از پروژه"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/30 bg-red-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-[8px] text-[16px] text-red-500">
            <AlertTriangle className="size-4" />
            بخش حساس (Danger Zone)
          </CardTitle>
          <CardDescription>
            عملیات غیرقابل برگشت روی این پروژه
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">
              آرشیو یا حذف پروژه
            </p>
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
              با حذف پروژه، تمام ایشوها، سایکل‌ها و مایلستون‌های مرتبط آرشیو می‌شوند.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm(`آیا مطمئن هستید که می‌خواهید پروژه ${project.name} را حذف کنید؟`)) {
                alert("پروژه با موفقیت آرشیو شد.");
              }
            }}
          >
            آرشیو پروژه
          </Button>
        </CardContent>
      </Card>

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

