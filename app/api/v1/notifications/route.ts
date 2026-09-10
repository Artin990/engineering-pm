import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession, AuthError } from "@/lib/auth/session";
import {
  listUserNotifications,
  markNotificationRead,
  markAllRead,
} from "@/lib/notifications";

function errJson(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: err.issues[0]?.message ?? "ورودی نامعتبر" },
      { status: 400 }
    );
  }
  console.error("[api-notifications]", err);
  return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await getSession();
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit")) || 20;

    const rows = await listUserNotifications(profileId, limit);
    return NextResponse.json({ data: rows });
  } catch (err) {
    return errJson(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { profileId } = await getSession();
    const body = await request.json();

    // یا mark یک اعلان، یا همه را خوانده‌شده کن
    const input = z
      .object({
        notificationId: z.string().uuid().optional(),
        all: z.boolean().optional(),
      })
      .refine((v) => v.all || v.notificationId, {
        message: "notificationId یا all لازم است",
      })
      .parse(body);

    if (input.all) {
      await markAllRead(profileId);
    } else if (input.notificationId) {
      await markNotificationRead(input.notificationId, profileId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errJson(err);
  }
}
