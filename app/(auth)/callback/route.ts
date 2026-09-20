import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { syncUserProfile } from "@/app/actions/auth";
import { isUserAdminEmail } from "@/lib/auth/admin-check";

export const dynamic = "force-dynamic";

/**
 * Standard Auth Callback route for Supabase OAuth / GitHub / Email confirmation.
 * Guarantees proper cookie forwarding and error handling.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error") || searchParams.get("error_code");
  const errorDesc = searchParams.get("error_description") || searchParams.get("message");

  const inviteCode =
    searchParams.get("invite") ||
    searchParams.get("invite_code") ||
    searchParams.get("code_ref") ||
    searchParams.get("ref");
  const next = searchParams.get("next") || searchParams.get("redirectTo") || "/projects";

  // Check if provider returned an error (e.g. user denied GitHub authorization)
  if (errorParam) {
    console.warn("[Auth Callback] OAuth provider error:", errorParam, errorDesc);
    const friendlyMsg = errorDesc
      ? `خطا در ورود با گیت‌هاب: ${errorDesc}`
      : "ورود با حساب گیت‌هاب لغو شد یا دسترسی تایید نگردید.";
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(friendlyMsg)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("کد احراز هویت از سوی گیت‌هاب دریافت نشد.")}`
    );
  }

  const redirectUrl = new URL(next.startsWith("/") ? next : "/projects", origin);
  const response = NextResponse.redirect(redirectUrl);

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

    // Create a Supabase server client directly connected to response.cookies
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    // 1. Exchange OAuth code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    let authUser = data?.user || null;

    if (error) {
      console.warn("[Auth Callback] Code exchange warning:", error.message);
      // Fallback: check if session is already established
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        authUser = userData.user;
      } else {
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent("نشست احراز هویت با گیت‌هاب معتبر نیست یا منقضی شده است.")}`
        );
      }
    }

    // 2. Sync profile in database
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
        console.warn("[Auth Callback] Profile sync note:", syncErr);
      }

      // 3. Set persistent role and user cookies
      response.cookies.set("radarcheck_active_role", userRole, { path: "/", maxAge: 2592000 });
      response.cookies.set("radarcheck_user_email", encodeURIComponent(userEmail), { path: "/", maxAge: 2592000 });
      response.cookies.set("radarcheck_user_id", authUser.id, { path: "/", maxAge: 2592000 });
      response.cookies.set("radarcheck_user_name", encodeURIComponent(userName), { path: "/", maxAge: 2592000 });

      return response;
    }

    return response;
  } catch (err: unknown) {
    console.error("[Auth Callback] Unexpected error:", err);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("خطای سیستمی در فرآیند احراز هویت با گیت‌هاب رخ داد.")}`
    );
  }
}
