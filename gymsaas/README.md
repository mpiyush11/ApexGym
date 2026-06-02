# GymOS — Gym Management SaaS (V1)

Premium, mobile-first, multi-tenant gym management for independent gyms.
Stack: **Next.js 16 (App Router) · TypeScript · Tailwind v4 · Firebase (Auth/Firestore/Storage) · Vercel**.

> Planning docs live in the repo root: `gym-saas-v1-architecture.md`,
> `gym-saas-v1-architecture-audit.md`, `DECISIONS.md`.

---

## ✅ Milestone M0 — Scaffold (DONE)

What's in place:

| Area | File(s) | Notes |
|---|---|---|
| Env-safe config | `src/lib/config/env.ts` | Never throws; exposes `isConfigured` flags + safe fallbacks |
| Firebase client | `src/lib/firebase/client.ts` | Returns `null` when unconfigured (no crash); App Check best-effort |
| Firebase admin | `src/lib/firebase/admin.ts` | Server-only, env-safe |
| Money (Rule 2) | `src/lib/money/money.ts` | Integer minor units only; `formatMoney`, `toMinor`, `toMajor` |
| Domain model | `src/lib/domain/{constants,types}.ts` | Explicit naming (Rule 1), CMS fields (Rule 3), Firestore-native shapes |
| Design tokens | `src/app/globals.css` | Luxury dark + gold; skeleton/fade; no horizontal scroll |
| UI primitives | `src/components/ui/*` | Button, Card, Badge, StatCard, ResponsiveList |
| Feedback | `src/components/feedback/*` | Skeleton, EmptyState, ErrorState, ConfigNeededState |
| Mobile-first shell | `src/components/layout/*` | Sidebar (desktop) + BottomNav (mobile) + Topbar |
| Providers | `src/components/providers/AppProviders.tsx` | React Query (retry/timeout → no infinite loaders) + App Check |
| Demo pages | `src/app/page.tsx`, `src/app/app/page.tsx` | Landing + role-based dashboard demo |

### Mandatory rules — enforced from day one
- **Rule 1 (naming):** `gym_profile_id`, `gym_slug`, `member_display_name`, `_minor`, `is_*`.
- **Rule 2 (money):** integer minor units everywhere; format only at the UI edge.
- **Rule 3 (CMS):** `testimonial_text` / `member_since_year` / `member_tier_key`; `image_title` / `area_category` / `is_hero_gallery` / `is_active`.
- **Rule 4 (mobile-first):** `ResponsiveList` = cards on mobile / table on `lg:`; bottom nav; `overflow-x: hidden`; breakpoints 360/390/430/768/1024/1440.
- **Rule 5 (env safety):** missing config → graceful `ConfigNeededState`, never a crash or infinite spinner.

---

## Getting started

```bash
cp .env.example .env.local   # fill in Firebase values (optional for UI preview)
npm install
npm run dev                  # http://localhost:3000  (and /app for dashboard)
npm run build                # production build
npm run lint
```

The UI runs **without** Firebase configured — it shows a clear "configuration
needed" banner and stays fully usable.

---

## Folder structure

```
src/
  app/
    page.tsx              # landing (M0 placeholder for public site, M7)
    app/page.tsx          # owner dashboard demo
    globals.css           # design tokens
  components/
    ui/                   # design-system primitives
    feedback/             # skeleton/empty/error/config states
    layout/               # AppShell, Sidebar, BottomNav, Topbar, nav config
    providers/            # React Query + App Check
  lib/
    config/env.ts         # env-safe loader
    firebase/             # client + admin init (env-safe)
    money/money.ts        # integer minor-unit helpers
    domain/               # constants + types (Firestore-native model)
    utils/cn.ts
```

---

## ✅ Milestone M1 — Auth, custom claims & tenant onboarding (DONE)

| Area | File(s) | Notes |
|---|---|---|
| Claims contract | `src/lib/auth/claims.ts` | `gym_profile_id` + `role` (+ `member_id`) on the ID token |
| Server session | `src/lib/auth/session.server.ts` | Verifies Firebase session cookie; env-safe (returns null, never throws) |
| Client auth | `src/lib/auth/authClient.ts` | Email/password **and** phone OTP; exchanges ID token for session cookie |
| Firestore paths | `src/lib/firebase/paths.ts` | Single source of truth for path-based tenancy |
| Onboarding service | `src/lib/services/onboarding.service.ts` | **Transactional** gym create + global `gym_slug` uniqueness + counters/settings + owner claims |
| API | `src/app/api/auth/session`, `/api/auth/claims`, `/api/onboarding` | Thin handlers; standard error envelope |
| Pages | `src/app/login`, `src/app/onboarding` | Premium mobile-first auth UI |
| App guard | `src/app/app/layout.tsx` | Redirects by session/role; preview mode when unconfigured |
| Session context | `src/components/providers/AppSessionProvider.tsx` | `useAppSession()` for role-aware UI |

**Auth flow:** sign in/up → session cookie → no tenant ⇒ `/onboarding` → create gym (owner) → `/app`.
Members are routed away from the staff app (portal arrives in M8). Preview mode keeps the
dashboard usable before Firebase is configured.

## ✅ Milestone M2 — Security Rules + emulator tests (DONE)

Tenant isolation is enforced at the **database layer** and proven with **33
passing rules tests** against the Firestore emulator.

| Area | File(s) | Notes |
|---|---|---|
| Firestore rules | `firestore.rules` | Default-deny, path-based tenancy, 4-role RBAC, money validation |
| Storage rules | `storage.rules` | Tenant-pathed photos/gallery/cards; type+size limits |
| Indexes | `firestore.indexes.json` | Composite indexes for member/lead/plan queries (audit 8.3) |
| Emulator config | `firebase.json`, `.firebaserc` | Firestore+Storage emulators |
| Test harness | `tests/helpers/setup.ts` | Two tenants + role contexts w/ real claim shape |
| Rules tests | `tests/firestore.rules.test.ts` | 33 tests across all roles + isolation + money |

Run the tests (needs Java 11+):

```bash
npm run test:rules     # boots the Firestore emulator and runs vitest
npm run emulators      # (optional) run emulators standalone
```

### What the rules guarantee
| Capability | platform_admin | owner | reception | member | anon |
|---|---|---|---|---|---|
| Cross-tenant access | ✅ | ❌ | ❌ | ❌ | ❌ |
| Read/update own gym profile | ✅ | ✅ | read | read | ❌ |
| Settings write | ✅ | ✅ | ❌ | ❌ | ❌ |
| Plans: read / pricing edit | ✅ | ✅/✅ | read/❌ | read/❌ | ❌ |
| Members: read / create / edit / delete | ✅ | ✅/✅/✅/✅ | ✅/✅/✅/❌ | self-read | ❌ |
| Memberships (renewals) create | ✅ | ✅ | ✅ | self-read | ❌ |
| CMS (gallery/testimonials/trainers) write | ✅ | ✅ | ❌ | ❌ | ❌ |
| Leads read/manage | ✅ | ✅ | ✅ | ❌ | ❌ |
| Counters / reports / activity logs write | ✅ | ❌ (server-only) | ❌ | ❌ | ❌ |
| `gym_slug_index` read | ✅ | ✅ | ✅ | ✅ | ✅ (public lookup) |

Money fields on membership writes are validated as **integer minor units ≥ 0**
(floats/negatives rejected at the rules layer — defense in depth for Rule 2).

> Note: `firebase-tools` is pinned to **13.35.1** (v15+ requires Java 21; the
> sandbox has Java 11).

## ✅ Milestone M3 — Plans & Members (mobile-first) (DONE)

Built mobile-first for **360–430px Android**, one-handed, card-based CRUD.
All writes go through the **server service layer (Admin SDK)** so counters and
member-code sequencing stay correct; Firestore Rules (M2) back it up.

| Area | File(s) | Notes |
|---|---|---|
| Guards | `src/lib/auth/guard.server.ts` | `requireStaff` / `requireOwner` mirror the rules |
| Member code | `src/lib/services/memberCode.server.ts` | Transactional `{SHORT}-{YYYY}-{000123}` (no collisions) |
| Plan service | `src/lib/services/plan.service.ts` | CRUD, major→minor money conversion, soft-deactivate |
| Member service | `src/lib/services/member.service.ts` | Transactional create + counter bump, dup-phone warn, cursor pagination, search, soft-archive |
| APIs | `/api/plans`, `/api/plans/[plan_id]`, `/api/members`, `/api/members/[member_id]` | Thin handlers, Zod validation, role-gated |
| Client services | `src/lib/services/apiClient.ts`, `src/modules/*/use*.ts` | Typed fetch + React Query hooks |
| Mobile UI kit | `Sheet` (bottom sheet), `Fab`, `ConfirmDialog`, `Select`/`Textarea` | One-handed forms |
| Pages | `src/app/app/plans`, `src/app/app/members` | Card grids, sticky search, infinite scroll, FAB |

### Mobile-first guarantees (this milestone)
- **No desktop tables** for members — pure **card list** with quick actions (Renew/Edit).
- **Bottom-sheet forms** slide up from the thumb zone; sticky CTA; grab handle.
- **FAB** ("Add") sits above the bottom nav, bottom-right, thumb-reachable.
- **Sticky search** pinned under the top bar; numeric input modes for phone/price.
- Skeletons + empty + error states on every async surface (no infinite loaders).

### Money & integrity
- Prices entered in major units, **stored as integer minor units** (`price_amount_minor`, `joining_fee_minor`).
- Member create is **transactional**: allocate `member_code` + bump `total_members` + write member atomically.
- Plans **soft-deactivate** (never hard-delete) so membership history stays valid.
- Members **soft-archive** (`is_archived`) — owner only.

## ✅ Milestone M4 — Memberships, Renewals, Expiry & Revenue (DONE)

The highest-priority business workflow. **Renewals are fully transactional and
financial history is immutable** — future plan price changes can never alter
past records (proven by an emulator integration test).

| Area | File(s) | Notes |
|---|---|---|
| Date logic (pure) | `src/lib/domain/renewal.logic.ts` | Expiry math, continuation, **gym-timezone** day boundary |
| Status logic (pure) | `src/lib/domain/status.logic.ts` | Derived active/expiring/expired/inactive |
| Renewal service | `src/lib/services/renewal.service.ts` | **One transaction**: immutable period + snapshot pricing + summary + counters + audit log |
| History (read-only) | `src/lib/services/membership.service.ts` | Immutable periods, newest first |
| Status recompute | `src/lib/services/statusRecompute.service.ts` | Daily cron job; self-heals counters |
| Dashboard | `src/lib/services/dashboard.service.ts` | O(1) counter reads (no scans) |
| APIs | `/api/members/[id]/renew`, `/history`, `/api/members/expiring`, `/api/dashboard/summary`, `/api/cron/recompute-status` | Role-gated, env-safe |
| Mobile UI | `RenewSheet`, `MembershipHistory`, Renewals page, live Dashboard | One-tap renew bottom sheet |
| Tests | `tests/renewal.logic.test.ts` (17), `tests/renewal.integration.test.ts` (3) | + 33 rules = **53 passing** |

### Immutability & financial integrity (this milestone)
- Every renewal creates a **new** `memberships/{id}`; prior periods are **never edited**.
- Each period **snapshots** `plan_name_snapshot`, `price_amount_minor`, `joining_fee_minor`, `discount_minor`, `renewal_amount_minor`, `amount_paid_minor`, `amount_due_minor`, `currency_code`, `payment_method_key`.
- Test proves: raising a plan's price afterward leaves historical amounts unchanged.
- All money is integer minor units; partial/cash/UPI/card payments supported (V1 scope).

### Renewal & expiry correctness
- **Continuation**: renewing while active extends from the current end date (no lost days); expired/new starts today.
- **Timezone-safe expiry**: "today" resolved in the gym's timezone (no off-by-one).
- **Atomic counters**: revenue (monthly reset) + active/expiring/expired buckets update in the same transaction; daily recompute self-heals drift and handles silent active→expired transitions.
- **One-tap renew**: defaults to full plan price + cash; expandable for discount/partial.
- Live **dashboard** (counter-based) + **expiring worklist** with inline renew; owner "Refresh statuses" button.

## ✅ Milestone M5 — Analytics (derived, mobile-first, fast at scale) (DONE)

**No duplicate financial source of truth.** Immutable `memberships` remain
authoritative; analytics read a **derived monthly rollup** (a materialized view)
that is fully reconstructable from those records.

| Area | File(s) | Notes |
|---|---|---|
| Aggregation (pure) | `src/lib/domain/analytics.logic.ts` | `aggregateMemberships()` — the single definition of analytics "truth" |
| Analytics service | `src/lib/services/analytics.service.ts` | Fast read (rollups) + `rebuildAnalytics()` (reconstruct from records) |
| Rollup write | `src/lib/services/renewal.service.ts` | Rollup incremented **inside the renewal transaction** with the same `amount_paid_minor` |
| APIs | `/api/analytics`, `/api/analytics/rebuild` | Owner-only; rebuild also via `CRON_SECRET` |
| Mobile UI | `src/app/app/analytics`, `BarChart` (inline SVG) | 3/6/12-month toggle, KPI grid, revenue & joins charts |
| Tests | `tests/analytics.logic.test.ts` (12) + reconciliation IT + 4 rules | **70 passing** total |

### Performance (<2s at 5,000+ members)
- The dashboard/analytics read path touches **~13 docs** (≤12 monthly rollups + counters), so read cost is **O(months), independent of member count**.
- Full-collection scans happen **only** in the infrequent `rebuild` (admin/cron), never on the read path.

### No duplicate source of truth (proven)
- Revenue was **removed** from the operational counters doc; money now lives in exactly two places: the immutable `memberships` records and their **derived** rollup.
- An emulator reconciliation test asserts the rollup equals `aggregateMemberships()` over the records; `rebuild` self-heals the view from source at any time.
- Rollups are **owner-read, server-write-only** (rules-enforced + tested).

## ✅ Milestone M6 — Leads & Public Contact Intake (DONE)

Lightweight lead capture that **integrates into the existing dashboard** — not a
separate CRM (constraint #6). Every new resource was justified; mobile-first.

| Area | File(s) | Notes |
|---|---|---|
| Lead schema | `src/lib/services/lead.schema.ts` | Public form + spam-trap fields (honeypot, time-trap); status enum |
| Rate limiter | `src/lib/services/rateLimit.server.ts` | Durable fixed-window (`public_rate_limits/`); admin-only, catch-all denies clients |
| Lead service | `src/lib/services/lead.service.ts` | Slug resolve, transactional create + `lead_new_count`, bounded list, status change w/ counter adjust |
| Public intake API | `/api/public/[gym_slug]/contact` | Honeypot + time-trap + per-IP + per-gym/day limits + Zod |
| Staff APIs | `/api/leads`, `/api/leads/[lead_id]` | Pipeline list (status filter) + status change |
| Public form | `/g/[gym_slug]/contact` | Mobile-first; idle/submitting/success/error states |
| Staff pipeline | `/app/leads` | Filter chips, WhatsApp/Call quick actions, inline status |
| Dashboard tie-in | `/app` | "New leads" tile (from `lead_new_count`) taps through to pipeline |
| Tests | `tests/lead.integration.test.ts` (4) + 5 rules | **79 passing** total |

### Spam protection (constraint #5), layered
Honeypot (silent accept) · 2s time-trap (silent accept) · durable rate limits
(5/10min per IP, 100/day per gym) · Zod validation. Form has full
loading / success / error states; no infinite loaders.

### Cost & justification (constraints #3, #7)
- **1 new collection** `public_rate_limits` — required for serverless rate limiting; reuses the existing catch-all deny rule (no rules change).
- **Reused** `leads` collection + rules, `counters.lead_new_count`, `gym_slug_index`, service/API/React-Query/mobile patterns.
- Intake = 1 slug read + 1 limiter txn + 1 lead-create txn. Pipeline = single `limit 30` query on the existing index. Dashboard leads = **0 new reads** (already in counters).
- **No** lead analytics rollup, scoring, or email sequences (deferred as nice-to-have).

## ✅ Hardening Phase (post-M6 audit) — DONE · architecture FROZEN for V1

Production-readiness fixes completed before M7. **97 tests passing.**

**P0 (launch blockers)**
- Onboarding session **re-mint** (`refreshSession`) — fixes the redirect loop after gym creation.
- **Membership immutability** locked in rules (`create/update/delete: if false` on periods; server Admin SDK only).
- **Tenant-id write validation** (`bodyTenantOk`) on members/plans/leads — anti-poisoning.

**P1 (high severity)**
- **Gym suspension enforcement** (cached `isGymSuspended`) in staff guard, app layout, and public intake.
- **Settings page** (owner) — gym details, WhatsApp, reminder days, report recipients, publish toggle.
- **Reception invite** (owner) — create/enable/disable reception logins (claims + `app_users`).
- **Revenue hidden from reception** — server strips it from the dashboard summary + UI guard.
- **Server-side App Check verification** on public intake (env-gated; token sent from the form).
- **Audit logs** for member create/edit/archive + settings/staff actions (`activity_logs`).

**Tests added:** money helpers, plan/member service integration (codes, counters, audit), onboarding (claims, slug uniqueness, one-gym-per-user), membership-immutability & tenant-poisoning rules, lead counters.

> Note: emulator tests now also use the **Auth** emulator; `firebase-tools` pinned to 13.x (Java 11). `server-only` is stubbed in `vitest.config.ts` so services import cleanly in node tests.

## ✅ Milestone M7 — Public Website + CMS (DONE)

Conversion-focused, mobile-first public site per gym (`/g/[gym_slug]`), rendered
server-side with ISR (`revalidate=300`). Reuses existing collections — no new
infrastructure (architecture remains frozen).

| Area | File(s) | Notes |
|---|---|---|
| Public data | `src/lib/services/publicSite.service.ts` | Admin-SDK read of a **published, non-suspended** gym bundle (profile + active plans/trainers/gallery/testimonials) |
| Public page | `src/app/g/[gym_slug]/page.tsx` | Hero, plans, trainers, gallery, testimonials, contact; per-gym SEO metadata + OG; `notFound()` when unpublished |
| WhatsApp-first | `src/lib/utils/whatsapp.ts` | Floating + per-plan `wa.me` CTAs with pre-filled, plan-specific messages |
| CMS service | `src/lib/services/content.service.ts` + `content.schema.ts` | Owner CRUD for trainers/gallery/testimonials (RULE 3 fields enforced) |
| CMS APIs | `/api/content/[kind]`, `/api/content/[kind]/[id]` | Owner-only; tenant-id stamped (anti-poisoning) |
| CMS UI | `src/modules/content/*`, `/app/{trainers,gallery,testimonials}` | Field-driven generic editor (bottom sheet), card lists, FAB |
| Settings link | `/app/settings` | "View public website" + publish toggle |

### Conversion & quality
- **WhatsApp-first**: floating CTA + per-plan "Enquire on WhatsApp" (pre-filled), contact form as secondary — gracefully hidden when no number configured.
- **Mobile-first 360–430px**: single/2-col grids, aspect-ratio image tiles (no distortion), lazy-loaded gallery, sticky top bar, thumb-reachable CTAs.
- **Fast + SEO**: SSR + ISR (cached), per-gym `<title>`/description/OpenGraph, `robots index,follow`.
- **Secure**: anonymous visitors never read Firestore directly; the server reads via Admin SDK; suspended/unpublished gyms 404.

> 97 tests still green; TypeScript/ESLint clean; build OK (public route is `ƒ` dynamic + ISR).

## ✅ Milestone M8 — Member Portal & Digital Card (DONE)

Reuses the **existing identity system** (custom claims) and member records — no
second identity, no new collections/indexes/jobs. The digital card is rendered
**entirely from existing** member + `current_membership_summary` data.

| Area | File(s) | Notes |
|---|---|---|
| Portal service | `src/lib/services/memberPortal.service.ts` | Phone-OTP → member binding + card bundle; all edge cases |
| Member guard | `src/lib/auth/guard.server.ts` | `requireMember()` (role=member + member_id) |
| APIs | `/api/member/login`, `/api/member/me` | Bind (verified phone from token) + card read |
| Client auth | `src/lib/auth/authClient.ts` | `confirmPhoneAndBindMember()` → bind → re-mint session |
| UI | `/g/[gym_slug]/member`, `DigitalCard` | Mobile-first login + live card; public-site footer link |
| Tests | `tests/memberPortal.integration.test.ts` (7) | **104 passing** total |

### Edge cases (explicitly required) — all tested
1. **Duplicate phone in same gym** → never auto-selects; fails `conflict`, logs `member.login_ambiguous`.
2. **Existing `member_auth_uid`** → never silently rebinds to a different UID; original preserved, logs `member.login_rebind_blocked`; same-UID re-bind is idempotent.
3. **Suspended gym** → login **and** card both blocked with the **same** `suspended` code/screen.

### Justified additions (per freeze rules)
- **Collections/indexes/jobs:** none. Login matches `member_phone ==` (automatic single-field index); archived filtered in memory.
- **API routes:** 2 (binding must be server-side via Admin SDK; card read keeps the server-service pattern).
- **Pages:** 1 (`/g/[gym_slug]/member`). Card = live web view (no PDF/storage in V1).

### Scope guardrails
✅ Member login (phone OTP), status, expiry/days-left, digital card, read-only basics, renew-via-WhatsApp deep link.
🚫 No attendance, workouts, social, wallet/QR, rewards, chat, or notifications.

## ✅ Milestone M9 — Reports, Exports & Backups (DONE)

Owner-only, mobile-first. Reuses the existing `report_runs` collection + analytics
+ counters — **no new collections/indexes**. **114 tests passing.**

| Area | File(s) | Notes |
|---|---|---|
| Report logic (pure) | `src/lib/domain/report.logic.ts` | Weekly window, date-keyed (idempotent) id |
| Report service | `src/lib/services/report.service.ts` | Weekly snapshot **derived** from counters + bounded last-7-day membership read |
| CSV export | `src/lib/services/export.service.ts` + `src/lib/utils/csv.ts` | **Streamed** members.csv / payments.csv; CSV-injection protected |
| APIs | `/api/reports`, `/api/reports/generate`, `/api/reports/export/[kind]` | Owner-only; generate also via `CRON_SECRET` (weekly) |
| Page | `/app/reports` | This-week summary + exports + history (cards, no tables) |
| Backups | `BACKUPS.md` | **Native Firestore→GCS export** (config/docs only); no app-managed backup, no new source of truth |
| Tests | `tests/report.logic.test.ts` (10) + `report.integration.test.ts` (3) | derivation, idempotency, suspension, CSV injection |

### Constraints honored
- `memberships` stays the **only** financial source of truth; reports are derived, exports are read-only extracts.
- Revenue/joins derived from existing rollups/counters + a **bounded** 7-day read (no full scans on the hot path).
- CSV **streamed** (no buffering) + **injection-protected** (`= + - @` neutralized, RFC-4180 quoting).
- **No** XLSX, email delivery, BI, custom date ranges, or new analytics.
- Backups = documentation/configuration around native Firestore exports.
- Reports page is **mobile-first and owner-only** (reception/members blocked).

## ✅ Milestone M10 — Launch Hardening (DONE)

Launch-focused: a11y, polish, production-config validation, deployment docs. **No
new features.** 114 tests green; TypeScript/ESLint/build clean.

| Area | File(s) | Notes |
|---|---|---|
| Accessibility | `src/components/ui/Sheet.tsx` | **Focus trap** + initial focus + Tab/Shift-Tab cycle + Escape + focus restore (covers all forms, renew, confirms) |
| Micro-interactions | `src/components/ui/Button.tsx` | Subtle `active:scale` press; focus-visible rings; reduced-motion respected globally |
| Contrast | `src/app/globals.css` | `--muted` nudged to comfortable WCAG-AA on surfaces incl. small text |
| Config validation | `scripts/check-prod-config.mjs` + `npm run check:config` | Gates deploy: required vs recommended env, sanity warnings |
| Launch docs | `LAUNCH.md` | Architecture summary, deploy checklist, readiness score, V2 backlog, limitations, **risk register & rollback** |
| Backups | `BACKUPS.md` | Native Firestore→GCS (config/docs) |

**Mobile QA (static + manual matrix 360/390/430/768/1024):** `overflow-x:hidden`
guard, no fixed-pixel widths or risky `min-w` in UI, mobile-first breakpoints
only, 44px tap targets, card layouts (no desktop tables in core flows).

→ See **`LAUNCH.md`** for the full deployment checklist, risk register, and
rollback plan.

## Status: V1 feature-complete — see `LAUNCH.md` for go-live steps.

### V1 scope (locked)
✅ Joining fee · cash payments · owner data export · lightweight audit log
⛔ Deferred: SaaS billing, daily cash reconciliation, advanced discounts, complex accounting
