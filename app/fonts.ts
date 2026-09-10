import localFont from "next/font/local";

/**
 * فونت Peyda — next/font/local
 * وزن‌های 400/500/600/700 (Regular/Medium/SemiBold/Bold)
 * فایل‌های woff2 را از منبع رسمی در app/fonts/ قرار دهید (app/fonts/README.md).
 */
export const peyda = localFont({
  src: [
    { path: "./fonts/Peyda-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Peyda-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Peyda-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Peyda-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-peyda",
  display: "swap",
});
