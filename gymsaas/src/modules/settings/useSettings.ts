"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/services/apiClient";

export interface SettingsView {
  gym_slug: string;
  gym_display_name: string;
  gym_whatsapp_number: string;
  gym_contact_phone: string;
  gym_contact_email: string;
  gym_city: string;
  default_currency_code: string;
  gym_timezone: string;
  renewal_reminder_days_before: number;
  report_recipient_emails: string[];
  public_site_is_published: boolean;
}

export interface StaffView {
  app_user_id: string;
  app_user_email: string;
  app_user_display_name: string;
  app_user_role_key: string;
  is_active: boolean;
}

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: () => api.get<SettingsView>("/api/settings") });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<SettingsView, "default_currency_code" | "gym_timezone" | "gym_slug">) =>
      api.patch<{ ok: true }>("/api/settings", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useStaff() {
  return useQuery({ queryKey: ["staff"], queryFn: () => api.get<StaffView[]>("/api/staff") });
}

export function useInviteReception() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; display_name: string; temp_password: string }) =>
      api.post<{ app_user_id: string }>("/api/staff", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  });
}

export function useSetStaffActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ app_user_id, is_active }: { app_user_id: string; is_active: boolean }) =>
      api.patch<{ ok: true }>(`/api/staff/${app_user_id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  });
}
