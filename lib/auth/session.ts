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
 * دریافت نشست کاربر فعلی — از روی کوکی توکن Supabase یا کوکی‌های معتبر سشن RadarCheck.
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
  const radarcheckEmail = cookieStore.get("radarcheck_user_email")?.value;
  const radarcheckRole = cookieStore.get("radarcheck_active_role")?.value;
  const radarcheckId = cookieStore.get("radarcheck_user_id")?.value;
  const radarcheckName = cookieStore.get("radarcheck_user_name")?.value;

  if (radarcheckEmail || radarcheckId) {
    const profileId = radarcheckId || "00000000-0000-0000-0000-000000000001";
    const displayName = radarcheckName ? decodeURIComponent(radarcheckName) : (radarcheckEmail ? decodeURIComponent(radarcheckEmail).split("@")[0] : "کاربر RadarCheck");

    const sessionUser: User = {
      id: profileId,
      app_metadata: {},
      user_metadata: {
        name: displayName,
        role: radarcheckRole || "admin",
      },
      aud: "authenticated",
      email: radarcheckEmail ? decodeURIComponent(radarcheckEmail) : "user@radarcheck.dev",
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
