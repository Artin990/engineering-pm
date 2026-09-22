"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  GitPullRequest,
  GitCommit,
  Copy,
  Check,
  ExternalLink,
  Link as LinkIcon,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GithubIcon } from "@/components/ui/github-icon";
import { useUserRole } from "@/lib/role-context";
import { useProjectStore } from "@/lib/project-store";
import { faNumber } from "@/lib/format";

export default function GithubPage() {
  const params = useParams<{ key: string }>();
  const projectKey = (params?.key || "PM").toUpperCase();

  const { isAdmin } = useUserRole();
  const { members, updateMember } = useProjectStore();

  const [copiedLink, setCopiedLink] = useState(false);

  // Dynamic PRs, Commits, and Suggestions from database
  const [prs] = useState<{
    id: string;
    prNumber: number;
    title: string;
    authorLogin: string;
    state: "open" | "merged" | "closed";
    url: string;
    repoName: string;
    updatedAt: string;
  }[]>([]);

  const [commits] = useState<{
    id: string;
    sha: string;
    message: string;
    authorLogin: string;
    branch: string;
    time: string;
  }[]>([]);

  const [suggestions, setSuggestions] = useState<{
    id: string;
    issueKey: string;
    issueTitle: string;
    currentStatus: string;
    suggestedStatus: string;
    confidence?: number;
  }[]>([]);

  const inviteLink = typeof window !== "undefined"
    ? `${window.location.origin}/register?invite=${projectKey.toLowerCase()}-gh`
    : `https://flowdeck.dev/register?invite=${projectKey.toLowerCase()}`;

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSuggestionAction = (id: string, action?: "accept" | "reject") => {
    void action;
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              هوش و یکپارچه‌سازی GitHub
            </h1>
            <Badge variant="outline" className="font-mono text-xs">
              {projectKey}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            مشاهده حساب‌های گیت‌هاب اعضا، تولید لینک دعوت، بررسی PRها و همگام‌سازی مخازن
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={copyInvite}
            variant="outline"
            className="gap-2 text-xs border-border bg-card shadow-xs"
          >
            {copiedLink ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <LinkIcon className="w-3.5 h-3.5" />
            )}
            {copiedLink ? "لینک کپی شد!" : "کپی لینک دعوت همکاران"}
          </Button>

          <Button asChild size="sm" className="gap-2">
            <a
              href="https://github.com/apps"
              target="_blank"
              rel="noreferrer"
            >
              <GithubIcon size={14} />
              اتصال GitHub App
            </a>
          </Button>
        </div>
      </div>

      {/* Invite Link Banner */}
      <Card className="border-primary/30 bg-primary/5 shadow-xs">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">لینک دعوت سریع به پروژه {projectKey}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                این لینک را برای اعضای تیم ارسال کنید تا مستقیم وارد پروژه شده و گیت‌هاب خود را وصل کنند.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input
              readOnly
              value={inviteLink}
              className="bg-card text-xs font-mono max-w-xs h-9"
              dir="ltr"
            />
            <Button size="sm" onClick={copyInvite} className="gap-1.5 shrink-0">
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedLink ? "کپی شد" : "کپی"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Team Members' GitHub Accounts Section */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <GithubIcon size={16} />
              حساب‌های GitHub اعضای تیم ({faNumber(members.length)})
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              یوزرنیم‌های متصل به پروژه جهت رهگیری PRها، کامیت‌ها و آنالیتیکس فردی
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {members.map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-xl border border-border/70 bg-card hover:border-primary/50 transition-colors flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white ${
                        m.role === "admin"
                          ? "bg-amber-600"
                          : m.role === "intern"
                          ? "bg-purple-600"
                          : "bg-blue-600"
                      }`}
                    >
                      {m.displayName.charAt(0)}
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-foreground block truncate">
                        {m.displayName}
                      </span>
                      <span className="text-[10px] text-muted-foreground block font-mono">
                        {m.role === "admin"
                          ? "مدیر"
                          : m.role === "intern"
                          ? "کارآموز"
                          : "مهندس"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                  {m.githubLogin ? (
                    <a
                      href={`https://github.com/${m.githubLogin}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-primary hover:underline"
                    >
                      <GithubIcon size={12} />
                      @{m.githubLogin}
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">متصل نشده</span>
                  )}

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextGh = prompt(`یوزرنیم GitHub برای ${m.displayName}:`, m.githubLogin || "");
                        if (nextGh !== null) {
                          updateMember(m.id, { githubLogin: nextGh.trim() });
                        }
                      }}
                      className="text-[10px] text-muted-foreground hover:text-foreground underline"
                    >
                      {m.githubLogin ? "ویرایش" : "+ افزودن"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Status Suggestions */}
      {suggestions.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Sparkles className="w-4 h-4" />
              پیشنهادهای هوشمند تغییر وضعیت از GitHub ({faNumber(suggestions.length)})
            </CardTitle>
            <CardDescription className="text-xs">
              بر اساس مرج یا بسته شدن PRها، این تغییر وضعیت‌ها پیشنهاد شده است:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-lg border border-amber-500/20 bg-card text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-foreground">{s.issueKey}</span>
                  <span className="ms-2 font-medium">{s.issueTitle}</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    تغییر وضعیت از <span className="font-semibold">{s.currentStatus}</span> به{" "}
                    <span className="font-semibold text-primary">{s.suggestedStatus}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSuggestionAction(s.id, "accept")}
                    className="h-7 px-3 text-xs"
                  >
                    تأیید
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSuggestionAction(s.id, "reject")}
                    className="h-7 px-3 text-xs"
                  >
                    رد
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* PRs and Commits Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pull Requests */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GitPullRequest className="w-4 h-4 text-purple-500" />
              Pull Requestهای اخیر
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/60">
            {prs.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                هنوز هیچ Pull Request همگام‌سازی‌شده‌ای برای این مخزن ثبت نشده است.
              </div>
            ) : (
              prs.map((pr) => (
                <div key={pr.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium hover:underline block truncate text-foreground text-sm"
                    >
                      #{pr.prNumber} — {pr.title}
                    </a>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      {pr.repoName} · توسط @{pr.authorLogin} · {pr.updatedAt}
                    </p>
                  </div>
                  <Badge
                    variant={pr.state === "merged" ? "secondary" : "default"}
                    className="text-[10px] shrink-0"
                  >
                    {pr.state === "merged" ? "مرج‌شده" : "باز"}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Commits */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-blue-500" />
              آخرین کامیت‌های ثبت‌شده
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/60">
            {commits.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                هنوز کامیتی در این پروژه ثبت نشده است.
              </div>
            ) : (
              commits.map((c) => (
                <div key={c.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <span className="font-mono text-[11px] text-primary font-bold">{c.sha}</span>
                    <span className="ms-2 font-medium text-foreground">{c.message}</span>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      شاخه {c.branch} · توسط @{c.authorLogin} · {c.time}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
