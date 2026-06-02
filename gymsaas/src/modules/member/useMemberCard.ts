"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/services/apiClient";

export interface MemberCardBundle {
  member_display_name: string;
  member_code: string;
  member_photo_url: string;
  member_phone: string;
  member_join_date: string;
  member_status_key: string;
  member_tier_key: string;
  plan_name_snapshot: string | null;
  membership_end_date: string | null;
  amount_due_minor: number;
  currency_code: string;
  gym_display_name: string;
  gym_primary_color_hex: string;
  gym_whatsapp_number: string;
  gym_slug: string;
}

export function useMemberCard(enabled: boolean) {
  return useQuery({
    queryKey: ["member", "me"],
    queryFn: () => api.get<MemberCardBundle>("/api/member/me"),
    enabled,
    retry: false,
  });
}
