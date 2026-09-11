import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { isUserAdminEmail } from "@/lib/role-context";

export const dynamic = "force-dynamic";

export interface ChatMessageItem {
  id: string;
  senderId: string | null;
  senderName: string;
  senderEmail: string | null;
  senderRole: string;
  message: string;
  createdAt: string;
}

const MAX_MESSAGES = 100;

// Shared in-memory rolling message buffer (capped at 100 messages)
let memoryMessages: ChatMessageItem[] = [
  {
    id: "msg-welcome-1",
    senderId: "admin-1",
    senderName: "آرتین امیری",
    senderEmail: "amiriartin185@gmil.com",
    senderRole: "admin",
    message: "سلام همکاران گرامی. به اتاق گفتگوی مهندسی RadarCheck خوش آمدید. پیام‌ها به‌صورت زنده میان تمامی اعضا و کارفرما رد و بدل می‌شود.",
    createdAt: new Date().toISOString(),
  },
];

export async function GET() {
  try {
    const session = await getSession().catch(() => null);
    const userEmail = session?.user?.email;
    const isAdmin = isUserAdminEmail(userEmail);

    return NextResponse.json({
      messages: memoryMessages,
      totalCount: memoryMessages.length,
      maxCapacity: MAX_MESSAGES,
      currentUser: session
        ? {
            id: session.profileId,
            name:
              session.user.user_metadata?.name ||
              session.user.email?.split("@")[0] ||
              "کاربر",
            email: session.user.email,
            isAdmin,
          }
        : null,
    });
  } catch {
    return NextResponse.json({
      messages: memoryMessages,
      totalCount: memoryMessages.length,
      maxCapacity: MAX_MESSAGES,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession().catch(() => null);
    const body = await request.json();

    if (!body.message || !body.message.trim()) {
      return NextResponse.json(
        { error: "متن پیام نمی‌تواند خالی باشد." },
        { status: 400 }
      );
    }

    const userEmail = session?.user?.email || body.senderEmail || "";
    const isAdmin = isUserAdminEmail(userEmail);
    const userName =
      body.senderName ||
      session?.user?.user_metadata?.name ||
      userEmail.split("@")[0] ||
      "کاربر تیم";

    const newMsg: ChatMessageItem = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: session?.profileId || null,
      senderName: userName,
      senderEmail: userEmail || null,
      senderRole: isAdmin ? "admin" : "member",
      message: body.message.trim(),
      createdAt: new Date().toISOString(),
    };

    // اگر به ۱۰۰ پیام رسید، قدیمی‌ترین پیام‌ها حذف شوند و سقف ۱۰۰ رعایت شود
    memoryMessages.push(newMsg);
    if (memoryMessages.length > MAX_MESSAGES) {
      memoryMessages = memoryMessages.slice(memoryMessages.length - MAX_MESSAGES);
    }

    return NextResponse.json({ data: newMsg, totalCount: memoryMessages.length }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در ارسال پیام" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession().catch(() => null);
    const userEmail = session?.user?.email;
    const isAdmin = isUserAdminEmail(userEmail);

    if (!isAdmin) {
      return NextResponse.json(
        { error: "تنها مدیرعامل مجاز به پاک‌سازی تاریخچه پیام‌ها است." },
        { status: 403 }
      );
    }

    // بازنشانی چت
    memoryMessages = [
      {
        id: `msg-reset-${Date.now()}`,
        senderId: session?.profileId || null,
        senderName: session?.user?.user_metadata?.name || "مدیرعامل",
        senderEmail: userEmail || null,
        senderRole: "admin",
        message: "تاریخچه گفتگو توسط مدیرعامل پاک‌سازی و دور جدید آغاز شد.",
        createdAt: new Date().toISOString(),
      },
    ];

    return NextResponse.json({ success: true, messages: memoryMessages });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در پاک‌سازی چت" },
      { status: 500 }
    );
  }
}
