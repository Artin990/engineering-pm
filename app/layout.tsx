import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";

import { peyda } from "./fonts";
import "./globals.css";

import { RoleProvider } from "@/lib/role-context";

export const metadata: Metadata = {
  title: "RadarCheck — سامانه مدیریت مهندسی و هوش پروژه",
  description: "سامانه یکپارچه مدیریت پروژه، مدیریت مهندسی و هوش گیت‌هاب RadarCheck",
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
          <RoleProvider>{children}</RoleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
