# V1 Build Decisions (locked)

Date: 2026-06-02

## Confirmed choices
1. **Start point:** M0 scaffold first — Next.js + TypeScript + Tailwind, Firebase init, env-safe config loader, App Check placeholder, design tokens, mobile shell (bottom nav + sidebar).
2. **Member auth:** Both — Phone OTP primary, email optional.
3. **Scope for V1:**
   - ✅ **Include:** Joining fee, cash payments (partial/full), owner data export (CSV/Excel), lightweight audit log.
   - ⛔ **Defer:** SaaS billing system, daily cash reconciliation, advanced discounts, complex accounting features.

## V1 goal (north star)
Fast deployment · easy member management · reliable renewals · expiry tracking · mobile-first usability · local-gym sellability.
**Avoid accounting-software complexity.**

## Mandatory rules (non-negotiable)
- Explicit naming: `gym_profile_id`, `gym_slug`, `member_display_name`.
- Money: integer minor units only (`price_monthly_minor`, `joining_fee_minor`, `renewal_amount_minor`, `amount_paid_minor`). No float/decimal.
- CMS fields: testimonials (`testimonial_text`, `member_since_year`, `member_tier_key`); gallery (`image_title`, `area_category`, `is_hero_gallery`, `is_active`).
- Mobile-first: breakpoints 360/390/430/768/1024/1440, no horizontal scroll, tables have mobile card fallbacks.
- Env safety: validated config + fallbacks, loading/error states, no infinite loaders, no crash on missing env.

## Stack
Next.js (App Router) · TypeScript · Tailwind CSS · Firebase Auth · Firestore · Firebase Storage · Cloud Functions · Vercel.
