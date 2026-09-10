/**
 * قالب‌بندی اعداد UI به فارسی (fa-IR).
 * ⚠️ کدهای ایشو (مثل PM-142) لاتین می‌مانند — برای آن‌ها از formatIssueKey استفاده کنید.
 */

/** عدد به رقم فارسی با جداکننده هزارگان: ۱۲۳٬۴۵۶ */
export function faNumber(value: number | bigint): string {
  return value.toLocaleString("fa-IR");
}

/** درصد فارسی: ٪۷۵ */
export function faPercent(value: number, fractionDigits = 0): string {
  return `${(value * 100).toLocaleString("fa-IR", {
    maximumFractionDigits: fractionDigits,
  })}٪`;
}

/** تاریخ به تقویم شمسی/فارسی */
export function faDate(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * کد ایشو عمداً لاتین می‌ماند (PM-142) — مطابق سند بخش ۳.
 * فقط جداکننده‌ها را نرمال می‌کنیم؛ اعداد را دست نمی‌زنیم.
 */
export function formatIssueKey(prefix: string, seq: number): string {
  return `${prefix.toUpperCase()}-${seq}`;
}
