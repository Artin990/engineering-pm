/**
 * تست امنیت: تلاش دسترسی بدون عضویت باید 403 بدهد.
 * ⚠️ این تست‌ها فقط در محیطی قابل اجرا هستند که:
 *   1. سرور در حال اجرا باشد (npm run dev)
 *   2. دیتابیس Supabase آماده باشد
 *   3. حداقل یک پروژه و workspace وجود داشته باشد
 *
 * برای محیط CI: TEST_PROJECT_ID و TEST_API_KEY_noauth در env تنظیم شود.
 *
 * فرض: یک API key بدون عضویت پروژه داریم — اگر ندارید، این فایل skip می‌شود.
 */
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const PROJECT_ID = process.env.TEST_PROJECT_ID;
const HAS_E2E_ENV = Boolean(process.env.SUPABASE_URL && PROJECT_ID);

// فقط وقتی env هست فعال می‌شود
test.skip(!HAS_E2E_ENV, "TEST_PROJECT_ID یا SUPABASE_URL تنظیم نشده — تست امنیت skip");

test.describe("API Security — دسترسی بدون عضویت", () => {
  const projectUrl = `${BASE_URL}/api/v1/projects/${PROJECT_ID}/issues`;

  test("GET بدون احراز هویت → 401", async ({ request }) => {
    const res = await request.get(projectUrl);
    expect(res.status()).toBe(401);
  });

  test("POST بدون احراز هویت → 401", async ({ request }) => {
    const res = await request.post(projectUrl, {
      data: {
        key: "SEC-1",
        title: "ایشوی تست امنیت",
      },
    });
    expect(res.status()).toBe(401);
  });

  test("GET پروژه ناموجود → 404 (نه crash)", async ({ request }) => {
    const res = await request.get(
      `${BASE_URL}/api/v1/projects/00000000-0000-0000-0000-000000000000/issues`
    );
    expect(res.status()).toBe(404);
  });

  test("GET workspace بدون عضویت → 403", async ({ request }) => {
    // اگر workspaceId دارید، آن را اینجا قرار دهید
    const wsId = process.env.TEST_WORKSPACE_ID_NONMEMBER;
    if (!wsId) {
      test.skip(true, "TEST_WORKSPACE_ID_NONMEMBER تنظیم نشده");
      return;
    }
    const res = await request.get(
      `${BASE_URL}/api/v1/projects?workspaceId=${wsId}`
    );
    expect(res.status()).toBe(403);
  });
});
