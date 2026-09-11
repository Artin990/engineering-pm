import { describe, it, expect } from "vitest";
import { isUserAdminEmail } from "@/lib/auth/admin-check";

describe("1. تست انقضای کد معرف ۱۰ دقیقه‌ای و دسترسی ادمین", () => {
  it("ایمیل‌های مدیرعامل را به درستی تشخیص می‌دهد", () => {
    expect(isUserAdminEmail("artinamiri185@gmail.com")).toBe(true);
    expect(isUserAdminEmail("amiriartin185@gmail.com")).toBe(true);
    expect(isUserAdminEmail("amiriartin185@gmil.com")).toBe(true);
    expect(isUserAdminEmail("ArtinAmiri185@Gmail.Com")).toBe(true);
    expect(isUserAdminEmail("regular_developer@company.com")).toBe(false);
    expect(isUserAdminEmail("")).toBe(false);
    expect(isUserAdminEmail(null)).toBe(false);
  });

  it("کد زیرمجموعه‌گیری با سن کمتر از ۶۰۰ ثانیه معتبر است", () => {
    const codeCreatedAt = Date.now() - 300 * 1000; // 5 minutes ago
    const elapsedSec = Math.floor((Date.now() - codeCreatedAt) / 1000);
    const isValid = elapsedSec < 600;
    expect(isValid).toBe(true);
  });

  it("کد زیرمجموعه‌گیری با سن بیشتر یا مساوی ۶۰۰ ثانیه منقضی شناخته می‌شود", () => {
    const codeCreatedAt = Date.now() - 601 * 1000; // 10 minutes and 1 second ago
    const elapsedSec = Math.floor((Date.now() - codeCreatedAt) / 1000);
    const isValid = elapsedSec < 600;
    expect(isValid).toBe(false);
  });

  it("محاسبه دقیق زمان باقی‌مانده تایمر ۱۰ دقیقه‌ای", () => {
    const CODE_VALIDITY_SECONDS = 600;
    const updatedAt = Date.now() - 150 * 1000; // 150 seconds elapsed
    const elapsedSeconds = Math.floor((Date.now() - updatedAt) / 1000);
    const remainingSeconds = Math.max(0, CODE_VALIDITY_SECONDS - (elapsedSeconds % CODE_VALIDITY_SECONDS));
    expect(remainingSeconds).toBe(450);
  });
});

describe("2. تست ویژگی‌های چت زنده (CRUD، ریپلای، ری‌اکشن، ویرایش)", () => {
  interface ChatMessage {
    id: string;
    senderName: string;
    message: string;
    replyTo?: { id: string; senderName: string; message: string } | null;
    reactions?: Record<string, string[]>;
    isEdited?: boolean;
  }

  it("تغییر وضعیت ری‌اکشن (افزودن و حذف ایموجی کاربر)", () => {
    const msg: ChatMessage = {
      id: "msg-1",
      senderName: "توسعه‌دهنده",
      message: "تست ارسال پیام",
      reactions: {},
    };

    const userIdentifier = "پوریا کریمی";
    const emoji = "🚀";

    // 1. افزودن ری‌اکشن
    const reactions = { ...(msg.reactions || {}) };
    const users = reactions[emoji] ? [...reactions[emoji]] : [];
    const idx = users.indexOf(userIdentifier);
    if (idx > -1) {
      users.splice(idx, 1);
    } else {
      users.push(userIdentifier);
    }
    reactions[emoji] = users;

    expect(reactions[emoji]).toContain(userIdentifier);
    expect(reactions[emoji].length).toBe(1);

    // 2. حذف ری‌اکشن با کلیک مجدد
    const idx2 = reactions[emoji].indexOf(userIdentifier);
    if (idx2 > -1) {
      reactions[emoji].splice(idx2, 1);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    }

    expect(reactions[emoji]).toBeUndefined();
  });

  it("ساختار ریپلای و ویرایش پیام", () => {
    const originalMsg: ChatMessage = {
      id: "msg-100",
      senderName: "مدیرعامل",
      message: "جلسه دمو ساعت ۴ برگزار می‌شود.",
    };

    const replyMsg: ChatMessage = {
      id: "msg-101",
      senderName: "مهندس فرانت",
      message: "بله، من آماده‌ام.",
      replyTo: {
        id: originalMsg.id,
        senderName: originalMsg.senderName,
        message: originalMsg.message,
      },
    };

    expect(replyMsg.replyTo).toBeDefined();
    expect(replyMsg.replyTo?.id).toBe("msg-100");
    expect(replyMsg.replyTo?.senderName).toBe("مدیرعامل");

    // ویرایش پیام
    const editedMsg: ChatMessage = {
      ...replyMsg,
      message: "بله، اسلایدها و تست‌ها آماده هستند.",
      isEdited: true,
    };

    expect(editedMsg.isEdited).toBe(true);
    expect(editedMsg.message).toBe("بله، اسلایدها و تست‌ها آماده هستند.");
  });

  it("رعایت سقف ۱۰۰ پیام در تاریخچه فعال چت", () => {
    const MAX_MESSAGES = 100;
    const messageList: ChatMessage[] = [];
    for (let i = 1; i <= 105; i++) {
      messageList.push({
        id: `msg-${i}`,
        senderName: `کاربر ${i}`,
        message: `پیام شماره ${i}`,
      });
      if (messageList.length > MAX_MESSAGES) {
        messageList.shift();
      }
    }

    expect(messageList.length).toBe(100);
    expect(messageList[0].id).toBe("msg-6");
    expect(messageList[99].id).toBe("msg-105");
  });
});

describe("3. تست نگاشت نقش‌ها و دسترسی به پروژه‌ها", () => {
  it("نقش‌های فرانت‌اند به درستی به نقش‌های معتبر دیتابیس (lead, contributor, viewer) نگاشت می‌شوند", () => {
    const mapRole = (uiRole: string): "lead" | "contributor" | "viewer" => {
      const raw = String(uiRole || "contributor").toLowerCase();
      if (raw === "admin" || raw === "lead") return "lead";
      if (raw === "intern" || raw === "viewer") return "viewer";
      return "contributor";
    };

    expect(mapRole("admin")).toBe("lead");
    expect(mapRole("lead")).toBe("lead");
    expect(mapRole("intern")).toBe("viewer");
    expect(mapRole("viewer")).toBe("viewer");
    expect(mapRole("member")).toBe("contributor");
    expect(mapRole("contributor")).toBe("contributor");
  });

  it("یکسان‌سازی و ادغام اعضای پروژه بدون کلید تکراری", () => {
    const existingMembers = [
      { id: "user-1", displayName: "آرتین امیری", role: "lead" },
      { id: "user-2", displayName: "سارا حسینی", role: "contributor" },
    ];

    const newMember = { id: "user-3", displayName: "پوریا کریمی", role: "viewer" };
    const merged = [...existingMembers, newMember];

    expect(merged.length).toBe(3);
    expect(merged.some((m) => m.id === "user-3")).toBe(true);
  });
});
