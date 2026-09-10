import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase Server Client — Server Components / Route Handlers / Server Actions.
 * ⚠️ قدرتمند (service-role) نیست — با توکن کاربر کار می‌کند، RLS اعمال می‌شود.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // از داخل Server Component فراخوانی شد — set نادیده گرفته می‌شود
          }
        },
      },
    }
  );
}
