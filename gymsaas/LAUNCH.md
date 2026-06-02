# GymOS — V1 Launch Readiness (M10)

Launch-focused hardening: mobile QA, accessibility, UX polish, production config,
deployment, and operational safety. **No new features.**

---

## 1. Final architecture summary

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Firebase (Auth /
Firestore / Storage / App Check) · Vercel. Modular monolith; service layer owns
business logic; API routes stay thin; Firestore rules are defense-in-depth.

**Tenancy:** path-based multi-tenant — everything under
`gym_profiles/{gym_profile_id}/…`. Isolation enforced by custom claims
(`gym_profile_id`, `role`, `member_id`) + default-deny security rules.

**Roles:** `owner`, `reception`, `member`, `platform_admin`.

**Financial integrity:** `memberships` (immutable, snapshotted) are the **single
source of truth**. Analytics rollups + weekly reports + CSV exports are all
**derived/read-only** views — never a parallel ledger. Money is integer minor
units end-to-end.

**Surfaces:** owner/reception dashboard, members, plans, renewals, leads,
analytics, reports, settings, CMS (trainers/gallery/testimonials); public
per-gym website (`/g/[slug]`) + contact; member portal + digital card
(`/g/[slug]/member`).

**Background work:** daily status recompute + weekly report (scheduled via
`CRON_SECRET`); native Firestore→GCS backups (infra, see `BACKUPS.md`).

**Quality:** 114 automated tests (Firestore/Auth emulator), clean TypeScript +
ESLint + production build.

---

## 2. Production deployment checklist

### A. Pre-deploy (config & build)
- [ ] `npm run check:config` passes with the production env loaded (all required ✅).
- [ ] `npm run lint` clean · `npx tsc --noEmit` clean · `npm run build` succeeds.
- [ ] `npm run test:rules` green (Firestore + Auth emulator).
- [ ] Firebase web + Admin env vars set in Vercel (Admin private key as a secret).
- [ ] `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` set; App Check registered (reCAPTCHA v3) and **enforced** on Firestore/Storage in the Firebase console.
- [ ] `CRON_SECRET` set.

### B. Firebase project
- [ ] Deploy rules: `firebase deploy --only firestore:rules,storage:rules`.
- [ ] Deploy indexes: `firebase deploy --only firestore:indexes` (wait until *Enabled*).
- [ ] Auth providers enabled: Email/Password + Phone (OTP). Add prod domain to authorized domains.
- [ ] Phone Auth quota/billing reviewed; reCAPTCHA configured for phone.
- [ ] Seed your `platform_admin` claim on the support account (out-of-band script).

### C. Schedulers (Cloud Scheduler → HTTPS, `Authorization: Bearer <CRON_SECRET>`)
- [ ] Daily `POST /api/cron/recompute-status` per active gym (status + counters self-heal).
- [ ] Weekly `POST /api/reports/generate` per active gym.
- [ ] Backups: enable native Firestore scheduled export per `BACKUPS.md`; verify first export + one test restore.

### D. Post-deploy smoke (run on a real 360–430px device)
- [ ] Owner signup → onboarding → lands on dashboard (no redirect loop).
- [ ] Create plan → add member → **one-tap renew** → dashboard/analytics update.
- [ ] Reception login sees members/renewals but **no revenue**; cannot edit plans/settings.
- [ ] Public site renders (after Publish), WhatsApp + per-plan CTAs work; contact form creates a lead.
- [ ] Member portal: phone OTP → digital card shows status/expiry.
- [ ] Reports: Generate now → summary; Members/Payments CSV download & open in a spreadsheet.
- [ ] Suspend a test gym → app, public site, and member card all blocked consistently.

---

## 3. Launch readiness score

**9 / 10 — ready for a controlled launch (pilot gyms).**

Rationale: full V1 surface built and tested; tenant isolation, immutable
financials, env-safety, and a11y in place. The missing point is *operational
runtime confidence* — schedulers, App Check enforcement, and backup/restore must
be verified in the live project (config, not code), plus real-device QA sign-off.

---

## 4. Remaining V2 backlog (explicitly out of V1)
- Online payments + auto-renew billing; SaaS subscription/billing for gyms.
- Email/SMS/WhatsApp Business **delivery** of reports & reminders (recipients already stored).
- XLSX / server-generated PDF exports; custom date-range & BI dashboards.
- Full-text member search (V1 uses phone + code + bounded name filter).
- Daily cash reconciliation / shift reports; advanced discounts.
- Activity-log **viewer UI** (logs are written in V1).
- Attendance module (flagged `attendance_enabled`, build only on demand), wallet/QR cards, member self-renew, custom domains/subdomains, native mobile apps.

---

## 5. Known limitations & accepted tradeoffs
- **Member name search** reads up to ~200 recent docs per query; phone/code are indexed and preferred. Acceptable for V1 gym sizes; full-text deferred to V2.
- **CSV export** is O(members) by nature — streamed + paginated, gated to owner, rare/explicit action; never on a hot path.
- **Suspension check** is cached ~60s for cost — a suspended gym is fully locked within a minute (acceptable for billing enforcement).
- **`firebase-tools` pinned to 13.x** for the Java 11 sandbox; CI/prod may use latest.
- **Digital card** is a live web view (no wallet pass/QR/PDF in V1) — always shows current status, shareable via link.
- **Reports email delivery** not included — summaries are in-app + printable; recipients field stored for V2.
- **Single Firebase project, shared-DB multi-tenant** — correct for V1 scale; per-tenant DB isolation is a future option for very large enterprise tenants.

---

## 6. Risk register & rollback plan

| # | Risk | Likelihood | Impact | Mitigation | Rollback |
|---|---|---|---|---|---|
| R1 | Security rules regression on deploy | Low | Critical | `npm run test:rules` in CI before deploy; rules are versioned | `firebase deploy --only firestore:rules` with previous `firestore.rules` (git revert) |
| R2 | Missing/invalid prod env at deploy | Med | High (white-screen-safe, but degraded) | `npm run check:config` gates pipeline; app is env-safe (shows config-needed, never crashes) | Set env in Vercel + redeploy; instant `vercel rollback` to last good build |
| R3 | Composite index not enabled yet | Med | Med (queries error) | Deploy indexes first; wait for *Enabled*; services return clear errors (no crash) | Re-deploy indexes; feature degrades gracefully until ready |
| R4 | App Check misconfig blocks contact form | Low | Med | Server soft-fails when App Check unconfigured; honeypot+rate-limit still apply | Temporarily disable App Check enforcement in console |
| R5 | Scheduler/cron misfire (status/report) | Low | Low | Idempotent jobs (date-keyed report; recompute self-heals); owner manual buttons exist | Re-run manually; fix scheduler; no data corruption |
| R6 | Phone-OTP cost/abuse spike | Low | Med | App Check + Firebase phone quotas/alerts | Lower quotas; tighten App Check; rules already block direct writes |
| R7 | Counter drift vs records | Low | Med | Daily recompute rebuilds counters; analytics `rebuild` reconstructs rollups from immutable records | Trigger recompute/rebuild; truth is always re-derivable from `memberships` |
| R8 | Bad data write / accidental delete | Low | High | Soft-deletes for members/plans; memberships immutable (rules) | Restore from native Firestore→GCS backup into a verify DB, then cut over |

**General rollback:** Vercel keeps prior immutable deployments — `vercel rollback`
(or promote the last green build) reverts app code in seconds. Rules/indexes are
in git and re-deployable independently. Firestore data is recoverable from daily
GCS exports. Because all financial figures are **re-derivable from immutable
`memberships`**, analytics/report/counters corruption is always recoverable
without data loss.
