"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, ShieldCheck, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SwaggerDocsPage() {
  useEffect(() => {
    // Dynamically inject Swagger UI CSS and JS
    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = "https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css";
    document.head.appendChild(cssLink);

    // Custom overrides for sleek dark/light theme
    const styleEl = document.createElement("style");
    styleEl.innerHTML = `
      .swagger-ui .topbar { display: none !important; }
      .swagger-ui { font-family: inherit !important; }
      .swagger-ui .info { margin: 24px 0 !important; }
      .swagger-ui .scheme-container { background: transparent !important; box-shadow: none !important; padding: 12px 0 !important; }
      .swagger-ui .opblock { border-radius: 12px !important; margin: 0 0 16px !important; box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important; }
      .swagger-ui .opblock-summary { border-radius: 12px !important; }
      .swagger-ui .btn { border-radius: 8px !important; font-weight: 500 !important; }
      .swagger-ui input[type=text], .swagger-ui textarea { border-radius: 8px !important; }
      .swagger-ui select { border-radius: 8px !important; }
    `;
    document.head.appendChild(styleEl);

    const scriptBundle = document.createElement("script");
    scriptBundle.src = "https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js";
    scriptBundle.async = true;
    scriptBundle.onload = () => {
      // @ts-expect-error SwaggerUIBundle is global
      if (window.SwaggerUIBundle) {
        // @ts-expect-error SwaggerUIBundle is global
        window.SwaggerUIBundle({
          url: "/api/openapi.json",
          dom_id: "#swagger-ui-container",
          deepLinking: true,
          presets: [
            // @ts-expect-error SwaggerUIBundle is global
            window.SwaggerUIBundle.presets.apis,
            // @ts-expect-error SwaggerUIBundle is global
            window.SwaggerUIStandalonePreset,
          ],
          layout: "BaseLayout",
        });
      }
    };
    document.body.appendChild(scriptBundle);

    return () => {
      if (document.head.contains(cssLink)) document.head.removeChild(cssLink);
      if (document.head.contains(styleEl)) document.head.removeChild(styleEl);
      if (document.body.contains(scriptBundle)) document.body.removeChild(scriptBundle);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" dir="ltr">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">FlowDeck API Docs</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                v1.0.1 (OpenAPI 3.0)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              مستندات تعاملی REST API پلتفرم مدیریت مهندسی
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/api/openapi.json" target="_blank">
            <Button variant="outline" size="sm" className="text-xs h-8">
              <BookOpen className="w-3.5 h-3.5 mr-1.5" />
              Raw OpenAPI JSON
            </Button>
          </Link>
          <Link href="/projects">
            <Button size="sm" className="text-xs h-8">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              بازگشت به داشبورد
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Swagger UI Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        <div className="mb-6 bg-card border rounded-2xl p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                احراز هویت و تست تعاملی (Interactive Testing)
              </h2>
              <p className="text-sm text-muted-foreground">
                برای تست اندپوینت‌های نیازمند احراز هویت، می‌توانید ابتدا در سامانه لاگین نموده یا از کوکی‌های سشن استفاده نمایید.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono bg-muted/60 px-3 py-1.5 rounded-lg border">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Spec-Kit Standard: Active
            </div>
          </div>
        </div>

        {/* Swagger Root */}
        <div id="swagger-ui-container" className="bg-card border rounded-2xl p-6 shadow-sm overflow-hidden" />
      </main>
    </div>
  );
}
