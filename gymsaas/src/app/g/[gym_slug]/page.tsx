/**
 * Public per-gym website (server-rendered + ISR). Mobile-first, premium, SEO.
 * Goal: convert visitors to leads via WhatsApp-first CTAs + contact form.
 *
 * Reads the published gym bundle via the Admin SDK (client rules stay locked).
 * Returns notFound() when the gym is missing/unpublished/suspended.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicGymBundle } from "@/lib/services/publicSite.service";
import { formatMoney } from "@/lib/money/money";
import { buildWhatsAppLink } from "@/lib/utils/whatsapp";
import { isAdminReady } from "@/lib/firebase/admin";

// Revalidate the static page periodically (ISR) — fast + cheap reads.
export const revalidate = 300;

const planDurationLabel: Record<string, string> = {
  monthly: "/ month",
  quarterly: "/ quarter",
  semi_annual: "/ 6 months",
  annual: "/ year",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gym_slug: string }>;
}): Promise<Metadata> {
  const { gym_slug } = await params;
  const gym = isAdminReady ? await getPublicGymBundle(gym_slug) : null;
  if (!gym) return { title: "Gym not found" };
  const title = `${gym.gym_display_name}${gym.gym_city ? ` · ${gym.gym_city}` : ""} — Join Today`;
  const description = `Become a member at ${gym.gym_display_name}. View membership plans, trainers and facilities. Enquire on WhatsApp.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: gym.hero_image_url ? [{ url: gym.hero_image_url }] : undefined,
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

export default async function PublicGymSite({
  params,
}: {
  params: Promise<{ gym_slug: string }>;
}) {
  const { gym_slug } = await params;
  // Env-safe: if backend isn't configured we can't render real content.
  const gym = isAdminReady ? await getPublicGymBundle(gym_slug) : null;
  if (!gym) notFound();

  const brand = gym.gym_primary_color_hex || "#d4af37";
  const waLink = buildWhatsAppLink(
    gym.gym_whatsapp_number,
    `Hi ${gym.gym_display_name}, I'd like to know more about your memberships.`,
  );
  const contactHref = `/g/${gym.gym_slug}/contact`;

  // LocalBusiness structured data — high-value, low-cost SEO for local search.
  const cheapestPlan = gym.plans.reduce<number | null>((min, p) => {
    const v = p.price_amount_minor;
    return min == null || v < min ? v : min;
  }, null);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    name: gym.gym_display_name,
    ...(gym.gym_contact_phone ? { telephone: gym.gym_contact_phone } : {}),
    ...(gym.gym_contact_email ? { email: gym.gym_contact_email } : {}),
    ...(gym.hero_image_url ? { image: gym.hero_image_url } : {}),
    ...(gym.gym_address_line || gym.gym_city
      ? {
          address: {
            "@type": "PostalAddress",
            ...(gym.gym_address_line ? { streetAddress: gym.gym_address_line } : {}),
            ...(gym.gym_city ? { addressLocality: gym.gym_city } : {}),
          },
        }
      : {}),
    ...(cheapestPlan != null
      ? { priceRange: `from ${formatMoney(cheapestPlan, gym.default_currency_code)}` }
      : {}),
  };

  return (
    <main className="min-h-screen bg-background text-foreground" style={{ ["--brand" as string]: brand }}>
      {/* SEO: LocalBusiness structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* ── Sticky top bar ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-surface-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="flex items-center gap-2 font-bold">
            <span className="text-lg">🏋️</span>
            <span className="truncate">{gym.gym_display_name}</span>
          </span>
          <div className="flex items-center gap-2">
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden h-9 items-center rounded-full px-4 text-sm font-semibold text-black sm:inline-flex"
                style={{ background: brand }}
              >
                WhatsApp
              </a>
            ) : null}
            <Link
              href={contactHref}
              className="inline-flex h-9 items-center rounded-full border border-surface-border px-4 text-sm font-medium"
            >
              Enquire
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {gym.hero_image_url ? (
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary owner image; next/image config deferred */}
            <img src={gym.hero_image_url} alt="" className="h-full w-full object-cover opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/40 to-background" />
          </div>
        ) : (
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{ background: `radial-gradient(60% 50% at 50% 0%, ${brand}40, transparent 70%)` }}
          />
        )}
        <div className="relative mx-auto max-w-3xl px-5 py-20 text-center sm:py-28">
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Train at{" "}
            <span style={{ color: brand }}>{gym.gym_display_name}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg">
            {gym.gym_city ? `${gym.gym_city}'s ` : ""}premium fitness destination.
            Flexible plans, expert trainers, and a community that keeps you coming back.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center rounded-[var(--radius-card)] px-6 font-semibold text-black"
                style={{ background: brand }}
              >
                💬 Enquire on WhatsApp
              </a>
            ) : null}
            <Link
              href={contactHref}
              className="inline-flex h-12 items-center justify-center rounded-[var(--radius-card)] border border-surface-border bg-surface px-6 font-semibold"
            >
              Send an enquiry
            </Link>
          </div>
          {gym.testimonials.length > 0 ? (
            <p className="mt-6 text-sm text-muted">
              ⭐ Loved by {gym.testimonials.length}+ members
            </p>
          ) : null}
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-16 px-4 pb-28 pt-4">
        {/* ── Plans ────────────────────────────────────────────── */}
        {gym.plans.length > 0 ? (
          <section id="plans">
            <SectionHeading title="Membership plans" subtitle="Pick a plan and start today" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gym.plans.map((p) => {
                const planWa = buildWhatsAppLink(
                  gym.gym_whatsapp_number,
                  `Hi ${gym.gym_display_name}, I'm interested in the ${p.plan_display_name} plan.`,
                );
                return (
                  <div key={p.plan_id} className="flex flex-col rounded-[var(--radius-card)] border border-surface-border bg-surface p-5">
                    <h3 className="text-lg font-semibold">{p.plan_display_name}</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-bold" style={{ color: brand }}>
                        {formatMoney(p.price_amount_minor, p.currency_code || gym.default_currency_code)}
                      </span>
                      <span className="text-xs text-muted">
                        {planDurationLabel[p.plan_duration_key] ?? ""}
                      </span>
                    </div>
                    {p.joining_fee_minor > 0 ? (
                      <p className="mt-1 text-xs text-muted">
                        + {formatMoney(p.joining_fee_minor, p.currency_code || gym.default_currency_code)} one-time joining
                      </p>
                    ) : null}
                    {p.plan_description ? (
                      <p className="mt-3 flex-1 text-sm text-muted">{p.plan_description}</p>
                    ) : <div className="flex-1" />}
                    <a
                      href={planWa ?? contactHref}
                      target={planWa ? "_blank" : undefined}
                      rel={planWa ? "noopener noreferrer" : undefined}
                      className="mt-4 inline-flex h-11 items-center justify-center rounded-[var(--radius-card)] px-4 text-sm font-semibold text-black"
                      style={{ background: brand }}
                    >
                      {planWa ? "Enquire on WhatsApp" : "Enquire now"}
                    </a>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* ── Trainers ─────────────────────────────────────────── */}
        {gym.trainers.length > 0 ? (
          <section id="trainers">
            <SectionHeading title="Meet the trainers" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gym.trainers.map((t) => (
                <div key={t.trainer_id} className="rounded-[var(--radius-card)] border border-surface-border bg-surface p-5">
                  <div className="flex items-center gap-3">
                    <Avatar url={t.trainer_photo_url} name={t.trainer_display_name} brand={brand} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{t.trainer_display_name}</p>
                      {t.trainer_specialty ? (
                        <p className="truncate text-xs text-muted">{t.trainer_specialty}</p>
                      ) : null}
                    </div>
                  </div>
                  {t.trainer_bio ? (
                    <p className="mt-3 line-clamp-3 text-sm text-muted">{t.trainer_bio}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Gallery ──────────────────────────────────────────── */}
        {gym.gallery.length > 0 ? (
          <section id="gallery">
            <SectionHeading title="Inside the gym" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gym.gallery.map((g) => (
                <figure
                  key={g.gallery_item_id}
                  className="relative aspect-square overflow-hidden rounded-[var(--radius-card)] border border-surface-border bg-surface-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary owner image; next/image config deferred */}
                  <img
                    src={g.image_url}
                    alt={g.image_title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  {g.image_title ? (
                    <figcaption className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-2 py-1 text-[11px] text-white">
                      {g.image_title}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Testimonials ─────────────────────────────────────── */}
        {gym.testimonials.length > 0 ? (
          <section id="testimonials">
            <SectionHeading title="What members say" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {gym.testimonials.map((t) => (
                <blockquote key={t.testimonial_id} className="rounded-[var(--radius-card)] border border-surface-border bg-surface p-5">
                  <p className="text-sm">“{t.testimonial_text}”</p>
                  <footer className="mt-3 flex items-center gap-2 text-xs text-muted">
                    <span className="font-semibold text-foreground">{t.author_display_name}</span>
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 capitalize">{t.member_tier_key}</span>
                    <span>· member since {t.member_since_year}</span>
                  </footer>
                </blockquote>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Contact ──────────────────────────────────────────── */}
        <section id="contact">
          <SectionHeading title="Ready to start?" subtitle="We'll get back to you fast" />
          <div className="rounded-[var(--radius-card)] border border-surface-border bg-surface p-6 text-center">
            <p className="text-sm text-muted">
              Send us your details and our team will reach out about membership.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {waLink ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center rounded-[var(--radius-card)] px-6 font-semibold text-black"
                  style={{ background: brand }}
                >
                  💬 Chat on WhatsApp
                </a>
              ) : null}
              <Link
                href={contactHref}
                className="inline-flex h-12 items-center justify-center rounded-[var(--radius-card)] border border-surface-border bg-surface-2 px-6 font-semibold"
              >
                Fill the contact form
              </Link>
            </div>
            {(gym.gym_address_line || gym.gym_city || gym.gym_contact_phone) ? (
              <p className="mt-5 text-xs text-muted">
                {[gym.gym_address_line, gym.gym_city].filter(Boolean).join(", ")}
                {gym.gym_contact_phone ? (
                  <>
                    {" · "}
                    {/* Click-to-call on mobile */}
                    <a href={`tel:${gym.gym_contact_phone.replace(/\s+/g, "")}`} className="font-medium text-foreground underline">
                      {gym.gym_contact_phone}
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-surface-border py-8 text-center text-xs text-muted">
        <Link href={`/g/${gym.gym_slug}/member`} className="font-medium text-foreground hover:underline">
          Existing member? Sign in →
        </Link>
        <p className="mt-3">© {new Date().getFullYear()} {gym.gym_display_name}. All rights reserved.</p>
      </footer>

      {/* ── Floating WhatsApp CTA (mobile-first, thumb-reachable) ─ */}
      {waLink ? (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat on WhatsApp"
          className="fixed bottom-5 right-4 z-50 flex h-14 items-center gap-2 rounded-full px-5 font-semibold text-black shadow-[var(--shadow-md)]"
          style={{ background: brand }}
        >
          <span className="text-xl">💬</span>
          <span className="hidden sm:inline">WhatsApp</span>
        </a>
      ) : null}
    </main>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 text-center">
      <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
    </div>
  );
}

function Avatar({ url, name, brand }: { url?: string; name: string; brand: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary owner image; next/image config deferred
      <img src={url} alt={name} className="h-12 w-12 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-black"
      style={{ background: brand }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
