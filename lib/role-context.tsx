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

const ADMIN_EMAILS = [
  "amiriartin185@gmil.com",
  "amiriartin185@gmail.com",
  "artinamiri185@gmail.com",
];

export function isUserAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.some((adm) => adm.toLowerCase() === email.trim().toLowerCase());
}

export const DEFAULT_MEMBER_PROFILE: UserProfile = {
  id: "00000000-0000-0000-0000-000000000002",
  name: "کاربر جدید",
  email: "user@flowdeck.dev",
  role: "member",
  roleTitle: "توسعه‌دهنده / کاربر عادی",
  avatar: "ک",
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
  const [role, setRoleState] = useState<UserRole>("member");
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_MEMBER_PROFILE);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    async function syncAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          const userMeta = session.user.user_metadata || {};
          const userEmail = session.user.email || "";
          const userName = userMeta.name || userMeta.full_name || userMeta.user_name || userEmail.split("@")[0] || "کاربر Flowdeck";
          
          // فقط ایمیل‌های مجاز دسترسی ادمین دارند و سایر کاربران جدید عادی خواهند بود
          const isAdminUser = isUserAdminEmail(userEmail);
          const userRole: UserRole = isAdminUser ? "admin" : "member";
          const roleTitle = isAdminUser ? "مدیرعامل و ادمین ارشد" : "توسعه‌دهنده / کاربر عادی";
          const avatarUrl = userMeta.avatar_url || userMeta.picture || null;

          const userProf: UserProfile = {
            id: session.user.id,
            name: userName,
            email: userEmail,
            role: userRole,
            roleTitle: roleTitle,
            avatar: avatarUrl || userName.charAt(0),
            github: userMeta.user_name || userMeta.github_login,
          };

          setProfile(userProf);
          setRoleState(userRole);

          setCookie("flowdeck_active_role", userRole);
          setCookie("flowdeck_user_email", userEmail);
          setCookie("flowdeck_user_id", session.user.id);
          setCookie("flowdeck_user_name", userName);
          localStorage.setItem("flowdeck_user_session", JSON.stringify(userProf));
          localStorage.setItem("flowdeck_active_role", userRole);
          setIsLoading(false);
          return;
        } else if (mounted) {
          // در صورتی که نشستی در سوپابیس وجود ندارد، سشن لوکال را پاک کن
          localStorage.removeItem("flowdeck_user_session");
          localStorage.removeItem("flowdeck_active_role");
          deleteCookie("flowdeck_active_role");
          deleteCookie("flowdeck_user_email");
          deleteCookie("flowdeck_user_id");
          deleteCookie("flowdeck_user_name");
          setProfile(DEFAULT_MEMBER_PROFILE);
          setRoleState("member");
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
        
        const isAdminUser = isUserAdminEmail(userEmail);
        const userRole: UserRole = isAdminUser ? "admin" : "member";
        const roleTitle = isAdminUser ? "مدیرعامل و ادمین ارشد" : "توسعه‌دهنده / کاربر عادی";
        const avatarUrl = userMeta.avatar_url || userMeta.picture || null;

        const userProf: UserProfile = {
          id: session.user.id,
          name: userName,
          email: userEmail,
          role: userRole,
          roleTitle: roleTitle,
          avatar: avatarUrl || userName.charAt(0),
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

  // فقط ادمین اصلی اجازه تغییر نقش دارد
  const setRole = useCallback((newRole: UserRole) => {
    if (!isUserAdminEmail(profile.email)) return; // کاربران عادی اجازه تغییر نقش به ادمین را ندارند

    setRoleState(newRole);
    localStorage.setItem("flowdeck_active_role", newRole);
    setCookie("flowdeck_active_role", newRole);

    setProfile((prev) => {
      const updated: UserProfile = {
        ...prev,
        role: newRole,
        roleTitle: newRole === "admin" || newRole === "owner" ? "مدیرعامل و ادمین ارشد" : "توسعه‌دهنده / کاربر عادی",
      };
      localStorage.setItem("flowdeck_user_session", JSON.stringify(updated));
      return updated;
    });
  }, [profile.email]);

  const setUserSession = useCallback((user: Partial<UserProfile>) => {
    const isAdminUser = isUserAdminEmail(user.email);
    const activeRole: UserRole = isAdminUser ? "admin" : "member";
    const roleTitle = isAdminUser ? "مدیرعامل و ادمین ارشد" : "توسعه‌دهنده / کاربر عادی";

    const newProfile: UserProfile = {
      id: user.id || DEFAULT_MEMBER_PROFILE.id,
      name: user.name || "کاربر Flowdeck",
      email: user.email || "user@flowdeck.dev",
      role: activeRole,
      roleTitle: roleTitle,
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
    setProfile(DEFAULT_MEMBER_PROFILE);
    setRoleState("member");
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
      role: "member" as UserRole,
      profile: DEFAULT_MEMBER_PROFILE,
      setRole: () => {},
      setUserSession: () => {},
      logout: async () => {},
      isAdmin: false,
      isMember: true,
      isLoading: false,
    };
  }
  return context;
}
