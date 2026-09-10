/**
 * استخراج منشن‌ها از متن کامنت — @github_login یا @display_name.
 * خروجی: لیست userId هایی که باید اعلان بگیرند (نویسنده حذف می‌شود).
 */
import { db } from "@/lib/db";
import { profiles, workspaceMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const MENTION_RE = /(^|\s)@([a-zA-Z0-9-_]+)/g;

/** استخراج شناسه‌های منشن‌شده از متن. */
export function extractMentions(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(MENTION_RE)) {
    found.add(match[2]);
  }
  return [...found];
}

/**
 * تبدیل منشن‌ها به userId — با تطبیق github_login یا display_name
 * بین اعضای همان workspace (منشن خارج از workspace اعلان نمی‌گیرد).
 */
export async function resolveMentions(
  body: string,
  workspaceId: string,
  authorId: string
): Promise<string[]> {
  const mentions = extractMentions(body);
  if (mentions.length === 0) return [];

  const rows = await db
    .select({ userId: workspaceMembers.userId, login: profiles.githubLogin, name: profiles.displayName })
    .from(workspaceMembers)
    .innerJoin(profiles, eq(profiles.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  const lower = mentions.map((m) => m.toLowerCase());
  const matched = rows
    .filter(
      (r) =>
        (r.login && lower.includes(r.login.toLowerCase())) ||
        (r.name && lower.includes(r.name.toLowerCase()))
    )
    .map((r) => r.userId);

  return [...new Set(matched)].filter((id) => id !== authorId);
}
