"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/services/apiClient";

export interface MonthlyAgg {
  month_key: string;
  revenue_collected_minor: number;
  joining_fees_minor: number;
  discount_minor: number;
  periods_count: number;
  new_joins_count: number;
}

export interface AnalyticsResult {
  months: MonthlyAgg[];
  total_revenue_minor: number;
  total_new_joins: number;
  renewal_rate_pct: number;
  active_count: number;
  expiring_count: number;
  expired_count: number;
  total_members: number;
  currency_code: string;
  window_months: number;
}

export function useAnalytics(months = 12) {
  return useQuery({
    queryKey: ["analytics", months],
    queryFn: () => api.get<AnalyticsResult>(`/api/analytics?months=${months}`),
  });
}

export function useRebuildAnalytics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ memberships_scanned: number; months_written: number }>(
        "/api/analytics/rebuild",
        {},
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
