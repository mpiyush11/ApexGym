"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/services/apiClient";
import type { Member } from "@/lib/domain/types";
import type { MemberCreateInput, MemberUpdateInput } from "@/lib/services/member.schema";

interface MemberPage {
  members: Member[];
  next_cursor: string | null;
}

/** Paginated member list (infinite scroll on mobile). */
export function useMembersList() {
  return useInfiniteQuery({
    queryKey: ["members", "list"],
    queryFn: ({ pageParam }) =>
      api.get<MemberPage>(
        `/api/members${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    initialPageParam: "" as string,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

/** Debounced search (caller passes the term). */
export function useMemberSearch(term: string) {
  return useQuery({
    queryKey: ["members", "search", term],
    queryFn: () =>
      api.get<MemberPage>(`/api/members?q=${encodeURIComponent(term)}`),
    enabled: term.trim().length > 0,
  });
}

export function useMember(member_id: string | null) {
  return useQuery({
    queryKey: ["members", "detail", member_id],
    queryFn: () => api.get<Member>(`/api/members/${member_id}`),
    enabled: Boolean(member_id),
  });
}

interface CreateResult {
  member: Member;
  duplicate_warning: boolean;
}

export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MemberCreateInput) =>
      api.post<CreateResult>("/api/members", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ member_id, input }: { member_id: string; input: MemberUpdateInput }) =>
      api.patch<Member>(`/api/members/${member_id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });
}

export function useArchiveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (member_id: string) => api.del<{ ok: true }>(`/api/members/${member_id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });
}
