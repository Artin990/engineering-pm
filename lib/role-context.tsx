"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

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

const ADMIN_PROFILE: UserProfile = {
  id: "admin-1",
  name: "آرتین امیری",
  email: "artinamiri185@gmail.com",
  role: "admin",
  roleTitle: "مدیرعامل و ادمین ارشد",
  avatar: "آ",
  github: "artin-amiri",
};

const MEMBER_PROFILE: UserProfile = {
  id: "member-1",
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
  isAdmin: boolean;
  isMember: boolean;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>("admin");

  useEffect(() => {
    const saved = localStorage.getItem("flowdeck_active_role") as UserRole | null;
    if (saved === "admin" || saved === "member") {
      setRoleState(saved);
    }
  }, []);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem("flowdeck_active_role", newRole);
  };

  const profile = role === "admin" ? ADMIN_PROFILE : MEMBER_PROFILE;

  return (
    <RoleContext.Provider
      value={{
        role,
        profile,
        setRole,
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
      isAdmin: true,
      isMember: false,
    };
  }
  return context;
}
