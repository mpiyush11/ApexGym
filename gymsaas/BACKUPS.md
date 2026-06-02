# GymOS — Backup & Disaster Recovery (V1)

> **Principle:** backups are **native Firestore exports to Google Cloud Storage**,
> configured at the infrastructure level. They are a byte-for-byte copy used only
> for disaster recovery — the app **never reads them**, so they introduce **no new
> source of truth**. `memberships` remains the single financial source of truth.

There is **no application-managed backup system** in V1 (no code, no collections,
no scheduled functions written by us for backups).

## What to configure (one-time, per environment)

### 1. Scheduled daily export (managed by Google)
Firestore has a built-in scheduled export. Enable it with the gcloud CLI:

```bash
# Grant the Firestore service agent access to a dedicated backup bucket.
gsutil mb -l <REGION> gs://<PROJECT_ID>-firestore-backups

# Create a daily backup schedule with 14-day retention (managed by Firestore).
gcloud firestore backups schedules create \
  --database="(default)" \
  --recurrence=daily \
  --retention=14d
```

(Alternatively, the classic approach: a Cloud Scheduler job that calls
`gcloud firestore export gs://<PROJECT_ID>-firestore-backups/$(date +%F)` daily.)

### 2. Restore (disaster recovery)
```bash
# List available backups
gcloud firestore backups list --location=<REGION>

# Restore into a NEW database, verify, then cut over (never overwrite blindly)
gcloud firestore databases restore \
  --source-backup=<BACKUP_RESOURCE_NAME> \
  --destination-database=restore-verify
```

## Retention & scope
- **Retention:** 14 days of daily snapshots (adjust per business need).
- **Scope:** entire Firestore database (all tenants). Multi-tenant isolation is
  unaffected — backups are admin-only infrastructure artifacts.
- **Storage:** a dedicated GCS bucket with no public access; lifecycle rule can
  auto-delete objects older than the retention window.

## What is NOT a backup (by design)
- The owner **CSV export** (`/api/reports/export/*`) is a *convenience extract*
  for accountants / portability — not a recovery mechanism and not authoritative.
- `report_runs` are derived weekly snapshots, not backups.

## Operational checklist
- [ ] Backup schedule created and first export verified in the bucket.
- [ ] Bucket access locked down (no public, least-privilege IAM).
- [ ] Restore tested at least once into a throwaway database.
- [ ] Retention/lifecycle policy set.
