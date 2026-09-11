/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Clock,
  Send,
  Shield,
  User,
  Settings,
  Sparkles,
  AlertCircle,
  Play,
  RotateCcw,
  PlusCircle,
  X,
  Volume2,
  Users,
  CheckCircle2,
  StopCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useUserRole } from "@/lib/role-context";
import { faNumber, toPersianDigits } from "@/lib/format";

interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string | null;
  senderName: string;
  senderEmail: string | null;
  senderRole: string;
  message: string;
  createdAt: string;
}

interface ChatSession {
  id: string;
  title: string;
  durationMinutes: number;
  startedAt: string;
  endsAt: string;
  isActive: boolean;
  remainingSeconds: number;
}

export default function ChatPage() {
  const { profile, isAdmin } = useUserRole();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [remainingSec, setRemainingSec] = useState<number>(600);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // CEO settings state
  const [newTitle, setNewTitle] = useState("جلسه هماهنگی سریع مهندسی");
  const [newDuration, setNewDuration] = useState("10");
  const [clearHistoryOnNew, setClearHistoryOnNew] = useState(false);
  const [updatingSettings, setUpdatingSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Poll or Fetch chat state
  const fetchChat = async () => {
    try {
      const res = await fetch("/api/v1/chat");
      if (res.ok) {
        const json = await res.json();
        if (json.session) {
          setSession(json.session);
          setRemainingSec(json.session.remainingSeconds);
          setNewTitle(json.session.title);
          setNewDuration(String(json.session.durationMinutes));
        }
        if (Array.isArray(json.messages)) {
          setMessages(json.messages);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchChat();
    const interval = setInterval(fetchChat, 3000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer tick every second
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || sending || remainingSec <= 0) return;

    const textToSend = inputMessage.trim();
    setInputMessage("");
    setSending(true);

    // Optimistic message
    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sessionId: session?.id || "temp",
      senderId: profile.id,
      senderName: profile.name,
      senderEmail: profile.email,
      senderRole: isAdmin ? "admin" : "member",
      message: textToSend,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempMsg.id ? json.data : m))
          );
        }
      }
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const handleStartNewSession = async () => {
    setUpdatingSettings(true);
    try {
      const res = await fetch("/api/v1/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_new",
          title: newTitle,
          durationMinutes: Number(newDuration) || 10,
          clearHistory: clearHistoryOnNew,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setSession(json.session);
        setRemainingSec(json.session.remainingSeconds);
        if (clearHistoryOnNew) setMessages([]);
        setSettingsOpen(false);
      }
    } catch {
      // ignore
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleExtendSession = async (minutes: number) => {
    try {
      const res = await fetch("/api/v1/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extend",
          addMinutes: minutes,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setSession(json.session);
        setRemainingSec(json.session.remainingSeconds);
      }
    } catch {
      // ignore
    }
  };

  const handleEndSession = async () => {
    if (!confirm("آیا از پایان دادن به سشن فعلی اطمینان دارید؟")) return;
    try {
      const res = await fetch("/api/v1/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "end",
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setSession(json.session);
        setRemainingSec(0);
      }
    } catch {
      // ignore
    }
  };

  // Format time MM:SS
  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    const formatted = `${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return toPersianDigits(formatted);
  };

  const isSessionActive = remainingSec > 0;
  const totalSessionSec = (session?.durationMinutes || 10) * 60;
  const progressPercent = Math.min(100, Math.max(0, (remainingSec / totalSessionSec) * 100));

  return (
    <section aria-label="اتاق گفتگوی زنده تیم" className="h-[calc(100vh-20px)] flex flex-col max-w-5xl mx-auto p-2 sm:p-4 gap-3">
      {/* Top Session Bar */}
      <header className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4 shadow-sm shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--primary)] text-white shadow-xs">
              <MessageSquare size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[16px] sm:text-[18px] font-bold text-[var(--text-primary)] truncate">
                  {session?.title || "اتاق گفتگوی زنده تیم مهندسی"}
                </h1>
                <Badge
                  variant={isSessionActive ? "success" : "destructive"}
                  className="text-[11px] gap-1"
                >
                  <span className={`size-1.5 rounded-full ${isSessionActive ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                  {isSessionActive ? "سشن فعال" : "سشن پایان‌یافته"}
                </Badge>
              </div>
              <p className="text-[12px] text-[var(--text-muted)] truncate mt-0.5">
                سشن زمان‌بندی‌شده گفتگوی متمرکز مهندسی و بازبینی اسپرینت
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Countdown Badge */}
            <div
              className={`flex items-center gap-2 rounded-[10px] border px-3 py-1.5 transition-colors ${
                remainingSec > 120
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : remainingSec > 60
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 animate-pulse"
              }`}
            >
              <Clock className="size-4" />
              <div className="flex flex-col text-start">
                <span className="text-[10px] opacity-80 leading-none">زمان باقی‌مانده</span>
                <span className="text-[15px] font-bold font-mono tracking-wider">
                  {formatTimer(remainingSec)}
                </span>
              </div>
            </div>

            {/* CEO Settings Button */}
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-[var(--border)]"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings size={15} className="text-[var(--primary)]" />
                <span className="hidden sm:inline">مدیریت سشن</span>
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar of Time */}
        <div className="w-full bg-[var(--surface-raised)] h-1.5 rounded-full overflow-hidden mt-3">
          <div
            className={`h-full transition-all duration-1000 ${
              remainingSec > 120
                ? "bg-emerald-500"
                : remainingSec > 60
                ? "bg-amber-500"
                : "bg-red-500"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Main Chat Area */}
      <Card className="flex-1 min-h-0 border-[var(--border)] bg-[var(--surface)] flex flex-col overflow-hidden shadow-sm">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--text-muted)] space-y-2">
              <MessageSquare size={36} className="opacity-40" />
              <p className="text-[14px] font-medium text-[var(--text-primary)]">
                هنوز پیامی در این سشن ارسال نشده است
              </p>
              <p className="text-[12px] max-w-sm">
                نخستین پیام هماهنگی یا نکته فنی خود را در کادر زیر بنویسید و با همکاران به اشتراک بگذارید.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderEmail?.toLowerCase() === profile.email.toLowerCase() || msg.senderId === profile.id;
              const isSenderAdmin = msg.senderRole === "admin";
              const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }) : "";

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar */}
                  <div
                    className={`size-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-xs ${
                      isSenderAdmin ? "bg-[var(--primary)]" : "bg-blue-600"
                    }`}
                  >
                    {msg.senderName.charAt(0) || "ک"}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${
                      isMe ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-[var(--text-muted)]">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {isMe ? "شما" : msg.senderName}
                      </span>
                      {isSenderAdmin && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1 border-amber-500/30 text-amber-500 gap-0.5">
                          <Shield size={9} />
                          مدیرعامل
                        </Badge>
                      )}
                      <span>•</span>
                      <span>{timeStr}</span>
                    </div>

                    <div
                      className={`rounded-[12px] px-3.5 py-2.5 text-[13px] leading-relaxed break-words shadow-xs ${
                        isMe
                          ? "bg-[var(--primary)] text-white rounded-tr-xs"
                          : "bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border)] rounded-tl-xs"
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Reactions / Tags */}
        {isSessionActive && (
          <div className="px-3 sm:px-4 py-1.5 border-t border-[var(--border)] bg-[var(--background)] flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <span className="text-[var(--text-muted)] text-[11px] shrink-0">برچسب‌های سریع:</span>
            {[
              "تأیید شد 👍",
              "نیاز به بررسی 🔍",
              "بلاک شد ⛔",
              "در حال انجام ⚡",
              "پول ریکوئست باز شد 🚀",
            ].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setInputMessage((prev) => (prev ? `${prev} [${tag}]` : `[${tag}] `))}
                className="shrink-0 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Message Input Box or Expired Notice */}
        <div className="p-3 sm:p-4 border-t border-[var(--border)] bg-[var(--surface)] shrink-0">
          {isSessionActive ? (
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="پیام خود را برای اعضای جلسه بنویسید..."
                className="flex-1 bg-[var(--background)]"
                autoFocus
              />
              <Button type="submit" disabled={!inputMessage.trim() || sending} className="gap-1.5 shrink-0">
                <Send size={15} />
                <span className="hidden sm:inline">{sending ? "ارسال..." : "ارسال"}</span>
              </Button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] bg-red-500/10 border border-red-500/20 p-3 text-[13px] text-red-600 dark:text-red-400">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>زمان این سشن به پایان رسیده است. گفتگو موقتاً بسته شد.</span>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => handleExtendSession(5)} variant="outline" className="h-7 text-[11px]">
                    تمدید ۵ دقیقه
                  </Button>
                  <Button size="sm" onClick={() => setSettingsOpen(true)} className="h-7 text-[11px]">
                    شروع سشن جدید
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* CEO Session Settings Modal */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-full max-w-[480px] rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-[24px] shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <Settings className="size-5 text-[var(--primary)]" />
                <h2 className="text-[17px] font-bold text-[var(--text-primary)]">
                  مدیریت و تنظیمات سشن گفتگو (مخصوص مدیرعامل)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-[8px] p-1 text-[var(--text-muted)] hover:bg-[var(--surface-raised)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  عنوان جلسه / سشن
                </label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: جلسه هماهنگی سریع مهندسی"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  مدت زمان سشن (دقیقه)
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {["5", "10", "15", "30"].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setNewDuration(mins)}
                      className={`rounded-[8px] border py-1.5 text-[12px] font-medium transition-colors ${
                        newDuration === mins
                          ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                          : "border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:border-[var(--primary)]"
                      }`}
                    >
                      {faNumber(Number(mins))} دقیقه
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  min="1"
                  max="120"
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  placeholder="یا تایپ مدت زمان دلخواه..."
                  className="font-mono text-start"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="clearHistory"
                  checked={clearHistoryOnNew}
                  onChange={(e) => setClearHistoryOnNew(e.target.checked)}
                  className="size-4 rounded border-[var(--border)] text-[var(--primary)]"
                />
                <label htmlFor="clearHistory" className="text-[12px] text-[var(--text-secondary)] cursor-pointer">
                  پاک‌سازی پیام‌های قبلی و شروع صفحه چت سفید برای سشن جدید
                </label>
              </div>

              <div className="rounded-[8px] bg-[var(--surface-raised)] p-3 text-[12px] text-[var(--text-muted)] space-y-1">
                <p className="font-semibold text-[var(--text-primary)]">عملیات سریع روی سشن جاری:</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-[11px]"
                    onClick={() => handleExtendSession(5)}
                  >
                    + تمدید ۵ دقیقه
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-[11px]"
                    onClick={() => handleExtendSession(10)}
                  >
                    + تمدید ۱۰ دقیقه
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-8 text-[11px]"
                    onClick={handleEndSession}
                  >
                    پایان دادن فوری به سشن
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
                انصراف
              </Button>
              <Button
                type="button"
                disabled={updatingSettings || !newTitle.trim()}
                onClick={handleStartNewSession}
                className="gap-1.5"
              >
                <Play size={15} />
                {updatingSettings ? "در حال ایجاد..." : "اعمال و شروع سشن جدید"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
