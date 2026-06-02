/**
 * Firestore path helpers — single source of truth for path-based multi-tenancy
 * (audit C0). All tenant data lives under gym_profiles/{gym_profile_id}/...
 * Keeping paths here prevents accidental cross-tenant queries.
 */

export const COLLECTIONS = {
  GYM_PROFILES: "gym_profiles",
  GYM_SLUG_INDEX: "gym_slug_index", // top-level: global uniqueness
  PLATFORM_SUBSCRIPTIONS: "platform_subscriptions",
} as const;

export const SUBCOLLECTIONS = {
  SETTINGS: "settings",
  COUNTERS: "counters",
  MEMBERS: "members",
  MEMBERSHIPS: "memberships", // under a member
  PLANS: "membership_plans",
  LEADS: "leads",
  TRAINERS: "trainers",
  GALLERY: "gallery_items",
  TESTIMONIALS: "testimonials",
  REPORT_RUNS: "report_runs",
  ACTIVITY_LOGS: "activity_logs",
  APP_USERS: "app_users",
  ANALYTICS_MONTHLY: "analytics_monthly", // derived monthly rollups (materialized view)
} as const;

/** Singleton doc ids for per-gym singletons. */
export const SINGLETON_IDS = {
  SETTINGS: "settings",
  COUNTERS: "summary",
} as const;

export const path = {
  gymProfile: (gym_profile_id: string) =>
    `${COLLECTIONS.GYM_PROFILES}/${gym_profile_id}`,
  slugIndex: (gym_slug: string) =>
    `${COLLECTIONS.GYM_SLUG_INDEX}/${gym_slug}`,
  settings: (gym_profile_id: string) =>
    `${COLLECTIONS.GYM_PROFILES}/${gym_profile_id}/${SUBCOLLECTIONS.SETTINGS}/${SINGLETON_IDS.SETTINGS}`,
  counters: (gym_profile_id: string) =>
    `${COLLECTIONS.GYM_PROFILES}/${gym_profile_id}/${SUBCOLLECTIONS.COUNTERS}/${SINGLETON_IDS.COUNTERS}`,
  appUser: (gym_profile_id: string, app_user_id: string) =>
    `${COLLECTIONS.GYM_PROFILES}/${gym_profile_id}/${SUBCOLLECTIONS.APP_USERS}/${app_user_id}`,
  members: (gym_profile_id: string) =>
    `${COLLECTIONS.GYM_PROFILES}/${gym_profile_id}/${SUBCOLLECTIONS.MEMBERS}`,
  plans: (gym_profile_id: string) =>
    `${COLLECTIONS.GYM_PROFILES}/${gym_profile_id}/${SUBCOLLECTIONS.PLANS}`,
  analyticsMonthly: (gym_profile_id: string) =>
    `${COLLECTIONS.GYM_PROFILES}/${gym_profile_id}/${SUBCOLLECTIONS.ANALYTICS_MONTHLY}`,
  analyticsMonth: (gym_profile_id: string, month_key: string) =>
    `${COLLECTIONS.GYM_PROFILES}/${gym_profile_id}/${SUBCOLLECTIONS.ANALYTICS_MONTHLY}/${month_key}`,
} as const;
