/**
 * Protected app layout (server component).
 *
 * Resolves the session and gates access:
 *   - not signed in            -> /login
 *   - signed in, no tenant     -> /onboarding
 *   - signed in with tenant    -> render the app for owner/reception
 *
 * Env-safe degradation: if the Admin SDK is NOT configured (e.g. local UI
 * preview without Firebase), we render in a clearly-labelled PREVIEW mode as
 * owner instead of trapping the user in a redirect loop.
 */
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth/session.server";
import { isAdminReady } from "@/lib/firebase/admin";
import { isStaffRole } from "@/lib/auth/claims";
import { isGymSuspended } from "@/lib/services/gym.server";
import { AppSessionProvider } from "@/components/providers/AppSessionProvider";
import type { RoleKey } from "@/lib/domain/constants";

export default async function ProtectedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Preview mode when backend auth isn't configured yet.
  if (!isAdminReady) {
    return (
      <AppSessionProvider
        value={{
          uid: "preview",
          email: null,
          gym_profile_id: "preview",
          role: "owner",
          previewMode: true,
        }}
      >
        {children}
      </AppSessionProvider>
    );
  }

  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.claims.gym_profile_id || !user.claims.role) redirect("/onboarding");
  if (!isStaffRole(user.claims.role)) {
    // Members use the member portal, not the staff app.
    redirect("/login");
  }

  // Billing/account enforcement: suspended gyms see a clear locked screen.
  if (await isGymSuspended(user.claims.gym_profile_id)) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 p-8 text-center">
          <div className="mb-3 text-3xl">🔒</div>
          <h1 className="text-lg font-semibold">Account suspended</h1>
          <p className="mt-2 text-sm text-muted">
            This gym account is currently suspended. Please contact support to
            restore access.
          </p>
        </div>
      </main>
    );
  }

  return (
    <AppSessionProvider
      value={{
        uid: user.uid,
        email: user.email ?? null,
        gym_profile_id: user.claims.gym_profile_id,
        role: user.claims.role as RoleKey,
        previewMode: false,
      }}
    >
      {children}
    </AppSessionProvider>
  );
}
