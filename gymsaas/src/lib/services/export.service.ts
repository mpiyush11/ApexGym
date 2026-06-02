/**
 * CSV export streams (server-only, owner). Streams existing records page-by-page
 * so we never buffer the whole collection in memory. CSV-injection protected.
 *
 * memberships remain the only financial source of truth — these are read-only
 * extracts, not a new store. Cost is O(members): acceptable because it is a
 * rare, explicit owner action, never on a hot path.
 */
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { path, SUBCOLLECTIONS } from "@/lib/firebase/paths";
import { csvRow } from "@/lib/utils/csv";
import { toMajor } from "@/lib/money/money";
import type { Member, Membership } from "@/lib/domain/types";

const PAGE = 200;

function encoder() {
  return new TextEncoder();
}

/** Stream members.csv (one row per member). */
export function streamMembersCsv(
  gym_profile_id: string,
  currency_code: string,
): ReadableStream<Uint8Array> | null {
  const db = getAdminDb();
  if (!db) return null;
  const enc = encoder();
  const col = db.collection(path.members(gym_profile_id));

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        enc.encode(
          csvRow([
            "member_code",
            "member_display_name",
            "member_phone",
            "member_email",
            "member_status_key",
            "member_tier_key",
            "member_join_date",
            "current_plan",
            "membership_end_date",
            "amount_due",
          ]),
        ),
      );
      try {
        let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
        for (;;) {
          let q = col.where("is_archived", "==", false).orderBy("created_at", "asc").limit(PAGE);
          if (cursor) q = q.startAfter(cursor);
          const snap = await q.get();
          if (snap.empty) break;
          for (const d of snap.docs) {
            const m = d.data() as Member;
            const s = m.current_membership_summary ?? null;
            controller.enqueue(
              enc.encode(
                csvRow([
                  m.member_code,
                  m.member_display_name,
                  m.member_phone,
                  m.member_email ?? "",
                  m.member_status_key,
                  m.member_tier_key ?? "",
                  (m.member_join_date ?? "").slice(0, 10),
                  s?.plan_name_snapshot ?? "",
                  (s?.membership_end_date ?? "").slice(0, 10),
                  toMajor(s?.amount_due_minor ?? 0, currency_code),
                ]),
              ),
            );
          }
          cursor = snap.docs[snap.docs.length - 1];
          if (snap.size < PAGE) break;
        }
        controller.close();
      } catch {
        controller.error(new Error("export_failed"));
      }
    },
  });
}

/**
 * Stream payments.csv — one row per immutable membership period. Uses a
 * collection-group query scoped to the tenant (existing index), paged by
 * created_at. This is the audit-grade financial extract.
 */
export function streamPaymentsCsv(
  gym_profile_id: string,
  currency_code: string,
): ReadableStream<Uint8Array> | null {
  const db = getAdminDb();
  if (!db) return null;
  const enc = encoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        enc.encode(
          csvRow([
            "created_at",
            "member_id",
            "plan_name_snapshot",
            "membership_start_date",
            "membership_end_date",
            "price_amount",
            "joining_fee",
            "discount",
            "amount_paid",
            "amount_due",
            "payment_method_key",
            "payment_status_key",
            "currency_code",
          ]),
        ),
      );
      try {
        let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
        for (;;) {
          let q = db
            .collectionGroup(SUBCOLLECTIONS.MEMBERSHIPS)
            .where("gym_profile_id", "==", gym_profile_id)
            .orderBy("created_at", "asc")
            .limit(PAGE);
          if (cursor) q = q.startAfter(cursor);
          const snap = await q.get();
          if (snap.empty) break;
          for (const d of snap.docs) {
            const m = d.data() as Membership;
            const cc = m.currency_code || currency_code;
            controller.enqueue(
              enc.encode(
                csvRow([
                  m.created_at,
                  m.member_id,
                  m.plan_name_snapshot,
                  (m.membership_start_date ?? "").slice(0, 10),
                  (m.membership_end_date ?? "").slice(0, 10),
                  toMajor(m.price_amount_minor ?? 0, cc),
                  toMajor(m.joining_fee_minor ?? 0, cc),
                  toMajor(m.discount_minor ?? 0, cc),
                  toMajor(m.amount_paid_minor ?? 0, cc),
                  toMajor(m.amount_due_minor ?? 0, cc),
                  m.payment_method_key,
                  m.payment_status_key,
                  cc,
                ]),
              ),
            );
          }
          cursor = snap.docs[snap.docs.length - 1];
          if (snap.size < PAGE) break;
        }
        controller.close();
      } catch {
        controller.error(new Error("export_failed"));
      }
    },
  });
}
