import { NextResponse, type NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  try {
    await getSession();
    const allProfiles = await db
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
        githubLogin: profiles.githubLogin,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .orderBy(desc(profiles.createdAt));

    return NextResponse.json({ data: allProfiles });
  } catch (err) {
    console.warn("[members-api-error]", err);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    await getSession();
    const body = await request.json();

    if (!body.displayName && !body.email) {
      return NextResponse.json({ error: "نام یا ایمیل الزامی است." }, { status: 400 });
    }

    const newId = body.id || `m-${Date.now()}`;
    const [created] = await db
      .insert(profiles)
      .values({
        id: newId,
        displayName: body.displayName || body.name || body.email?.split("@")[0] || "عضو جدید",
        email: body.email,
        avatarUrl: body.avatarUrl || null,
        githubLogin: body.githubLogin || null,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          displayName: body.displayName || body.name,
          email: body.email,
          githubLogin: body.githubLogin || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err: unknown) {
    console.error("[create-member-error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در ایجاد عضو" },
      { status: 500 }
    );
  }
}
