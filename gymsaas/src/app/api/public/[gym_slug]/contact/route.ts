import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { leadSchema } from "@/lib/services/lead.schema";
import { appCheckSiteKey } from "@/lib/config/env";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ gym_slug: string }> }
) {
  try {
    const { gym_slug } = await props.params;
    const body = await req.json();

    // Validate the incoming lead data structure safely
    const validation = leadSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.format() },
        { status: 400 }
      );
    }

    const db = getFirebaseAdminDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed or not configured" },
        { status: 500 }
      );
    }

    // Resolve gym document by slug directly
    const gymSnap = await db
      .collection(paths.gyms.collection)
      .where("slug", "==", gym_slug)
      .limit(1)
      .get();

    if (gymSnap.empty) {
      return NextResponse.json({ error: "Gym not found" }, { status: 404 });
    }

    const gymId = gymSnap.docs[0].id;

    // Create the lead record directly in Firestore admin scope
    const leadRef = db.collection(paths.leads(gymId).collection).doc();
    const now = new Date().toISOString();

    const newLead = {
      id: leadRef.id,
      gymId,
      name: validation.data.name,
      email: validation.data.email || "",
      phone: validation.data.phone,
      notes: validation.data.notes || "",
      status: "new",
      createdAt: now,
      updatedAt: now,
    };

    await leadRef.set(newLead);

    return NextResponse.json({ success: true, leadId: leadRef.id });
  } catch (error: any) {
    console.error("CRITICAL_BACKEND_LEAD_ERROR:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error?.message || "" },
      { status: 500 }
    );
  }
}
