"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/services/apiClient";
import type { Lead } from "@/lib/domain/types";
import type { LeadStatusKey } from "@/lib/domain/constants";

export function useLeads(status: LeadStatusKey | "all") {
  return useQuery({
    queryKey: ["leads", status],
    queryFn: () =>
      api.get<Lead[]>(`/api/leads${status !== "all" ? `?status=${status}` : ""}`),
  });
}

export function useSetLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lead_id, lead_status_key }: { lead_id: string; lead_status_key: LeadStatusKey }) =>
      api.patch<Lead>(`/api/leads/${lead_id}`, { lead_status_key }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] }); // lead_new_count
    },
  });
}
