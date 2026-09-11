import { NextResponse, type NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages, profiles } from "@/lib/db/schema";
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
  reactions?: Record<string, string[]>;
}

const MAX_MESSAGES = 100;

// Shared in-memory fallback buffer
let memoryMessages: ChatMessageItem[] = [
  {
    id: "msg-welcome-1",
    senderId: "admin-1",
    senderName: "آرتین امیری",
    senderEmail: "amiriartin185@gmil.com",
    senderRole: "admin",
    message: "سلام همکاران گرامی. به اتاق گفتگوی مهندسی RadarCheck خوش آمدید. پیام‌ها به‌صورت زنده و دائمی میان تمامی اعضا و کارفرما ذخیره و رد و بدل می‌شود.",
    createdAt: new Date().toISOString(),
    reactions: { "👋": ["آرتین امیری"] },
  },
];

export async function GET() {
  try {
    const session = await getSession().catch(() => null);
    const userEmail = session?.user?.email;
    const isAdmin = isUserAdminEmail(userEmail);

    let dbList: ChatMessageItem[] = [];
    try {
      const rows = await db
        .select()
        .from(chatMessages)
        .orderBy(asc(chatMessages.createdAt))
        .limit(MAX_MESSAGES);

      if (rows && rows.length > 0) {
        dbList = rows.map((r) => ({
          id: r.id,
          senderId: r.senderId,
          senderName: r.senderName,
          senderEmail: r.senderEmail,
          senderRole: r.senderRole || "member",
          message: r.message,
          replyTo: (r.replyTo as ChatReplyInfo) || null,
          reactions: (r.reactions as Record<string, string[]>) || {},
          isEdited: Boolean(r.isEdited),
          updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        }));
        memoryMessages = dbList;
      }
    } catch (dbErr) {
      console.warn("[chat-api-get] db query notice:", dbErr);
    }

    const finalMessages = dbList.length > 0 ? dbList : memoryMessages;

    return NextResponse.json({
      messages: finalMessages,
      totalCount: finalMessages.length,
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

    // بررسی و تضمین وجود پروفایل فرستنده برای پیشگیری از خطای Foreign Key
    let validSenderId: string | null = null;
    if (session?.profileId) {
      try {
        const [prof] = await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.id, session.profileId))
          .limit(1);

        if (prof) {
          validSenderId = prof.id;
        } else {
          await db
            .insert(profiles)
            .values({
              id: session.profileId,
              displayName: userName,
              email: userEmail || null,
            })
            .onConflictDoNothing();
          validSenderId = session.profileId;
        }
      } catch {
        validSenderId = null;
      }
    }

    const newMsg: ChatMessageItem = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: validSenderId,
      senderName: userName,
      senderEmail: userEmail || null,
      senderRole: isAdmin ? "admin" : "member",
      message: body.message.trim(),
      createdAt: new Date().toISOString(),
      replyTo: body.replyTo || null,
      reactions: {},
    };

    // ۱. درج مطمئن در پایگاه داده PostgreSQL
    try {
      await db.insert(chatMessages).values({
        senderId: validSenderId,
        senderName: userName,
        senderEmail: userEmail || null,
        senderRole: isAdmin ? "admin" : "member",
        message: body.message.trim(),
        replyTo: body.replyTo || null,
        reactions: {},
        isEdited: false,
      });

      // واکشی مجدد پیام‌های معتبر از DB
      const rows = await db
        .select()
        .from(chatMessages)
        .orderBy(asc(chatMessages.createdAt))
        .limit(MAX_MESSAGES);

      if (rows && rows.length > 0) {
        memoryMessages = rows.map((r) => ({
          id: r.id,
          senderId: r.senderId,
          senderName: r.senderName,
          senderEmail: r.senderEmail,
          senderRole: r.senderRole || "member",
          message: r.message,
          replyTo: (r.replyTo as ChatReplyInfo) || null,
          reactions: (r.reactions as Record<string, string[]>) || {},
          isEdited: Boolean(r.isEdited),
          updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        }));
      }
    } catch (insertErr) {
      console.warn("[chat-post-db-warning]", insertErr);
      memoryMessages.push(newMsg);
      if (memoryMessages.length > MAX_MESSAGES) {
        memoryMessages = memoryMessages.slice(memoryMessages.length - MAX_MESSAGES);
      }
    }

    return NextResponse.json(
      { data: newMsg, totalCount: memoryMessages.length, messages: memoryMessages },
      { status: 201 }
    );
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
    const body = await request.json();
    const { action, messageId } = body;

    if (!messageId) {
      return NextResponse.json({ error: "شناسه پیام الزامی است." }, { status: 400 });
    }

    // 1. ویرایش متن پیام (Edit)
    if (action === "edit") {
      if (!body.newMessage || !body.newMessage.trim()) {
        return NextResponse.json({ error: "متن پیام نمی‌تواند خالی باشد." }, { status: 400 });
      }

      try {
        await db
          .update(chatMessages)
          .set({
            message: body.newMessage.trim(),
            isEdited: true,
            updatedAt: new Date(),
          })
          .where(eq(chatMessages.id, messageId));
      } catch (err) {
        console.warn("[chat-patch-edit-db]", err);
      }

      const idx = memoryMessages.findIndex((m) => m.id === messageId);
      if (idx > -1) {
        memoryMessages[idx] = {
          ...memoryMessages[idx],
          message: body.newMessage.trim(),
          isEdited: true,
          updatedAt: new Date().toISOString(),
        };
      }

      return NextResponse.json({ success: true, messages: memoryMessages });
    }

    // 2. افزودن یا حذف ایموجی واکنش (Reaction Toggle)
    if (action === "reaction") {
      const emoji = body.emoji;
      const userName = body.userName || session?.user?.user_metadata?.name || userEmail || "همکار";
      if (!emoji) {
        return NextResponse.json({ error: "ایموجی واکنش ارسال نشده است." }, { status: 400 });
      }

      let updatedReactions: Record<string, string[]> = {};
      const idx = memoryMessages.findIndex((m) => m.id === messageId);
      if (idx > -1) {
        const curMsg = memoryMessages[idx];
        const reactions = { ...(curMsg.reactions || {}) };
        const users = reactions[emoji] ? [...reactions[emoji]] : [];
        const existsIndex = users.indexOf(userName);
        if (existsIndex > -1) {
          users.splice(existsIndex, 1);
          if (users.length === 0) delete reactions[emoji];
          else reactions[emoji] = users;
        } else {
          users.push(userName);
          reactions[emoji] = users;
        }
        memoryMessages[idx] = { ...curMsg, reactions };
        updatedReactions = reactions;
      }

      try {
        await db
          .update(chatMessages)
          .set({ reactions: updatedReactions })
          .where(eq(chatMessages.id, messageId));
      } catch (err) {
        console.warn("[chat-patch-reaction-db]", err);
      }

      return NextResponse.json({ success: true, messages: memoryMessages });
    }

    // 3. حذف یک پیام تکی (Delete Single)
    if (action === "delete_single") {
      try {
        await db.delete(chatMessages).where(eq(chatMessages.id, messageId));
      } catch (err) {
        console.warn("[chat-patch-delete-db]", err);
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

    try {
      await db.delete(chatMessages);
      await db.insert(chatMessages).values({
        senderName: session?.user?.user_metadata?.name || "مدیرعامل",
        senderEmail: userEmail || null,
        senderRole: "admin",
        message: "تاریخچه گفتگو توسط مدیرعامل پاک‌سازی و دور جدید آغاز شد.",
        reactions: {},
      });
    } catch (err) {
      console.warn("[chat-delete-db]", err);
    }

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
