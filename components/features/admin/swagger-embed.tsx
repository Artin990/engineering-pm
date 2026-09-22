"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Terminal, BookOpen, ExternalLink, RefreshCw, Key } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SwaggerEmbed({ masterKey }: { masterKey?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    // 1. Inject Swagger UI CSS
    const existingCss = document.getElementById("rc-swagger-css");
    if (!existingCss) {
      const cssLink = document.createElement("link");
      cssLink.id = "rc-swagger-css";
      cssLink.rel = "stylesheet";
      cssLink.href = "https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css";
      document.head.appendChild(cssLink);
    }

    // 2. Inject Dark Theme Custom CSS overrides
    const existingStyle = document.getElementById("rc-swagger-dark-style");
    if (!existingStyle) {
      const styleEl = document.createElement("style");
      styleEl.id = "rc-swagger-dark-style";
      styleEl.innerHTML = `
        .swagger-ui {
          color: #e2e8f0 !important;
          font-family: inherit !important;
        }
        .swagger-ui .topbar { display: none !important; }
        .swagger-ui .info { margin: 16px 0 !important; }
        .swagger-ui .info .title { color: #f8fafc !important; font-size: 24px !important; }
        .swagger-ui .info p, .swagger-ui .info li { color: #94a3b8 !important; }
        .swagger-ui .scheme-container {
          background: #0d1527 !important;
          border-radius: 12px !important;
          border: 1px solid #1e293b !important;
          box-shadow: none !important;
          padding: 12px 16px !important;
          margin-bottom: 20px !important;
        }
        .swagger-ui .opblock {
          background: #0d1527 !important;
          border-radius: 12px !important;
          margin: 0 0 14px !important;
          border-color: #1e293b !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
        }
        .swagger-ui .opblock .opblock-summary {
          border-color: #1e293b !important;
          padding: 10px 16px !important;
        }
        .swagger-ui .opblock .opblock-summary-method {
          border-radius: 6px !important;
          font-weight: 700 !important;
          font-size: 12px !important;
          min-width: 70px !important;
          text-align: center !important;
        }
        .swagger-ui .opblock .opblock-summary-path {
          color: #f1f5f9 !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          font-size: 13px !important;
        }
        .swagger-ui .opblock .opblock-summary-description {
          color: #94a3b8 !important;
          font-size: 12px !important;
        }
        .swagger-ui .opblock-body {
          background: #090e1a !important;
          border-radius: 0 0 12px 12px !important;
          color: #cbd5e1 !important;
        }
        .swagger-ui table thead tr td, .swagger-ui table thead tr th {
          color: #94a3b8 !important;
          border-color: #1e293b !important;
        }
        .swagger-ui .parameter__name {
          color: #f8fafc !important;
          font-family: monospace !important;
        }
        .swagger-ui .parameter__type {
          color: #818cf8 !important;
        }
        .swagger-ui input[type=text], .swagger-ui textarea, .swagger-ui select {
          background: #050811 !important;
          border: 1px solid #334155 !important;
          color: #f8fafc !important;
          border-radius: 8px !important;
        }
        .swagger-ui .btn {
          border-radius: 8px !important;
          font-weight: 600 !important;
        }
        .swagger-ui .btn.execute {
          background-color: #4f46e5 !important;
          border-color: #4f46e5 !important;
          color: #ffffff !important;
        }
        .swagger-ui .btn.execute:hover {
          background-color: #4338ca !important;
        }
        .swagger-ui .btn.try-out__btn {
          border-color: #475569 !important;
          color: #cbd5e1 !important;
        }
        .swagger-ui .responses-inner {
          background: transparent !important;
        }
        .swagger-ui .response-col_status {
          color: #f8fafc !important;
        }
        .swagger-ui .response-col_description {
          color: #cbd5e1 !important;
        }
        .swagger-ui pre {
          background: #050811 !important;
          border-radius: 8px !important;
          border: 1px solid #1e293b !important;
          color: #a5b4fc !important;
        }
        .swagger-ui .model-box {
          background: #090e1a !important;
        }
        .swagger-ui section.models {
          border: 1px solid #1e293b !important;
          border-radius: 12px !important;
          background: #0d1527 !important;
        }
        .swagger-ui section.models h4 {
          color: #e2e8f0 !important;
        }
      `;
      document.head.appendChild(styleEl);
    }

    // 3. Load script and mount
    const existingScript = document.getElementById("rc-swagger-bundle");
    const initSwagger = () => {
      // @ts-expect-error SwaggerUIBundle is global
      if (window.SwaggerUIBundle) {
        try {
          // @ts-expect-error SwaggerUIBundle is global
          window.SwaggerUIBundle({
            url: "/api/openapi.json",
            dom_id: "#rc-admin-swagger-container",
            deepLinking: true,
            presets: [
              // @ts-expect-error SwaggerUIBundle is global
              window.SwaggerUIBundle.presets.apis,
              // @ts-expect-error SwaggerUIBundle is global
              window.SwaggerUIStandalonePreset,
            ],
            layout: "BaseLayout",
            requestInterceptor: (req: { headers: Record<string, string> }) => {
              if (masterKey) {
                req.headers["x-rc-admin-key"] = masterKey;
              }
              return req;
            },
          });
          setLoaded(true);
        } catch {
          setLoadError(true);
        }
      }
    };

    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "rc-swagger-bundle";
      script.src = "https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js";
      script.async = true;
      script.onload = () => {
        initSwagger();
      };
      script.onerror = () => {
        setLoadError(true);
      };
      document.body.appendChild(script);
    } else {
      initSwagger();
    }
  }, [masterKey]);

  return (
    <div className="space-y-4" dir="ltr">
      {/* Swagger Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <Terminal size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">FlowDeck Interactive Swagger Console</h2>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                OpenAPI 3.0
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive testing of all FlowDeck REST endpoints directly inside Super Admin Tower
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {masterKey && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono">
              <Key size={12} className="text-amber-400" />
              <span>Admin Key Injected</span>
            </div>
          )}
          <Link href="/api/openapi.json" target="_blank">
            <Button size="sm" variant="outline" className="text-xs border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 gap-1.5">
              <BookOpen size={13} />
              OpenAPI JSON
            </Button>
          </Link>
          <Link href="/docs" target="_blank">
            <Button size="sm" variant="outline" className="text-xs border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 gap-1.5">
              <ExternalLink size={13} />
              Standalone View
            </Button>
          </Link>
        </div>
      </div>

      {/* Loading state */}
      {!loaded && !loadError && (
        <div className="p-12 text-center text-slate-400 space-y-3 bg-slate-900/60 rounded-xl border border-slate-800">
          <RefreshCw size={24} className="animate-spin mx-auto text-indigo-400" />
          <p className="text-sm">Loading interactive Swagger API console...</p>
        </div>
      )}

      {loadError && (
        <div className="p-6 text-center text-rose-400 bg-rose-950/20 rounded-xl border border-rose-800/40">
          <p className="text-sm">Unable to load Swagger UI scripts. Please check your internet connection or open raw /api/openapi.json.</p>
        </div>
      )}

      {/* Swagger UI Mount Target */}
      <div
        id="rc-admin-swagger-container"
        className="rounded-2xl border border-slate-800 bg-[#070b12] p-4 sm:p-6 overflow-hidden shadow-2xl"
      />
    </div>
  );
}
