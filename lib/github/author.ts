/**
 * Resolve a GitHub author login to the internal profile id
 * (for github_commits.authorId / github_pull_requests.authorId).
 * Returns null when no linked profile exists.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";

export async function resolveAuthorId(githubLogin: string | null | undefined): Promise<string | null> {
  if (!githubLogin) return null;
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.githubLogin, githubLogin))
    .limit(1);
  return row?.id ?? null;
}
