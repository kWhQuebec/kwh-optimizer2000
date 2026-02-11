import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface SiteContentItem {
  id: string;
  contentKey: string;
  contentType: string;
  value: any;
  label: string | null;
  category: string;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

// Public: fetch active content by key (for landing page)
export function useSiteContentByKey(key: string) {
  return useQuery<SiteContentItem>({
    queryKey: ["site-content", key],
    queryFn: async () => {
      const res = await fetch(`/api/site-content/${key}`);
      if (!res.ok) return null as any;
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false,
  });
}

// Public: fetch all active content by category
export function useSiteContentByCategory(category: string) {
  return useQuery<SiteContentItem[]>({
    queryKey: ["site-content", "category", category],
    queryFn: async () => {
      const res = await fetch(`/api/site-content?category=${category}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Admin: fetch all content
export function useAdminSiteContent() {
  return useQuery<SiteContentItem[]>({
    queryKey: ["admin", "site-content"],
    queryFn: async () => {
      const res = await apiRequest<SiteContentItem[]>("GET", "/api/admin/site-content");
      return res;
    },
  });
}

// Admin: update content
export function useUpdateSiteContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SiteContentItem> }) => {
      const res = await apiRequest<SiteContentItem>("PATCH", `/api/admin/site-content/${id}`, data);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "site-content"] });
      queryClient.invalidateQueries({ queryKey: ["site-content"] });
    },
  });
}

// Admin: create content
export function useCreateSiteContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<SiteContentItem>) => {
      const res = await apiRequest<SiteContentItem>("POST", "/api/admin/site-content", data);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "site-content"] });
    },
  });
}

// Admin: delete content
export function useDeleteSiteContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/site-content/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "site-content"] });
    },
  });
}
