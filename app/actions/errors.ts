import { z } from "zod";
import { AuthError } from "@/lib/auth/session";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

/** تبدیل خطا به پاسخ استاندارد با کد قابل نمایش. */
export function toActionError(err: unknown): ActionResult<never> {
  if (err instanceof AuthError) {
    return { ok: false, error: err.message, code: "AUTH_ERROR" };
  }
  if (err instanceof z.ZodError) {
    const first = err.issues[0];
    return {
      ok: false,
      error: first?.message ?? "ورودی نامعتبر است",
      code: "VALIDATION_ERROR",
    };
  }
  console.error("[action-error]", err);
  return { ok: false, error: "خطای غیرمنتظره رخ داد", code: "INTERNAL_ERROR" };
}
