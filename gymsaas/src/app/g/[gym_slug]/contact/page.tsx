/**
 * Public contact page (server) — branded with the REAL gym for trust/continuity
 * and WhatsApp-first. Reuses getPublicGymBundle (no new infrastructure).
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicGymBundle } from "@/lib/services/publicSite.service";
import { buildWhatsAppLink } from "@/lib/utils/whatsapp";
import { isAdminReady } from "@/lib/firebase/admin";
import { ContactForm } from "@/modules/public/ContactForm";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gym_slug: string }>;
}): Promise<Metadata> {
  const { gym_slug } = await params;
  const gym = isAdminReady ? await getPublicGymBundle(gym_slug) : null;
  const name = gym?.gym_display_name ?? "Gym";
  return {
    title: `Enquire — ${name}`,
    description: `Contact ${name} about membership plans and joining.`,
    robots: { index: false, follow: true },
  };
}

export default async function PublicContactRoute({
  params,
}: {
  params: Promise<{ gym_slug: string }>;
}) {
  const { gym_slug } = await params;
  const gym = isAdminReady ? await getPublicGymBundle(gym_slug) : null;
  if (!gym) notFound();

  const brand = gym.gym_primary_color_hex || "#d4af37";
  const whatsappLink = buildWhatsAppLink(
    gym.gym_whatsapp_number,
    `Hi ${gym.gym_display_name}, I'd like to enquire about membership.`,
  );

  return (
    <ContactForm
      gymSlug={gym.gym_slug}
      gymName={gym.gym_display_name}
      brand={brand}
      whatsappLink={whatsappLink}
    />
  );
}
