"use client";

import { useEffect, useState, use } from "react";
import type { ConfirmationResult } from "firebase/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/feedback/Skeleton";
import { firebaseStatus, appConfig } from "@/lib/config/env";
import { ConfigNeededState } from "@/components/feedback/ErrorState";
import {
  startPhoneSignIn,
  confirmPhoneAndBindMember,
  signOut,
  fetchClaims,
} from "@/lib/auth/authClient";
import { useMemberCard } from "@/modules/member/useMemberCard";
import { DigitalCard } from "@/modules/member/DigitalCard";
import { ApiError } from "@/lib/services/apiClient";

type Step = "checking" | "phone" | "otp" | "card";

/**
 * Member portal + digital card (mobile-first). Phone-OTP login binds to an
 * existing member; the card renders from existing records. No new identity.
 */
export default function MemberPortalPage({
  params,
}: {
  params: Promise<{ gym_slug: string }>;
}) {
  const { gym_slug } = use(params);
  const [step, setStep] = useState<Step>("checking");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const card = useMemberCard(step === "card");

  // On load, check if we're already a signed-in member of THIS gym.
  useEffect(() => {
    let active = true;
    (async () => {
      const claims = await fetchClaims();
      if (!active) return;
      if (claims?.role === "member" && claims.member_id) setStep("card");
      else setStep("phone");
    })();
    return () => { active = false; };
  }, []);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await startPhoneSignIn(phone.trim(), "recaptcha-container");
    setBusy(false);
    if (!res.ok) { setError(res.error.message); return; }
    setConfirmation(res.data);
    setStep("otp");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmation) return;
    setError(null);
    setBusy(true);
    const res = await confirmPhoneAndBindMember(confirmation, code.trim(), gym_slug);
    setBusy(false);
    if (!res.ok) {
      setError(res.error instanceof ApiError ? res.error.message : res.error.message);
      return;
    }
    setStep("card");
  }

  async function handleSignOut() {
    await signOut();
    setStep("phone");
    setPhone(""); setCode(""); setConfirmation(null);
  }

  if (!firebaseStatus.isConfigured) {
    return <Shell><ConfigNeededState what="Member login" /></Shell>;
  }

  return (
    <Shell>
      {/* Invisible reCAPTCHA target for phone OTP */}
      <div id="recaptcha-container" />

      {step === "checking" ? (
        <div className="space-y-3"><Skeleton className="h-11 w-full" /><Skeleton className="h-40 w-full" /></div>
      ) : step === "phone" ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          <h1 className="text-xl font-semibold">Member login</h1>
          <p className="text-sm text-muted">Enter the phone number registered with your gym.</p>
          <Input label="Phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            required autoComplete="tel" placeholder="+91 90000 00000" hint="Include country code, e.g. +91" />
          {error ? <ErrorLine msg={error} /> : null}
          <Button type="submit" size="lg" className="w-full" isLoading={busy}>Send code</Button>
        </form>
      ) : step === "otp" ? (
        <form onSubmit={handleVerify} className="space-y-4">
          <h1 className="text-xl font-semibold">Enter code</h1>
          <p className="text-sm text-muted">We sent a 6-digit code to {phone}.</p>
          <Input label="Verification code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)}
            required placeholder="123456" />
          {error ? <ErrorLine msg={error} /> : null}
          <Button type="submit" size="lg" className="w-full" isLoading={busy}>Verify & sign in</Button>
          <button type="button" onClick={() => { setStep("phone"); setError(null); }}
            className="block w-full text-center text-sm text-muted">← Use a different number</button>
        </form>
      ) : (
        /* card */
        <div>
          {card.isLoading ? (
            <Skeleton className="h-64 w-full rounded-2xl" />
          ) : card.isError ? (
            <CardError error={card.error} onSignOut={handleSignOut} />
          ) : card.data ? (
            <>
              <DigitalCard card={card.data} />
              <button type="button" onClick={handleSignOut}
                className="mt-5 block w-full text-center text-sm text-muted">Sign out</button>
            </>
          ) : null}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 opacity-30"
        style={{ background: "radial-gradient(50% 40% at 50% 0%, rgba(212,175,55,0.18), transparent 70%)" }} />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="text-2xl">🪪</span>
          <span className="text-xl font-bold tracking-tight">{appConfig.appName} Member</span>
        </div>
        <div className="rounded-[var(--radius-card)] border border-surface-border bg-surface p-6 shadow-[var(--shadow-md)] sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return (
    <p className="rounded-[var(--radius-card)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{msg}</p>
  );
}

function CardError({ error, onSignOut }: { error: unknown; onSignOut: () => void }) {
  const code = error instanceof ApiError ? error.code : "internal";
  const msg =
    code === "suspended"
      ? "This gym account is suspended. Please contact the gym."
      : error instanceof ApiError ? error.message : "Could not load your card.";
  return (
    <div className="py-6 text-center">
      <div className="mb-2 text-3xl">{code === "suspended" ? "🔒" : "⚠️"}</div>
      <p className="text-sm text-muted">{msg}</p>
      <button type="button" onClick={onSignOut} className="mt-4 text-sm font-medium text-brand">Sign out</button>
    </div>
  );
}
