"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/services/apiClient";
import type { MembershipPlan } from "@/lib/domain/types";
import type { PlanInput } from "@/lib/services/plan.schema";

const KEY = ["plans"];

export function usePlans() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<MembershipPlan[]>("/api/plans"),
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PlanInput) => api.post<MembershipPlan>("/api/plans", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ plan_id, input }: { plan_id: string; input: PlanInput }) =>
      api.patch<MembershipPlan>(`/api/plans/${plan_id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeactivatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan_id: string) => api.del<{ ok: true }>(`/api/plans/${plan_id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
