import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Home, LayoutGrid, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-background px-4 py-16 overflow-hidden select-none">
      {/* Background glowing gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-lg w-full text-center space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3">
          <div className="relative w-12 h-12 rounded-2xl overflow-hidden border border-border shadow-md bg-card/60 backdrop-blur-md flex items-center justify-center">
            <Image
              src="/Flow-Deck-Logo.png"
              alt="FlowDeck Logo"
              width={48}
              height={48}
              className="object-contain dark:hidden"
              priority
            />
            <Image
              src="/Flow-Deck-Logo-for-dark-mode.png"
              alt="FlowDeck Logo"
              width={48}
              height={48}
              className="object-contain hidden dark:block"
              priority
            />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            FlowDeck
          </span>
        </div>

        {/* 404 Visual badge */}
        <div className="relative py-2">
          <h1 className="text-8xl sm:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-foreground via-foreground/70 to-foreground/20">
            ۴۰۴
          </h1>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mt-2">
            <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "12s" }} />
            صفحه پیدا نشد
          </div>
        </div>

        {/* Explanation */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            مسیر مورد نظر شما در فلودک یافت نشد!
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-md mx-auto">
            صفحه‌ای که به دنبال آن بودید ممکن است حذف شده باشد، نام آن تغییر کرده باشد یا موقتاً در دسترس نباشد.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Button asChild size="lg" className="w-full sm:w-auto gap-2 font-semibold shadow-md shadow-primary/20">
            <Link href="/projects">
              <LayoutGrid className="w-4 h-4" />
              داشبورد پروژه‌ها
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto gap-2">
            <Link href="/">
              <Home className="w-4 h-4" />
              صفحه اصلی
            </Link>
          </Button>
        </div>

        {/* Helpful links card */}
        <div className="pt-8 border-t border-border/60">
          <p className="text-xs text-muted-foreground mb-3">یا دسترسی سریع به این بخش‌ها:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Link
              href="/projects"
              className="p-3 rounded-lg border border-border/60 bg-card/40 hover:bg-muted/60 transition-colors flex items-center justify-between text-muted-foreground hover:text-foreground group"
            >
              <span>لیست تسک‌ها و ایشوها</span>
              <ArrowRight className="w-3.5 h-3.5 transform rotate-180 transition-transform group-hover:-translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="p-3 rounded-lg border border-border/60 bg-card/40 hover:bg-muted/60 transition-colors flex items-center justify-between text-muted-foreground hover:text-foreground group"
            >
              <span>ورود به حساب کاربری</span>
              <ArrowRight className="w-3.5 h-3.5 transform rotate-180 transition-transform group-hover:-translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
