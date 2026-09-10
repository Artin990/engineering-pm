# چک‌لیست آدیت نهایی — سامانه مدیریت پروژه‌های مهندسی

> تهیه‌کننده: OpenClaw (آنالیتیکس + QA، موج ۲) | تاریخ: 2026-09-10
> وضعیت: آدیت اولیه روی کد فعلی — موج ۲ هنوز در جریان است، پس همه آیتم‌ها نهایی نیستند.

## راهنمای علامت‌ها

- ✅ پاس (بررسی شد)
- ⚠️ هشدار / ناقص (در جریان موج ۲ یا نیازمند توجه)
- ❌ شکست (یافت‌شده در آدیت، نیازمند اقدام)
- ⏳ بلاک روی موج دیگر (خارج از scope من — فقط گزارش)

---

## ۱. معماری = پلن؟

| # | آیتم | وضعیت | توضیح |
|---|------|-------|-------|
| 1-1 | ساختار پوشه Next.js مطابق بخش ۴ سند | ✅ | `app/(auth)`, `app/(app)/projects/[key]`, `app/api/...`, `lib/db|github|progress|analytics`, `tests/` |
| 1-2 | اسکیما Drizzle مطابق بخش ۵ (شامل `github_events.delivery_id unique`) | ✅ | همه جدول‌ها + ایندکس‌های حیاتی + relations |
| 1-3 | قوانین SSOT رعایت شده (پروژه/ایشو داخلی، ریپو/PR گیت‌هاب) | ✅ | کامنت SSOT در `githubIssueLinks.suggestedStatus` — گیت‌هاب فقط پیشنهاد می‌دهد |
| 1-4 | sync دوسویه ایشوها ساخته نشده | ✅ | فقط `github_issue_links` با `suggestion_state` — مطابق محدودیت سند |
| 1-5 | موتور پیشرفت در `lib/progress/` جدا از آنالیتیکس | ✅ | `lib/progress/index.ts` (pure) + `lib/analytics/index.ts` (pure) + `lib/db/queries/analytics.ts` (دیتابیس) |
| 1-6 | سیستم تکراری وجود ندارد | ✅ | هر محاسبه یک‌بار، در یک ماژول — کوئری‌ها re-export متمرکز از `queries/index.ts` |

## ۲. مجوزها سمت سرور؟

| # | آیتم | وضعیت | توضیح |
|---|------|-------|-------|
| 2-1 | RLS روی همه جدول‌ها فعال | ✅ | `supabase/rls.sql` — همه جدول‌ها enable + پالیسی select/write |
| 2-2 | چک اپلیکیشنی در هر موتاسیون (`requireProjectRole`/`requireWorkspaceRole`) | ⏳ | هلپرها آماده (`lib/auth/rbac.ts`)؛ استفاده در route ها بر عهده OpenCode |
| 2-3 | `github_events` بدون پالیسی کاربر (فقط service-role) | ✅ | deny-all پیش‌فرض — کامنت در rls.sql |
| 2-4 | نوشتن `activities` فقط سمت سرور | ✅ | فقط پالیسی select — insert ندارد |
| 2-5 | route های `app/api/v1` گارد RBAC دارند | ⏳ | `projects/route.ts` گارد دارد؛ بقیه route ها در حال تکمیل OpenCode |
| 2-6 | تست دسترسی بدون عضویت → 403 | ⚠️ | `tests/e2e/security.spec.ts` نوشته شد؛ اجرا نیازمند env زنده (Supabase + Supabase URL) — در CI با env فعال می‌شود |

## ۳. وب‌هوک idempotent و امضاسنجی‌شده؟

| # | آیتم | وضعیت | توضیح |
|---|------|-------|-------|
| 3-1 | اعتبارسنجی `x-hub-signature-256` با HMAC + timing-safe | ✅ | `route.ts` وب‌هوک — `timingSafeEqual` |
| 3-2 | خواندن raw body (نه `request.json`) | ✅ | `await request.text()` قبل از verify |
| 3-3 | ثبت `delivery_id` در `github_events` + skip تکراری | ❌ | **بازنمانده**: فقط `console.log` — ثبت idempotency پیاده نشده (مسئولیت Aion CLI) |
| 3-4 | روتینگ event ها (push/PR/review/comment/installation) | ❌ | **بازنمانده**: هیچ روتینگی نیست (مسئولیت Aion CLI) |
| 3-5 | `GITHUB_WEBHOOK_SECRET` نبودن → 500 واضح | ✅ | |

## ۴. پیشرفت معنادار (وزنی)؟

| # | آیتم | وضعیت | توضیح |
|---|------|-------|-------|
| 4-1 | وزن وضعیت دقیقاً مطابق سند | ✅ | Backlog:0, Todo:0, In Progress:0.4, In Review:0.8, Blocked:0, Done:1 — تست `STATUS_WEIGHT` |
| 4-2 | وزن ایشو = estimate، پیش‌فرض ۱ | ✅ | `estimate` اسکیما default=۱؛ `computeCompletion` با estimate واقعی |
| 4-3 | cancelled از مخرج حذف | ✅ | تست اختصاصی |
| 4-4 | Completion = Σ(w×statusWeight)÷Σw، نه تعداد خام | ✅ | تست «وزنی نه تعداد خام» + تست ترکیب 4 وضعیته |
| 4-5 | رول‌آپ وزنی سایکل+مایلستون، نه میانگین ساده | ✅ | `rollupProgress` با وزن=مجموع estimate؛ تست اثبات تفاوت با میانگین ساده |
| 4-6 | Engineering Activity جدا از Completion | ✅ | متریک‌های PR/commit در `lib/analytics` جدا؛ هیچ‌وقت با completion قاطی نمی‌شود |
| 4-7 | Estimated Delivery = شیب واقعی ÷ شیب لازم | ✅ | `computeEstimatedDelivery` + ادغام در `getProjectHealth` با تلورانس 0.9 |
| 4-8 | Health چهارحالته با ترکیب pace/بلاک/overdue/stale | ✅ | Blocked > Off Track > At Risk > On Track — ۹ تست |
| 4-9 | تخریب امن روی داده خراب (صفر/منفی/NaN) | ✅ | ۶ تست مرزی — هیچ NaN/exception |
| 4-10 | پوشش تست محاسبات: **۶۰/۶۰ پاس** | ✅ | `npm run test` — progress (۳۴) + analytics (۲۶) |

## ۵. empty/loading/error در همه ویوها؟

| # | آیتم | وضعیت | توضیح |
|---|------|-------|-------|
| 5-1 | کامپوننت‌های Hermes حالت‌های سه‌گانه دارند | ⏳ | مسئولیت Hermes — در آدیت نهایی Claude Code بررسی شود |
| 5-2 | سناریو E2E داشبورد `data-testid` ها را چک می‌کند | ⚠️ | `smoke.spec.ts` اسکلت آماده (skip) — با تکمیل UI فعال شود |

## ۶. UI یکدست دو تم + RTL؟

| # | آیتم | وضعیت | توضیح |
|---|------|-------|-------|
| 6-1 | توکن‌های Dark/Light بخش ۳ پیاده شده | ⏳ | مسئولیت Claude/Hermes |
| 6-2 | فونت Peyda + `letter-spacing: 0` فارسی | ⏳ | فونت‌ها در `app/fonts/` موجود؛ اعمال در layout بر عهده Hermes |
| 6-3 | اعداد fa-IR، کدهای ایشو لاتین | ✅ | `lib/format.ts` آماده (`faNumber`, `faPercent`, `formatIssueKey`) |

## ۷. ایندکس‌ها + N+1؟

| # | آیتم | وضعیت | توضیح |
|---|------|-------|-------|
| 7-1 | ایندکس‌های حیاتی بخش ۵ در اسکیما | ✅ | `issues(project,status)`, `issues(cycle)`, `issues(assignee)`, `prs(repo,state)`, `activities(project,created desc)`, `github_events(delivery_id) unique` |
| 7-2 | کوئری‌های من N+1 ندارند یا مستند است | ⚠️ | `getProjectCyclesSubProgress` و `getProjectMilestonesSubProgress` حلقه per-cycle دارند — برای scale فعلی (تعداد کم سایکل/مایلستون) قابل‌قبول؛ اگر پروژه‌ای >۵۰ سایکل داشت، به JOIN+GROUP BY تبدیل شود. `getProjectCycleVelocities` قبلاً GROUP BY است ✅ |
| 7-3 | `prepare: false` برای Supabase Transaction mode | ✅ | `lib/db/index.ts` |

## ۸. سکرت به فرانت نرفته؟

| # | آیتم | وضعیت | توضیح |
|---|------|-------|-------|
| 8-1 | هیچ `process.env` سکرت در `.tsx` کامپوننت‌ها | ✅ | اسکن: صفر match در `app/**` و `components/**` — فقط `NEXT_PUBLIC_*` در `lib/supabase/client.ts` (مجاز) |
| 8-2 | سکرت‌ها فقط در route handlers / lib سروری | ✅ | `cron/sync`, `webhooks/github`, `lib/github/*`, `lib/supabase/admin.ts`, `lib/db/index.ts` — همه سمت سرور |
| 8-3 | `createAdminClient` (service-role) هرگز به فرانت نمی‌رود | ✅ | فقط import در فایل‌های سروری؛ کامنت هشدار داخل فایل |
| 8-4 | `.env.example` بدون مقدار واقعی | ✅ | فقط placeholder |

## ۹. TODO ناتمام؟

| # | آیتم | وضعیت | توضیح |
|---|------|-------|-------|
| 9-1 | فایل‌های OpenClaw: TODO واقعی صفر | ✅ | match های `lib/progress` فقط نام وضعیت `todo` در کامنت/کد است (false positive) |
| 9-2 | TODO های موج‌های دیگر رهگیری شده | ⚠️ | ~۲۵ TODO در `app/(app)`, `app/api`, `components/__fixtures__` — طبیعی (موج ۲ در جریان)؛ قبل از تحویل باید صفر شود |
| 9-3 | **route cron شکسته است** | ❌ | `app/api/cron/sync/route.ts` توابع `syncAllRepositories`, `notifyUpcomingDeadlines`, `notifyEndingCycles` را صدا می‌زند **بدون import** — خطای کامپایل/ران‌تایم. (فایل Aion CLI — این آدیت فقط گزارش می‌دهد) |

## ۱۰. تست‌ها

| # | آیتم | وضعیت | توضیح |
|---|------|-------|-------|
| 10-1 | Vitest: unit همه محاسبات + مرزی | ✅ | ۶۰/۶۰ پاس |
| 10-2 | Playwright: اسکلت + ۳ سناریوی دود | ✅ | `smoke.spec.ts` — ۳ تست skip (فعال‌سازی با تکمیل UI)؛ `playwright test --list` معتبر |
| 10-3 | تست امنیت 403/401 | ⚠️ | `security.spec.ts` — ۴ تست skip تا env زنده؛ در CI با `TEST_PROJECT_ID` فعال |
| 10-4 | تایپ‌چک فایل‌های OpenClaw | ✅ | صفر خطا در `lib/progress`, `lib/analytics`, `lib/db/queries/analytics.ts`, `tests/unit` |

---

## یافته‌های آدیت اولیه (خلاصه برای Claude Code — آدیت نهایی)

1. ❌ **P0 — cron route شکسته**: `app/api/cron/sync/route.ts` بدون import صدا می‌زند → باید قبل از هر دیپلوی fix شود (Aion CLI).
2. ❌ **P0 — وب‌هوک idempotency ندارد**: امضا چک می‌شود ولی `delivery_id` ثبت نمی‌شود → رویداد تکراری دوباره پردازش می‌شود (Aion CLI).
3. ❌ **P1 — وب‌هوک روتینگ ندارد**: هیچ eventای پردازش نمی‌شود (Aion CLI).
4. ⚠️ **P2 — N+1 بالقوه**: `getProjectCyclesSubProgress`/`getProjectMilestonesSubProgress` حلقه per-sub دارند — در scale فعلی OK، در آدیت نهایی با داده واقعی پروفایل شود.
5. ⚠️ **P2 — تست امنیت اجرا نشده**: نیازمند env زنده؛ در CI فعال شود.
6. ⏳ **P3 — UI/empty-states/تم**: در scope Hermes/Claude — این چک‌لیست فقط جای آن را نگه داشته.

## ریسک‌های قابل‌مشاهده در کد فعلی

- **R1**: موج‌های دیگر همزمان روی `lib/db/queries/*` و `lib/github/*` می‌نویسند — ریسک conflict در `queries/index.ts` (من فقط `analytics.ts` + re-export اضافه کردم؛ اگر OpenCode فایل‌های خودش را اضافه کرد، باید همه را re-export کند).
- **R2**: تایپ‌چک کل پروژه خطا دارد (فایل‌های OpenCode/Hermes ناتمام) — `tsc` سبز نیست؛ بلاکر دیپلوی تا تکمیل موج ۲.
- **R3**: `startedAt` ایشو در اسکیما نیست — `averageCycleTime` از `createdAt` استفاده می‌کند (lead time) مگر اینکه موج بعد ستون اضافه کند. در کامنت تابع مستند است.
- **R4**: متریک فردی (تعداد کامیت/خط برای سنجش شخص) عمداً پیاده نشده (ممنوع سند) — اگر فاز ۵ AI چیزی مشابه خواست، باید با برچسب «استنتاج» و नियम سند باشد.
