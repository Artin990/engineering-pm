import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";

import { peyda } from "./fonts";
import "./globals.css";

import { RoleProvider } from "@/lib/role-context";
import { I18nProvider } from "@/lib/i18n/context";

export const metadata: Metadata = {
  title: "FlowDeck — سامانه مدیریت مهندسی و هوش پروژه",
  description: "سامانه یکپارچه مدیریت پروژه، مدیریت مهندسی و هوش گیت‌هاب FlowDeck",
  icons: {
    icon: "/Flow-Deck-Logo.png",
    shortcut: "/Flow-Deck-Logo.png",
    apple: "/Flow-Deck-Logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className={`${peyda.variable} ${peyda.className}`} suppressHydrationWarning>
      <body className={`${peyda.className} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <I18nProvider>
            <RoleProvider>{children}</RoleProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
