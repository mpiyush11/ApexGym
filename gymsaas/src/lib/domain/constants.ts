/**
 * Domain constants — explicit string keys (MANDATORY RULE 1: explicit naming).
 * These keys are stored in Firestore exactly as written.
 */

// ── Roles (4 roles per audit correction C2) ────────────────────
export const ROLE_KEYS = {
  PLATFORM_ADMIN: "platform_admin", // you (cross-tenant support)
  OWNER: "owner",
  RECEPTION: "reception",
  MEMBER: "member",
} as const;
export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

// ── Member status (derived; recomputed daily) ──────────────────
export const MEMBER_STATUS_KEYS = {
  ACTIVE: "active",
  EXPIRING_SOON: "expiring_soon",
  EXPIRED: "expired",
  INACTIVE: "inactive",
} as const;
export type MemberStatusKey =
  (typeof MEMBER_STATUS_KEYS)[keyof typeof MEMBER_STATUS_KEYS];

// ── Membership plan durations ──────────────────────────────────
export const PLAN_DURATION_KEYS = {
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  SEMI_ANNUAL: "semi_annual",
  ANNUAL: "annual",
} as const;
export type PlanDurationKey =
  (typeof PLAN_DURATION_KEYS)[keyof typeof PLAN_DURATION_KEYS];

export const PLAN_DURATION_DAYS: Record<PlanDurationKey, number> = {
  monthly: 30,
  quarterly: 90,
  semi_annual: 180,
  annual: 365,
};

// ── Payment ────────────────────────────────────────────────────
export const PAYMENT_METHOD_KEYS = {
  CASH: "cash",
  UPI: "upi",
  CARD: "card",
} as const;
export type PaymentMethodKey =
  (typeof PAYMENT_METHOD_KEYS)[keyof typeof PAYMENT_METHOD_KEYS];

export const PAYMENT_STATUS_KEYS = {
  PAID: "paid",
  PARTIAL: "partial",
  PENDING: "pending",
} as const;
export type PaymentStatusKey =
  (typeof PAYMENT_STATUS_KEYS)[keyof typeof PAYMENT_STATUS_KEYS];

// ── Lead pipeline ──────────────────────────────────────────────
export const LEAD_STATUS_KEYS = {
  NEW: "new",
  CONTACTED: "contacted",
  TRIAL: "trial",
  CONVERTED: "converted",
  LOST: "lost",
} as const;
export type LeadStatusKey =
  (typeof LEAD_STATUS_KEYS)[keyof typeof LEAD_STATUS_KEYS];

export const LEAD_SOURCE_KEYS = {
  PUBLIC_CONTACT_FORM: "public_contact_form",
  WALK_IN: "walk_in",
  MANUAL: "manual",
} as const;
export type LeadSourceKey =
  (typeof LEAD_SOURCE_KEYS)[keyof typeof LEAD_SOURCE_KEYS];

// ── Member tier (used by testimonials member_tier_key + members) ─
export const MEMBER_TIER_KEYS = {
  STANDARD: "standard",
  GOLD: "gold",
  PLATINUM: "platinum",
} as const;
export type MemberTierKey =
  (typeof MEMBER_TIER_KEYS)[keyof typeof MEMBER_TIER_KEYS];

// ── Gym status ─────────────────────────────────────────────────
export const GYM_STATUS_KEYS = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
} as const;
export type GymStatusKey =
  (typeof GYM_STATUS_KEYS)[keyof typeof GYM_STATUS_KEYS];

// ── Schema versioning (future migration safety) ────────────────
export const CURRENT_SCHEMA_VERSION = 1;

// ── Mobile-first breakpoints (locked test matrix) ──────────────
export const BREAKPOINTS_PX = [360, 390, 430, 768, 1024, 1440] as const;
