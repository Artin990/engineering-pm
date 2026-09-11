import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncUserProfile } from "@/app/actions/auth";

/**
 * روت استاندارد Callback برای تبادل کد احراز هویت Supabase Auth (OAuth / Email Confirm / Magic Link)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || searchParams.get("redirectTo") || "/projects";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=کد_احراز_هویت_نامعتبر_است`);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[Auth Callback] Exchange error:", error.message);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("خطا در تبادل کد ورود: " + error.message)}`);
    }

    if (data?.user) {
      // همگام‌سازی پروفایل کاربر در دیتابیس
      const userMeta = data.user.user_metadata || {};
      await syncUserProfile({
        id: data.user.id,
        email: data.user.email || "",
        name: userMeta.name || userMeta.full_name || userMeta.user_name || null,
        avatarUrl: userMeta.avatar_url || null,
        githubLogin: userMeta.user_name || null,
      });
    }

    // هدایت به صفحه مقصد
    const redirectUrl = new URL(next.startsWith("/") ? next : "/projects", origin);
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error("[Auth Callback] Unexpected error:", err);
    return NextResponse.redirect(`${origin}/login?error=خطای_غیرمنتظره_در_ورود`);
  }
}
