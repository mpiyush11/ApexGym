"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { slugify } from "@/lib/utils/slug";
import { fetchClaims, refreshSession } from "@/lib/auth/authClient";

export default function OnboardingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [gymName, setGymName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Guard: must be signed in; if already has a tenant, go to app.
  useEffect(() => {
    let active = true;
    (async () => {
      const claims = await fetchClaims();
      if (!active) return;
      if (!claims) {
        router.replace("/login");
        return;
      }
      if (claims.gym_profile_id) {
        router.replace("/app");
        return;
      }
      setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  const previewSlug = gymName ? slugify(gymName) : "your-gym";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gym_display_name: gymName.trim(),
          owner_display_name: ownerName.trim(),
          gym_contact_phone: phone.trim(),
          gym_whatsapp_number: phone.trim(),
          gym_city: city.trim(),
          default_currency_code: "INR",
          gym_timezone: "Asia/Kolkata",
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error?.message ?? "Could not create your gym.");
        setLoading(false);
        return;
      }
      // Claims (gym_profile_id, role) were just set server-side. Re-mint the
      // session cookie from a FRESH ID token so the protected layout sees them
      // — otherwise the stale cookie causes an onboarding redirect loop.
      const refreshed = await refreshSession();
      if (!refreshed.ok) {
        setError("Gym created. Please sign in again to continue.");
        setLoading(false);
        return;
      }
      router.replace("/app");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <AuthLayout title="Setting things up…">
        <div className="space-y-3">
          <div className="skeleton h-11 w-full" />
          <div className="skeleton h-11 w-full" />
          <div className="skeleton h-11 w-2/3" />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your gym"
      subtitle="A few details to set up your workspace. You can change these later."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Gym name"
          name="gym_display_name"
          required
          value={gymName}
          onChange={(e) => setGymName(e.target.value)}
          placeholder="Iron Paradise Fitness"
          hint={`Your public URL: /g/${previewSlug}`}
        />
        <Input
          label="Your name"
          name="owner_display_name"
          required
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder="Owner full name"
        />
        <Input
          label="Phone / WhatsApp"
          name="gym_contact_phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 90000 00000"
        />
        <Input
          label="City"
          name="gym_city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Mumbai"
        />
        {error ? (
          <p className="rounded-[var(--radius-card)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" isLoading={loading}>
          Create gym & continue
        </Button>
      </form>
    </AuthLayout>
  );
}
