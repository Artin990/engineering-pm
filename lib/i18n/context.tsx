"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { Locale, Direction, TranslationDictionary, I18nContextType } from "./types";
import { fa } from "./dictionaries/fa";
import { en } from "./dictionaries/en";

const dictionaries: Record<Locale, TranslationDictionary> = {
  fa,
  en,
};

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = "flowdeck_locale";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fa");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 1. Check localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved && (saved === "fa" || saved === "en")) {
        setLocaleState(saved);
        updateDocument(saved);
      } else {
        updateDocument("fa");
      }
    } catch {
      updateDocument("fa");
    }
    setMounted(true);
  }, []);

  const updateDocument = (loc: Locale) => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.lang = loc;
      root.dir = loc === "fa" ? "rtl" : "ltr";
      
      // Update body class for typography if needed
      if (loc === "en") {
        root.classList.add("font-latin");
      } else {
        root.classList.remove("font-latin");
      }
    }
  };

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    updateDocument(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
      document.cookie = `${STORAGE_KEY}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    } catch (e) {
      console.error("Failed to save locale", e);
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "fa" ? "en" : "fa");
  }, [locale, setLocale]);

  const dir: Direction = locale === "fa" ? "rtl" : "ltr";
  const t = useMemo(() => dictionaries[locale] || dictionaries.fa, [locale]);

  const value = useMemo(
    () => ({
      locale,
      dir,
      t,
      setLocale,
      toggleLocale,
    }),
    [locale, dir, t, setLocale, toggleLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      locale: "fa",
      dir: "rtl",
      t: fa,
      setLocale: () => {},
      toggleLocale: () => {},
    };
  }
  return context;
}

export function useTranslation() {
  const { t, locale, dir } = useI18n();
  return { t, locale, dir };
}
