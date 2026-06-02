"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { RoleKey } from "@/lib/domain/constants";

export interface AppSession {
  uid: string;
  email: string | null;
  gym_profile_id: string;
  role: RoleKey;
  previewMode: boolean;
}

const SessionContext = createContext<AppSession | null>(null);

export function AppSessionProvider({
  value,
  children,
}: {
  value: AppSession;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useAppSession(): AppSession {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useAppSession must be used within AppSessionProvider");
  }
  return ctx;
}
