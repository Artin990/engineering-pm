"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type UserRole = "admin" | "member" | "owner" | "viewer";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  avatar?: string;
  github?: string;
}

export const DEFAULT_ADMIN_PROFILE: UserProfile = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "مدیر سیستم",
  email: "admin@flowdeck.dev",
  role: "admin",
  roleTitle: "مدیر ارشد",
  avatar: "م",
};

export const DEFAULT_MEMBER_PROFILE: UserProfile = {
  id: "00000000-0000-0000-0000-000000000002",
  name: "کاربر توسعه‌دهنده",
  email: "member@flowdeck.dev",
  role: "member",
  roleTitle: "توسعه‌دهنده مهندسی",
  avatar: "ت",
};

interface RoleContextValue {
  role: UserRole;
  profile: UserProfile;
  setRole: (role: UserRole) => void;
  setUserSession: (user: Partial<UserProfile>) => void;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isMember: boolean;
  isLoading: boolean;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

function setCookie(name: string, value: string, days = 30) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>("admin");
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_ADMIN_PROFILE);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // همگام‌سازی سشن کاربر از Supabase و لوکال استوریج
  useEffect(() => {
    let mounted = true;

    async function syncAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          const userMeta = session.user.user_metadata || {};
          const userEmail = session.user.email || "";
          const userName = userMeta.name || userMeta.full_name || userMeta.user_name || userEmail.split("@")[0] || "کاربر Flowdeck";
          const userRole: UserRole = userMeta.role || "admin";

          const userProf: UserProfile = {
            id: session.user.id,
            name: userName,
            email: userEmail,
            role: userRole,
            roleTitle: userRole === "admin" || userRole === "owner" ? "مدیر ارشد مهندسی" : "توسعه‌دهنده",
            avatar: userMeta.avatar_url || userName.charAt(0),
            github: userMeta.user_name || userMeta.github_login,
          };

          setProfile(userProf);
          setRoleState(userRole);

          setCookie("flowdeck_active_role", userRole);
          setCookie("flowdeck_user_email", userEmail);
          setCookie("flowdeck_user_id", session.user.id);
          setCookie("flowdeck_user_name", userName);
          setIsLoading(false);
          return;
        }

        // بررسی در صورت وجود ذخیره محلی قبلی
        const savedSession = localStorage.getItem("flowdeck_user_session");
        if (savedSession && mounted) {
          const parsed = JSON.parse(savedSession) as UserProfile;
          setProfile(parsed);
          setRoleState(parsed.role || "admin");
          setCookie("flowdeck_active_role", parsed.role || "admin");
          setCookie("flowdeck_user_email", parsed.email);
          setCookie("flowdeck_user_id", parsed.id);
          setCookie("flowdeck_user_name", parsed.name);
        }
      } catch (err) {
        console.warn("[RoleProvider] Auth sync note:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    syncAuth();

    // اشتراک در تغییرات وضعیت احراز هویت Supabase
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (session?.user) {
        const userMeta = session.user.user_metadata || {};
        const userEmail = session.user.email || "";
        const userName = userMeta.name || userMeta.full_name || userMeta.user_name || userEmail.split("@")[0] || "کاربر Flowdeck";
        const userRole: UserRole = userMeta.role || "admin";

        const userProf: UserProfile = {
          id: session.user.id,
          name: userName,
          email: userEmail,
          role: userRole,
          roleTitle: userRole === "admin" || userRole === "owner" ? "مدیر ارشد مهندسی" : "توسعه‌دهنده",
          avatar: userMeta.avatar_url || userName.charAt(0),
          github: userMeta.user_name,
        };

        setProfile(userProf);
        setRoleState(userRole);
        localStorage.setItem("flowdeck_user_session", JSON.stringify(userProf));
        localStorage.setItem("flowdeck_active_role", userRole);
        setCookie("flowdeck_active_role", userRole);
        setCookie("flowdeck_user_email", userEmail);
        setCookie("flowdeck_user_id", session.user.id);
        setCookie("flowdeck_user_name", userName);
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);

  const setRole = useCallback((newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem("flowdeck_active_role", newRole);
    setCookie("flowdeck_active_role", newRole);

    setProfile((prev) => {
      const updated: UserProfile = {
        ...prev,
        role: newRole,
        roleTitle: newRole === "admin" || newRole === "owner" ? "مدیر ارشد مهندسی" : "توسعه‌دهنده",
      };
      localStorage.setItem("flowdeck_user_session", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setUserSession = useCallback((user: Partial<UserProfile>) => {
    const activeRole: UserRole = user.role || "admin";
    const newProfile: UserProfile = {
      id: user.id || DEFAULT_ADMIN_PROFILE.id,
      name: user.name || "کاربر Flowdeck",
      email: user.email || "user@flowdeck.dev",
      role: activeRole,
      roleTitle: activeRole === "admin" || activeRole === "owner" ? "مدیر ارشد مهندسی" : "توسعه‌دهنده",
      avatar: user.avatar || user.name?.charAt(0) || "ک",
      github: user.github,
    };

    setRoleState(activeRole);
    setProfile(newProfile);

    localStorage.setItem("flowdeck_active_role", activeRole);
    localStorage.setItem("flowdeck_user_session", JSON.stringify(newProfile));

    setCookie("flowdeck_active_role", activeRole);
    setCookie("flowdeck_user_email", newProfile.email);
    setCookie("flowdeck_user_id", newProfile.id);
    setCookie("flowdeck_user_name", newProfile.name);
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ادامه پاک‌سازی حتی در خطای شبکه
    }
    localStorage.removeItem("flowdeck_active_role");
    localStorage.removeItem("flowdeck_user_session");
    deleteCookie("flowdeck_active_role");
    deleteCookie("flowdeck_user_email");
    deleteCookie("flowdeck_user_id");
    deleteCookie("flowdeck_user_name");
    setProfile(DEFAULT_ADMIN_PROFILE);
    setRoleState("admin");
  }, [supabase]);

  return (
    <RoleContext.Provider
      value={{
        role,
        profile,
        setRole,
        setUserSession,
        logout,
        isAdmin: role === "admin" || role === "owner",
        isMember: role === "member" || role === "viewer",
        isLoading,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useUserRole() {
  const context = useContext(RoleContext);
  if (!context) {
    return {
      role: "admin" as UserRole,
      profile: DEFAULT_ADMIN_PROFILE,
      setRole: () => {},
      setUserSession: () => {},
      logout: async () => {},
      isAdmin: true,
      isMember: false,
      isLoading: false,
    };
  }
  return context;
}
