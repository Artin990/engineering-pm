import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";

import { peyda } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "سامانه مدیریت پروژه‌های مهندسی",
  description: "مدیریت پروژه + مدیریت مهندسی + هوش گیت‌هاب",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className={`${peyda.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
