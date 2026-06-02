/**
 * Renewal input validation. Payment amounts arrive in MAJOR units from the
 * form (cash desk) and are converted to integer minor units server-side.
 */
import { z } from "zod";
import { PAYMENT_METHOD_KEYS } from "@/lib/domain/constants";

const methods = [
  PAYMENT_METHOD_KEYS.CASH,
  PAYMENT_METHOD_KEYS.UPI,
  PAYMENT_METHOD_KEYS.CARD,
] as const;

export const renewalSchema = z.object({
  plan_id: z.string().min(1, "Choose a plan"),
  // Optional override of the amount actually collected (cash desk reality).
  // If omitted, the server uses the plan's expected total.
  amount_paid_major: z.number().min(0).max(10_000_000).optional(),
  discount_major: z.number().min(0).max(10_000_000).default(0),
  discount_reason: z.string().trim().max(120).optional().or(z.literal("")),
  payment_method_key: z.enum(methods).default(PAYMENT_METHOD_KEYS.CASH),
  // Whether to also charge the one-time joining fee (first join).
  include_joining_fee: z.boolean().default(false),
});

export type RenewalInput = z.infer<typeof renewalSchema>;
