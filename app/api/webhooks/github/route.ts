import { NextResponse, type NextRequest } from "next/server";

import { verifyWebhookSignature } from "@/lib/github/signature";
import { insertEventIfNew } from "@/lib/github/queries";
import { processWebhookEvent } from "@/lib/github/webhooks";
import { after } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GitHub webhook endpoint.
 *
 * Contract (DOC-04 §2):
 * 1. Verify `x-hub-signature-256` (HMAC-SHA256 + GITHUB_WEBHOOK_SECRET)
 * 2. Idempotency: insert `delivery_id` into github_events (unique) — duplicate → skip
 * 3. Persist payload, return 202 fast, process async via `after()`
 * 4. Supported events: installation, installation_repositories, push,
 *    pull_request, pull_request_review
 */
export async function POST(request: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[github-webhook] GITHUB_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const deliveryId = request.headers.get("x-github-delivery");
  const event = request.headers.get("x-github-event");

  const signed = verifyWebhookSignature(Buffer.from(rawBody, "utf8"), signature, secret);
  if (!signed) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  if (!deliveryId || !event) {
    return NextResponse.json({ error: "missing delivery id or event" }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (typeof parsed !== "object" || parsed === null) {
      return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const action = typeof payload.action === "string" ? payload.action : null;

  const installation =
    typeof payload.installation === "object" && payload.installation !== null
      ? (payload.installation as Record<string, unknown>)
      : null;
  const installationId =
    installation && typeof installation.id === "number" ? installation.id : null;

  const repository =
    typeof payload.repository === "object" && payload.repository !== null
      ? (payload.repository as Record<string, unknown>)
      : null;
  const repoFullName =
    repository && typeof repository.full_name === "string" ? repository.full_name : null;

  // Idempotency: duplicate delivery → 200 + skip
  let state: "inserted" | "duplicate";
  try {
    state = await insertEventIfNew({
      deliveryId,
      event,
      action,
      installationId,
      repoFullName,
      payload,
    });
  } catch (err) {
    console.error("[github-webhook] failed to persist event", err);
    // 202 so GitHub retries later
    return NextResponse.json({ error: "persist failed; will retry" }, { status: 202 });
  }

  if (state === "duplicate") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // Fast 202 to GitHub; heavy work happens after the response is sent.
  after(async () => {
    try {
      await processWebhookEvent({
        deliveryId,
        event,
        action,
        installationId,
        repoFullName,
        payload,
      });
    } catch (err) {
      console.error(`[github-webhook] async processing failed ${event}/${action}`, err);
    }
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}
