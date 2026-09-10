/**
 * GitHub App environment configuration.
 * All values are server-side only — NEVER expose to the client.
 */

export const GITHUB_APP_ID = process.env.GITHUB_APP_ID ?? "";
export const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? "";
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? "";
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? "";
export const CRON_SECRET = process.env.CRON_SECRET ?? "";

/**
 * Private key may be stored with literal "\n" sequences in env vars.
 * This helper converts them to real newlines.
 */
export function getGitHubAppPrivateKey(): string {
  const raw = process.env.GITHUB_APP_PRIVATE_KEY ?? "";
  return raw.includes("\\n") ? raw.replaceAll("\\n", "\n") : raw;
}

/**
 * GitHub App slug (used for install URL).
 * Derived from GITHUB_APP_ID or set explicitly via GITHUB_APP_SLUG.
 */
export const GITHUB_APP_SLUG = process.env.GITHUB_APP_SLUG ?? "";

/** Check whether the GitHub App is fully configured (all required env vars present). */
export function isGithubConfigured(): boolean {
  return Boolean(
    GITHUB_APP_ID &&
      getGitHubAppPrivateKey() &&
      GITHUB_WEBHOOK_SECRET
  );
}

/** Return names of missing env vars. */
export function missingGithubEnvVars(): string[] {
  const missing: string[] = [];
  if (!GITHUB_APP_ID) missing.push("GITHUB_APP_ID");
  if (!getGitHubAppPrivateKey()) missing.push("GITHUB_APP_PRIVATE_KEY");
  if (!GITHUB_WEBHOOK_SECRET) missing.push("GITHUB_WEBHOOK_SECRET");
  return missing;
}
