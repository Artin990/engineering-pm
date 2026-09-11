/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Send,
  Shield,
  User,
  Trash2,
  Sparkles,
  AlertCircle,
  Users,
  CheckCircle2,
  Clock,
  Layers,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useUserRole } from "@/lib/role-context";
import { faNumber, toPersianDigits } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

interface ChatMessage {
  id: string;
  senderId: string | null;
  senderName: string;
  senderEmail: string | null;
  senderRole: string;
  message: string;
  createdAt: string;
}

export default function ChatPage() {
  const { profile, isAdmin } = useUserRole();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchChat = async () => {
    try {
      const res = await fetch("/api/v1/chat");
      if (res.ok) {
        const json = await res.json();
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

    // 1. Polling every 1.8s
    const interval = setInterval(fetchChat, 1800);

    // 2. Supabase Realtime channel
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    try {
      const supabase = createClient();
      channel = supabase
        .channel("radarcheck_live_chat")
        .on("broadcast", { event: "new_chat_message" }, () => {
          fetchChat();
        })
        .subscribe();
    } catch {
      // ignore
    }

    return () => {
      clearInterval(interval);
      if (channel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || sending) return;

    const textToSend = inputMessage.trim();
    setInputMessage("");
    setSending(true);

    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      senderId: profile.id,
      senderName: profile.name || "کاربر",
      senderEmail: profile.email,
      senderRole: isAdmin ? "admin" : "member",
      message: textToSend,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => {
      const updated = [...prev, tempMsg];
      return updated.length > 100 ? updated.slice(updated.length - 100) : updated;
    });

    try {
      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          senderName: profile.name,
          senderEmail: profile.email,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempMsg.id ? json.data : m))
          );
        }

        try {
          const supabase = createClient();
          supabase.channel("radarcheck_live_chat").send({
            type: "broadcast",
            event: "new_chat_message",
            payload: { msg: json.data },
          });
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const handleClearChat = async () => {
    if (!confirm("آیا از پاک‌سازی تاریخچه پیام‌های اتاق گفتگو اطمینان دارید؟")) return;
    setClearing(true);
    try {
      const res = await fetch("/api/v1/chat", { method: "DELETE" });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.messages)) {
          setMessages(json.messages);
        }
        try {
          const supabase = createClient();
          supabase.channel("radarcheck_live_chat").send({
            type: "broadcast",
            event: "new_chat_message",
            payload: { cleared: true },
          });
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    } finally {
      setClearing(false);
    }
  };

  const formatMessageTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return toPersianDigits(
        date.toLocaleTimeString("fa-IR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch {
      return "";
    }
  };

  const QUICK_PROMPTS = [
    "✅ تسک آماده تست در سرور است.",
    "🚀 پول‌ریکوئست جدید در گیت‌هاب ایجاد شد.",
    "⚠️ با خطای سیستمی مواجه شدم، نیاز به بررسی دارم.",
    "🤝 جلسه هماهنگی فنی را شروع کنیم؟",
    "🎯 مایلستون این هفته تکمیل شد.",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] max-w-5xl mx-auto p-4 md:p-6 space-y-4">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center border border-[var(--primary)]/20 shrink-0">
            <MessageSquare className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                اتاق گفتگوی زنده مهندسی
              </h1>
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                آنلاین و زنده
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              تبادل مستقیم نظر و پیام میان کارفرما و کلیه اعضای سازمان (ظرفیت سقف ۱۰۰ پیام با بازنویسی خودکار)
            </p>
          </div>
        </div>

        {/* Capacity Indicator & CEO Controls */}
        <div className="flex items-center gap-2.5">
          <Badge
            variant="outline"
            className="text-xs py-1.5 px-3 bg-[var(--surface-raised)] border-[var(--border)] gap-1.5 font-mono"
          >
            <Layers className="size-3.5 text-[var(--primary)]" />
            <span>ظرفیت: {faNumber(messages.length)} / {faNumber(100)} پیام</span>
          </Badge>

          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearChat}
              disabled={clearing}
              className="text-xs gap-1.5 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10"
              title="پاک‌سازی کلیه پیام‌های تاریخچه"
            >
              <Trash2 className="size-3.5" />
              پاک‌سازی گفتگو
            </Button>
          )}
        </div>
      </div>

      {/* 2. Chat Messages Area */}
      <Card className="flex-1 min-h-0 border-[var(--border)] bg-[var(--surface)] flex flex-col overflow-hidden shadow-xs">
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2 opacity-70">
              <MessageSquare className="size-12 text-[var(--text-muted)] stroke-1" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                هنوز پیامی در این گفتگو ارسال نشده است.
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                اولین پیام را بنویسید تا همکاران و کارفرما بلافاصله آن را دریافت کنند.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe =
                (profile.email && m.senderEmail && profile.email.toLowerCase() === m.senderEmail.toLowerCase()) ||
                (profile.id && m.senderId && profile.id === m.senderId);
              const isSenderAdmin = m.senderRole === "admin";

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isMe ? "items-start" : "items-end"} animate-in fade-in slide-in-from-bottom-2 duration-150`}
                >
                  {/* Sender Header */}
                  <div className={`flex items-center gap-1.5 mb-1 px-1 text-[11px] ${isMe ? "flex-row" : "flex-row-reverse"}`}>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {isMe ? "شما" : m.senderName}
                    </span>
                    {isSenderAdmin && (
                      <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        <Shield className="size-2.5" />
                        مدیرعامل
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      {formatMessageTime(m.createdAt)}
                    </span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                      isMe
                        ? "bg-[var(--primary)] text-white rounded-br-xs"
                        : "bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-primary)] rounded-bl-xs"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Bar */}
        <div className="border-t border-[var(--border)] px-4 py-2 bg-[var(--surface-raised)]/50 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
          <span className="text-[10px] text-[var(--text-muted)] font-medium shrink-0 flex items-center gap-1">
            <Sparkles className="size-3 text-[var(--primary)]" />
            پیام‌های سریع:
          </span>
          {QUICK_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setInputMessage(p);
              }}
              className="text-[11px] shrink-0 bg-[var(--surface)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] border border-[var(--border)] text-[var(--text-secondary)] px-2.5 py-1 rounded-full transition-colors cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>

        {/* 3. Chat Input Box */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 sm:p-4 border-t border-[var(--border)] bg-[var(--surface)] flex items-center gap-2"
        >
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="پیام خود را برای کارفرما و تیم بنویسید…"
            className="flex-1 bg-[var(--surface-raised)] text-xs sm:text-sm h-11 px-4"
            autoFocus
          />
          <Button
            type="submit"
            disabled={!inputMessage.trim() || sending}
            className="h-11 px-5 gap-2 text-xs sm:text-sm shrink-0 shadow-sm"
          >
            <Send className="size-4 rotate-180" />
            <span>ارسال</span>
          </Button>
        </form>
      </Card>
    </div>
  );
}
