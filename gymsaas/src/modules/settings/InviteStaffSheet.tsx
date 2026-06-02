"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useInviteReception } from "./useSettings";
import { ApiError } from "@/lib/services/apiClient";

/** Mobile-first reception invite (bottom sheet). */
export function InviteStaffSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const key = open ? "open" : "closed";
  return (
    <Sheet open={open} onClose={onClose} title="Add reception staff">
      <InviteBody key={key} onDone={onClose} />
    </Sheet>
  );
}

function InviteBody({ onDone }: { onDone: () => void }) {
  const invite = useInviteReception();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleInvite() {
    setError(null);
    try {
      await invite.mutateAsync({ email: email.trim(), display_name: name.trim(), temp_password: pwd });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create the login.");
    }
  }

  if (done) {
    return (
      <div className="py-4 text-center">
        <div className="mb-2 text-3xl">✅</div>
        <p className="font-semibold">Reception login created</p>
        <p className="mt-1 text-sm text-muted">
          Share the email and temporary password with your staff. They can sign in at the login page.
        </p>
        <Button className="mt-5 w-full" size="lg" onClick={onDone}>Done</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Input label="Staff name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Front desk name" autoComplete="name" />
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="reception@gym.com" autoComplete="off" />
      <Input
        label="Temporary password"
        value={pwd}
        onChange={(e) => setPwd(e.target.value)}
        placeholder="At least 8 characters"
        hint="Staff can change it later"
        autoComplete="off"
      />
      {error ? (
        <p className="rounded-[var(--radius-card)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}
      <Button className="w-full" size="lg" onClick={handleInvite} isLoading={invite.isPending}>
        Create reception login
      </Button>
    </div>
  );
}
