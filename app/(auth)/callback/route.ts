import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncUserProfile } from "@/app/actions/auth";
import { isUserAdminEmail } from "@/lib/role-context";

export const dynamic = "force-dynamic";

/**
 * روت استاندارد Callback برای تبادل کد احراز هویت Supabase Auth (OAuth / GitHub / Email Confirm)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const inviteCode =
    searchParams.get("invite") ||
    searchParams.get("invite_code") ||
    searchParams.get("code_ref") ||
    searchParams.get("ref");
  const next = searchParams.get("next") || searchParams.get("redirectTo") || "/projects";

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    const supabase = await createClient();
    let authUser = null;

    // ۱. تبادل کد با سشن
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      authUser = data.user;
    } else {
      // در صورت مصرف قبلی توکن، بررسی نشست فعال
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        authUser = userData.user;
      } else {
        console.warn("[Auth Callback] Exchange warning:", error?.message);
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent("نشست احراز هویت معتبر نیست یا منقضی شده است.")}`
        );
      }
    }

    // ۲. همگام‌سازی پروفایل کاربر در دیتابیس بدون مسدود کردن
    if (authUser) {
      const userMeta = authUser.user_metadata || {};
      const userEmail = authUser.email || "";
      const userName =
        userMeta.name ||
        userMeta.full_name ||
        userMeta.user_name ||
        userEmail.split("@")[0] ||
        "کاربر";
      const isAdmin = isUserAdminEmail(userEmail);
      const userRole = isAdmin ? "admin" : "member";

      try {
        await syncUserProfile({
          id: authUser.id,
          email: userEmail,
          name: userName,
          avatarUrl: userMeta.avatar_url || userMeta.picture || null,
          githubLogin: userMeta.user_name || userMeta.github_login || null,
          inviteCode: inviteCode || null,
        });
      } catch (syncErr) {
        console.warn("[Auth Callback] Non-fatal profile sync note:", syncErr);
      }

      // ۳. ساخت ریسپانس ریدایرکت با کوکی‌های سشن
      const redirectUrl = new URL(next.startsWith("/") ? next : "/projects", origin);
      const response = NextResponse.redirect(redirectUrl);

      response.cookies.set("flowdeck_active_role", userRole, { path: "/", maxAge: 2592000 });
      response.cookies.set("flowdeck_user_email", encodeURIComponent(userEmail), { path: "/", maxAge: 2592000 });
      response.cookies.set("flowdeck_user_id", authUser.id, { path: "/", maxAge: 2592000 });
      response.cookies.set("flowdeck_user_name", encodeURIComponent(userName), { path: "/", maxAge: 2592000 });

      return response;
    }

    return NextResponse.redirect(`${origin}/projects`);
  } catch (err: unknown) {
    console.error("[Auth Callback] Unexpected error:", err);
    return NextResponse.redirect(`${origin}/projects`);
  }
}
