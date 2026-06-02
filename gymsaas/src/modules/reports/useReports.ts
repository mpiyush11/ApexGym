"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/services/apiClient";

export interface ReportRunView {
  report_run_id: string;
  report_period_start: string;
  report_period_end: string;
  active_members: number;
  new_joins: number;
  expiring_count: number;
  revenue_period_minor: number;
  lead_new: number;
  created_at: string;
  renewals?: number;
  periods_count?: number;
}

export function useReports() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: () => api.get<ReportRunView[]>("/api/reports"),
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ReportRunView>("/api/reports/generate", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });
}
