import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";

import { peyda } from "./fonts";
import "./globals.css";

import { RoleProvider } from "@/lib/role-context";

export const metadata: Metadata = {
  title: "Flowdeck — سامانه مدیریت مهندسی و هوش پروژه",
  description: "سامانه یکپارچه مدیریت پروژه، مدیریت مهندسی و هوش گیت‌هاب Flowdeck",
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
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className={`${peyda.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <RoleProvider>{children}</RoleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
