# GymOS — Post-M6 Full Architecture & Codebase Audit

> Reviewer stance: senior engineer gating a production SaaS launch. Nothing is
> assumed correct. Findings are evidence-based against the actual code in
> `gymsaas/` (~7,300 LOC, 79 passing tests). Severity: **Critical / High / Medium / Low**.

**Headline:** the architecture is sound and the financial core is genuinely strong (immutable records, derived analytics, tenant isolation tested). But there is **one Critical launch-blocker** (onboarding redirect loop), several **High** gaps that real gym owners will hit on day one (no Settings/CMS, no staff invite, gym-suspension not enforced, App Check not verified on the public endpoint), and some scope that should be frozen or cut. Details below.

---

## Severity Summary

| # | Area | Top finding | Severity |
|---|---|---|---|
| 1 | Security | App Check not verified on public intake; cron secret optional | High |
| 2 | Firestore rules coverage | Good; membership `update` allowed to owner breaks immutability claim | High |
| 3 | Multi-tenant isolation | Solid + tested; gym **suspension not enforced** | High |
| 4 | Data integrity | Onboarding **claims/cookie race → redirect loop** | **Critical** |
| 5 | Mobile UX | Strong; a few tap-target / overflow nits | Low |
| 6 | Read/write cost | Name search reads up to 200 docs/keystroke-batch | Medium |
| 7 | Query/index alignment | Mostly aligned; 1 unused index, 1 risky `in` query | Medium |
| 8 | Code duplication | API guard/error boilerplate repeated ~13× | Medium |
| 9 | Dead code | `ResponsiveList`, `addDaysIso` (time.ts), exports unused | Low |
| 10 | Folder structure | Clean; minor `modules` vs `lib/services` split | Low |
| 11 | Maintainability | Good; currency hardcoded in several UIs | Medium |
| 12 | Test coverage gaps | No tests for plan/member services, onboarding, rate limiter | High |
| 13 | Performance | Dashboard does 2 sequential awaits; fine. Status cron unbounded | Medium |
| 14 | Accessibility | Emoji-only icons, select-as-action, focus traps missing | Medium |
| 15 | Env-safety | Excellent and consistent | ✅ Low |
| 16 | Error/loading states | Consistent; public form lacks field-level errors | Low |
| 17 | Dashboard workflows | Strong | Low |
| 18 | Reception workflows | No daily collections view; no dedicated simplified surface | Medium |
| 19 | Member workflows | **Member portal does not exist** (role defined, no UI) | High |
| 20 | Public website | **No public site/CMS**; only a bare contact form | High |

---

## 1. Security

**1.1 — App Check is initialized client-side but never *verified* on the public endpoint. (High)**
`initAppCheckSafely()` runs in the browser, but `/api/public/[gym_slug]/contact` never checks an App Check token (confirmed: "NO app check verification in public route"). *Why it matters:* App Check only protects you if the server enforces it. *Impact:* the public endpoint is scriptable; honeypot + time-trap + rate-limit help, but a determined attacker bypasses all three (they're client-supplied or IP-based). *Fix:* verify the App Check header server-side in the public route (and ideally on all API routes) via the Admin SDK; treat missing/invalid as soft-fail with the rate limiter still applied. Keep env-safe (no key configured → skip, log once).

**1.2 — `CRON_SECRET` is optional; if unset, the only protection is owner auth. (Medium)**
`recompute-status` and `analytics/rebuild` fall back to owner-only when no secret is set — acceptable, but there's no guard against an owner hammering the expensive rebuild. *Fix:* rate-limit rebuild per gym (e.g., 1/min) reusing the existing limiter; document that `CRON_SECRET` is required in production.

**1.3 — Session cookie lifetime 5 days, no revocation surface. (Low)**
Acceptable for V1; note for V2 (staff offboarding should revoke). Today deactivating a staff user doesn't kill an active session.

**1.4 — IP from `x-forwarded-for` is spoofable. (Low)**
Fine behind Vercel (it sets a trustworthy XFF), but document the assumption; per-gym/day cap is the real backstop.

## 2. Firestore Rules Coverage

**2.1 — Membership `update` is allowed to owner/platform — contradicts the "immutable history" guarantee. (High)**
`firestore.rules` allows `members/{id}/memberships/{id}` update for owner. The whole M4 promise is immutability; an owner editing a past paid period would silently break analytics reconciliation (the rollup wouldn't match). *Impact:* a curious/ malicious owner can rewrite revenue history; reconciliation tests would then fail in prod, not CI. *Fix:* disallow client `update`/`delete` on memberships entirely (server Admin SDK already bypasses rules for the rare correction path). Make the rule `allow update, delete: if false;` (platform_admin via Admin SDK only).

**2.2 — Rules don't validate tenant-id on writes (only path + role). (Medium)**
A reception user could write a member doc with `gym_profile_id` of *another* tenant in the body (the path is theirs, the field lies). Analytics/rebuild filter by `gym_profile_id` field → poisoned aggregation. *Fix:* add `request.resource.data.gym_profile_id == gym_profile_id` to member/lead/membership create rules.

**2.3 — No `create` validation that `is_archived`/status fields exist. (Low)**
Minor; service layer sets them. Defense-in-depth only.

## 3. Multi-Tenant Isolation

**3.1 — `gym_status_key = suspended` is written but never enforced. (High)**
Confirmed: only set at onboarding, never read in any guard. *Impact:* you cannot actually suspend a non-paying gym — they keep full access. For a SaaS you intend to sell, this is a billing-enforcement hole. *Fix:* `requireStaff`/`requireOwner` should reject when the gym is suspended; public site/intake should 404 when suspended. One extra cached read or fold into the claims refresh.

**3.2 — Isolation itself is strong** (path-based + claims + 12 cross-tenant tests). ✅

## 4. Data Integrity

**4.1 — CRITICAL: Onboarding sets custom claims, but the existing session cookie was minted *before* claims existed → redirect loop.** 
Evidence: `authClient` mints the session cookie from `getIdToken(true)` at login (no claims yet). Onboarding calls `/api/onboarding` which `setCustomUserClaims(...)` server-side, then the page does `router.push("/app")`. But `/app/layout.tsx` reads claims **from the session cookie**, which still has none → redirects to `/onboarding` → which sees claims via `fetchClaims()` (also reads the *cookie*, still stale) … *Why it matters:* this is the very first thing a new customer does. *Real-world impact:* **new owners can't get into their dashboard after creating a gym** — looks completely broken. *Fix:* after onboarding, force a token refresh and **re-mint the session cookie**: client calls `currentUser.getIdToken(true)` then re-POSTs `/api/auth/session` before navigating. (The onboarding service even has a comment about "re-login to retry" — that confirms the gap.) Add an integration/e2e test for the full signup→onboarding→dashboard path.

**4.2 — `member.create` / edit / archive write no `activity_log`. (Medium)**
Only renewal logs to the audit trail. The audit (1.8 in the original) justified the log for fraud/accountability with multiple staff + cash. Member edits and deletes are exactly what owners dispute ("who deleted this member?"). *Fix:* log create/edit/archive/lead-status in the same transaction pattern already used by renewal.

**4.3 — Analytics rollup vs. records can drift if a membership is ever edited (see 2.1). (High, same root)** Fixing 2.1 closes this.

**4.4 — Money snapshots, transactional renewal, immutable periods — excellent.** ✅

## 5. Mobile UX (360 / 390 / 430)

**5.1 — Lead status change uses a `<select>` as the primary action. (Medium, also a11y)** On a 360px phone a native select is fine, but it's both the status display and the mutator with no confirmation — easy mis-taps change pipeline state. *Fix:* keep select but debounce + toast; or a small action sheet.
**5.2 — Filter chip row / charts rely on horizontal scroll** — acceptable and intentional, but add a subtle fade/scroll affordance so users know it scrolls.
**5.3 — Otherwise strong:** bottom nav, bottom-sheet forms, FAB, `overflow-x:hidden`, 44px targets. ✅

## 6. Firestore Read/Write Costs

**6.1 — Member name search reads up to 200 docs per query. (Medium)** `searchMembers` fetches `limit(200)` then filters in memory for name/code. At a 5,000-member gym with reception searching by name constantly, this is 200 reads/search × many searches/day = real cost + latency. Phone search is cheap (range query). *Fix (V1, cheap):* index lowercased name prefix or store `search_terms` array + `array-contains` (1 small index). Or restrict the default UX to phone/code search (the human keys reception actually uses) and gate name-search.
**6.2 — Onboarding/public slug resolve = 2 reads (index doc + profile).** Fine; the profile read is needed for suspension/published checks.
**6.3 — Counters/rollup design keeps dashboard + analytics at O(1).** ✅

## 7. Query / Index Alignment

**7.1 — Declared index `members(member_status_key, created_at desc)` appears unused. (Low)** The list query orders by `created_at` only with `is_archived ==`; the expiring query uses `member_status_key in [...]` then sorts in memory. *Fix:* drop the unused composite or wire the list to use it; keep indexes matching real queries.
**7.2 — `listExpiringMembers` uses `where in ["expiring_soon","expired"]` + in-memory sort. (Medium)** Works, but `in` + later pagination won't scale and needs the right single-field index. For V1 volumes fine; document the ceiling.
**7.3 — `analytics rebuild` collection-group index is declared and matches.** ✅

## 8. Code Duplication

**8.1 — API route guard + error-envelope boilerplate repeated in ~13 routes. (Medium)** Every route hand-rolls `if (!guard.ok) return NextResponse.json(...httpStatusForError...)`. *Impact:* easy to get an inconsistent response or forget a check. *Fix:* a tiny `withStaff(handler)` / `withOwner(handler)` wrapper that injects `{gym_profile_id, role, user}` and standardizes errors. ~13 routes shrink and become uniform.
**8.2 — "Preview mode banner" JSX duplicated across 5 pages. (Low)** Extract `<PreviewBanner/>`.
**8.3 — Date formatting (`toLocaleDateString("en-IN", …)`) copied in 4 files. (Low)** Move to `lib/utils/time` (`formatDateShort`).

## 9. Dead Code

**9.1 — `ResponsiveList` component is never used. (Low)** Members/leads use card lists directly. Either delete it or note it's reserved; right now it's dead weight contradicting "no overengineering."
**9.2 — `time.ts addDaysIso` duplicates `renewal.logic addDaysIso`. (Low)** Two implementations of the same thing; keep one.
**9.3 — Re-exports like `export { COLLECTIONS }` from services are unused. (Low)** Trim.
**9.4 — `member.schema` has `member_photo_url` but no upload path exists yet.** Field is harmless but advertises a feature not built.

## 10. Folder Structure
Clean and conventional (`app` / `components` / `lib` / `modules`). **10.1 (Low):** the split between `lib/services/*.service.ts` and `modules/*/use*.ts` is good, but `modules` also holds presentational components (`BarChart`, `LeadCard`) while `components/ui` holds others — slightly arbitrary. Acceptable for V1; document the rule ("feature-specific UI in modules, generic in components/ui").

## 11. Maintainability

**11.1 — Currency is hardcoded to `appConfig.defaultCurrency` in several client pages (analytics, plans, members, renew). (Medium)** The data model supports per-gym currency, but the UI ignores it and uses the env default. A non-INR gym would see wrong symbols. *Fix:* thread `default_currency_code` from a gym-context provider (server-resolved once), not the env constant.
**11.2 — `RenewSheet` recomputes money in the client with `Math.round(x*100)`. (Medium)** This bypasses `toMinor()` and assumes 2-decimal currency in the UI. It's display-only (server recomputes authoritatively), but it's a latent Rule-2 violation pattern. *Fix:* use `toMinor`/`formatMoney` helpers everywhere.

## 12. Test Coverage Gaps (High overall)
Strong where it counts (rules 42, renewal/analytics/lead logic + integration). **Missing:**
- **Onboarding flow** (would have caught the Critical 4.1). (High)
- **Plan service & member service** (create/transaction/dup-phone/pagination). (High)
- **Rate limiter** window behavior. (Medium)
- **Status recompute** transitions + counter rebuild. (Medium)
- **Money helpers** (`toMinor/toMajor/formatMoney` rounding). (Medium)
- No component/RTL tests at all (acceptable for V1 if e2e covers smoke).

## 13. Performance Bottlenecks
**13.1 — `recomputeGymStatuses` loads ALL non-archived members into memory. (Medium)** At 5,000+ members this is one big read + in-memory loop in a single function invocation; risk of timeout/memory on very large tenants. *Fix:* paginate the scan (cursor) or shard by status; it's a daily job so latency is tolerable but bound it.
**13.2 — Dashboard summary issues 2 reads via `Promise.all` — fine.** ✅

## 14. Accessibility
**14.1 — Icons are emoji-only with no text alternative in nav/stat tiles. (Medium)** Screen readers announce emoji inconsistently. Add `aria-hidden` to decorative emoji and ensure labels carry meaning (mostly they do).
**14.2 — Bottom sheet lacks focus trap + initial focus + `aria-modal` focus management. (Medium)** Keyboard/AT users can tab behind the sheet. *Fix:* trap focus, focus first field on open, restore on close.
**14.3 — Color-only status (badges) — add text (already present) ✅; verify contrast of muted text on dark (some `--muted` on `--surface` may fail WCAG AA). (Low)**

## 15. Env-Safety Compliance
**Excellent and consistent.** Every Firebase getter returns null when unconfigured; services return `not_configured`; UI shows preview/Config states; no throw-on-import; React Query retries/timeouts prevent infinite loaders. ✅ One nit (Low): `rateLimit` fails *open* when DB is down — correct for UX, but document it.

## 16. Error / Loading States
Consistent skeleton/empty/error across pages. **16.1 (Low):** public contact form shows a single error string, not field-level validation (server returns first Zod issue). Fine for V1; could map field errors later.

## 17. Dashboard Workflows
Strong: live counters, expiring worklist with one-tap renew, leads tile tap-through, owner refresh. **17.1 (Low):** "Refresh statuses" is a manual button doing a full recompute — fine, but should be rate-limited (ties to 1.2) and hidden once a real scheduler runs.

## 18. Reception Workflows
**18.1 — No "today's collections" view. (Medium)** The original audit (C8/12.4) called this out as a core cash-gym need and it's deferred — acceptable per locked scope, but reception currently shares the owner dashboard (revenue visible). *Decide:* either hide revenue from reception or add the simple daily-cash view. Right now reception can see monthly revenue on the dashboard, which many owners will NOT want. (High if you consider revenue-privacy; I rate **Medium**.)
**18.2 — Reception sees the full dashboard incl. revenue tile. (Medium → privacy)** `dashboard/summary` is `requireStaff` and the page shows revenue to both roles. *Fix:* gate the revenue tile + analytics to owner only (analytics route already is owner-only; dashboard tile is not).

## 19. Member Workflows
**19.1 — The Member role and rules exist, but there is NO member portal UI, login, or digital card. (High)** Confirmed: no `/member`, `/card`, or portal routes. The product vision lists "Member: login, digital card, status, expiry, profile." Today a member can't do anything. *Decision needed:* this is M8 — fine to defer, but it means "digital membership cards," a headline selling feature, is **not in the product yet**. Don't market it until M8.

## 20. Public Website Conversion Readiness
**20.1 — There is no public gym website. (High)** Only `/g/[gym_slug]/contact` (a bare form) and a generic marketing `/` placeholder exist. No hero, plans, trainers, gallery, testimonials, WhatsApp CTA, SEO. *Impact:* the "luxury public website" + WhatsApp-first conversion — a primary differentiator and lead source — **does not exist yet** (it's M7). The contact form isn't even linked from a real site. This is the correct next milestone; flagging that conversion readiness is currently 0.
**20.2 — `public_site_is_published` is stored but nothing renders a site or checks it. (High, same as M7).**

---

## Overengineering / Cut / Postpone / Missing

### Overengineered for V1 (simplify or remove)
- **`ResponsiveList`** (dead) — remove; card lists won.
- **Two `addDaysIso` implementations** — consolidate.
- **Per-tenant `analytics rebuild` endpoint exposed to owners** — keep the function, but it's really an ops/cron tool; don't surface a user button beyond the existing "Rebuild" unless rate-limited.
- **Duplicate route boilerplate** — collapse via a guard wrapper (reduces ~150 lines).

### Should be REMOVED from V1
- **Member `member_photo_url` field surfaced** without an upload path — either build minimal upload (M8) or remove the field from forms to avoid implying it works.
- **Reception visibility of monthly revenue** — remove from reception view (privacy).

### Should be POSTPONED to V2 (confirm freeze)
- Member portal + digital cards (currently M8 — keep, but it's V1-headline; decide if V1 can ship without it).
- Daily cash reconciliation (already deferred).
- Staff invite/management UI (currently only owner is auto-created — **but see "missing" below**).
- Name full-text search (use phone/code in V1).
- SMS/WhatsApp Business automation, custom domains, online payments.

### MISSING V1 features real gym owners need (gaps in current build)
1. **Onboarding actually working** (Critical 4.1) — non-negotiable.
2. **Settings page** — owners cannot edit branding, WhatsApp number, reminder days, or report recipients via UI (data model + rules exist; no screen). **High.**
3. **Staff (reception) invite** — an owner cannot create a reception login today; only the owner account exists. A gym with a front desk can't use the reception role at all. **High.**
4. **Gym suspension enforcement** (billing lever) — **High.**
5. **Public site (M7)** — the lead engine. **High (next milestone).**
6. **Member portal/cards (M8)** — **High (headline feature).**

---

# Final V1 Scope Freeze

### ✅ STAYS in V1 (must ship, in this order)
1. **Fix Critical onboarding loop (4.1)** + re-mint session cookie + test. *(do before M7)*
2. **Membership immutability hard-lock in rules (2.1/4.3)** + tenant-id write validation (2.2). *(do before M7)*
3. **Gym suspension enforcement (3.1)** in guards + public routes.
4. **Settings page** (branding, WhatsApp number, reminder days, report recipients).
5. **Reception invite** (owner creates reception staff) + **hide revenue from reception** (18.2).
6. **App Check verification on public intake (1.1)** + rebuild rate-limit (1.2).
7. **M7 Public website** (hero, plans, trainers, gallery, testimonials, contact, WhatsApp-first, SSG/ISR, suspension/published checks).
8. **M8 Member portal + digital card** (phone OTP/email, status, expiry, shareable card).
9. **M9 Weekly reports + owner CSV/Excel export + Firestore backups.**
10. Existing core (auth, plans, members, renewals, expiry, analytics, leads). ✅
11. **Hardening pass:** audit-log member create/edit/archive (4.2), per-gym currency in UI (11.1), money helpers in RenewSheet (11.2), focus-trap sheets (14.2), guard wrapper + dedupe (8.1), bound status-recompute scan (13.1), add missing service/onboarding tests (12).

### ➡️ MOVES to V2
- Full-text name search / search index (V1 = phone + code).
- Daily cash reconciliation & shift reports.
- Staff activity-log **viewer UI** (write the logs in V1; build the viewer in V2).
- SMS / WhatsApp Business API automation, custom domains/subdomains.
- Online payments + auto-renew billing (V1 records cash/UPI/card manually).
- Member self-service beyond card/status (bookings, etc.).
- Wallet passes / QR for the digital card.

### 🚫 NEVER build (anti-bloat, reaffirmed)
- Workout tracking, diet plans, AI coaching, wearables, social feed.
- Attendance as a *core* feature (keep the `attendance_enabled` flag only; build the module **only** if a paying customer demands it).
- Trainer payroll / full accounting / GST invoicing engine.
- Per-member chat/messaging inbox, push-notification center.
- A full CRM (leads stay a simple pipeline, per the M6 decision).

---

## Recommended pre-M7 work order (gating)
**Blockers first (do not start M7 until 1–2 are fixed):**
1. Onboarding session re-mint (Critical).
2. Membership immutability + tenant-id write rules (High, data integrity).

**Then high-value, low-cost hardening (can batch):** suspension enforcement, App Check verify, reception revenue hiding, guard wrapper + dead-code removal, member audit logging, onboarding/service tests.

**Then proceed to M7 (public site)** — the biggest revenue/conversion lever — followed by M8 (member portal/cards) and M9 (reports/backups).

*End of audit. No new features were written during this review.*
