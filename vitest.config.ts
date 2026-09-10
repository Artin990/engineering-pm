import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * کانفیگ Vitest — تست‌های unit محاسبات (progress/analytics/health).
 * تست‌های unit فقط توابع pure را می‌سنجند — بدون دیتابیس، بدون موک شبکه.
 * تست‌های امنیتی/E2E در Playwright (tests/e2e) با محیط واقعی اجرا می‌شوند.
 */
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    reporters: "default",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
