"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type UserRole = "admin" | "member";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  avatar?: string;
  github?: string;
}

export const ADMIN_PROFILE: UserProfile = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "آرتین امیری",
  email: "artinamiri185@gmail.com",
  role: "admin",
  roleTitle: "مدیرعامل و ادمین ارشد",
  avatar: "آ",
  github: "artin-amiri",
};

export const MEMBER_PROFILE: UserProfile = {
  id: "00000000-0000-0000-0000-000000000002",
  name: "سارا احمدی",
  email: "sara.ahmadi@flowdeck.dev",
  role: "member",
  roleTitle: "توسعه‌دهنده / کاربر عادی",
  avatar: "س",
  github: "sara-ahmadi",
};

interface RoleContextValue {
  role: UserRole;
  profile: UserProfile;
  setRole: (role: UserRole) => void;
  setUserSession: (user: Partial<UserProfile>) => void;
  logout: () => void;
  isAdmin: boolean;
  isMember: boolean;
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
  const [customProfile, setCustomProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    // Load persisted session
    try {
      const savedRole = localStorage.getItem("flowdeck_active_role") as UserRole | null;
      const savedSession = localStorage.getItem("flowdeck_user_session");

      if (savedSession) {
        const parsed = JSON.parse(savedSession) as UserProfile;
        setCustomProfile(parsed);
        if (parsed.role) {
          setRoleState(parsed.role);
          setCookie("flowdeck_active_role", parsed.role);
          setCookie("flowdeck_user_email", parsed.email);
          setCookie("flowdeck_user_id", parsed.id);
        }
      } else if (savedRole === "admin" || savedRole === "member") {
        setRoleState(savedRole);
        setCookie("flowdeck_active_role", savedRole);
        const baseProf = savedRole === "admin" ? ADMIN_PROFILE : MEMBER_PROFILE;
        setCookie("flowdeck_user_email", baseProf.email);
        setCookie("flowdeck_user_id", baseProf.id);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const setRole = useCallback((newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem("flowdeck_active_role", newRole);
    setCookie("flowdeck_active_role", newRole);

    const baseProf = newRole === "admin" ? ADMIN_PROFILE : MEMBER_PROFILE;
    setCookie("flowdeck_user_email", baseProf.email);
    setCookie("flowdeck_user_id", baseProf.id);

    if (customProfile) {
      const updated: UserProfile = {
        ...customProfile,
        role: newRole,
        roleTitle: newRole === "admin" ? "مدیرعامل و ادمین ارشد" : "توسعه‌دهنده / کاربر عادی",
      };
      setCustomProfile(updated);
      localStorage.setItem("flowdeck_user_session", JSON.stringify(updated));
    }
  }, [customProfile]);

  const setUserSession = useCallback((user: Partial<UserProfile>) => {
    const activeRole = user.role || (user.email === "artinamiri185@gmail.com" ? "admin" : "member");
    const newProfile: UserProfile = {
      id: user.id || (activeRole === "admin" ? ADMIN_PROFILE.id : MEMBER_PROFILE.id),
      name: user.name || (activeRole === "admin" ? ADMIN_PROFILE.name : "کاربر Flowdeck"),
      email: user.email || (activeRole === "admin" ? ADMIN_PROFILE.email : "user@flowdeck.dev"),
      role: activeRole,
      roleTitle: activeRole === "admin" ? "مدیرعامل و ادمین ارشد" : "توسعه‌دهنده / کاربر عادی",
      avatar: user.avatar || user.name?.charAt(0) || (activeRole === "admin" ? "آ" : "ک"),
      github: user.github,
    };

    setRoleState(activeRole);
    setCustomProfile(newProfile);

    localStorage.setItem("flowdeck_active_role", activeRole);
    localStorage.setItem("flowdeck_user_session", JSON.stringify(newProfile));

    setCookie("flowdeck_active_role", activeRole);
    setCookie("flowdeck_user_email", newProfile.email);
    setCookie("flowdeck_user_id", newProfile.id);
    setCookie("flowdeck_user_name", newProfile.name);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("flowdeck_active_role");
    localStorage.removeItem("flowdeck_user_session");
    deleteCookie("flowdeck_active_role");
    deleteCookie("flowdeck_user_email");
    deleteCookie("flowdeck_user_id");
    deleteCookie("flowdeck_user_name");
    setCustomProfile(null);
    setRoleState("admin");
  }, []);

  const profile = customProfile || (role === "admin" ? ADMIN_PROFILE : MEMBER_PROFILE);

  return (
    <RoleContext.Provider
      value={{
        role,
        profile,
        setRole,
        setUserSession,
        logout,
        isAdmin: role === "admin",
        isMember: role === "member",
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
      profile: ADMIN_PROFILE,
      setRole: () => {},
      setUserSession: () => {},
      logout: () => {},
      isAdmin: true,
      isMember: false,
    };
  }
  return context;
}
