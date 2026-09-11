import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // بروزرسانی خودکار نشست کاربر
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    // خطای اتصال احتمالی در حالت آفلاین
  }

  const flowdeckEmail = request.cookies.get("flowdeck_user_email")?.value;
  const isAuthenticated = !!user || !!flowdeckEmail;
  const pathname = request.nextUrl.pathname;

  // ۱. حفاظت از مسیرهای خصوصی اپلیکیشن (داشبورد، اعضا، پروژه‌ها)
  const isProtectedPath = pathname.startsWith("/projects") || pathname.startsWith("/members");
  if (isProtectedPath && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ۲. هدایت کاربر لاگین‌شده از صفحات لاگین/ثبت‌نام به داشبورد
  const isAuthPage = pathname === "/login" || pathname === "/register";
  if (isAuthPage && isAuthenticated) {
    const redirectTo = request.nextUrl.searchParams.get("redirectTo") || "/projects";
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * عدم اعمال میدلور روی فایل‌های استاتیک، تصاویر و مسیرهای API غیرضروری
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)$|api/webhooks).*)",
  ],
};
