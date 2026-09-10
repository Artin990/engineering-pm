import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Admin Client — server-side only، با service_role.
 * ⚠️ فقط در Route Handlers / Server Actions / Cron استفاده شود.
 * ⚠️ هرگز به فرانت نرود (RLS را bypass می‌کند).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin: NEXT_PUBLIC_SUPABASE_URL یا SUPABASE_SERVICE_ROLE_KEY تنظیم نشده است."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
