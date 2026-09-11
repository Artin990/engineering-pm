/**
 * قالب‌بندی اعداد UI به فارسی (fa-IR).
 * ⚠️ کدهای ایشو (مثل PM-142) لاتین می‌مانند — برای آن‌ها از formatIssueKey استفاده کنید.
 */

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** تبدیل صریح تمام ارقام انگلیسی به فارسی */
export function toPersianDigits(input: string | number | bigint | null | undefined): string {
  if (input === null || input === undefined) return "";
  return String(input).replace(/[0-9]/g, (w) => PERSIAN_DIGITS[+w]);
}

/** عدد به رقم فارسی با جداکننده هزارگان: ۱۲۳٬۴۵۶ */
export function faNumber(value: number | bigint): string {
  const formatted = value.toLocaleString("en-US");
  return toPersianDigits(formatted.replace(/,/g, "٬"));
}

/** درصد فارسی: ٪۷۵ */
export function faPercent(value: number, fractionDigits = 0): string {
  const num = (value * 100).toFixed(fractionDigits);
  return `٪${toPersianDigits(num)}`;
}

/** تاریخ به تقویم شمسی/جلالی (هجری خورشیدی) */
export function faDate(date: Date | string | number | null | undefined): string {
  if (!date) return "-";
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const formatted = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
    return toPersianDigits(formatted);
  } catch {
    return toPersianDigits(String(date));
  }
}

/** تاریخ و ساعت شمسی */
export function faDateTime(date: Date | string | number | null | undefined): string {
  if (!date) return "-";
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const formatted = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
    return toPersianDigits(formatted);
  } catch {
    return toPersianDigits(String(date));
  }
}

/** تاریخ کوتاه شمسی (۱۴۰۳/۰۶/۲۱) */
export function faShortDate(date: Date | string | number | null | undefined): string {
  if (!date) return "-";
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const formatted = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    return toPersianDigits(formatted);
  } catch {
    return toPersianDigits(String(date));
  }
}

/** زمان نسبی شمسی («همین الان»، «۵ دقیقه پیش»، «۲ روز پیش») */
export function faRelativeTime(date: Date | string | number | null | undefined): string {
  if (!date) return "-";
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 45) return "همین الان";
    if (diffMin < 60) return `${faNumber(diffMin)} دقیقه پیش`;
    if (diffHour < 24) return `${faNumber(diffHour)} ساعت پیش`;
    if (diffDay === 1) return "دیروز";
    if (diffDay < 30) return `${faNumber(diffDay)} روز پیش`;
    return faDate(d);
  } catch {
    return String(date);
  }
}

/**
 * کد ایشو عمداً لاتین می‌ماند (PM-142) — مطابق سند بخش ۳.
 * فقط جداکننده‌ها را نرمال می‌کنیم؛ اعداد را دست نمی‌زنیم.
 */
export function formatIssueKey(prefix: string, seq: number): string {
  return `${prefix.toUpperCase()}-${seq}`;
}
