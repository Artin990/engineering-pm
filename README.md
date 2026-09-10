# سامانه مدیریت پروژه‌های مهندسی (Engineering PM)

پلتفرم مدیریت پروژه‌های مهندسی: **مدیریت پروژه + مدیریت مهندسی + هوش گیت‌هاب**.
مبتنی بر سند `PROJECT-MASTER-PLAN-FA.md` — دامنه روی Vercel، دیتابیس Supabase Postgres، فرانت Next.js، UI فارسی (RTL) با فونت Peyda.

## استک

| لایه | انتخاب |
|---|---|
| فریمورک | Next.js 15 (App Router) + TypeScript |
| استایل | Tailwind CSS v4 + shadcn/ui (Radix) |
| ORM | Drizzle + postgres.js (Supabase Postgres) |
| احراز هویت | Supabase Auth (ایمیل + OAuth گیت‌هاب) |
| تم | next-themes (Dark/Light) |
| تست | Vitest (unit) + Playwright (E2E) |

## شروع سریع

```bash
npm install
cp .env.example .env      # مقادیر را پر کنید
npm run dev               # http://localhost:3000
```

## متغیرهای محیطی

`.env.example` را ببینید. کلیدها:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — کلید عمومی (فقط سمت کلاینت)
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` — **فقط سمت سرور، هرگز به فرانت نرود**
- `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY` — نصب GitHub App
- `GITHUB_WEBHOOK_SECRET` — اعتبارسنجی HMAC وب‌هوک
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — OAuth لاگین
- `CRON_SECRET` — محافظت از `/api/cron/*`

## دیتابیس

اسکیما در `lib/db/schema.ts` (۲۸ جدول — بخش ۵ سند). مایگریشن در `drizzle/`.

```bash
npm run db:generate       # تولید SQL از اسکیما
npm run db:migrate        # اعمال روی Supabase (نیازمند SUPABASE_DB_URL)
npm run db:studio         # مرورگر بصری دیتابیس
```

**RLS:** بعد از مایگریشن، کل `supabase/rls.sql` را در SQL Editor سوپابیس اجرا کنید (۴۶ پالیسی + هلپرهای عضویت).

## تست

```bash
npm run test              # Vitest — ۶۰ تست (پیشرفت وزنی + آنالیتیکس)
npm run test:e2e          # Playwright — نیازمند env زنده
```

## دیپلوی

1. **Supabase:** ساخت project → اجرای مایگریشن + `rls.sql` → فعال‌سازی Auth providers
2. **Vercel:** Import این ریپو → ست کردن ۱۱ متغیر محیطی → `vercel.json` کرون هر ۱۵ دقیقه را فعال می‌کند
3. **GitHub App:** طبق `docs/GITHUB-SETUP.md` — وب‌هوک را به `https://دامنه/api/webhooks/github` وصل کنید
4. **دامنه:** Vercel → Settings → Domains

## ساختار

```
app/
  (auth)/     login, register, callback
  (app)/      شل اصلی RTL + سایدبار + projects/[key]/{issues,cycles,roadmap,...}
  api/        webhooks/github, cron/sync, v1/*, github/*
lib/
  db/         schema.ts + queries/
  github/     GitHub App + Octokit + webhook + idempotency
  auth/       session + RBAC
  progress/   موتور پیشرفت وزنی (pure)
  analytics/  متریک‌ها
  supabase/   client / server / admin
components/   ui (shadcn) + features (domain)
supabase/     rls.sql
```

## فونت Peyda

`app/fonts/` — فایل‌های واقعی woff2 (وزن‌های 400/500/600/700) را از منبع رسمی دانلود و آنجا بگذارید (راهنما: `app/fonts/README.md`). وایرینگ با `next/font/local` کامل است.
