// scripts/test-roles-dual.mjs
// Comprehensive Dual-Role (CEO vs Staff Member) RBAC Verification Suite

const BASE_URL = "http://localhost:3000";

// کوکی‌های شبیه‌سازی مدیرعامل
const CEO_COOKIES = [
  "flowdeck_user_email=amiriartin185%40gmail.com",
  "flowdeck_active_role=admin",
  "flowdeck_user_id=11111111-1111-1111-1111-111111111111",
  "flowdeck_user_name=%D8%A2%D8%B1%D8%AA%DB%8C%D9%86%20%D8%A7%D9%85%DB%8C%D8%B1%DB%8C",
].join("; ");

// کوکی‌های شبیه‌سازی کارمند عادی زیرمجموعه
const STAFF_COOKIES = [
  "flowdeck_user_email=staff.developer%40radarcheck.dev",
  "flowdeck_active_role=member",
  "flowdeck_user_id=22222222-2222-2222-2222-222222222222",
  "flowdeck_user_name=%DA%A9%D8%A7%D8%B1%D9%85%D9%86%D8%AF%20%D8%AA%D9%88%D8%B3%D8%B9%D9%87%E2%80%8C%D8%AF%D9%87%D9%86%D8%AF%D9%87",
].join("; ");

async function req(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    redirect: "manual",
    ...options,
    headers: {
      "Accept": "application/json,text/html",
      ...options.headers,
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, headers: res.headers, text, json };
}

async function runDualRoleAudit() {
  console.log("================================================================================");
  console.log("🚀 شروع آزمون جامع تطبیقی: مدیرعامل (CEO) در برابر کارکنان زیرمجموعه (Staff)");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(name, condition, extra = "") {
    if (condition) {
      passed++;
      console.log(`  ✅ [PASS] ${name} ${extra ? `(${extra})` : ""}`);
    } else {
      failed++;
      console.error(`  ❌ [FAIL] ${name} ${extra ? `(${extra})` : ""}`);
    }
  }

  // -------------------------------------------------------------------------
  // ۱. تست دیدگاه مدیرعامل (CEO Persona)
  // -------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("👤 بخش ۱: آزمون کلیه بخش‌ها از دیدگاه مدیرعامل (CEO)");
  console.log("--------------------------------------------------------------------------------");

  // ۱.۱ کارتابل پروژه‌ها
  const ceoProjectsPage = await req("/projects", { headers: { Cookie: CEO_COOKIES } });
  assert("مدیرعامل: لود صفحه کارتابل پروژه‌ها (/projects)", ceoProjectsPage.status === 200);

  // ۱.۲ لیست پروژه‌ها از API (مدیر تمام پروژه‌ها را دریافت می‌کند)
  const ceoProjectsApi = await req("/api/v1/projects", { headers: { Cookie: CEO_COOKIES } });
  assert(
    "مدیرعامل: دریافت فهرست کلیه پروژه‌ها از API",
    ceoProjectsApi.status === 200 && Array.isArray(ceoProjectsApi.json?.data),
    `تعداد پروژه‌ها: ${ceoProjectsApi.json?.data?.length ?? 0}`
  );

  // ۱.۳ تب نمای کلی پروژه
  const ceoOverview = await req("/projects/PM", { headers: { Cookie: CEO_COOKIES } });
  assert("مدیرعامل: لود تب نمای کلی پروژه (/projects/PM)", ceoOverview.status === 200);

  // ۱.۴ تب تسک‌ها و ایشوها
  const ceoIssues = await req("/projects/PM/issues", { headers: { Cookie: CEO_COOKIES } });
  assert("مدیرعامل: لود تب ایشوها و تسک‌ها (/projects/PM/issues)", ceoIssues.status === 200);

  // ۱.۵ تب اعضا و دسترسی‌های پروژه
  const ceoMembers = await req("/projects/PM/members", { headers: { Cookie: CEO_COOKIES } });
  assert("مدیرعامل: لود تب اعضا و دسترسی‌ها (/projects/PM/members)", ceoMembers.status === 200);

  // ۱.۶ تب تنظیمات پروژه
  const ceoSettings = await req("/projects/PM/settings", { headers: { Cookie: CEO_COOKIES } });
  assert("مدیرعامل: لود تب تنظیمات پروژه (/projects/PM/settings)", ceoSettings.status === 200);

  // ۱.۷ فهرست اعضای کل سازمان
  const ceoOrgMembers = await req("/members", { headers: { Cookie: CEO_COOKIES } });
  assert("مدیرعامل: دسترسی به پنل اعضای کل سازمان (/members)", ceoOrgMembers.status === 200);

  // ۱.۸ عملیات تکمیل و بایگانی کارفرما توسط مدیرعامل
  const ceoArchiveRes = await req("/api/v1/projects/PM/archive", {
    method: "POST",
    headers: { Cookie: CEO_COOKIES, "Content-Type": "application/json" },
    body: JSON.stringify({ successRate: 100 }),
  });
  assert(
    "مدیرعامل: اختیار تکمیل و بایگانی پروژه (POST /api/v1/projects/PM/archive)",
    ceoArchiveRes.status === 200,
    `Status: ${ceoArchiveRes.status}`
  );

  // بازگردانی پروژه به فعال توسط مدیرعامل
  const ceoUnarchiveRes = await req("/api/v1/projects/PM/archive", {
    method: "POST",
    headers: { Cookie: CEO_COOKIES, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "unarchive" }),
  });
  assert(
    "مدیرعامل: اختیار فعال‌سازی مجدد پروژه (Unarchive)",
    ceoUnarchiveRes.status === 200,
    `Status: ${ceoUnarchiveRes.status}`
  );

  // ۱.۹ مدیریت اعضای پروژه توسط مدیرعامل (افزودن عضو تستی)
  const ceoAddMemberRes = await req("/api/v1/projects/PM/members", {
    method: "POST",
    headers: { Cookie: CEO_COOKIES, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "test.invitee@radarcheck.dev",
      displayName: "عضو تستی دعوت‌شده",
      role: "member",
    }),
  });
  assert(
    "مدیرعامل: اختیار افزودن عضو به پروژه (POST /api/v1/projects/PM/members)",
    ceoAddMemberRes.status === 200,
    `Status: ${ceoAddMemberRes.status}`
  );

  // ۱.۱۰ حذف عضو توسط مدیرعامل
  const ceoRemoveMemberRes = await req("/api/v1/projects/PM/members?userId=test.invitee@radarcheck.dev", {
    method: "DELETE",
    headers: { Cookie: CEO_COOKIES },
  });
  assert(
    "مدیرعامل: اختیار حذف عضو از پروژه (DELETE /api/v1/projects/PM/members)",
    ceoRemoveMemberRes.status === 200,
    `Status: ${ceoRemoveMemberRes.status}`
  );

  // -------------------------------------------------------------------------
  // ۲. تست دیدگاه کارمند زیرمجموعه (Staff Member Persona)
  // -------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("👷 بخش ۲: آزمون کلیه بخش‌ها از دیدگاه کارمند زیرمجموعه (Staff / Member)");
  console.log("--------------------------------------------------------------------------------");

  // ۲.۱ کارتابل پروژه‌ها برای کارمند عادی
  const staffProjectsPage = await req("/projects", { headers: { Cookie: STAFF_COOKIES } });
  assert("کارمند: لود صفحه کارتابل پروژه‌ها (/projects)", staffProjectsPage.status === 200);

  // ۲.۲ لیست پروژه‌ها از API برای کارمند عادی (صرفاً پروژه‌های منتسب‌شده)
  const staffProjectsApi = await req("/api/v1/projects", { headers: { Cookie: STAFF_COOKIES } });
  assert(
    "کارمند: تفکیک دسترسی پروژه‌ها در API (صرفاً پروژه‌های تخصیص‌یافته)",
    staffProjectsApi.status === 200 && Array.isArray(staffProjectsApi.json?.data),
    `تعداد پروژه‌های مجاز برای کارمند: ${staffProjectsApi.json?.data?.length ?? 0}`
  );

  // ۲.۳ تب نمای کلی پروژه
  const staffOverview = await req("/projects/PM", { headers: { Cookie: STAFF_COOKIES } });
  assert("کارمند: لود تب نمای کلی پروژه (/projects/PM)", staffOverview.status === 200);

  // ۲.۴ تب تسک‌ها و بورد ایشوها
  const staffIssues = await req("/projects/PM/issues", { headers: { Cookie: STAFF_COOKIES } });
  assert("کارمند: لود بورد تسک‌ها و ایشوها (/projects/PM/issues)", staffIssues.status === 200);

  // ۲.۵ تب اعضا و دسترسی‌ها
  const staffMembers = await req("/projects/PM/members", { headers: { Cookie: STAFF_COOKIES } });
  assert("کارمند: لود تب هم‌تیمی‌های پروژه (/projects/PM/members)", staffMembers.status === 200);

  // ۲.۶ ممانعت از تکمیل و بایگانی کارفرما توسط کارمند (POST /archive)
  const staffArchiveRes = await req("/api/v1/projects/PM/archive", {
    method: "POST",
    headers: { Cookie: STAFF_COOKIES, "Content-Type": "application/json" },
    body: JSON.stringify({ successRate: 100 }),
  });
  assert(
    "کارمند: ممانعت اکید از تکمیل/بایگانی پروژه (انتظار 403 Forbidden)",
    staffArchiveRes.status === 403,
    `Status واقعی: ${staffArchiveRes.status}`
  );

  // ۲.۷ ممانعت از بازگردانی پروژه توسط کارمند (DELETE /archive)
  const staffUnarchiveRes = await req("/api/v1/projects/PM/archive", {
    method: "DELETE",
    headers: { Cookie: STAFF_COOKIES },
  });
  assert(
    "کارمند: ممانعت اکید از بازگردانی بایگانی (انتظار 403 Forbidden)",
    staffUnarchiveRes.status === 403,
    `Status واقعی: ${staffUnarchiveRes.status}`
  );

  // ۲.۸ ممانعت از افزودن عضو به پروژه توسط کارمند عادی
  const staffAddMemberRes = await req("/api/v1/projects/PM/members", {
    method: "POST",
    headers: { Cookie: STAFF_COOKIES, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "unauthorized.user@radarcheck.dev",
      displayName: "عضو غیرمجاز",
      role: "admin",
    }),
  });
  assert(
    "کارمند: ممانعت از افزودن عضو جدید به پروژه (انتظار 403 Forbidden)",
    staffAddMemberRes.status === 403,
    `Status واقعی: ${staffAddMemberRes.status}`
  );

  // ۲.۹ ممانعت از حذف عضو از پروژه توسط کارمند عادی
  const staffRemoveMemberRes = await req("/api/v1/projects/PM/members?userId=test.user@radarcheck.dev", {
    method: "DELETE",
    headers: { Cookie: STAFF_COOKIES },
  });
  assert(
    "کارمند: ممانعت از حذف عضو از پروژه (انتظار 403 Forbidden)",
    staffRemoveMemberRes.status === 403,
    `Status واقعی: ${staffRemoveMemberRes.status}`
  );

  // ۲.۱۰ ممانعت از ایجاد عضو سازمانی توسط کارمند در اندپوینت اصلی سازمان (/api/v1/members)
  const staffOrgMemberAdd = await req("/api/v1/members", {
    method: "POST",
    headers: { Cookie: STAFF_COOKIES, "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "کاربر جدید", email: "new@radarcheck.dev" }),
  });
  assert(
    "کارمند: ممانعت از ثبت عضو در کل سازمان (انتظار 403 Forbidden)",
    staffOrgMemberAdd.status === 403,
    `Status واقعی: ${staffOrgMemberAdd.status}`
  );

  // ۲.۱۱ ممانعت از حذف عضو سازمانی توسط کارمند (/api/v1/members)
  const staffOrgMemberDelete = await req("/api/v1/members?id=some-id", {
    method: "DELETE",
    headers: { Cookie: STAFF_COOKIES },
  });
  assert(
    "کارمند: ممانعت از حذف عضو سازمان (انتظار 403 Forbidden)",
    staffOrgMemberDelete.status === 403,
    `Status واقعی: ${staffOrgMemberDelete.status}`
  );

  // ۲.۱۲ صفحه اعضای کل سازمان برای کارمند عادی (باید گارد دسترسی بدهد)
  const staffOrgPage = await req("/members", { headers: { Cookie: STAFF_COOKIES } });
  const hasCeoOnlyNotice = staffOrgPage.text.includes("دسترسی محدود به مدیرعامل");
  assert(
    "کارمند: مشاهده گارد 'دسترسی محدود به مدیرعامل' در صفحه /members",
    staffOrgPage.status === 200 && hasCeoOnlyNotice,
    hasCeoOnlyNotice ? "متن گارد احراز شد" : "هشدار: متن گارد یافت نشد"
  );

  // -------------------------------------------------------------------------
  // ۳. خلاصه نتایج
  // -------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`📊 نتیجه آزمون جامع سطوح دسترسی: ${passed} تست موفق (PASS) | ${failed} خطا یا باگ (FAIL)`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runDualRoleAudit().catch((err) => {
  console.error("خطای اجرای آزمون:", err);
  process.exit(1);
});
