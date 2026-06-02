"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/services/apiClient";

export interface DashboardSummary {
  active_count: number;
  expiring_count: number;
  expired_count: number;
  total_members: number;
  lead_new_count: number;
  revenue_month_minor: number;
  revenue_month_key: string;
  currency_code: string;
  can_view_revenue?: boolean;
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => api.get<DashboardSummary>("/api/dashboard/summary"),
  });
}

/** Manual "refresh statuses" — recomputes derived statuses + counters. */
export function useRecomputeStatuses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ scanned: number; changed: number }>("/api/cron/recompute-status", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}
