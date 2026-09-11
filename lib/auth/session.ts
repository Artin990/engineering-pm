import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

export type SessionResult = {
  user: User;
  profileId: string;
};

export class AuthError extends Error {
  readonly status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/**
 * نشست کاربر فعلی — از روی کوکی Supabase یا نشست معتبر Flowdeck.
 * در صورت نبود نشست، AuthError(401) پرتاب می‌کند.
 */
export async function getSession(): Promise<SessionResult> {
  // 1. اول تلاش برای خواندن توکن کاربر از Supabase Auth
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user) {
      return { user, profileId: user.id };
    }
  } catch {
    // Supabase auth service not reached / fallback
  }

  // 2. بررسی کوکی‌های احراز هویت Flowdeck
  const cookieStore = await cookies();
  const flowdeckEmail = cookieStore.get("flowdeck_user_email")?.value;
  const flowdeckRole = cookieStore.get("flowdeck_active_role")?.value;
  const flowdeckId = cookieStore.get("flowdeck_user_id")?.value;
  const flowdeckName = cookieStore.get("flowdeck_user_name")?.value;

  if (flowdeckEmail || flowdeckRole || flowdeckId) {
    const isArtinAdmin =
      flowdeckEmail === "artinamiri185@gmail.com" || flowdeckRole === "admin";
    const profileId =
      flowdeckId ||
      (isArtinAdmin
        ? "00000000-0000-0000-0000-000000000001"
        : "00000000-0000-0000-0000-000000000002");

    const dummyUser: User = {
      id: profileId,
      app_metadata: {},
      user_metadata: {
        name: flowdeckName ? decodeURIComponent(flowdeckName) : (isArtinAdmin ? "آرتین امیری" : "کاربر سامانه"),
        role: flowdeckRole || (isArtinAdmin ? "admin" : "member"),
      },
      aud: "authenticated",
      email: flowdeckEmail ? decodeURIComponent(flowdeckEmail) : (isArtinAdmin ? "artinamiri185@gmail.com" : "user@flowdeck.dev"),
      created_at: new Date().toISOString(),
    };

    return { user: dummyUser, profileId };
  }

  throw new AuthError("نشست معتبر نیست — ابتدا وارد شوید.", 401);
}

/** نشست اختیاری — اگر نبود null برمی‌گرداند (مثلاً برای guard کردن UI). */
export async function getOptionalSession(): Promise<SessionResult | null> {
  try {
    return await getSession();
  } catch {
    return null;
  }
}
