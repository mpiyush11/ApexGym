/**
 * Domain TypeScript types — the Firestore-native data model.
 * Naming is explicit per MANDATORY RULE 1. Money fields are integer
 * minor units per MANDATORY RULE 2. CMS required fields per RULE 3.
 *
 * Firestore path layout (audit correction C0):
 *   gym_profiles/{gym_profile_id}
 *     ├─ settings/{singleton}
 *     ├─ counters/{summary}
 *     ├─ members/{member_id}
 *     │    └─ memberships/{membership_id}
 *     ├─ membership_plans/{plan_id}
 *     ├─ leads/{lead_id}
 *     ├─ trainers/{trainer_id}
 *     ├─ gallery_items/{gallery_item_id}
 *     ├─ testimonials/{testimonial_id}
 *     ├─ report_runs/{report_run_id}
 *     └─ activity_logs/{log_id}
 *   gym_slug_index/{gym_slug}   (top-level, global uniqueness)
 */

import type {
  RoleKey,
  MemberStatusKey,
  PlanDurationKey,
  PaymentMethodKey,
  PaymentStatusKey,
  LeadStatusKey,
  LeadSourceKey,
  MemberTierKey,
  GymStatusKey,
} from "./constants";

/** ISO-8601 UTC string. We store UTC and render in gym timezone. */
export type IsoUtcString = string;

export interface GymProfile {
  gym_profile_id: string;
  gym_slug: string;
  gym_display_name: string;
  gym_legal_name?: string;
  gym_logo_url?: string;
  gym_primary_color_hex?: string;
  gym_contact_email?: string;
  gym_contact_phone?: string;
  gym_whatsapp_number?: string;
  gym_address_line?: string;
  gym_city?: string;
  gym_country_code?: string;
  default_currency_code: string; // e.g. "INR"
  gym_timezone: string; // e.g. "Asia/Kolkata"
  attendance_enabled: boolean; // optional module flag (default false)
  public_site_is_published: boolean;
  gym_status_key: GymStatusKey;
  schema_version: number;
  created_at: IsoUtcString;
  updated_at: IsoUtcString;
}

export interface GymSetting {
  gym_profile_id: string;
  renewal_reminder_days_before: number; // e.g. 7
  report_recipient_emails: string[];
  whatsapp_default_message_template: string;
}

export interface AppUser {
  app_user_id: string; // == Firebase Auth uid
  gym_profile_id: string;
  app_user_email?: string;
  app_user_phone?: string;
  app_user_display_name: string;
  app_user_role_key: RoleKey;
  is_active: boolean;
  last_login_at?: IsoUtcString;
}

/** Denormalized current-membership snapshot stored ON the member doc (C0/C2). */
export interface CurrentMembershipSummary {
  membership_id: string;
  plan_name_snapshot: string;
  plan_duration_key: PlanDurationKey;
  membership_end_date: IsoUtcString;
  member_status_key: MemberStatusKey;
  amount_due_minor: number;
}

export interface Member {
  member_id: string;
  gym_profile_id: string;
  member_code: string; // unique per gym, e.g. IRON-2026-000142
  member_display_name: string;
  member_phone: string; // primary human key
  member_email?: string;
  member_photo_url?: string;
  member_join_date: IsoUtcString;
  member_tier_key?: MemberTierKey;
  assigned_trainer_id?: string | null;
  member_status_key: MemberStatusKey; // derived, recomputed daily
  current_membership_summary?: CurrentMembershipSummary | null;
  source_lead_id?: string | null;
  member_notes?: string;
  member_auth_uid?: string | null; // links member portal login
  is_archived: boolean; // soft delete
  schema_version: number;
  created_at: IsoUtcString;
  updated_at: IsoUtcString;
}

export interface MembershipPlan {
  plan_id: string;
  gym_profile_id: string;
  plan_display_name: string;
  plan_duration_key: PlanDurationKey;
  plan_duration_days: number;
  price_amount_minor: number; // e.g. price_monthly_minor source
  joining_fee_minor: number; // one-time fee (included in V1)
  currency_code: string;
  plan_description?: string;
  is_active: boolean;
  display_order: number;
  created_at: IsoUtcString;
  updated_at: IsoUtcString;
}

/** A purchased period. Renewal = a new membership doc (subcollection). */
export interface Membership {
  membership_id: string;
  gym_profile_id: string;
  member_id: string;
  plan_id: string;
  // Snapshots so later plan edits never rewrite history (audit 2.3):
  plan_name_snapshot: string;
  plan_duration_key: PlanDurationKey;
  plan_duration_days: number;
  price_amount_minor: number;
  joining_fee_minor: number;
  discount_minor: number;
  renewal_amount_minor: number; // total expected = price + joining_fee - discount
  amount_paid_minor: number;
  amount_due_minor: number;
  currency_code: string; // snapshot of the currency at sale time
  payment_method_key: PaymentMethodKey; // cash default
  payment_status_key: PaymentStatusKey;
  membership_start_date: IsoUtcString;
  membership_end_date: IsoUtcString;
  created_by_app_user_id: string;
  created_at: IsoUtcString;
}

export interface Lead {
  lead_id: string;
  gym_profile_id: string;
  lead_display_name: string;
  lead_phone?: string;
  lead_email?: string;
  lead_message?: string;
  lead_source_key: LeadSourceKey;
  lead_status_key: LeadStatusKey;
  assigned_app_user_id?: string | null;
  converted_member_id?: string | null;
  created_at: IsoUtcString;
  updated_at: IsoUtcString;
}

export interface Trainer {
  trainer_id: string;
  gym_profile_id: string;
  trainer_display_name: string;
  trainer_specialty?: string;
  trainer_bio?: string;
  trainer_photo_url?: string;
  is_active: boolean;
  display_order: number;
}

/** CMS REQUIRED FIELDS (MANDATORY RULE 3). */
export interface Testimonial {
  testimonial_id: string;
  gym_profile_id: string;
  testimonial_text: string; // required
  member_since_year: number; // required
  member_tier_key: MemberTierKey; // required
  author_display_name: string;
  author_photo_url?: string;
  is_active: boolean;
  display_order: number;
}

/** CMS REQUIRED FIELDS (MANDATORY RULE 3). */
export interface GalleryItem {
  gallery_item_id: string;
  gym_profile_id: string;
  image_url: string;
  image_title: string; // required
  area_category: string; // required (cardio/weights/studio/reception...)
  is_hero_gallery: boolean; // required
  is_active: boolean; // required
  display_order: number;
}

/** Aggregate counters — avoid full-collection scans (audit 2.6/8.1). */
export interface GymCounters {
  gym_profile_id: string;
  member_seq: number; // for member_code generation
  active_count: number;
  expiring_count: number;
  expired_count: number;
  total_members: number;
  lead_new_count: number;
  revenue_month_minor: number;
  revenue_month_key: string; // "2026-06" — reset boundary
  updated_at: IsoUtcString;
}

export interface ActivityLog {
  log_id: string;
  gym_profile_id: string;
  actor_app_user_id: string;
  actor_display_name: string;
  action_key: string; // e.g. "member.create", "membership.renew"
  entity_type: string; // "member" | "membership" | ...
  entity_id: string;
  summary: string;
  created_at: IsoUtcString;
}

/**
 * Monthly analytics rollup — a DERIVED materialized view of the immutable
 * membership records (NOT a separate financial source of truth). Fully
 * reconstructable from memberships via aggregateMemberships(). Doc id = "YYYY-MM".
 */
export interface AnalyticsMonthly {
  month_key: string; // "YYYY-MM"
  gym_profile_id: string;
  revenue_collected_minor: number;
  joining_fees_minor: number;
  discount_minor: number;
  periods_count: number;
  new_joins_count: number;
  currency_code: string;
  updated_at: IsoUtcString;
}

export interface ReportRun {
  report_run_id: string;
  gym_profile_id: string;
  report_period_start: IsoUtcString;
  report_period_end: IsoUtcString;
  active_members: number;
  new_joins: number;
  expiring_count: number;
  revenue_period_minor: number;
  lead_new: number;
  lead_converted: number;
  delivery_status_key: "generated" | "emailed" | "failed";
  export_file_url?: string;
  created_at: IsoUtcString;
}
