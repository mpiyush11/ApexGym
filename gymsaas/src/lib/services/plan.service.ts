/**
 * Membership plan service (server-only). Tenant-scoped by gym_profile_id.
 * Money is converted from major to integer minor units here (Rule 2).
 * Plans are soft-deactivated (is_active=false), never hard-deleted, so member
 * history that references them stays intact (audit 15.6).
 */
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { path, SUBCOLLECTIONS } from "@/lib/firebase/paths";
import {
  PLAN_DURATION_DAYS,
  type PlanDurationKey,
} from "@/lib/domain/constants";
import { toMinor } from "@/lib/money/money";
import { nowIso } from "@/lib/utils/time";
import { ok, err, type Result } from "@/lib/utils/result";
import type { MembershipPlan } from "@/lib/domain/types";
import type { PlanInput } from "./plan.schema";

function plansCol(gym_profile_id: string) {
  const db = getAdminDb();
  return db ? db.collection(path.plans(gym_profile_id)) : null;
}

export async function listPlans(
  gym_profile_id: string,
  currency_code: string,
): Promise<Result<MembershipPlan[]>> {
  const col = plansCol(gym_profile_id);
  if (!col) return err("not_configured", "Database not configured.");
  try {
    const snap = await col.orderBy("display_order").get();
    const plans = snap.docs.map((d) => d.data() as MembershipPlan);
    // Keep currency consistent for display even on legacy docs.
    return ok(plans.map((p) => ({ ...p, currency_code: p.currency_code || currency_code })));
  } catch {
    return err("internal", "Could not load plans.");
  }
}

export async function createPlan(
  gym_profile_id: string,
  currency_code: string,
  input: PlanInput,
): Promise<Result<MembershipPlan>> {
  const col = plansCol(gym_profile_id);
  if (!col) return err("not_configured", "Database not configured.");
  const ref = col.doc();
  const now = nowIso();
  const duration = input.plan_duration_key as PlanDurationKey;
  const plan: MembershipPlan = {
    plan_id: ref.id,
    gym_profile_id,
    plan_display_name: input.plan_display_name,
    plan_duration_key: duration,
    plan_duration_days: PLAN_DURATION_DAYS[duration],
    price_amount_minor: toMinor(input.price_major, currency_code),
    joining_fee_minor: toMinor(input.joining_fee_major, currency_code),
    currency_code,
    plan_description: input.plan_description || "",
    is_active: input.is_active,
    display_order: input.display_order,
    created_at: now,
    updated_at: now,
  };
  try {
    await ref.set(plan);
    return ok(plan);
  } catch {
    return err("internal", "Could not create the plan.");
  }
}

export async function updatePlan(
  gym_profile_id: string,
  currency_code: string,
  plan_id: string,
  input: PlanInput,
): Promise<Result<MembershipPlan>> {
  const col = plansCol(gym_profile_id);
  if (!col) return err("not_configured", "Database not configured.");
  const ref = col.doc(plan_id);
  const duration = input.plan_duration_key as PlanDurationKey;
  const patch = {
    plan_display_name: input.plan_display_name,
    plan_duration_key: duration,
    plan_duration_days: PLAN_DURATION_DAYS[duration],
    price_amount_minor: toMinor(input.price_major, currency_code),
    joining_fee_minor: toMinor(input.joining_fee_major, currency_code),
    plan_description: input.plan_description || "",
    is_active: input.is_active,
    display_order: input.display_order,
    updated_at: nowIso(),
  };
  try {
    const snap = await ref.get();
    if (!snap.exists) return err("not_found", "Plan not found.");
    await ref.set(patch, { merge: true });
    return ok({ ...(snap.data() as MembershipPlan), ...patch });
  } catch {
    return err("internal", "Could not update the plan.");
  }
}

/** Soft delete = deactivate (preserves membership history). */
export async function deactivatePlan(
  gym_profile_id: string,
  plan_id: string,
): Promise<Result<true>> {
  const col = plansCol(gym_profile_id);
  if (!col) return err("not_configured", "Database not configured.");
  try {
    await col.doc(plan_id).set(
      { is_active: false, updated_at: nowIso() },
      { merge: true },
    );
    return ok(true);
  } catch {
    return err("internal", "Could not deactivate the plan.");
  }
}

export { SUBCOLLECTIONS };
