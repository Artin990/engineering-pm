/**
 * Suggestion actions — accept/reject a GitHub status suggestion.
 * POST /api/github/suggestions/accept  { linkId: string }
 * POST /api/github/suggestions/reject  { linkId: string }
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { githubIssueLinks, issues } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireProjectRole } from "@/lib/auth/rbac";
import { AuthError } from "@/lib/auth/session";
import { acceptSuggestion, rejectSuggestion } from "@/lib/github/links";

const IdSchema = z.object({ linkId: z.string().uuid() });

async function requireLeadForLink(linkId: string): Promise<void> {
  const [link] = await db
    .select({ issueId: githubIssueLinks.issueId })
    .from(githubIssueLinks)
    .where(eq(githubIssueLinks.id, linkId))
    .limit(1);
  if (!link) throw new AuthError("suggestion not found", 404);
  const [issue] = await db
    .select({ projectId: issues.projectId })
    .from(issues)
    .where(eq(issues.id, link.issueId))
    .limit(1);
  if (!issue) throw new AuthError("issue not found", 404);
  await requireProjectRole(issue.projectId, "contributor");
}

export async function POST(request: NextRequest) {
  try {
    const { pathname } = new URL(request.url);
    const action = pathname.endsWith("/accept") ? "accept" : "reject";

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
    }

    const parsed = IdSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "linkId لازم است" }, { status: 400 });
    }

    await requireLeadForLink(parsed.data.linkId);

    const success =
      action === "accept"
        ? await acceptSuggestion(parsed.data.linkId)
        : await rejectSuggestion(parsed.data.linkId);

    if (!success) {
      return NextResponse.json({ error: "suggestion not found" }, { status: 404 });
    }
    return NextResponse.json({ data: { linkId: parsed.data.linkId, action } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[github/suggestions]", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
