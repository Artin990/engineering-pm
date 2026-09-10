/**
 * GitHub OAuth callback — exchange code for a user token, fetch /user,
 * and save github_login into the current user's profile.
 *
 * NOTE (untested): needs a real user session + GITHUB_CLIENT_SECRET;
 * marked as untested until verified with a live GitHub App.
 */
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { AuthError, getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

interface GithubUser {
  login?: string;
  avatar_url?: string;
  name?: string;
}

async function exchangeCodeForToken(code: string): Promise<string | null> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

async function fetchGithubUser(token: string): Promise<GithubUser | null> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as GithubUser;
}

export async function GET(request: NextRequest) {
  try {
    const { profileId } = await getSession();

    const code = new URL(request.url).searchParams.get("code");
    if (!code) {
      return NextResponse.json({ error: "missing code" }, { status: 400 });
    }

    const token = await exchangeCodeForToken(code);
    if (!token) {
      return NextResponse.json(
        { error: "token exchange failed (check GITHUB_CLIENT_ID/SECRET)" },
        { status: 502 }
      );
    }

    const user = await fetchGithubUser(token);
    if (!user?.login) {
      return NextResponse.json({ error: "could not read GitHub user" }, { status: 502 });
    }

    await db
      .update(profiles)
      .set({ githubLogin: user.login, avatarUrl: user.avatar_url ?? null })
      .where(eq(profiles.id, profileId));

    const back = new URL("/projects", request.url);
    back.searchParams.set("linked", user.login);
    return NextResponse.redirect(back);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[github/oauth/callback]", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
