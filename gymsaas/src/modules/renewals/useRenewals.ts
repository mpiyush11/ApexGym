"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/services/apiClient";
import type { Member, Membership } from "@/lib/domain/types";
import type { RenewalInput } from "@/lib/services/renewal.schema";

export function useExpiringMembers() {
  return useQuery({
    queryKey: ["members", "expiring"],
    queryFn: () => api.get<Member[]>("/api/members/expiring"),
  });
}

export function useMembershipHistory(member_id: string | null) {
  return useQuery({
    queryKey: ["members", "history", member_id],
    queryFn: () => api.get<Membership[]>(`/api/members/${member_id}/history`),
    enabled: Boolean(member_id),
  });
}

export function useRenewMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ member_id, input }: { member_id: string; input: RenewalInput }) =>
      api.post<{ membership: Membership; member_status_key: string }>(
        `/api/members/${member_id}/renew`,
        input,
      ),
    onSuccess: () => {
      // Refresh everything affected by a renewal.
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
