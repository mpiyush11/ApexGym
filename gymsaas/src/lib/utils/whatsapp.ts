/**
 * Build a wa.me deep link with a pre-filled message. WhatsApp-first conversion
 * is the primary CTA for the public site (audit 13.1). Returns null when no
 * number is configured so callers can hide/disable the CTA gracefully.
 */
export function buildWhatsAppLink(
  rawNumber: string | undefined | null,
  message: string,
): string | null {
  const digits = (rawNumber ?? "").replace(/[^0-9]/g, "");
  if (digits.length < 7) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
