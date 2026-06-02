/**
 * Renewal service (server-only) — THE highest-priority workflow.
 *
 * A renewal creates a NEW immutable membership period. It NEVER edits a prior
 * period. Everything financial is SNAPSHOT at sale time so future plan price
 * changes can never alter historical records (audit 2.3 / 6.2 — immutability).
 *
 * The whole operation is ONE Firestore transaction:
 *   1. read plan (snapshot source) + member (current end date) + counters
 *   2. compute period dates (continuation vs fresh) and payment in minor units
 *   3. create memberships/{id} (immutable)
 *   4. update member.current_membership_summary + derived member_status_key
 *   5. adjust counters: revenue (monthly, with reset) + active/expiring/expired
 *   6. write an activity_log entry (audit trail)
 *
 * Money is integer minor units throughout (Rule 2).
 */
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { path, SUBCOLLECTIONS } from "@/lib/firebase/paths";
import {
  CURRENT_SCHEMA_VERSION,
  MEMBER_STATUS_KEYS,
  PAYMENT_STATUS_KEYS,
  type MemberStatusKey,
} from "@/lib/domain/constants";
import { toMinor } from "@/lib/money/money";
import { addMinor, computeDueMinor } from "@/lib/money/money";
import { nowIso, monthKey } from "@/lib/utils/time";
import { gymTodayIso, computeRenewalPeriod } from "@/lib/domain/renewal.logic";
import { deriveMemberStatus } from "@/lib/domain/status.logic";
import { ok, err, type Result } from "@/lib/utils/result";
import type {
  Membership,
  MembershipPlan,
  Member,
  CurrentMembershipSummary,
} from "@/lib/domain/types";
import type { RenewalInput } from "./renewal.schema";

export interface RenewalContext {
  gym_profile_id: string;
  gym_timezone: string;
  currency_code: string;
  reminder_days: number;
  actor_app_user_id: string;
  actor_display_name: string;
}

export async function renewMembership(
  ctx: RenewalContext,
  member_id: string,
  input: RenewalInput,
): Promise<Result<{ membership: Membership; member_status_key: MemberStatusKey }>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");

  const memberRef = db.doc(`${path.members(ctx.gym_profile_id)}/${member_id}`);
  const planRef = db.doc(`${path.plans(ctx.gym_profile_id)}/${input.plan_id}`);
  const countersRef = db.doc(path.counters(ctx.gym_profile_id));
  const membershipRef = memberRef.collection(SUBCOLLECTIONS.MEMBERSHIPS).doc();
  const logRef = db
    .collection(`${path.gymProfile(ctx.gym_profile_id)}/${SUBCOLLECTIONS.ACTIVITY_LOGS}`)
    .doc();

  const now = nowIso();
  const todayIso = gymTodayIso(ctx.gym_timezone);
  // Monthly rollup doc (derived view) keyed by the collection month.
  const rollupMonthKey = monthKey(now);
  const rollupRef = db.doc(path.analyticsMonth(ctx.gym_profile_id, rollupMonthKey));

  try {
    const result = await db.runTransaction(async (tx) => {
      const [memberSnap, planSnap, rollupSnap] = await Promise.all([
        tx.get(memberRef),
        tx.get(planRef),
        tx.get(rollupRef),
      ]);

      if (!memberSnap.exists) throw new DomainError("not_found", "Member not found.");
      if (!planSnap.exists) throw new DomainError("not_found", "Plan not found.");

      const member = memberSnap.data() as Member;
      const plan = planSnap.data() as MembershipPlan;
      const rollupExists = rollupSnap.exists;

      // First-ever period for this member = a "new join" for analytics.
      const isFirstJoin = !member.current_membership_summary;

      // ── 1. dates ──────────────────────────────────────────────
      const currentEnd = member.current_membership_summary?.membership_end_date ?? null;
      const { membership_start_date, membership_end_date } = computeRenewalPeriod(
        plan.plan_duration_days,
        todayIso,
        currentEnd,
      );

      // ── 2. money (integer minor units, snapshotted) ───────────
      const price_amount_minor = plan.price_amount_minor;
      const joining_fee_minor = input.include_joining_fee ? plan.joining_fee_minor : 0;
      const discount_minor = toMinor(input.discount_major ?? 0, ctx.currency_code);
      const gross = addMinor(price_amount_minor, joining_fee_minor);
      const renewal_amount_minor = Math.max(0, gross - discount_minor);
      const amount_paid_minor =
        input.amount_paid_major != null
          ? toMinor(input.amount_paid_major, ctx.currency_code)
          : renewal_amount_minor; // default: paid in full
      const amount_due_minor = computeDueMinor(renewal_amount_minor, amount_paid_minor);
      const payment_status_key =
        amount_due_minor === 0
          ? PAYMENT_STATUS_KEYS.PAID
          : amount_paid_minor > 0
            ? PAYMENT_STATUS_KEYS.PARTIAL
            : PAYMENT_STATUS_KEYS.PENDING;

      // ── 3. immutable membership doc ───────────────────────────
      const membership: Membership = {
        membership_id: membershipRef.id,
        gym_profile_id: ctx.gym_profile_id,
        member_id,
        plan_id: plan.plan_id,
        plan_name_snapshot: plan.plan_display_name,
        plan_duration_key: plan.plan_duration_key,
        plan_duration_days: plan.plan_duration_days,
        price_amount_minor,
        joining_fee_minor,
        discount_minor,
        renewal_amount_minor,
        amount_paid_minor,
        amount_due_minor,
        currency_code: ctx.currency_code,
        payment_method_key: input.payment_method_key,
        payment_status_key,
        membership_start_date,
        membership_end_date,
        created_by_app_user_id: ctx.actor_app_user_id,
        created_at: now,
      };
      tx.set(membershipRef, membership);

      // ── 4. member summary + derived status ────────────────────
      const newStatus = deriveMemberStatus(
        membership_end_date,
        todayIso,
        ctx.reminder_days,
      );
      const summary: CurrentMembershipSummary = {
        membership_id: membership.membership_id,
        plan_name_snapshot: plan.plan_display_name,
        plan_duration_key: plan.plan_duration_key,
        membership_end_date,
        member_status_key: newStatus,
        amount_due_minor,
      };
      tx.set(
        memberRef,
        {
          current_membership_summary: summary,
          member_status_key: newStatus,
          schema_version: CURRENT_SCHEMA_VERSION,
          updated_at: now,
        },
        { merge: true },
      );

      // ── 5a. operational counters: status buckets ONLY ─────────
      // NOTE: revenue is NOT stored here. Money lives only in the immutable
      // membership records and the DERIVED monthly rollup (single source +
      // reconstructable view) — no duplicate financial source of truth.
      const prevStatus = (member.member_status_key as MemberStatusKey) ?? MEMBER_STATUS_KEYS.INACTIVE;
      const counterPatch: Record<string, unknown> = { updated_at: now };
      applyStatusDelta(counterPatch, prevStatus, newStatus);
      tx.set(countersRef, counterPatch, { merge: true });

      // ── 5b. derived monthly rollup (materialized view) ────────
      // Incremented with the SAME amount_paid_minor written to the membership,
      // so the rollup always equals aggregateMemberships() over the records.
      if (rollupExists) {
        tx.set(
          rollupRef,
          {
            revenue_collected_minor: FieldValue.increment(amount_paid_minor),
            joining_fees_minor: FieldValue.increment(joining_fee_minor),
            discount_minor: FieldValue.increment(discount_minor),
            periods_count: FieldValue.increment(1),
            new_joins_count: FieldValue.increment(isFirstJoin ? 1 : 0),
            updated_at: now,
          },
          { merge: true },
        );
      } else {
        tx.set(rollupRef, {
          month_key: rollupMonthKey,
          gym_profile_id: ctx.gym_profile_id,
          revenue_collected_minor: amount_paid_minor,
          joining_fees_minor: joining_fee_minor,
          discount_minor,
          periods_count: 1,
          new_joins_count: isFirstJoin ? 1 : 0,
          currency_code: ctx.currency_code,
          updated_at: now,
        });
      }

      // ── 6. activity log (immutable audit trail) ───────────────
      tx.set(logRef, {
        log_id: logRef.id,
        gym_profile_id: ctx.gym_profile_id,
        actor_app_user_id: ctx.actor_app_user_id,
        actor_display_name: ctx.actor_display_name,
        action_key: "membership.renew",
        entity_type: "membership",
        entity_id: membership.membership_id,
        summary: `Renewed ${member.member_display_name} on ${plan.plan_display_name}`,
        created_at: now,
      });

      return { membership, member_status_key: newStatus };
    });

    return ok(result);
  } catch (e) {
    if (e instanceof DomainError) return err(e.code, e.message);
    return err("internal", "Could not complete the renewal. Please try again.");
  }
}

/** Bucket counters by status. Only active/expiring/expired are counted. */
function applyStatusDelta(
  patch: Record<string, unknown>,
  prev: MemberStatusKey,
  next: MemberStatusKey,
) {
  if (prev === next) return;
  const field: Partial<Record<MemberStatusKey, string>> = {
    active: "active_count",
    expiring_soon: "expiring_count",
    expired: "expired_count",
  };
  const dec = field[prev];
  const inc = field[next];
  if (dec) patch[dec] = FieldValue.increment(-1);
  if (inc) patch[inc] = FieldValue.increment(1);
}

class DomainError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
