/**
 * GitHub webhook signature verification (HMAC-SHA256, timing-safe).
 */
import crypto from "node:crypto";

/**
 * Verify the `x-hub-signature-256` header against the raw body bytes.
 * @param rawBody - exact raw request body (Buffer)
 * @param signature - value of `x-hub-signature-256` header (`sha256=...`)
 * @param secret - GITHUB_WEBHOOK_SECRET
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) return false;
  if (!signature.startsWith("sha256=")) return false;

  const expected = Buffer.from(
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex"),
    "utf8"
  );
  const received = Buffer.from(signature, "utf8");

  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

/**
 * Timing-safe string comparison for secrets (e.g. CRON_SECRET).
 */
export function safeCompare(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
