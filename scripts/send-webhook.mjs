#!/usr/bin/env node
/**
 * GitHub Webhook Simulator
 *
 * Sends a fixture payload to a local (or remote) webhook endpoint
 * with correct x-hub-signature-256 HMAC-SHA256 signature.
 *
 * Usage:
 *   node scripts/send-webhook.mjs <event> <fixture-path> [--secret <secret>] [--url <url>]
 *
 * Examples:
 *   node scripts/send-webhook.mjs push fixtures/github/push.json
 *   node scripts/send-webhook.mjs pull_request fixtures/github/pull_request-opened.json --secret mysecret
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function usage() {
  console.error(
    `Usage: node scripts/send-webhook.mjs <event> <fixture.json> [--secret <secret>] [--url <url>]`
  );
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length < 2) usage();

const event = args[0];
const fixturePath = path.resolve(ROOT, args[1]);
const secretIdx = args.indexOf("--secret");
const secret = secretIdx !== -1 ? args[secretIdx + 1] : process.env.GITHUB_WEBHOOK_SECRET ?? "";
const urlIdx = args.indexOf("--url");
const url = urlIdx !== -1 ? args[urlIdx + 1] : "http://localhost:3000/api/webhooks/github";

if (!secret) {
  console.error("Missing --secret or GITHUB_WEBHOOK_SECRET");
  process.exit(1);
}

const body = fs.readFileSync(fixturePath, "utf8");
const signature =
  "sha256=" + crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
const deliveryId = crypto.randomUUID();

console.log(`Event:        ${event}`);
console.log(`Fixture:      ${path.relative(ROOT, fixturePath)}`);
console.log(`Delivery ID:  ${deliveryId}`);
console.log(`URL:          ${url}`);
console.log(`Signature:    ${signature.slice(0, 20)}…`);
console.log("");

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-hub-signature-256": signature,
    "x-github-delivery": deliveryId,
    "x-github-event": event,
  },
  body,
});

console.log(`Response: ${res.status} ${res.statusText}`);
const json = await res.json().catch(() => null);
if (json) console.log(JSON.stringify(json, null, 2));
