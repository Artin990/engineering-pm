/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Send,
  Shield,
  Trash2,
  Sparkles,
  Layers,
  Edit3,
  Reply,
  Smile,
  X,
  Check,
  CornerDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useUserRole } from "@/lib/role-context";
import { faNumber, toPersianDigits } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

export interface ChatReplyInfo {
  id: string;
  senderName: string;
  message: string;
}

export interface ChatMessage {
  id: string;
  senderId: string | null;
  senderName: string;
  senderEmail: string | null;
  senderRole: string;
  message: string;
  createdAt: string;
  updatedAt?: string | null;
  isEdited?: boolean;
  replyTo?: ChatReplyInfo | null;
  reactions?: Record<string, string[]>;
}

const COMMON_EMOJIS = ["👍", "❤️", "🚀", "😂", "🔥", "👀", "👏", "🎉"];

export default function ChatPage() {
  const { profile, isAdmin } = useUserRole();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

  // Edit state
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Active emoji picker popup for a message ID
  const [activeEmojiPickerMsgId, setActiveEmojiPickerMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const myIdentifier = profile.name || profile.email || "کاربر";

  const fetchChat = async () => {
    try {
      const res = await fetch("/api/v1/chat");
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.messages)) {
          setMessages(json.messages);
          // Mark all read in localStorage for sidebar badge
          try {
            localStorage.setItem("radarcheck_chat_last_read_count", String(json.messages.length));
            localStorage.setItem("radarcheck_chat_last_read_timestamp", String(Date.now()));
            window.dispatchEvent(new Event("radarcheck_chat_read"));
          } catch {
            // ignore
          }
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
    if (!editingMessage) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, editingMessage]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || sending) return;

    const textToSend = inputMessage.trim();
    const currentReply = replyingTo
      ? {
          id: replyingTo.id,
          senderName: replyingTo.senderName,
          message: replyingTo.message.slice(0, 100),
        }
      : null;

    setInputMessage("");
    setReplyingTo(null);
    setSending(true);

    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      senderId: profile.id,
      senderName: profile.name || "کاربر",
      senderEmail: profile.email,
      senderRole: isAdmin ? "admin" : "member",
      message: textToSend,
      createdAt: new Date().toISOString(),
      replyTo: currentReply,
      reactions: {},
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
          replyTo: currentReply,
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

  const handleSaveEdit = async () => {
    if (!editingMessage || !editText.trim() || savingEdit) return;
    setSavingEdit(true);

    try {
      const res = await fetch("/api/v1/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          messageId: editingMessage.id,
          newMessage: editText.trim(),
          senderEmail: profile.email,
          senderName: profile.name,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.messages)) {
          setMessages(json.messages);
        }
        setEditingMessage(null);
        setEditText("");

        try {
          const supabase = createClient();
          supabase.channel("radarcheck_live_chat").send({
            type: "broadcast",
            event: "new_chat_message",
            payload: { edited: true },
          });
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setActiveEmojiPickerMsgId(null);

    // Optimistic UI update
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const currentReactions = { ...(m.reactions || {}) };
        const users = currentReactions[emoji] ? [...currentReactions[emoji]] : [];
        const idx = users.indexOf(myIdentifier);
        if (idx > -1) {
          users.splice(idx, 1);
          if (users.length === 0) delete currentReactions[emoji];
          else currentReactions[emoji] = users;
        } else {
          users.push(myIdentifier);
          currentReactions[emoji] = users;
        }
        return { ...m, reactions: currentReactions };
      })
    );

    try {
      const res = await fetch("/api/v1/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reaction",
          messageId,
          emoji,
          userName: myIdentifier,
        }),
      });

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
            payload: { reaction: true },
          });
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteSingleMessage = async (messageId: string) => {
    if (!confirm("آیا از حذف این پیام اطمینان دارید؟")) return;

    // Optimistic UI update
    setMessages((prev) => prev.filter((m) => m.id !== messageId));

    try {
      const res = await fetch("/api/v1/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_single",
          messageId,
          senderEmail: profile.email,
          senderName: profile.name,
        }),
      });

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
            payload: { deleted: true },
          });
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  };

  const handleClearChat = async () => {
    if (!confirm("آیا از پاک‌سازی کامل تاریخچه پیام‌های اتاق گفتگو اطمینان دارید؟")) return;
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
    <div className="flex flex-col h-[calc(100vh-65px)] max-w-5xl mx-auto p-3 sm:p-5 space-y-3.5" onClick={() => activeEmojiPickerMsgId && setActiveEmojiPickerMsgId(null)}>
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
              امکان ریپلای، ویرایش، حذف پیام و واکنش با ایموجی میان پرسنل و کارفرما (ظرفیت ۱۰۰ پیام چرخشی)
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
              پاک‌سازی کل گفتگو
            </Button>
          )}
        </div>
      </div>

      {/* 2. Chat Messages Area */}
      <Card className="flex-1 min-h-0 border-[var(--border)] bg-[var(--surface)] flex flex-col overflow-hidden shadow-xs">
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
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
                (profile.id && m.senderId && profile.id === m.senderId) ||
                (profile.name && m.senderName && profile.name === m.senderName);
              const isSenderAdmin = m.senderRole === "admin";
              const canModify = isMe || isAdmin;

              return (
                <div
                  key={m.id}
                  className={`group relative flex flex-col ${isMe ? "items-start" : "items-end"} animate-in fade-in slide-in-from-bottom-2 duration-150`}
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
                    {m.isEdited && (
                      <span className="text-[9px] text-[var(--text-muted)] italic">
                        (ویرایش شده)
                      </span>
                    )}
                  </div>

                  {/* Main Bubble Container with Hover Action Menu */}
                  <div className={`relative max-w-[90%] sm:max-w-[75%] flex flex-col ${isMe ? "items-start" : "items-end"}`}>
                    {/* Hover Floating Action Bar */}
                    <div
                      className={`absolute -top-3.5 z-20 hidden group-hover:flex items-center gap-0.5 bg-[var(--surface)] border border-[var(--border)] rounded-full px-1.5 py-0.5 shadow-md ${
                        isMe ? "left-2" : "right-2"
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Emoji Trigger */}
                      <button
                        type="button"
                        onClick={() =>
                          setActiveEmojiPickerMsgId(
                            activeEmojiPickerMsgId === m.id ? null : m.id
                          )
                        }
                        className="p-1 rounded-full text-[var(--text-muted)] hover:text-amber-500 hover:bg-[var(--surface-raised)] transition-colors"
                        title="واکنش با ایموجی"
                      >
                        <Smile className="size-3.5" />
                      </button>

                      {/* Reply Button */}
                      <button
                        type="button"
                        onClick={() => setReplyingTo(m)}
                        className="p-1 rounded-full text-[var(--text-muted)] hover:text-blue-500 hover:bg-[var(--surface-raised)] transition-colors"
                        title="پاسخ (Reply)"
                      >
                        <Reply className="size-3.5" />
                      </button>

                      {/* Edit Button */}
                      {canModify && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMessage(m);
                            setEditText(m.message);
                          }}
                          className="p-1 rounded-full text-[var(--text-muted)] hover:text-emerald-500 hover:bg-[var(--surface-raised)] transition-colors"
                          title="ویرایش پیام"
                        >
                          <Edit3 className="size-3.5" />
                        </button>
                      )}

                      {/* Delete Button */}
                      {canModify && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSingleMessage(m.id)}
                          className="p-1 rounded-full text-[var(--text-muted)] hover:text-red-500 hover:bg-[var(--surface-raised)] transition-colors"
                          title="حذف پیام"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Emoji Reaction Selector Popup */}
                    {activeEmojiPickerMsgId === m.id && (
                      <div
                        className={`absolute -top-10 z-30 flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-full p-1.5 shadow-xl animate-in zoom-in-95 duration-100 ${
                          isMe ? "left-0" : "right-0"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {COMMON_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(m.id, emoji)}
                            className="size-7 flex items-center justify-center rounded-full hover:bg-[var(--surface-raised)] hover:scale-125 transition-transform text-sm"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Message Bubble Body */}
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                        isMe
                          ? "bg-[var(--primary)] text-white rounded-br-xs"
                          : "bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-primary)] rounded-bl-xs"
                      }`}
                    >
                      {/* Replied Message Quote snippet */}
                      {m.replyTo && (
                        <div
                          className={`mb-2 rounded-lg p-2 text-xs border-r-2 ${
                            isMe
                              ? "bg-white/15 border-white/80 text-white/95"
                              : "bg-[var(--surface)] border-[var(--primary)] text-[var(--text-secondary)]"
                          }`}
                        >
                          <div className="flex items-center gap-1 font-semibold text-[11px] mb-0.5 opacity-90">
                            <CornerDownLeft className="size-3" />
                            <span>پاسخ به {m.replyTo.senderName}</span>
                          </div>
                          <p className="line-clamp-2 text-[11px] opacity-80 whitespace-pre-wrap">
                            {m.replyTo.message}
                          </p>
                        </div>
                      )}

                      {/* Message Content or Inline Edit Form */}
                      {editingMessage?.id === m.id ? (
                        <div className="space-y-2 text-[var(--text-primary)]" onClick={(e) => e.stopPropagation()}>
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={3}
                            className="w-full text-xs sm:text-sm p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingMessage(null)}
                              className="h-7 text-xs px-2"
                            >
                              انصراف
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveEdit}
                              disabled={!editText.trim() || savingEdit}
                              className="h-7 text-xs px-2.5 gap-1"
                            >
                              <Check className="size-3" />
                              <span>{savingEdit ? "در حال ذخیره…" : "ذخیره ویرایش"}</span>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{m.message}</p>
                      )}
                    </div>

                    {/* Reactions Pill List */}
                    {m.reactions && Object.keys(m.reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 px-1">
                        {Object.entries(m.reactions).map(([emoji, users]) => {
                          const hasReacted = users.includes(myIdentifier);
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleReaction(m.id, emoji);
                              }}
                              className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                                hasReacted
                                  ? "bg-[var(--primary)]/15 border-[var(--primary)]/40 text-[var(--primary)] font-bold shadow-xs scale-105"
                                  : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"
                              }`}
                              title={users.join("، ")}
                            >
                              <span>{emoji}</span>
                              <span className="font-mono text-[10px]">{faNumber(users.length)}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
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

        {/* Replying Banner */}
        {replyingTo && (
          <div className="flex items-center justify-between px-4 py-2 bg-[var(--surface-raised)] border-t border-[var(--border)] text-xs text-[var(--text-secondary)] animate-in slide-in-from-bottom-1">
            <div className="flex items-center gap-2 min-w-0">
              <Reply className="size-3.5 text-[var(--primary)] shrink-0" />
              <div className="truncate">
                <span className="font-semibold text-[var(--text-primary)]">در حال پاسخ به {replyingTo.senderName}: </span>
                <span className="text-[var(--text-muted)] truncate">{replyingTo.message}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
              title="انصراف از پاسخ"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* 3. Chat Input Box */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 sm:p-4 border-t border-[var(--border)] bg-[var(--surface)] flex items-center gap-2"
        >
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={replyingTo ? `پاسخ به ${replyingTo.senderName}…` : "پیام خود را برای کارفرما و تیم بنویسید…"}
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
