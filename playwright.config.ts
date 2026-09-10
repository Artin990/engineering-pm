import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright — فقط اسکلت + سناریوهای دود (پرامپت موج ۲ OpenClaw).
 * اجرا: npm run test:e2e  (نیازمند dev server در حال اجرا یا webServer خودکار)
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // سناریوهای دود ترتیبی — ساخت پروژه/ایشو state می‌سازد
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // اگر سرور در حال اجرا نیست، خودکار بالا می‌آید
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
