import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isUserAdminEmail } from "@/lib/auth/admin-check";

export const dynamic = "force-dynamic";

export interface ChatReplyInfo {
  id: string;
  senderName: string;
  message: string;
}

export interface ChatMessageItem {
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
  reactions?: Record<string, string[]>; // emoji -> array of user names / emails
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
    reactions: { "👋": ["آرتین امیری"] },
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
      replyTo: body.replyTo || null,
      reactions: {},
    };

    // اگر به ۱۰۰ پیام رسید، قدیمی‌ترین پیام‌ها حذف شوند و سقف ۱۰۰ رعایت شود
    memoryMessages.push(newMsg);
    if (memoryMessages.length > MAX_MESSAGES) {
      memoryMessages = memoryMessages.slice(memoryMessages.length - MAX_MESSAGES);
    }

    return NextResponse.json({ data: newMsg, totalCount: memoryMessages.length, messages: memoryMessages }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در ارسال پیام" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession().catch(() => null);
    const userEmail = session?.user?.email;
    const isAdmin = isUserAdminEmail(userEmail);
    const body = await request.json();
    const { action, messageId } = body;

    if (!messageId) {
      return NextResponse.json({ error: "شناسه پیام الزامی است." }, { status: 400 });
    }

    const msgIndex = memoryMessages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) {
      return NextResponse.json({ error: "پیام مورد نظر یافت نشد." }, { status: 404 });
    }

    const currentMsg = memoryMessages[msgIndex];
    const isOwner =
      (userEmail && currentMsg.senderEmail && userEmail.toLowerCase() === currentMsg.senderEmail.toLowerCase()) ||
      (body.senderEmail && currentMsg.senderEmail && body.senderEmail.toLowerCase() === currentMsg.senderEmail.toLowerCase()) ||
      (body.senderName && currentMsg.senderName && body.senderName === currentMsg.senderName);

    // 1. ویرایش متن پیام (Edit)
    if (action === "edit") {
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: "شما مجاز به ویرایش این پیام نیستید." }, { status: 403 });
      }
      if (!body.newMessage || !body.newMessage.trim()) {
        return NextResponse.json({ error: "متن پیام نمی‌تواند خالی باشد." }, { status: 400 });
      }

      memoryMessages[msgIndex] = {
        ...currentMsg,
        message: body.newMessage.trim(),
        isEdited: true,
        updatedAt: new Date().toISOString(),
      };

      return NextResponse.json({ success: true, message: memoryMessages[msgIndex], messages: memoryMessages });
    }

    // 2. افزودن یا حذف ایموجی واکنش (Reaction Toggle)
    if (action === "reaction") {
      const emoji = body.emoji;
      const userName = body.userName || session?.user?.user_metadata?.name || userEmail || "همکار";
      if (!emoji) {
        return NextResponse.json({ error: "ایموجی واکنش ارسال نشده است." }, { status: 400 });
      }

      const reactions = { ...(currentMsg.reactions || {}) };
      const currentUsers = reactions[emoji] ? [...reactions[emoji]] : [];

      const existsIndex = currentUsers.indexOf(userName);
      if (existsIndex > -1) {
        // حذف واکنش اگر قبلا داده بود
        currentUsers.splice(existsIndex, 1);
        if (currentUsers.length === 0) {
          delete reactions[emoji];
        } else {
          reactions[emoji] = currentUsers;
        }
      } else {
        // افزودن واکنش جدید
        currentUsers.push(userName);
        reactions[emoji] = currentUsers;
      }

      memoryMessages[msgIndex] = {
        ...currentMsg,
        reactions,
      };

      return NextResponse.json({ success: true, message: memoryMessages[msgIndex], messages: memoryMessages });
    }

    // 3. حذف یک پیام تکی (Delete Single)
    if (action === "delete_single") {
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: "تنها فرستنده یا مدیرعامل مجاز به حذف این پیام هستند." }, { status: 403 });
      }

      memoryMessages = memoryMessages.filter((m) => m.id !== messageId);
      return NextResponse.json({ success: true, deletedId: messageId, messages: memoryMessages });
    }

    return NextResponse.json({ error: "عملیات نامعتبر است." }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در ویرایش پیام" },
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
        reactions: {},
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
