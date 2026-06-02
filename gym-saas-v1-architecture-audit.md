# Gym Management SaaS V1 — Architecture Audit & Corrected Blueprint

> **Phase 1 deliverable: audit first, code later.**
> **Mandate:** Challenge every decision. Do not assume the current plan is correct.
> **New constraints in this round:** Firebase stack (Auth + Firestore + Storage), Reception Dashboard, Member Portal, optional Attendance module, 90%+ mobile usage.

---

## 0. The Single Biggest Finding (read this first)

**The stack changed from PostgreSQL (relational) to Firestore (NoSQL document DB), but the data model in the V1 plan is still relational.** This is the most consequential issue in the entire system, so it frames the whole audit.

Firestore has **no joins, no foreign keys, no transactional integrity across collections by default, no `SUM()`/`GROUP BY`, no `ORDER BY` across fields without composite indexes, and query cost scales with documents read.** Almost every "relationship," "report aggregation," and "expiry query" in the original plan silently assumed SQL. If we port the relational design 1:1 onto Firestore, we get slow reports, expensive reads, broken integrity, and painful renewals.

**This audit treats "relational design on a NoSQL engine" as the root cause behind a large share of the Critical/High issues below**, and the corrections re-model the system *Firestore-natively* while preserving every mandatory rule (explicit naming, integer minor units, required CMS fields, mobile-first, env safety).

---

## How to read severities
- **Critical** — will cause data loss, security breach, broken core workflow, or block launch.
- **High** — serious correctness/UX/cost problem; fix before selling.
- **Medium** — degrades quality or maintainability; fix during V1.
- **Low** — polish / future-proofing.

---

# Phase 1: Architecture Audit

## 1. Missing Business Requirements

| # | Issue | Why it's a problem | Real-world impact | Solution | Severity |
|---|---|---|---|---|---|
| 1.1 | **Joining/admission fee not modeled** | Plan only had plan price; most Indian gyms charge a one-time `joining_fee_minor` separate from the recurring plan. | Revenue under-reported; reception can't record real cash collected; owner distrusts numbers. | Add `joining_fee_minor` to plan + `joining_fee_paid_minor` snapshot on first membership. | High |
| 1.2 | **No partial / pending payment + balance tracking** | Cash gyms routinely take partial payment. Original only had a `payment_status_key`. | Reception writes balances on paper; disputes; revenue mismatch. | Add `amount_paid_minor`, `amount_due_minor`, `payment_method_key` (cash/upi/card) per membership. | High |
| 1.3 | **No discount / promo handling** | Owners give ad-hoc discounts; without it they edit price and corrupt history. | Inaccurate revenue analytics. | Add `discount_minor` + `discount_reason` snapshot on membership. | Medium |
| 1.4 | **No invoice / receipt artifact** | Members ask for receipts; cash gyms need proof. | Manual receipts; unprofessional vs "premium" positioning. | Generate a simple receipt (reuse ID-card render pipeline → PDF). | Medium |
| 1.5 | **No member freeze / pause** | Travel, injury, medical pauses are extremely common. | Owners manually extend dates, breaking expiry logic. | Add `membership_freeze` with `freeze_start`, `freeze_end`, auto-extend expiry. (Can be V1.1 but reserve the field.) | Medium |
| 1.6 | **Subscription/billing for the SaaS itself is undefined** | This is a SaaS to *sell*, but there's no plan for how gyms pay *you*. | No revenue model; can't go live commercially. | Add a platform-level `subscription` concept (gym plan tier, trial, status). Manual/Razorpay later; at minimum gate by `gym_status_key`. | High |
| 1.7 | **No data export for the gym owner (their own data)** | Owners fear lock-in; legally may need their member list. | Sales objection; trust issue. | Provide CSV export of members/payments per tenant. | Medium |
| 1.8 | **No audit trail of who did what** | Cash + multiple staff = disputes ("who deleted this member?"). | Theft/fraud undetectable; no accountability. | Lightweight `activity_log` (actor, action, entity, timestamp). | High |

## 2. Missing Database Relationships (re-cast for Firestore)

| # | Issue | Why | Impact | Solution | Severity |
|---|---|---|---|---|---|
| 2.1 | **Member ↔ Membership history modeled as joins** | Firestore can't join. Reading a member + their history relationally = N+1 reads. | Slow member detail page; high read cost. | Model `memberships` as a **subcollection** under each member: `gym_profiles/{gym_profile_id}/members/{member_id}/memberships/{membership_id}`. Denormalize the *current* membership summary onto the member doc. | Critical |
| 2.2 | **No denormalized "current membership" on member** | Lists/dashboards would need a read per member to know status/expiry. | Member list = hundreds of extra reads. | Store `current_membership_summary` (plan name, end date, status) on the member doc, updated transactionally on renew. | Critical |
| 2.3 | **Plan price changes corrupt historical memberships** | Without snapshots, editing a plan rewrites past revenue. | Reports change retroactively; audit fails. | Snapshot `plan_name_snapshot`, `price_amount_minor`, `joining_fee_minor`, `discount_minor` on each membership doc. | Critical |
| 2.4 | **Lead → Member conversion link missing** | Can't measure conversion or avoid duplicate entry. | Lost analytics; double data entry. | On convert, write `converted_member_id` on lead and `source_lead_id` on member. | Medium |
| 2.5 | **Trainer ↔ Member assignment undefined** | Even without payroll, owners want to see "Trainer X's members." | Feature gap if requested. | Optional `assigned_trainer_id` on member (nullable). Low priority. | Low |
| 2.6 | **Counters for dashboard not modeled** | Firestore has no cheap `COUNT()`. Counting active members = read all docs. | Dashboard becomes expensive and slow at scale. | Maintain **aggregate counter docs** per gym (`stats/summary`) updated via transactions/Cloud Functions. | Critical |

## 3. Missing User Roles / Permissions

| # | Issue | Why | Impact | Solution | Severity |
|---|---|---|---|---|---|
| 3.1 | **Reception role wasn't first-class earlier; Member role is brand new** | New vision adds Reception Dashboard + Member Portal — different auth surfaces. | Wrong access; members could see admin data. | Define 4 roles: `owner`, `reception`, `member`, plus `platform_admin` (you). Members authenticate but are **not** staff. | Critical |
| 3.2 | **Member identity is not a staff user** | Members log in to a portal but must be sandboxed to *their own* doc. | Security: a member could read other members. | Members get Firebase Auth accounts mapped to a single `member_id`; security rules restrict to self. | Critical |
| 3.3 | **No "platform admin" (you) separation** | You need cross-tenant support access; owners must not have it. | Support impossible / over-privileged owners. | Add `platform_admin` custom claim, used only by you, never granted to tenants. | High |
| 3.4 | **Permission matrix undefined per action** | Reception shouldn't delete members or edit plans/pricing. | Junior staff cause irreversible damage. | Explicit action matrix (see Corrections §C3). Enforce in **both** UI and security rules. | High |
| 3.5 | **No invite/deactivate flow for staff** | Staff turnover is high at gyms. | Ex-employees retain access. | Owner can invite/deactivate `reception` users; deactivation revokes claims. | High |

## 4. Mobile-First UX Gaps

| # | Issue | Why | Impact | Solution | Severity |
|---|---|---|---|---|---|
| 4.1 | **Admin tables have no mobile card fallback** | 90%+ mobile; tables overflow on 360px. | Owner literally can't use the product on a phone. | Every list = responsive: `<table>` on `lg:`, stacked **cards** on mobile (`grid-cols-1`). Mandatory pattern. | Critical |
| 4.2 | **Renewal/add-member forms not designed for thumb use** | Long forms on mobile cause abandonment at the reception desk. | Slow check-ins, queues. | Multi-step, single-column, large tap targets (min 44px), sticky primary CTA. | High |
| 4.3 | **No bottom navigation for mobile dashboards** | Sidebar nav is desktop-centric. | Hard navigation on phones. | Mobile: bottom tab bar (Dashboard/Members/Renew/More). Desktop: sidebar. | High |
| 4.4 | **Member portal not specified as offline-tolerant card** | Members open card at the door with bad signal. | Card won't load → embarrassing. | Cache last card render; show cached + "as of" timestamp when offline. | High |
| 4.5 | **No defined breakpoints enforcement** | "Mobile-first" stated but not testable. | Regressions slip in. | Lock test matrix: 360/390/430/768/1024/1440. No horizontal scroll at any width. | Medium |
| 4.6 | **Image-heavy public site on mobile data** | Gallery/hero can be heavy on 4G. | Slow LCP → lost conversions. | `next/image`, responsive sizes, blur placeholders, lazy-load below fold. | High |

## 5. Multi-Tenant SaaS Risks (Firestore-specific)

| # | Issue | Why | Impact | Solution | Severity |
|---|---|---|---|---|---|
| 5.1 | **Tenant isolation depends on Firestore Security Rules, which were never written/specified** | In Firestore, isolation is enforced by rules + data path, not a repository layer. | A wrong rule = full cross-gym data leak. | Use **path-based tenancy**: everything under `gym_profiles/{gym_profile_id}/...`. Rules check `request.auth.token.gym_profile_id == path gym_profile_id`. | Critical |
| 5.2 | **Tenant binding via custom claims not designed** | Need `gym_profile_id` + `role` on the auth token. | Without it, every request must look up membership = slow/insecure. | Set Firebase **custom claims** (`gym_profile_id`, `role`) on user creation via Cloud Function. | Critical |
| 5.3 | **Public website needs unauthenticated reads of tenant content** | Visitors aren't logged in but must read plans/gallery/testimonials. | Either site breaks or you over-expose data. | Mark public content docs readable when `is_active==true`; **never** expose members/leads/payments publicly. Consider serving public content via SSR/Cloud Function with Admin SDK to avoid loosening rules. | Critical |
| 5.4 | **Slug uniqueness across tenants** | Firestore can't enforce global uniqueness via constraint. | Two gyms grab same `gym_slug` → routing collision. | Maintain a top-level `gym_slug_index/{gym_slug}` doc; create transactionally to guarantee uniqueness. | High |
| 5.5 | **No per-tenant usage limits** | A single gym could blow read/write quota for everyone (shared Firebase project). | Cost spikes; noisy-neighbor. | Track per-tenant counters; soft caps by `subscription` tier. | Medium |

## 6. Data Integrity Risks (NoSQL)

| # | Issue | Why | Impact | Solution | Severity |
|---|---|---|---|---|---|
| 6.1 | **No cross-document transactions planned for renewals** | Renew must (a) create membership, (b) update member summary, (c) bump counters — atomically. | Partial writes → wrong status/revenue. | Wrap renewal in a Firestore **transaction / batched write**. | Critical |
| 6.2 | **Denormalized data can drift** | Current-membership summary + counters duplicate source data. | Dashboard shows stale/wrong numbers. | Single write path (a Cloud Function or service) owns denormalization; never update from multiple places. | Critical |
| 6.3 | **Member code uniqueness race** | Two reception users add members simultaneously. | Duplicate `member_code`. | Allocate codes via a transactional counter doc per gym (`counters/member_seq`). | High |
| 6.4 | **No schema validation in a schemaless DB** | Firestore accepts any shape. | Corrupt/missing fields crash UI. | Validate with **Zod** at the service boundary + enforce shapes in security rules where feasible. | High |
| 6.5 | **Money as JS number risks float** | Firestore numbers are doubles; large minor-unit math still ok within 2^53 but careless math drifts. | Rounding bugs in revenue. | Store integers, do all math in integers, format only at display. Lint against float money. | High |
| 6.6 | **Deletes are hard deletes → history loss** | Deleting a member nukes payment history (revenue!). | Revenue reports break; legal/audit gap. | **Soft delete** (`is_archived`) everywhere financial; never destroy payment docs. | High |

## 7. Security Risks

| # | Issue | Why | Impact | Solution | Severity |
|---|---|---|---|---|---|
| 7.1 | **Security Rules are the entire security model and were unspecified** | No service layer can protect you if rules are open. | Catastrophic data breach. | Write, test (emulator), and version Security Rules as a first-class artifact before launch. | Critical |
| 7.2 | **Member photos / ID cards via public Storage URLs** | Default Storage links can be guessable/over-shared → PII leak. | Member photos exposed. | Store under tenant path; use Storage Security Rules; serve via signed/short-lived URLs. | High |
| 7.3 | **ID card shareable link could expose live PII forever** | Earlier design used a token URL. | Stale token = permanent leak. | Signed, **revocable**, time-bounded token; card reads live status; minimal PII. | High |
| 7.4 | **Public contact form abuse / spam** | Unauthenticated writes to leads. | Spam floods dashboard; cost. | Rate limit + App Check + honeypot/captcha; write leads via a Cloud Function, not direct client write. | High |
| 7.5 | **Firebase App Check not mentioned** | Without it, anyone can hit your Firestore/Functions directly. | Quota abuse, scraping. | Enable **App Check** on Firestore/Storage/Functions. | High |
| 7.6 | **Secrets / env in client bundle** | Next.js exposes `NEXT_PUBLIC_*`. Firebase web config is public (ok), but server keys must not leak. | Leaked admin credentials = total compromise. | Admin SDK only in server/Functions; never ship service-account keys to client. | Critical |
| 7.7 | **No rules for member self-access scope** | Member portal could read others. | Privacy breach. | Rule: member can read only `members/{their_id}` and own card. | Critical |

## 8. Scalability Risks

| # | Issue | Why | Impact | Solution | Severity |
|---|---|---|---|---|---|
| 8.1 | **Dashboard counts by reading all docs** | No COUNT in Firestore. | Cost + latency grow with members. | Aggregate counter docs maintained on write. | High |
| 8.2 | **Weekly report scans whole collections per gym** | Aggregation in app code. | Slow/expensive as gyms grow. | Incremental counters + a scheduled Function that reads counters, not full scans; store snapshot in `report_run`. | High |
| 8.3 | **Composite indexes not planned** | Firestore requires explicit composite indexes for multi-field queries (e.g., status + expiry order). | Queries fail in prod with "needs index." | Pre-declare composite indexes (members by status+end_date, leads by status+created). | Medium |
| 8.4 | **Single Firebase project for all tenants** | Shared quotas/limits. | Noisy neighbor; hard to isolate cost per gym. | Acceptable for V1 + counters/caps; document migration path to project-per-large-tenant later. | Low |

## 9. Performance Risks

| # | Issue | Why | Impact | Solution | Severity |
|---|---|---|---|---|---|
| 9.1 | **Public site reading Firestore on every visit** | Marketing pages don't need live reads. | Slow LCP, read cost, poor SEO on mobile. | **ISR/SSG**: build public pages statically, revalidate on content change; serve from CDN. | High |
| 9.2 | **No pagination strategy for member lists** | Loading all members at once. | Slow on mobile; high reads. | Cursor pagination (`startAfter`), page size ~20; infinite scroll on mobile. | High |
| 9.3 | **No loading skeletons / error boundaries specified per screen** | Firestore latency varies on mobile networks. | Blank screens / infinite spinners (violates env-safety rule). | Mandatory skeleton + error + empty state per async surface; React Query with timeouts/retries. | High |
| 9.4 | **Images unoptimized** | Gallery/photos large. | Slow mobile. | `next/image`, WebP, responsive `sizes`. | Medium |

## 10. Admin (Owner) Workflow Friction

| # | Issue | Why | Impact | Solution | Severity |
|---|---|---|---|---|---|
| 10.1 | **"One-click renewal" not actually one-click in original flow** | It was a 2-step modal. | Slows the highest-frequency action. | Default renew = one tap (same plan, auto dates, cash). Advanced options collapsed. | High |
| 10.2 | **No quick global search** | Finding a member at the desk must be instant. | Slow service, queues. | Persistent search (name/phone/code) with debounce; phone is the primary key humans use. | High |
| 10.3 | **Expiring-members not an actionable worklist** | Just a count earlier. | Renewals missed = lost revenue. | "Expiring" tab = list with inline one-tap renew + WhatsApp reminder. | High |
| 10.4 | **Analytics undefined (new requirement)** | Owner vision now lists Analytics explicitly. | Owner can't see trends. | Define V1 analytics: revenue by month, joins vs expiries, renewal rate, lead conversion — all from counters, not scans. | Medium |

## 11. Member Workflow Friction

| # | Issue | Why | Impact | Solution | Severity |
|---|---|---|---|---|---|
| 11.1 | **Member login method unclear (email vs phone)** | Gym members rarely have/recall email; phone is universal in India. | Members can't log in → portal unused. | **Phone OTP** as primary auth (Firebase Phone Auth); email optional. | High |
| 11.2 | **Member onboarding to portal undefined** | Reception creates member offline; how does the member get access? | Members never activate portal. | On creation, generate portal access; member logs in with the phone reception entered; auto-links to `member_id`. | High |
| 11.3 | **Card unusable offline** | Bad signal at door. | Frustration. | PWA + cached card. | Medium |
| 11.4 | **No expiry visibility / renewal nudge in portal** | Members forget to renew. | Lower renewals. | Portal shows status, days left, "Renew via WhatsApp" CTA. | Medium |

## 12. Reception Workflow Friction (new dashboard)

| # | Issue | Why | Impact | Solution | Severity |
|---|---|---|---|---|---|
| 12.1 | **Offline registration + cash payment flow not designed** | Core stated requirement; desk has spotty wifi. | Can't register members → product fails its core promise. | Offline-tolerant add-member (queue writes, sync on reconnect via Firestore offline persistence); cash as default `payment_method_key`. | Critical |
| 12.2 | **Reception lacks a dedicated, minimal UI** | Reusing owner dashboard overwhelms staff. | Errors, slow training. | Stripped Reception Dashboard: Add / Search / Renew only, big buttons, mobile-first. | High |
| 12.3 | **Duplicate-member prevention at desk** | Same member re-registered. | Dirty data, double counting. | On add, check phone against existing members; warn before create. | High |
| 12.4 | **No daily cash reconciliation view** | Owner needs end-of-day cash total from reception. | Cash leakage. | "Today's collections" summary (cash/upi totals) for reception + owner. | High |

## 13. Public Website Conversion Issues

| # | Issue | Why | Impact | Solution | Severity |
|---|---|---|---|---|---|
| 13.1 | **WhatsApp CTA is the real conversion path but treated as secondary** | In India, leads convert via WhatsApp, not forms. | Lost leads. | Make WhatsApp the **primary**, persistent CTA (floating + per-plan), pre-filled message with plan name. Form is secondary. | High |
| 13.2 | **No lead capture on plan cards** | Visitor interested in a plan has no direct action. | Friction → drop-off. | Each plan card: "Enquire on WhatsApp" with plan context. | Medium |
| 13.3 | **No social proof above the fold on mobile** | Testimonials buried. | Lower trust → lower conversion. | Surface rating/testimonial snippet near hero on mobile. | Medium |
| 13.4 | **Page speed/SEO not guaranteed** | Live Firestore reads (see 9.1). | Poor mobile LCP → fewer conversions + worse ranking. | SSG/ISR + image optimization. | High |
| 13.5 | **No analytics/conversion tracking** | Can't measure what converts. | Blind optimization. | Lightweight, privacy-safe analytics events (WhatsApp click, form submit). | Low |

## 14. Reporting & Backup Weaknesses

| # | Issue | Why | Impact | Solution | Severity |
|---|---|---|---|---|---|
| 14.1 | **No backup strategy for Firestore** | Firestore is durable but not safe from *your own* bad writes/deletes. | One bad script wipes a gym's data; no restore. | Enable scheduled **Firestore export to GCS** (daily); document restore. | Critical |
| 14.2 | **Reports aggregate by full scans** | See 8.2. | Cost/slowness. | Counter-based incremental reports. | High |
| 14.3 | **Report delivery single-channel** | Email only; owners live on WhatsApp. | Reports ignored. | Email PDF/CSV + in-app + optional WhatsApp link to report. Email failure must fall back to in-app download (env safety). | Medium |
| 14.4 | **No per-tenant data export (owner self-backup)** | Trust/lock-in (also 1.7). | Sales objection. | One-click CSV export per gym. | Medium |

## 15. Renewal & Expiry Edge Cases

| # | Issue | Why | Impact | Solution | Severity |
|---|---|---|---|---|---|
| 15.1 | **Early renewal date math undefined** | Renew before expiry: extend from today or from current end? | Members lose/gain days → disputes. | Rule: new period starts at `max(today, current_end_date) + 1`; document it. | High |
| 15.2 | **Timezone/day-boundary errors** | Store UTC, gym in IST; "expires today" ambiguous. | Off-by-one expiry. | Store UTC; compute/display in gym timezone; expiry = end of local day. | High |
| 15.3 | **Freeze/pause breaks expiry** | No freeze handling (1.5). | Manual date edits corrupt data. | Freeze extends end date by frozen days; reserve fields now. | Medium |
| 15.4 | **Reminder timing not defined / could spam** | "Soft reminder" stated but no schedule. | Annoyed members or missed renewals. | Reminders at T-7, T-1, T+1 (configurable `renewal_reminder_days_before`); idempotent (don't double-send). | High |
| 15.5 | **Status recompute mechanism on Firestore** | No cron in Firestore by default. | Status goes stale (e.g., active→expired never flips). | **Scheduled Cloud Function** daily recomputes status + counters; also compute live in lists. | Critical |
| 15.6 | **Plan deleted while members hold it** | Hard delete breaks history. | Orphaned memberships. | Soft-deactivate plans (`is_active=false`); snapshots already protect history. | High |

## 16. Future Maintenance Problems

| # | Issue | Why | Impact | Solution | Severity |
|---|---|---|---|---|---|
| 16.1 | **No migration story for schemaless Firestore** | Field shapes evolve; old docs lack new fields. | Crashes reading old members. | Version docs (`schema_version`); defensive reads with defaults; backfill scripts. | High |
| 16.2 | **Denormalization without a single owner** | Multiple write paths → drift (6.2). | Endless bug-chasing. | Centralize all derived writes in Cloud Functions/services. | High |
| 16.3 | **Security Rules untested = silent regressions** | Rules are code but often unmanaged. | Breach or lockout on deploy. | Rules unit-tested in emulator in CI. | High |
| 16.4 | **Attendance bolted on later breaks assumptions** | Must be optional from day one. | Refactor pain. | Design `attendance_enabled` flag + isolated module boundary now (even if unbuilt). | Medium |
| 16.5 | **Solo-dev over-reliance on Firebase lock-in** | Hard to leave Firestore later. | Strategic risk. | Keep business logic in a service layer (not in components/rules); treat Firestore as a swappable data adapter. | Medium |
| 16.6 | **Env safety not encoded as a pattern** | Missing Firebase/env config crashes app at boot. | White-screen on misconfig. | Central config loader with validated fallbacks; feature flags degrade gracefully; never throw at import time. | High |

---

## Audit Severity Summary

| Severity | Count (approx) | Examples |
|---|---|---|
| **Critical** | 16 | NoSQL re-model, security rules, tenant isolation, renewal transactions, status cron, backups, offline reception, member self-access |
| **High** | 30 | Counters, snapshots, member auth, one-click renew, WhatsApp-first, App Check, soft deletes, env safety pattern |
| **Medium** | 15 | Discounts, receipts, analytics scope, indexes, dedupe |
| **Low** | 4 | Project-per-tenant later, conversion analytics, trainer-member link |

**Verdict:** The product vision is sound and sellable, but the **data architecture must be re-modeled for Firestore**, and **security rules + offline + counters + backups** are non-negotiable before launch. None of these block the mandatory rules — all are preserved below.

---

# Recommended V1 Corrections

This section supersedes conflicting parts of the original blueprint.

## C0. Firestore-Native Re-Model (resolves the root cause)
Adopt **path-based multi-tenancy with denormalization + counters**:

```
gym_profiles/{gym_profile_id}
  ├─ (gym fields: gym_slug, gym_display_name, branding, whatsapp, timezone,
  │   default_currency_code, attendance_enabled, gym_status_key, schema_version)
  ├─ settings/{singleton}            (reminder days, report recipients, flags)
  ├─ counters/{summary}             (active_count, expiring_count, lead_new_count,
  │                                  revenue_month_minor, member_seq ...)
  ├─ members/{member_id}
  │     ├─ (member_display_name, member_code, member_phone, member_photo_url,
  │     │   member_join_date, member_status_key, is_archived, schema_version,
  │     │   current_membership_summary { plan_name_snapshot, membership_end_date,
  │     │     member_status_key, amount_due_minor })
  │     └─ memberships/{membership_id}   (period + payment snapshots)
  ├─ membership_plans/{plan_id}
  ├─ leads/{lead_id}
  ├─ trainers/{trainer_id}
  ├─ gallery_items/{gallery_item_id}    (image_title, area_category,
  │                                       is_hero_gallery, is_active)
  ├─ testimonials/{testimonial_id}      (testimonial_text, member_since_year,
  │                                       member_tier_key)
  ├─ report_runs/{report_run_id}
  ├─ activity_logs/{log_id}
  └─ attendance/{...}                    (only if attendance_enabled)

Top-level (platform):
  gym_slug_index/{gym_slug} -> { gym_profile_id }   (global uniqueness)
  platform_subscriptions/{gym_profile_id}           (SaaS billing/tier)
```

**Rules applied:** all monetary fields are integer minor units (`price_monthly_minor`, `joining_fee_minor`, `renewal_amount_minor`, `amount_paid_minor`, `amount_due_minor`, `discount_minor`); explicit naming (`gym_profile_id`, `gym_slug`, `member_display_name`); CMS required fields present on gallery & testimonials.

## C1. Membership / Payment Model (corrected)
Each `memberships/{id}` document snapshots everything financial:
- `plan_id`, `plan_name_snapshot`, `plan_duration_key`, `plan_duration_days`
- `membership_start_date`, `membership_end_date` (UTC, computed in gym timezone)
- `price_amount_minor`, `joining_fee_minor`, `discount_minor`, `discount_reason`
- `amount_paid_minor`, `amount_due_minor`, `payment_method_key` (cash/upi/card)
- `payment_status_key` (paid/partial/pending)
- `created_by_app_user_id`, `created_at`
Renewal = transactional batch: create membership → update member `current_membership_summary` → bump `counters` → write `activity_log`.

## C2. Roles & Permission Matrix (corrected — 4 roles)
| Action | platform_admin | owner | reception | member |
|---|---|---|---|---|
| Cross-tenant support | ✅ | ❌ | ❌ | ❌ |
| Settings / branding | ❌ | ✅ | ❌ | ❌ |
| Plans + pricing | ❌ | ✅ | ❌ | ❌ |
| Add/Edit member | ❌ | ✅ | ✅ | ❌ |
| Delete/archive member | ❌ | ✅ | ❌ | ❌ |
| Renew membership | ❌ | ✅ | ✅ | ❌ |
| Search members | ❌ | ✅ | ✅ | ❌ |
| View reports/analytics | ❌ | ✅ | (daily cash only) | ❌ |
| Manage leads | ❌ | ✅ | ✅ (view/contact) | ❌ |
| CMS (gallery/testimonials/trainers) | ❌ | ✅ | ❌ | ❌ |
| View own card/status/profile | ❌ | ❌ | ❌ | ✅ |

Enforced in **both** UI and Firestore Security Rules via custom claims `{ gym_profile_id, role }`.

## C3. Auth Strategy (corrected)
- **Owner/Reception:** email/password or phone (Firebase Auth) + custom claims for tenant + role (set by a Cloud Function on invite).
- **Member:** **Phone OTP** primary, linked to a single `member_id`; rules restrict to self.
- **Platform admin:** custom claim, never granted to tenants.

## C4. Security Rules (now a first-class, tested artifact)
- Default deny.
- Tenant docs readable/writable only if `request.auth.token.gym_profile_id == {gym_profile_id}` and role permits the action.
- Members limited to their own member doc + card.
- Public content (`is_active==true` gallery/testimonials/plans/trainers) served via **SSR/Cloud Function with Admin SDK** so client rules stay locked; leads/members/payments never publicly readable.
- Rules unit-tested in the **Firebase Emulator** in CI.

## C5. Counters, Status & Scheduled Jobs
- **Aggregate counters** per gym maintained transactionally on every write (no full-collection scans for dashboards).
- **Daily scheduled Cloud Function:** recompute `member_status_key` (active/expiring_soon/expired), refresh counters, send renewal reminders (T-7/T-1/T+1, idempotent).
- **Weekly scheduled Cloud Function:** build `report_run` snapshot from counters; deliver email (PDF+CSV) with **in-app download fallback**.

## C6. Backups & Data Safety
- Scheduled **Firestore export to Cloud Storage** (daily) + documented restore.
- **Soft deletes** (`is_archived`) for anything financial; never destroy payment docs.
- Per-tenant **CSV export** for owner self-backup.

## C7. Mobile-First Architecture (enforced)
- Tables → **mobile card lists** below `lg:`; `<table>` only on large screens.
- **Bottom tab nav** on mobile (Owner & Reception), sidebar on desktop.
- Forms: single-column, multi-step, 44px+ targets, sticky CTA.
- Member portal = **PWA** with cached offline card.
- Locked breakpoint QA: 360 / 390 / 430 / 768 / 1024 / 1440; **zero horizontal scroll**.
- Public site: **SSG/ISR + `next/image`** for fast mobile conversions.

## C8. Reception Dashboard (new, minimal)
Three primary actions, mobile-first: **Add member**, **Search/Renew**, **Today's collections** (cash/upi totals). Offline-tolerant via Firestore offline persistence; duplicate-phone check on add; cash default.

## C9. Public Site Conversion (WhatsApp-first)
- Persistent floating WhatsApp CTA + per-plan "Enquire on WhatsApp" with pre-filled plan context.
- Contact form secondary, written via Cloud Function (App Check + rate limit + honeypot).
- Social proof near hero on mobile.

## C10. Environment & Integration Safety (pattern)
- Central **validated config loader** with safe fallbacks; **never throw at import**.
- Every integration (WhatsApp, email, storage, OTP): fallback + graceful degradation + loading + error state; **no infinite loaders** (timeouts + retry + error boundary).
- **App Check** on Firestore/Storage/Functions; Admin SDK server-only.

## C11. Attendance as Optional Module
- `attendance_enabled` flag on `gym_profile`. When `false`: feature hidden entirely, no nav, no workflow dependency, no reads. Module boundary isolated so it can ship later without refactor.

---

# Final Improved V1 Architecture Blueprint (Firestore Edition)

### System shape
```
Browsers (mobile-first)
 ├─ Public site (SSG/ISR via Next.js on Vercel, CDN, next/image)
 ├─ Owner dashboard (auth: owner)        ┐
 ├─ Reception dashboard (auth: reception)│  Next.js app (TS + Tailwind)
 └─ Member portal/PWA (auth: member)     ┘
        │ thin API/route handlers + service layer (business logic, Zod)
        ▼
 Firebase: Auth (claims: gym_profile_id, role) · Firestore (path-tenant + counters)
           Storage (tenant paths, signed URLs) · App Check
 Cloud Functions: renewal txns · daily status/reminders · weekly reports · slug index · lead intake
 Scheduled: Firestore export → GCS (backups)
```

### Tech stack (confirmed)
Next.js · TypeScript · Tailwind · Firebase Auth · Firestore · Firebase Storage · Cloud Functions · Vercel. Priorities: **speed, simplicity, reliability, sellability.**

### Surfaces & primary screens
- **Public:** Hero · Plans (WhatsApp CTA) · Trainers · Gallery · Testimonials · Contact · floating WhatsApp.
- **Owner:** Dashboard · Analytics · Members · Plans · Renewals (expiring worklist) · Leads · Trainers · Gallery · Testimonials · Reports · Settings.
- **Reception:** Add member · Search/Renew · Today's collections.
- **Member:** Login (phone OTP) · Digital card (offline-cached) · Status/expiry · Profile.

### Mandatory rules — compliance check ✅
- Explicit naming: `gym_profile_id`, `gym_slug`, `member_display_name` ✅
- Money: integer minor units only (`price_monthly_minor`, `joining_fee_minor`, `renewal_amount_minor`, `amount_paid_minor`) ✅
- CMS fields: testimonials (`testimonial_text`, `member_since_year`, `member_tier_key`), gallery (`image_title`, `area_category`, `is_hero_gallery`, `is_active`) ✅
- Mobile-first: card fallbacks, bottom nav, PWA, locked breakpoints, no horizontal scroll ✅
- Env safety: validated config + fallbacks + loading/error states, no crashes/infinite loaders ✅

---

# Implementation Planning (next phase — no code yet)

### Resolved-before-code gate (all Critical items)
1. ✅ Firestore data model finalized (C0/C1)
2. ✅ Roles + claims + permission matrix (C2/C3)
3. ✅ Security Rules design + emulator test plan (C4)
4. ✅ Renewal transaction + counters + status cron (C5)
5. ✅ Backups + soft deletes (C6)
6. ✅ Offline reception + mobile patterns (C7/C8)
7. ✅ Env-safety pattern (C10)

### Proposed build milestones
| M | Scope | Output |
|---|---|---|
| **M0** | Project scaffold, config loader, Firebase init, App Check, design tokens, mobile shell (bottom nav + sidebar) | Running shell, env-safe |
| **M1** | Auth + custom claims + roles + tenant onboarding + slug index | Login per role |
| **M2** | Security Rules + emulator tests | Verified isolation |
| **M3** | Plans (money minor units) + members + member code counter | Reception add/search |
| **M4** | Memberships/renewals (transactions) + status cron + counters | One-tap renew + expiry |
| **M5** | Owner dashboard + analytics from counters | Live metrics |
| **M6** | Leads + public contact intake (Function) | Lead pipeline |
| **M7** | Public site (SSG/ISR) + CMS (gallery/testimonials/trainers) + WhatsApp-first | Sellable site |
| **M8** | Member portal PWA + digital card (offline) | Member access |
| **M9** | Weekly reports + email/CSV/PDF + backups export | Automated reporting |
| **M10** | Polish: skeletons, micro-interactions, full breakpoint QA, fallback hardening | Launch-ready |

---

## Decision needed before I "start work"
Two choices materially change implementation and are worth confirming so I build the right thing first:

1. **Where to start coding** — M0 scaffold first (recommended), or a specific module you want to see prototyped (e.g., the renewal flow or the public site)?
2. **Member auth method** — Phone OTP (recommended for India) vs email/password. Affects Firebase setup and the member portal.

(Defaults if you don't specify: start at **M0 scaffold**, member auth via **Phone OTP**.)
