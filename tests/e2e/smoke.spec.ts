/**
 * سناریوهای دود E2E — پرامپت موج ۲ OpenClaw:
 * «لاگین → ساخت پروژه → ساخت ایشو → دیدن در داشبورد»
 *
 * وضعیت: لاگین/UI ساخت پروژه هنوز placeholder است (پیاده‌سازی OpenCode/Hermes در جریان).
 * این فایل‌ها اسکلت قابل‌اجرایی هستند که با تکمیل UI فعال می‌شوند.
 * برای فعال‌سازی هر سناریو: test.skip را به test تغییر دهید وقتی UI آماده شد.
 */
import { test, expect } from "@playwright/test";

test.describe("دود: ورود", () => {
  test.skip("لاگین با ایمیل → ریدایرکت به لیست پروژه‌ها", async ({ page }) => {
    await page.goto("/login");
    // TODO(Hermes): فرم ورود هنوز placeholder است
    await page.getByLabel("ایمیل").fill("test@example.com");
    await page.getByLabel("رمز عبور").fill("password123");
    await page.getByRole("button", { name: "ورود" }).click();
    await expect(page).toHaveURL(/\/projects/);
  });
});

test.describe("دود: چرخه پروژه → ایشو → داشبورد", () => {
  test.skip("ساخت پروژه → ساخت ایشو → دیدن ایشو در داشبورد پروژه", async ({ page }) => {
    // پیش‌فرض: کاربر لاگین است (storageState یا seed)
    await page.goto("/projects");

    // ۱. ساخت پروژه
    await page.getByRole("button", { name: "پروژه جدید" }).click();
    await page.getByLabel("نام پروژه").fill("پروژه دود");
    await page.getByLabel("کلید").fill("SMK");
    await page.getByRole("button", { name: "ساخت" }).click();
    await expect(page).toHaveURL(/\/projects\/SMK/);

    // ۲. ساخت ایشو
    await page.getByRole("link", { name: "ایشوها" }).click();
    await page.getByRole("button", { name: "ایشوی جدید" }).click();
    await page.getByLabel("عنوان").fill("ایشوی دود SMK-1");
    await page.getByRole("button", { name: "ساخت" }).click();

    // ۳. ایشو در داشبورد دیده می‌شود
    await page.goto("/projects/SMK");
    await expect(page.getByText("ایشوی دود SMK-1")).toBeVisible();
  });

  test.skip("داشبورد به سوالات کلیدی بخش ۱ جواب می‌دهد", async ({ page }) => {
    await page.goto("/projects/SMK");
    // هدر پروژه، سلامت، پیشرفت، کارها، تیم، گیت‌هاب، تایم‌لاین، ریسک‌ها
    await expect(page.getByTestId("project-health")).toBeVisible();
    await expect(page.getByTestId("project-progress")).toBeVisible();
    await expect(page.getByTestId("project-work-summary")).toBeVisible();
    await expect(page.getByTestId("project-team")).toBeVisible();
    await expect(page.getByTestId("project-github")).toBeVisible();
  });
});
