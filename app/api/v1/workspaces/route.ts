import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireWorkspaceRole } from "@/lib/auth/rbac";
import { AuthError } from "@/lib/auth/session";
import {
  listWorkspaceMembers,
  createWorkspace,
  upsertWorkspaceMember,
} from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { createWorkspaceSchema, inviteWorkspaceMemberSchema } from "@/lib/validators";

function errJson(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: err.issues[0]?.message ?? "ورودی نامعتبر" },
      { status: 400 }
    );
  }
  console.error("[api-workspace]", err);
  return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId لازم است" }, { status: 400 });
    }
    await requireWorkspaceRole(workspaceId, "viewer");
    const members = await listWorkspaceMembers(workspaceId);
    return NextResponse.json({ data: members });
  } catch (err) {
    return errJson(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // دو حالت: ساخت workspace یا دعوت عضو
    const parsed = z
      .discriminatedUnion("op", [
        createWorkspaceSchema.extend({ op: z.literal("create") }),
        inviteWorkspaceMemberSchema.extend({ op: z.literal("invite") }),
      ])
      .parse(body);

    if (parsed.op === "create") {
      const session = await getSession();
      const ws = await createWorkspace(session.profileId, parsed);
      return NextResponse.json({ data: ws }, { status: 201 });
    }

    await requireWorkspaceRole(parsed.workspaceId, "admin");
    const member = await upsertWorkspaceMember(parsed);
    return NextResponse.json({ data: member }, { status: 201 });
  } catch (err) {
    return errJson(err);
  }
}
