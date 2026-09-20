import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isUserAdminEmail } from "@/lib/auth/admin-check";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isValidIranianNationalId } from "@/lib/validators/national-id";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/verify-national-id
 * Validates an Iranian National ID and allows platform admins to approve/reject.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();

    const { nationalId, targetUserId, approve } = body;

    // If validating a national ID syntax
    if (nationalId) {
      const isValid = isValidIranianNationalId(nationalId);
      if (!isValid) {
        return NextResponse.json(
          { ok: false, error: "کد ملی وارد شده طبق الگوریتم ۱۰ رقمی کشور نامعتبر است." },
          { status: 400 }
        );
      }
    }

    // If approving/rejecting a user verification (Admin only)
    if (targetUserId) {
      const userEmail = session.user.email?.toLowerCase() || "";
      if (!isUserAdminEmail(userEmail)) {
        return NextResponse.json(
          { error: "دسترسی غیرمجاز: تنها ادمین پلتفرم مجاز به تایید هویت است." },
          { status: 403 }
        );
      }

      const status = approve === false ? "rejected" : "verified";
      await db
        .update(profiles)
        .set({
          verificationStatus: status,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, targetUserId));

      return NextResponse.json({ ok: true, userId: targetUserId, status });
    }

    return NextResponse.json({ ok: true, valid: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "خطای پردازش اعتبارسنجی";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
