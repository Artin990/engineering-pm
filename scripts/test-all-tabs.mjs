// Comprehensive Tab & Endpoint Test Suite
const BASE_URL = "http://localhost:3000";

const testTargets = [
  { name: "ورود به سامانه (Login)", path: "/login", type: "page" },
  { name: "ثبت‌نام و احراز کد ملی مدیرعامل (Register)", path: "/register", type: "page" },
  { name: "مستندات API (Swagger UI)", path: "/docs", type: "page" },
  { name: "مشخصات OpenAPI 3.0.3 (JSON)", path: "/api/openapi.json", type: "api" },
  { name: "کارتابل پروژه‌ها (Projects Page)", path: "/projects", type: "page" },
  { name: "لیست پروژه‌ها از API", path: "/api/v1/projects", type: "api" },
  { name: "سینک پروژه (Project State Sync)", path: "/api/v1/projects/PM/sync", type: "api" },
  { name: "اعضا و دسترسی‌های پروژه از API", path: "/api/v1/projects/PM/members", type: "api" },
  { name: "ایشوهای پروژه از API", path: "/api/v1/projects/PM/issues", type: "api" },
  { name: "فعالیت‌های پروژه از API", path: "/api/v1/projects/PM/activity", type: "api" },
  { name: "داشبورد نمای کلی پروژه (Project Overview)", path: "/projects/PM", type: "page" },
  { name: "تب تسک‌ها و ایشوها (Issues)", path: "/projects/PM/issues", type: "page" },
  { name: "تب اسپرینت‌ها و چرخه‌ها (Cycles)", path: "/projects/PM/cycles", type: "page" },
  { name: "تب مایلستون‌ها (Milestones)", path: "/projects/PM/milestones", type: "page" },
  { name: "تب نقشه راه (Roadmap)", path: "/projects/PM/roadmap", type: "page" },
  { name: "تب آمار و آنالیتیکس (Analytics)", path: "/projects/PM/analytics", type: "page" },
  { name: "تب اعضا و دسترسی‌های پروژه (Members)", path: "/projects/PM/members", type: "page" },
  { name: "تب فید فعالیت‌ها (Activity)", path: "/projects/PM/activity", type: "page" },
  { name: "تب اتصال به گیت‌هاب (GitHub)", path: "/projects/PM/github", type: "page" },
  { name: "تب تنظیمات پروژه (Settings)", path: "/projects/PM/settings", type: "page" },
  { name: "فهرست اعضای کل سازمان (Org Directory)", path: "/members", type: "page" },
  { name: "گفتگو و چت داخلی (Chat)", path: "/chat", type: "page" },
  { name: "تنظیمات کاربر و پروفایل (User Settings)", path: "/settings", type: "page" },
];

async function runTests() {
  console.log("==================================================");
  console.log("🔍 شروع تست جامع تمام تب‌ها و بخش‌های سامانه");
  console.log("==================================================\n");

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const target of testTargets) {
    const url = `${BASE_URL}${target.path}`;
    const start = Date.now();
    try {
      const res = await fetch(url, {
        headers: {
          "Accept": "text/html,application/json",
          "x-internal-test": "epm-test-bypass",
          "Cookie": "flowdeck_user_email=amiriartin185%40gmail.com; flowdeck_active_role=admin; flowdeck_user_id=11111111-1111-1111-1111-111111111111",
        },
        redirect: "manual"
      });
      const elapsed = Date.now() - start;
      const status = res.status;
      const text = await res.text();

      // Check redirect
      const isRedirect = status === 301 || status === 302 || status === 307 || status === 308;
      const redirectLocation = res.headers.get("location");

      // Check runtime or rendering errors
      const hasServerError = text.includes("Application error") || 
                             text.includes("Internal Server Error") || 
                             text.includes("Unhandled Runtime Error") ||
                             (target.type === "page" && text.includes("Something went wrong"));

      const isAuthRedirectExpected = (target.path === "/login" || target.path === "/register") && isRedirect && redirectLocation?.includes("/projects");

      const ok = ((status >= 200 && status < 300) || isAuthRedirectExpected) && !hasServerError;

      if (ok) {
        passed++;
        console.log(`✅ [${status}] ${target.name} (${target.path}) - ${elapsed}ms ${isAuthRedirectExpected ? "(هدایت خودکار کاربر لاگین‌شده به کارتابل)" : ""}`);
      } else {
        failed++;
        console.error(`❌ [${status}] ${target.name} (${target.path}) - ${elapsed}ms ${isRedirect ? `-> Redirected to ${redirectLocation}` : ""} ${hasServerError ? "-> ERROR DETECTED IN BODY" : ""}`);
        if (hasServerError) {
          console.error("   Snippet:", text.slice(0, 300).replace(/\n/g, " "));
        }
      }

      results.push({
        name: target.name,
        path: target.path,
        type: target.type,
        status,
        elapsed,
        ok,
        error: isRedirect ? `Redirected to ${redirectLocation}` : (hasServerError ? "Client/Server exception in rendered HTML" : null),
      });
    } catch (err) {
      failed++;
      console.error(`❌ [CONN_ERR] ${target.name} (${target.path}): ${err.message}`);
      results.push({
        name: target.name,
        path: target.path,
        type: target.type,
        status: 0,
        ok: false,
        error: err.message,
      });
    }
  }

  console.log("\n==================================================");
  console.log(`📊 نتیجه آزمون: ${passed} بخش سالم | ${failed} بخش دارای باگ یا خطا`);
  console.log("==================================================");
}

runTests();
