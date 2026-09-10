/**
 * استخراج کلید ایشوی داخلی (مثل ENG-123) از متن برنچ / پیام کامیت / PR.
 */

const ISSUE_KEY_RE = /\b([A-Z][A-Z0-9]{1,9}-\d{1,7})\b/g;

/** همه کلیدهای یکتا (با حروف بزرگ) داخل متن. */
export function extractIssueKeys(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const m of text.matchAll(ISSUE_KEY_RE)) {
    found.add(m[1].toUpperCase());
  }
  return [...found];
}

/**
 * استخراج کلید از نام برنچ.
 * قرارداد: feature/ENG-123-slug ، ENG-123-slug ، bugfix/eng-123/...
 */
export function extractIssueKeysFromBranch(branch: string | null | undefined): string[] {
  return extractIssueKeys(branch);
}

/** اولین کلید داخل متن (برای پیشنهاد لینک خودکار). */
export function firstIssueKey(text: string | null | undefined): string | null {
  const keys = extractIssueKeys(text);
  return keys[0] ?? null;
}
