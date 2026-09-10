import { createClient } from "@/lib/supabase/server";
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
 * نشست کاربر فعلی — از روی کوکی Supabase.
 * در صورت نبود نشست، AuthError(401) پرتاب می‌کند.
 */
export async function getSession(): Promise<SessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError("نشست معتبر نیست — ابتدا وارد شوید.");
  }

  return { user, profileId: user.id };
}

/** نشست اختیاری — اگر نبود null برمی‌گرداند (مثلاً برای guard کردن UI). */
export async function getOptionalSession(): Promise<SessionResult | null> {
  try {
    return await getSession();
  } catch {
    return null;
  }
}
