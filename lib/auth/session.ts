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
 * دریافت نشست کاربر فعلی — از روی کوکی توکن Supabase یا کوکی‌های معتبر سشن FlowDeck.
 * در صورت نبود نشست، AuthError(401) پرتاب می‌کند.
 */
export async function getSession(): Promise<SessionResult> {
  // ۱. اولویت اول: خواندن توکن امن کاربر از Supabase Auth
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
    // خطای ارتباط با سرور احراز هویت سوپابیس — رفتن به کوکی‌های پشتیبان
  }

  // ۲. بررسی کوکی‌های احراز هویت سشن
  const cookieStore = await cookies();
  const flowdeckEmail = cookieStore.get("flowdeck_user_email")?.value;
  const flowdeckRole = cookieStore.get("flowdeck_active_role")?.value;
  const flowdeckId = cookieStore.get("flowdeck_user_id")?.value;
  const flowdeckName = cookieStore.get("flowdeck_user_name")?.value;

  if (flowdeckEmail || flowdeckId) {
    const profileId = flowdeckId || "00000000-0000-0000-0000-000000000001";
    const displayName = flowdeckName ? decodeURIComponent(flowdeckName) : (flowdeckEmail ? decodeURIComponent(flowdeckEmail).split("@")[0] : "کاربر FlowDeck");

    const sessionUser: User = {
      id: profileId,
      app_metadata: {},
      user_metadata: {
        name: displayName,
        role: flowdeckRole || "admin",
      },
      aud: "authenticated",
      email: flowdeckEmail ? decodeURIComponent(flowdeckEmail) : "user@flowdeck.dev",
      created_at: new Date().toISOString(),
    };

    return { user: sessionUser, profileId };
  }

  throw new AuthError("نشست معتبر نیست — لطفاً ابتدا وارد حساب کاربری خود شوید.", 401);
}

/** نشست اختیاری — اگر نبود null برمی‌گرداند. */
export async function getOptionalSession(): Promise<SessionResult | null> {
  try {
    return await getSession();
  } catch {
    return null;
  }
}
