"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/services/apiClient";

export type ContentKind = "trainers" | "gallery" | "testimonials";

export function useContentList<T>(kind: ContentKind) {
  return useQuery({
    queryKey: ["content", kind],
    queryFn: () => api.get<T[]>(`/api/content/${kind}`),
  });
}

export function useCreateContent(kind: ContentKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<{ id: string }>(`/api/content/${kind}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content", kind] }),
  });
}

export function useUpdateContent(kind: ContentKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<{ ok: true }>(`/api/content/${kind}/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content", kind] }),
  });
}

export function useDeleteContent(kind: ContentKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: true }>(`/api/content/${kind}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content", kind] }),
  });
}
