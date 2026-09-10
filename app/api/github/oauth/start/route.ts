/**
 * Link the current user's GitHub identity (github_login) to their profile.
 *
 * GitHub OAuth (user-to-server) for identity linking only:
 * 1. GET  /api/github/oauth/start  → redirects to github.com/login/oauth/authorize
 * 2. GET  /api/github/oauth/callback?code=..  → exchanges code, reads /user, saves profiles.githubLogin
 *
 * Required env (see .env.example):
 *   GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET (from the GitHub App's OAuth settings)
 */
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GITHUB_CLIENT_ID is not configured" },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const base = `${url.protocol}//${url.host}`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${base}/api/github/oauth/callback`,
    scope: "read:user",
    allow_signup: "false",
  });

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`
  );
}
