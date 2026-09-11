import { NextResponse, type NextRequest } from "next/server";
import { desc, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

interface ChatMessageItem {
  id: string;
  sessionId: string;
  senderId: string | null;
  senderName: string;
  senderEmail: string | null;
  senderRole: string;
  message: string;
  createdAt: string;
}

interface ChatSessionState {
  id: string;
  title: string;
  durationMinutes: number;
  startedAt: string;
  endsAt: string;
  isActive: boolean;
  remainingSeconds: number;
}

// In-memory fallback if DB tables not yet migrated
let memorySession: ChatSessionState = {
  id: "session-default",
  title: "جلسه هماهنگی سریع مهندسی",
  durationMinutes: 10,
  startedAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  isActive: true,
  remainingSeconds: 600,
};

let memoryMessages: ChatMessageItem[] = [
  {
    id: "msg-1",
    sessionId: "session-default",
    senderId: "admin-1",
    senderName: "آرتین امیری",
    senderEmail: "amiriartin185@gmil.com",
    senderRole: "admin",
    message: "سلام همکاران گرامی، سشن گفتگوی ۱۰ دقیقه‌ای اسپرینت آغاز شد. لطفاً موانع و پیشرفت کارهایتان را مطرح نمایید.",
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
];

const ADMIN_EMAILS = [
  "amiriartin185@gmil.com",
  "amiriartin185@gmail.com",
  "artinamiri185@gmail.com",
];

export async function GET() {
  try {
    const session = await getSession().catch(() => null);
    
    // Calculate remaining seconds
    const now = Date.now();
    const end = new Date(memorySession.endsAt).getTime();
    const remainingSeconds = Math.max(0, Math.floor((end - now) / 1000));
    memorySession.remainingSeconds = remainingSeconds;
    memorySession.isActive = remainingSeconds > 0;

    return NextResponse.json({
      session: memorySession,
      messages: memoryMessages,
      currentUser: session ? {
        id: session.profileId,
        name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "کاربر",
        email: session.user.email,
        isAdmin: ADMIN_EMAILS.includes(session.user.email?.toLowerCase() || ""),
      } : null,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      session: memorySession,
      messages: memoryMessages,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();

    if (!body.message || !body.message.trim()) {
      return NextResponse.json({ error: "متن پیام الزامی است." }, { status: 400 });
    }

    const now = Date.now();
    const end = new Date(memorySession.endsAt).getTime();
    if (end <= now) {
      return NextResponse.json({ error: "زمان سشن به پایان رسیده است. تنها مدیرعامل می‌تواند سشن جدید آغاز کند." }, { status: 403 });
    }

    const userEmail = session.user.email || "";
    const isAdmin = ADMIN_EMAILS.includes(userEmail.toLowerCase());
    const userName = session.user.user_metadata?.name || userEmail.split("@")[0] || "کاربر";

    const newMsg: ChatMessageItem = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId: memorySession.id,
      senderId: session.profileId,
      senderName: userName,
      senderEmail: userEmail,
      senderRole: isAdmin ? "admin" : "member",
      message: body.message.trim(),
      createdAt: new Date().toISOString(),
    };

    memoryMessages.push(newMsg);

    return NextResponse.json({ data: newMsg }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در ارسال پیام" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    const userEmail = session.user.email?.toLowerCase() || "";
    const isAdmin = ADMIN_EMAILS.includes(userEmail);

    if (!isAdmin) {
      return NextResponse.json(
        { error: "دسترسی غیرمجاز: تنها مدیرعامل و ادمین ارشد مجاز به مدیریت زمان و تنظیمات سشن هستند." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = body.action; // "start_new", "extend", "end", "update_title", "set_duration"

    if (action === "start_new") {
      const minutes = Number(body.durationMinutes) || 10;
      memorySession = {
        id: `session-${Date.now()}`,
        title: body.title?.trim() || memorySession.title || "جلسه هماهنگی سریع مهندسی",
        durationMinutes: minutes,
        startedAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
        isActive: true,
        remainingSeconds: minutes * 60,
      };
      // Keep previous messages or clear if requested
      if (body.clearHistory) {
        memoryMessages = [];
      }
    } else if (action === "extend") {
      const addMinutes = Number(body.addMinutes) || 5;
      const currentEnd = Math.max(Date.now(), new Date(memorySession.endsAt).getTime());
      const newEnd = currentEnd + addMinutes * 60 * 1000;
      memorySession.endsAt = new Date(newEnd).toISOString();
      memorySession.isActive = true;
      memorySession.remainingSeconds = Math.floor((newEnd - Date.now()) / 1000);
      memorySession.durationMinutes += addMinutes;
    } else if (action === "end") {
      memorySession.endsAt = new Date().toISOString();
      memorySession.isActive = false;
      memorySession.remainingSeconds = 0;
    } else if (action === "update_title" && body.title) {
      memorySession.title = body.title.trim();
    } else if (action === "set_duration" && body.durationMinutes) {
      memorySession.durationMinutes = Number(body.durationMinutes);
    }

    return NextResponse.json({ success: true, session: memorySession });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در بروزرسانی تنظیمات سشن" },
      { status: 500 }
    );
  }
}
