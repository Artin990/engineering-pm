/**
 * GitHub App authentication — JWT + installation access tokens.
 *
 * - App JWT: signed with the App private key (ES256), valid 10 min.
 * - Installation token: fetched via POST /app/installations/{id}/access_tokens,
 *   cached in-memory until 5 min before expiry (~55 min lifetime).
 */
import * as jose from "jose";
import { Octokit } from "octokit";
import { GITHUB_APP_ID, getGitHubAppPrivateKey } from "./config";

/* ------------------------------------------------------------------ */
/* App-level JWT                                                       */
/* ------------------------------------------------------------------ */

/**
 * Create a short-lived JWT authenticating as the GitHub App itself.
 * Algorithm: RS256 (GitHub requires RS256 for App JWTs, not ES256).
 */
export async function createAppJwt(): Promise<string> {
  const privateKeyPem = getGitHubAppPrivateKey();
  if (!privateKeyPem) throw new Error("GITHUB_APP_PRIVATE_KEY is not set");

  const now = Math.floor(Date.now() / 1000);
  const privateKey = await jose.importPKCS8(privateKeyPem, "RS256");

  return new jose.SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(GITHUB_APP_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 600) // 10 minutes
    .sign(privateKey);
}

/* ------------------------------------------------------------------ */
/* Installation access token with in-memory cache                      */
/* ------------------------------------------------------------------ */

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

const installationTokenCache = new Map<string, CachedToken>();

/**
 * Get an installation access token for the given installation ID.
 * Cached in-memory; auto-refreshes 5 minutes before expiry.
 */
export async function getInstallationAccessToken(
  installationId: number
): Promise<string> {
  const cacheKey = String(installationId);
  const cached = installationTokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cached.token;
  }

  const appJwt = await createAppJwt();
  const appOctokit = new Octokit({ auth: appJwt });

  const { data } = await appOctokit.rest.apps.createInstallationAccessToken({
    installation_id: installationId,
  });

  const expiresAt = data.expires_at
    ? new Date(data.expires_at).getTime()
    : Date.now() + 55 * 60 * 1000; // fallback: 55 min

  installationTokenCache.set(cacheKey, {
    token: data.token,
    expiresAt,
  });

  return data.token;
}

/**
 * Build an Octokit instance authenticated as an installation.
 */
export async function getInstallationOctokit(
  installationId: number
): Promise<Octokit> {
  const token = await getInstallationAccessToken(installationId);
  return new Octokit({ auth: token });
}

/**
 * Clear cached token for a specific installation (e.g. on uninstall).
 */
export function clearInstallationToken(installationId: number): void {
  installationTokenCache.delete(String(installationId));
}

/**
 * Build an Octokit instance authenticated as the GitHub App itself.
 */
export async function getAppOctokit(): Promise<Octokit> {
  const jwt = await createAppJwt();
  return new Octokit({ auth: jwt });
}
