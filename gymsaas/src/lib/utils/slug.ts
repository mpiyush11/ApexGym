/** Slug helpers for gym_slug (URL identifier). Explicit naming: gym_slug. */

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Reserved slugs that must never be assigned to a tenant. */
export const RESERVED_GYM_SLUGS = new Set([
  "app",
  "api",
  "login",
  "onboarding",
  "admin",
  "platform",
  "www",
  "card",
  "g",
  "_next",
]);

export function isValidGymSlug(gym_slug: string): boolean {
  if (!gym_slug || gym_slug.length < 3 || gym_slug.length > 48) return false;
  if (RESERVED_GYM_SLUGS.has(gym_slug)) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gym_slug);
}
