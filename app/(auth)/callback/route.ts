import { NextResponse, type NextRequest } from "next/server";

/**
 * OAuth callback route — Supabase Auth code exchange.
 * TODO (موج ۲): createClient + exchangeCodeForSession + redirect to /projects
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  // TODO: exchange code with Supabase, then redirect
  return NextResponse.redirect(`${origin}/projects`);
}
