import { describe, it, expect } from "vitest";
import { fa } from "@/lib/i18n/dictionaries/fa";
import { en } from "@/lib/i18n/dictionaries/en";

describe("i18n Translation Dictionaries", () => {
  it("should have matching top-level sections between FA and EN dictionaries", () => {
    const faSections = Object.keys(fa).sort();
    const enSections = Object.keys(en).sort();
    expect(faSections).toEqual(enSections);
  });

  it("should have matching keys in all sections", () => {
    const sections = Object.keys(fa) as (keyof typeof fa)[];

    for (const section of sections) {
      const faKeys = Object.keys(fa[section]).sort();
      const enKeys = Object.keys(en[section]).sort();
      expect(faKeys, `Mismatch in section "${section}" keys`).toEqual(enKeys);
    }
  });

  it("should not have empty translation values in FA dictionary", () => {
    const sections = Object.keys(fa) as (keyof typeof fa)[];

    for (const section of sections) {
      for (const [key, value] of Object.entries(fa[section])) {
        expect(typeof value).toBe("string");
        expect(value.trim().length, `Empty FA translation for ${section}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("should not have empty translation values in EN dictionary", () => {
    const sections = Object.keys(en) as (keyof typeof en)[];

    for (const section of sections) {
      for (const [key, value] of Object.entries(en[section])) {
        expect(typeof value).toBe("string");
        expect(value.trim().length, `Empty EN translation for ${section}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("should provide correct core navigation and auth translations", () => {
    expect(fa.nav.projects).toBe("پروژه‌ها");
    expect(en.nav.projects).toBe("Projects");

    expect(fa.nav.chat).toBe("گفتگو و پیام‌ها");
    expect(en.nav.chat).toBe("Chat & Messages");

    expect(fa.auth.loginTitle).toBe("ورود به سامانه");
    expect(en.auth.loginTitle).toBe("Sign in to FlowDeck");
  });
});
