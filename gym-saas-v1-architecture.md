# Gym Management SaaS — V1 Architecture & Blueprint

> **Document type:** Architecture & Product Blueprint (planning only — no code, no SQL, no implementation files)
> **Audience:** Solo developer / small team building a focused multi-tenant SaaS for independent gyms and local fitness centers
> **Guiding principle:** *Does this save time, improve management, or increase renewals? If not, it is not in V1.*

---

## 0. Assumptions & Recommended Stack (read first)

The responsive examples in the brief (`block md:flex`, `grid-cols-1 md:grid-cols-2`) are Tailwind CSS utilities, so the blueprint assumes a modern React + Tailwind stack. The architecture itself is stack-agnostic, but concrete recommendations assume:

| Layer | Recommendation | Why |
|---|---|---|
| Framework | **Next.js (App Router)** | One codebase serves the luxury public site (SSR/SSG for SEO + speed) and the admin dashboard (client-rendered). Built-in API routes remove the need for a separate backend service in V1. |
| Styling | **Tailwind CSS + a small design-token layer** | Enforces the responsive rules (Rule 4) and premium consistency. |
| Database | **PostgreSQL** (managed: Supabase / Neon / RDS) | Relational integrity for tenant isolation, money, and renewals. Row-Level Security available if using Supabase. |
| ORM/Access | **Prisma** (or Drizzle) | Type-safe, explicit field naming, migrations. |
| Auth | **Managed auth** (Supabase Auth / Auth.js / Clerk) | Avoid building auth in V1; supports multi-tenant roles. |
| File/Image storage | **Object storage + CDN** (Supabase Storage / S3 + CloudFront / Cloudinary) | Member photos, gallery images, generated ID cards. |
| Background jobs | **Scheduled function / cron** (Vercel Cron, Supabase Edge Functions, or a queue) | Weekly reports + expiry recalculation. |
| Email/Report delivery | **Transactional email provider** (Resend / Postmark / SES) | Weekly report delivery + renewal reminders. |
| Hosting | **Vercel (app) + managed Postgres** | Lowest ops burden for a solo developer. |

> This is intentionally a **modular monolith**, not microservices. A solo developer should never operate distributed infrastructure for V1.

---

## 1. Product Architecture

### 1.1 High-level shape

```
                         ┌────────────────────────────────────────┐
                         │            CLIENTS / BROWSERS           │
                         │  Public visitor   │   Gym admin/staff   │
                         └─────────┬───────────────────┬───────────┘
                                   │                   │
                  (public, SEO, SSG/SSR)        (auth-gated, CSR)
                                   │                   │
                         ┌─────────▼───────────────────▼───────────┐
                         │          NEXT.JS APPLICATION             │
                         │  ┌──────────────┐   ┌─────────────────┐  │
                         │  │ Public Site  │   │  Admin Dashboard│  │
                         │  │  (per-tenant │   │  (per-tenant    │  │
                         │  │   by slug)   │   │   by session)   │  │
                         │  └──────────────┘   └─────────────────┘  │
                         │  ┌────────────────────────────────────┐  │
                         │  │      API LAYER (route handlers)     │  │
                         │  └────────────────────────────────────┘  │
                         │  ┌────────────────────────────────────┐  │
                         │  │   SERVICE LAYER (business logic)    │  │
                         │  │  members · plans · renewals · leads │  │
                         │  │  reports · idcards · tenants        │  │
                         │  └────────────────────────────────────┘  │
                         │  ┌────────────────────────────────────┐  │
                         │  │   DATA ACCESS (repositories/ORM)    │  │
                         │  └────────────────────────────────────┘  │
                         └──────┬────────────┬───────────┬──────────┘
                                │            │           │
                    ┌───────────▼──┐  ┌──────▼─────┐ ┌───▼──────────────┐
                    │ PostgreSQL   │  │ Object     │ │ Email / Cron     │
                    │ (tenant      │  │ storage+CDN│ │ External services│
                    │  scoped)     │  │ (images)   │ │ (safe fallbacks) │
                    └──────────────┘  └────────────┘ └──────────────────┘
```

### 1.2 Architectural principles

1. **Modular monolith** — one deployable, internally split into clear modules.
2. **Service layer owns business rules** — API handlers stay thin; UI never talks to the DB directly.
3. **Tenant scope is enforced at the data-access layer, not the UI** — every query is filtered by `gym_profile_id` (see §6).
4. **Money is integer minor units everywhere** (Rule 2).
5. **External calls are wrapped with fallbacks** — the app degrades, never crashes (Rule 5).
6. **Explicit, descriptive naming everywhere** (Rule 1).

---

## 2. Module Breakdown

Each module is a vertical slice: UI + API + service + repository + types.

| Module | Responsibility | Key V1 capabilities |
|---|---|---|
| **Tenant / Gym Profile** | Gym identity, slug, branding, settings | Create gym, slug routing, branding, contact + WhatsApp config |
| **Auth & Roles** | Login, sessions, role gating | Owner, Manager, Staff roles; tenant binding |
| **Members** | Member lifecycle | Add, edit, search, history, status, photo |
| **Membership Plans** | Catalog of sellable plans | Monthly/Quarterly/Semi-annual/Annual, pricing (minor units), active toggle |
| **Renewals & Expiry** | Membership periods over time | Renew, compute expiry, status derivation, renewal history |
| **Digital ID Cards** | Member identity artifact | Unique member code, shareable card view, status badge |
| **Leads** | Capture & convert inquiries | Contact form intake, status pipeline, WhatsApp action |
| **Public Website** | Marketing surface per gym | Hero, about, plans, trainers, gallery, testimonials, contact, WhatsApp CTA |
| **Content (Gallery + Testimonials + Trainers)** | Editable public content | CRUD with all frontend-required fields (Rule 3) |
| **Reports** | Automated weekly summaries | Generate + deliver (email + downloadable export) |
| **Dashboard** | Aggregated overview | Revenue, active, expiring, leads at a glance |

### 2.1 Module dependency direction

```
UI ──► API ──► Service ──► Repository ──► DB
                  │
                  └──► Integrations (email, storage) wrapped with fallbacks
```
No reverse dependencies. Services may call other services (e.g., Renewals → Members), but repositories never call services.

---

## 3. Recommended Database Design (conceptual — no SQL)

> Described as entities + fields + relationships. **Every entity carries `gym_profile_id`** for tenant isolation (except the tenant/account tables themselves). All money fields are **integer minor units** (paise for ₹). All timestamps stored UTC.

### 3.1 Naming conventions (Rule 1)
- Primary keys: `<entity>_id` (e.g., `member_id`, `plan_id`).
- Tenant FK: **`gym_profile_id`** (never `gym_id`).
- Slugs: **`gym_slug`** (never `slug`).
- Human names: **`member_display_name`**, **`trainer_display_name`** (never `name`).
- Money: suffix `_minor` and currency (e.g., `price_amount_minor`, `currency_code`).
- Booleans: `is_*` prefix (`is_active`, `is_hero_gallery`).
- Status enums stored as explicit string keys (e.g., `member_status_key`).

### 3.2 Entities

**gym_profile** (the tenant)
- `gym_profile_id` (PK)
- `gym_slug` (unique, URL identifier)
- `gym_legal_name`, `gym_display_name`
- `gym_logo_url`, `gym_primary_color_hex`
- `gym_contact_email`, `gym_contact_phone`, `gym_whatsapp_number`
- `gym_address_line`, `gym_city`, `gym_country_code`
- `default_currency_code` (e.g., `INR`)
- `gym_status_key` (active/suspended)
- `created_at`, `updated_at`

**gym_setting** (1:1 with gym_profile — flexible config)
- `gym_profile_id` (FK)
- `report_recipient_emails` (list)
- `renewal_reminder_days_before` (e.g., 7)
- `public_site_is_published` (bool)
- `whatsapp_default_message_template`
- fallback-safe defaults for every key (Rule 5)

**app_user** (admin/staff)
- `app_user_id` (PK)
- `gym_profile_id` (FK)
- `app_user_email`, `app_user_display_name`
- `app_user_role_key` (owner/manager/staff)
- `is_active`, `last_login_at`

**member**
- `member_id` (PK)
- `gym_profile_id` (FK)
- `member_code` (unique per gym — drives ID card; see §3.4)
- `member_display_name`
- `member_phone`, `member_email` (optional)
- `member_photo_url`
- `member_gender_key` (optional), `member_dob` (optional)
- `member_join_date`
- `current_membership_id` (FK → membership, nullable)
- `member_status_key` (active / expiring_soon / expired / inactive — **derived**, see §3.3)
- `member_notes`
- `created_at`, `updated_at`

**membership_plan**
- `plan_id` (PK)
- `gym_profile_id` (FK)
- `plan_display_name` (e.g., "Quarterly")
- `plan_duration_key` (monthly / quarterly / semi_annual / annual)
- `plan_duration_days` (resolved length used for expiry math)
- `price_amount_minor` (integer), `currency_code`
- `plan_description`
- `is_active`
- `display_order`
- `created_at`, `updated_at`

**membership** (a purchased period — the core of renewals)
- `membership_id` (PK)
- `gym_profile_id` (FK)
- `member_id` (FK)
- `plan_id` (FK — snapshot reference)
- `plan_name_snapshot`, `price_paid_minor`, `currency_code` (snapshot at sale time so later plan edits don't rewrite history)
- `membership_start_date`, `membership_end_date`
- `payment_status_key` (paid / partial / pending)
- `created_by_app_user_id`
- `created_at`

> **Renewal = create a new `membership` row**, recompute the member's `current_membership_id` and derived status. History is the full set of membership rows. Never overwrite a period.

**lead**
- `lead_id` (PK)
- `gym_profile_id` (FK)
- `lead_display_name`
- `lead_phone`, `lead_email` (optional)
- `lead_message`
- `lead_source_key` (public_contact_form / walk_in / manual)
- `lead_status_key` (new / contacted / trial / converted / lost)
- `assigned_app_user_id` (optional)
- `created_at`, `updated_at`

**trainer**
- `trainer_id` (PK)
- `gym_profile_id` (FK)
- `trainer_display_name`
- `trainer_specialty`, `trainer_bio`
- `trainer_photo_url`
- `is_active`, `display_order`

**testimonial** (Rule 3 — all frontend-required fields present)
- `testimonial_id` (PK)
- `gym_profile_id` (FK)
- `testimonial_text` ✅
- `member_since_year` ✅
- `member_tier_key` ✅ (e.g., gold/platinum label shown on card)
- `author_display_name`, `author_photo_url`
- `is_active`, `display_order`

**gallery_item** (Rule 3 — all frontend-required fields present)
- `gallery_item_id` (PK)
- `gym_profile_id` (FK)
- `image_url`
- `image_title` ✅
- `area_category` ✅ (e.g., cardio / weights / studio / reception)
- `is_hero_gallery` ✅
- `is_active` ✅
- `display_order`

**report_run** (audit of generated reports)
- `report_run_id` (PK)
- `gym_profile_id` (FK)
- `report_period_start`, `report_period_end`
- `report_payload_json` (computed metrics snapshot)
- `delivery_status_key` (generated / emailed / failed)
- `export_file_url` (PDF/CSV)
- `created_at`

### 3.3 Membership status derivation (single source of truth)
Status is **computed**, not hand-edited, to avoid drift:
- `active` → `membership_end_date >= today`
- `expiring_soon` → within `renewal_reminder_days_before` of `membership_end_date`
- `expired` → `membership_end_date < today`
- `inactive` → no membership ever / manually deactivated

A nightly cron recomputes `member_status_key` so dashboard counts are O(1) reads; lists can also compute live for accuracy.

### 3.4 Member code generation (drives ID card)
`member_code` = stable, unique per gym, human-readable. Pattern: `{GYM_SHORTCODE}-{YYYY}-{SEQUENCE}` (e.g., `IRON-2026-000142`). Generated server-side inside a transaction to prevent collisions.

### 3.5 Indexing essentials
- Composite index on `(gym_profile_id, member_status_key)` for dashboard.
- Index on `(gym_profile_id, membership_end_date)` for expiry queries.
- Unique `(gym_profile_id, member_code)` and `(gym_profile_id, gym_slug)` global unique.
- Index on `(gym_profile_id, lead_status_key, created_at)`.

---

## 4. Admin Panel Structure

### 4.1 Navigation (sidebar)
```
Dashboard
Members            (list, add, edit, renew, history)
Membership Plans   (catalog + pricing)
Renewals & Expiry  (expiring soon, expired, renew action)
Leads              (pipeline + WhatsApp action)
Trainers           (content)
Gallery            (content + hero flags)
Testimonials       (content)
Reports            (history, download, settings)
Settings           (gym profile, branding, WhatsApp, report recipients)
```

### 4.2 Dashboard (overview) cards
- **Revenue overview** — this month / last month, from `price_paid_minor` sums (formatted from minor units only at the edge).
- **Active members** — count + trend.
- **Expiring members** — next 7/30 days, click-through to renew.
- **New leads** — count by status, quick actions.
- **Recent activity** — latest renewals/joins.

### 4.3 Key admin screens & UX
| Screen | Primary actions | UX notes |
|---|---|---|
| Members list | search, filter by status, paginate | Server-side search on `member_display_name`, `member_code`, `member_phone`. Skeleton rows while loading. |
| Member detail | edit, renew, view history | Renew is a 2-step modal: pick plan → confirm dates + payment. Shows full membership timeline. |
| Plans | add/edit, toggle active, reorder | Price entered in major units, stored as minor. Inactive plans hidden from public site but kept for history. |
| Leads | change status, WhatsApp, assign | WhatsApp opens `wa.me` deep link with template; if number missing, button disabled with tooltip (Rule 5). |
| Content (gallery/testimonials/trainers) | CRUD, reorder, active toggle | Image upload with client-side resize; hero flag limited/validated. |
| Reports | view, download, configure recipients | Manual "Generate now" + automatic weekly. |
| Settings | branding, contacts, report recipients | All fields fallback-safe. |

### 4.4 Roles & permissions (V1, simple)
- **Owner** — everything incl. settings, plans, reports.
- **Manager** — members, renewals, leads, content; no billing-critical settings.
- **Staff** — members + leads only.

---

## 5. Public Website Structure

Rendered **per tenant via `gym_slug`** route, SSG/ISR for speed + SEO, only published when `public_site_is_published` is true.

### 5.1 Page sections (single luxury landing page + optional sub-pages)
1. **Hero** — gym display name, tagline, primary CTA (Join / WhatsApp), background from hero gallery (`is_hero_gallery = true`).
2. **About** — story, value props, key stats.
3. **Membership Plans** — pricing cards from active plans; price formatted from minor units; CTA → contact/WhatsApp.
4. **Trainers** — active trainers grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).
5. **Gallery** — filtered by `area_category`, only `is_active`, masonry/grid with fixed aspect ratios (no distortion — Rule 4).
6. **Testimonials** — carousel/grid using `testimonial_text`, `author_display_name`, `member_since_year`, `member_tier_key`.
7. **Contact form** — writes a `lead` (source = `public_contact_form`).
8. **WhatsApp CTA** — floating button using `gym_whatsapp_number`; hidden gracefully if not configured (Rule 5).
9. **Footer** — address, hours, social, legal.

### 5.2 Premium experience execution
- **Typography:** one display font + one text font, strict type scale; generous line-height.
- **Spacing:** consistent 4/8px spacing scale; large section padding.
- **Visual hierarchy:** clear primary CTA per section; restrained accent color from `gym_primary_color_hex`.
- **Loading:** skeletons for image grids; blur-up placeholders.
- **Micro-interactions:** subtle hover lift on cards, smooth scroll, fade-in on view — **tasteful only**, respect `prefers-reduced-motion`.
- **No external-resource dependence in preview** — inline critical styles, use optimized self-hosted images.

### 5.3 Responsive strategy (Rule 4)
- **Mobile-first**: base styles target small screens, scale up with `md:`/`lg:`.
- Grids: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.
- Layout switches: `block md:flex`.
- All images use fixed aspect-ratio containers + `object-cover` → **no distortion, no overflow**.
- Max-width content containers prevent line-length blowout.
- Test matrix: 360px, 768px, 1024px, 1440px. No horizontal scroll at any breakpoint; no content hidden behind overflow.

---

## 6. SaaS Tenant Architecture

### 6.1 Isolation model: **shared database, shared schema, tenant column**
Best fit for a solo dev + many small gyms (low per-tenant cost, easy migrations).
- Every business row has **`gym_profile_id`**.
- **Isolation enforced in the data-access layer**: a tenant-scoped repository injects `gym_profile_id` into *every* query automatically — application code cannot accidentally query across tenants.
- Optional defense-in-depth: **Postgres Row-Level Security** keyed on the session's gym so even a missed filter cannot leak data.

```
Request → resolve tenant → bind gym_profile_id to request context
        → repositories read context → all queries auto-scoped
```

### 6.2 Tenant resolution
- **Public site:** tenant resolved from `gym_slug` in URL (path-based, e.g., `/g/{gym_slug}` or subdomain `{gym_slug}.app.com` later).
- **Admin:** tenant resolved from the authenticated session's `gym_profile_id` (a user belongs to exactly one gym in V1).

### 6.3 Why not schema-per-tenant or db-per-tenant
- Migration and ops overhead multiplies per gym — wrong for a solo developer.
- V1 gyms are small; a single well-indexed table set scales to thousands of gyms.
- Can graduate to schema/db isolation later for large enterprise tenants (out of V1 scope).

### 6.4 Tenant lifecycle
- **Onboarding:** create `gym_profile` + `gym_setting` (with safe defaults) + owner `app_user` in one transaction.
- **Suspension:** `gym_status_key = suspended` → blocks admin + unpublishes public site, data retained.
- **No cross-tenant sharing** of members, plans, trainers, leads, settings — ever.

---

## 7. API Architecture

### 7.1 Style
- **REST-ish resource routes** via Next.js route handlers, grouped by module.
- **Thin handlers** → validate input → call service → shape response.
- **All money in responses returned as minor units + a formatted display string**, never as float.

### 7.2 Resource map (illustrative — not implementation)
```
/api/members            GET (list/search), POST (create)
/api/members/{id}       GET, PATCH
/api/members/{id}/renew POST                (creates membership period)
/api/members/{id}/history GET

/api/plans              GET, POST
/api/plans/{id}         PATCH, DELETE(soft → is_active=false)

/api/leads              GET (list/filter), POST (public intake)
/api/leads/{id}         PATCH (status/assignment)

/api/trainers           GET, POST, PATCH, DELETE(soft)
/api/gallery            GET, POST, PATCH, DELETE(soft)
/api/testimonials       GET, POST, PATCH, DELETE(soft)

/api/dashboard/summary  GET (aggregated counts + revenue)
/api/reports            GET (history), POST (generate now)
/api/reports/{id}/export GET (PDF/CSV)

/api/public/{gym_slug}/site   GET (published public content bundle)
/api/public/{gym_slug}/contact POST (creates lead)

/api/settings           GET, PATCH
```

### 7.3 Cross-cutting concerns
- **Validation:** schema validation (e.g., Zod) at the boundary; reject before service.
- **Auth middleware:** verifies session, attaches `gym_profile_id` + role.
- **Tenant guard:** every non-public route asserts the resource's `gym_profile_id` matches the session.
- **Consistent response envelope:** `{ data, error, meta }`; predictable pagination (`page`, `page_size`, `total`).
- **Error contract:** typed error codes; never leak internals; never hang (always resolve/reject — Rule 5).
- **Idempotency for renewals/payments:** guard against double submission.
- **Rate limiting** on public endpoints (contact form) to prevent lead spam.

---

## 8. Frontend Architecture

### 8.1 Folder structure (feature-first, solo-dev friendly)
```
src/
  app/
    (public)/
      g/[gym_slug]/            # luxury public site (SSG/ISR)
        page.tsx
        sections/              # hero, about, plans, trainers, gallery, ...
    (admin)/
      dashboard/
      members/
      plans/
      leads/
      trainers/
      gallery/
      testimonials/
      reports/
      settings/
    api/                       # route handlers (see §7)
  modules/                     # vertical business slices
    members/
      components/
      hooks/
      services/                # client-side service calls
      types.ts
    plans/
    renewals/
    leads/
    reports/
    idcards/
    content/                   # gallery, testimonials, trainers
    tenant/
  server/                      # server-only
    services/                  # business logic (members, renewals, reports...)
    repositories/              # tenant-scoped data access
    integrations/              # email, storage, whatsapp — wrapped w/ fallbacks
    money/                     # minor-unit helpers (format/parse)
    auth/
  components/
    ui/                        # buttons, inputs, modals, cards (design system)
    layout/                    # shells, sidebar, headers
    feedback/                  # skeletons, empty states, toasts
  lib/                         # utils, formatters, constants, status keys
  styles/                      # tailwind config, design tokens
```

### 8.2 Component organization
- **`components/ui`** = primitive design system (premium look lives here).
- **`modules/*/components`** = feature components composed from `ui`.
- **Skeletons + empty states are first-class** components for every list/grid.

### 8.3 State management strategy (keep it light)
- **Server state:** **TanStack Query (React Query)** — caching, loading/error states, retries with backoff (prevents infinite loading — Rule 5). This handles 90% of "state."
- **URL state:** filters, search, pagination live in the URL (shareable, no global store needed).
- **Local UI state:** `useState`/`useReducer` for modals, forms.
- **Light global state:** a small context for session/tenant/theme only.
- **No Redux** — over-engineering for V1.

### 8.4 Service layer strategy (frontend)
- UI never calls `fetch` directly. Each module exposes a typed **service** (`membersService.renew(...)`) that wraps API calls.
- Services centralize error normalization + money formatting.
- Mirrors the server service layer for symmetry.

### 8.5 Money handling on the frontend (Rule 2)
- Receive `price_amount_minor` (int) + `currency_code`.
- A single `formatMoney(minor, currency)` helper produces display strings (`₹3,200`).
- Inputs collect major units and convert to minor on submit. **No float math anywhere.**

### 8.6 Premium UX implementation checklist
- Strict design tokens (spacing, type scale, radius, shadow).
- Skeleton loaders for every async surface.
- Optimistic UI for status changes (lead status, active toggles) with rollback on error.
- `prefers-reduced-motion` respected; animations subtle and few.
- Accessible: focus states, labels, color contrast.

---

## 9. Digital Member Identity Card — Recommended Approach

**Recommendation: server-rendered, shareable web ID card (no native app, no QR check-in system in V1).**

### 9.1 What it contains
- `member_code` (unique identifier)
- `member_photo_url`
- `member_display_name`
- `member_status_key` (live badge: active / expiring / expired)
- `member_join_date`
- `membership_end_date` (expiry)
- current `plan_name_snapshot`
- gym branding (logo, primary color)

### 9.2 Delivery options (ranked for V1)
1. **Unique unguessable card URL** (e.g., `/card/{signed_token}`) — opens a premium, mobile-first card page. Shareable via WhatsApp. **Recommended primary.**
2. **Downloadable image/PDF** of the card generated on demand (server-side render → image) for offline saving.
3. *(Deferred)* Wallet passes / QR check-in — explicitly **out of V1** per anti-bloat rules.

### 9.3 Why this approach
- Zero app install, works on any phone.
- Always shows **live** status (re-reads membership), so an expired member can't flash a valid-looking card.
- Token is signed + revocable; no member PII beyond what's on the card; respects tenant isolation.
- Fits "premium, fast, reliable" with minimal engineering.

---

## 10. Automated Reports — Recommended Mechanism

**Recommendation: scheduled weekly job → compute snapshot → store `report_run` → deliver via email with attached/exportable PDF + CSV.**

### 10.1 Contents (weekly summary)
- Active members (count + change vs last week)
- New joins (count + list)
- Expiring memberships (next 7/30 days)
- Revenue summary (sum of `price_paid_minor` for the period, formatted)
- Lead statistics (new / contacted / converted / lost)

### 10.2 Mechanism
- **Cron trigger** (Vercel Cron / Supabase scheduled function) runs weekly per gym.
- Service computes metrics from tenant-scoped queries → writes `report_run` (immutable snapshot).
- **Delivery:** transactional email to `report_recipient_emails`; **PDF** for human reading + **CSV** for spreadsheets, both stored at `export_file_url`.
- **On-demand "Generate now"** button in admin reuses the same service.
- **Fallback safety (Rule 5):** if email provider is unconfigured/down, the report is still generated and downloadable in-app; failure logged as `delivery_status_key = failed`, never blocks the app.

### 10.3 Why email + downloadable export
- Gym owners live in WhatsApp/email, not dashboards — push beats pull for weekly review.
- CSV satisfies accountants; PDF satisfies owners.
- Snapshot storage makes reports reproducible and auditable.

---

## 11. Environment & Integration Fallback Safety (Rule 5)

| Integration | If missing/failing | Behavior |
|---|---|---|
| WhatsApp number | not configured | Hide/disable CTA + show tooltip; no broken link |
| Email provider | missing keys / down | Reports still generated + downloadable; mark delivery failed; no crash |
| Object storage / CDN | image fails to load | Placeholder image + retry; layout never collapses |
| Auth provider | transient error | Clear error screen + retry, no infinite spinner |
| Any external call | timeout | Hard timeout + retry-with-backoff via React Query; fail to a safe state |

**Global rules:** every async path has a timeout, an error state, and an empty state. No silent infinite loading. Missing config resolves to a documented safe default, never an exception at startup.

---

## 12. Risks & Edge Cases

| Area | Risk / Edge case | Mitigation |
|---|---|---|
| Tenant isolation | A query forgets `gym_profile_id` → data leak | Auto-scoping repositories + optional Postgres RLS; code review checklist |
| Money | Float/decimal sneaks in → rounding errors | Integer minor units enforced; lint rule + central money helpers; snapshots at sale |
| Renewals | Renewing before expiry vs after gap | Define rule: renew extends from `max(today, current_end_date)`; store explicit start/end |
| Renewals | Double-submit creates duplicate periods | Idempotency key on renew endpoint |
| Member status | Drift between stored vs real status | Status is derived; nightly recompute + live compute in lists |
| Member code | Race condition → duplicate code | Generate inside transaction with unique constraint |
| Plan edits | Changing price rewrites history | Snapshot `plan_name_snapshot` + `price_paid_minor` on each membership |
| Gallery hero | Multiple/zero hero images | Validate `is_hero_gallery`; fallback to default hero if none |
| Public form | Spam leads | Rate limiting + basic bot protection (honeypot/captcha) |
| ID card | Expired member shows valid card | Card reads live status; token revocable |
| Responsive | Overflow / image distortion on small screens | Fixed aspect-ratio containers, mobile-first grids, breakpoint test matrix |
| Reports | Email fails silently | Downloadable fallback + failed status surfaced in admin |
| Timezones | Expiry off by a day | Store UTC, compute expiry in gym's local timezone, display localized |
| Photos/PII | Sensitive member data exposure | Signed URLs, tenant-scoped storage paths, least-privilege access |
| Solo-dev maintainability | Over-engineering creep | Modular monolith, no microservices, light state, feature-first folders |

---

## 13. Recommended V1 Scope

### ✅ In V1
- Multi-tenant gym profiles (slug-based public site + session-based admin)
- Member management: add / edit / search / history / photo / status
- Membership plans: monthly / quarterly / semi-annual / annual, money in minor units
- Renewals + expiry tracking (derived status, reminders config)
- Digital member ID card (shareable web card + downloadable export)
- Lead management: public contact form → pipeline → WhatsApp action
- Admin dashboard: revenue, active, expiring, leads
- Editable public content: trainers, gallery (with all Rule 3 fields), testimonials (with all Rule 3 fields)
- Luxury responsive public website
- Automated weekly reports (email + PDF/CSV export) + on-demand generation
- Settings: branding, contacts, WhatsApp, report recipients
- Roles: owner / manager / staff
- Fallback-safe integrations

### 🚫 Explicitly out of V1 (anti-bloat)
Workout tracking · diet plans · attendance systems · trainer payroll · AI coaching · native mobile apps · QR check-in · wearable integrations · social features · in-app payment gateway (V1 records payment status manually; gateway can come later) · per-tenant subdomains/custom domains (path-based slug first) · multi-gym-per-user.

### 🔮 Likely V2 candidates (only with business justification)
Online payments + auto-renew billing · SMS/WhatsApp Business API automation · custom domains/subdomains · advanced analytics · staff activity audit log · member self-service portal.

---

## 14. Build Sequence (suggested for a solo developer)

1. Tenant + auth + settings (foundation, isolation, fallbacks).
2. Plans + money layer.
3. Members + photos + search.
4. Memberships/renewals/expiry + derived status.
5. Dashboard summary.
6. Leads + public contact intake.
7. Public website (content modules: trainers, gallery, testimonials) + premium design system.
8. Digital ID card.
9. Automated reports + delivery.
10. Polish: skeletons, micro-interactions, responsive QA, fallback hardening.

---

*End of blueprint. No code, SQL, or implementation files included — by design.*
