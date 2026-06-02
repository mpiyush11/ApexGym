"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { firebaseStatus } from "@/lib/config/env";
import { ConfigNeededState } from "@/components/feedback/ErrorState";
import {
  signInWithEmail,
  registerWithEmail,
  fetchClaims,
} from "@/lib/auth/authClient";

type Mode = "signin" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function routeAfterAuth() {
    const claims = await fetchClaims();
    // No tenant yet -> onboarding. Otherwise into the app.
    if (!claims?.gym_profile_id) router.push("/onboarding");
    else router.push("/app");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result =
      mode === "signin"
        ? await signInWithEmail(email.trim(), password)
        : await registerWithEmail(email.trim(), password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    await routeAfterAuth();
  }

  if (!firebaseStatus.isConfigured) {
    return (
      <AuthLayout title="Sign in">
        <ConfigNeededState what="Firebase Authentication" />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={mode === "signin" ? "Welcome back" : "Create your account"}
      subtitle={
        mode === "signin"
          ? "Sign in to manage your gym."
          : "Start managing your gym in minutes."
      }
      footer={
        <Link href="/" className="hover:text-foreground">
          ← Back to home
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@gym.com"
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        {error ? (
          <p className="rounded-[var(--radius-card)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" isLoading={loading}>
          {mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        {mode === "signin" ? "New to GymOS?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "register" : "signin");
            setError(null);
          }}
          className="font-medium text-brand hover:underline"
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </AuthLayout>
  );
}
