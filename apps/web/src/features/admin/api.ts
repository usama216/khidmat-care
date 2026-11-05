"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { type ApiError, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";

export type Page<T> = { items: T[]; total: number; page: number; page_size: number };

export type Overview = {
  new_messages: number;
  messages_last_7_days: number;
  providers_pending: number;
  providers_approved: number;
  patients: number;
  bookings_awaiting_assignment: number;
  bookings_active: number;
  active_services: number;
  active_packages: number;
};

export type MessageStatus = "NEW" | "HANDLED";

export type ContactMessage = {
  id: string;
  name: string;
  phone: string;
  message: string;
  locale: string;
  status: MessageStatus;
  created_at: string;
  handled_at: string | null;
};

export type Package = { id: string; sessions_count: number; price_pkr: number; is_active: boolean };

export type Service = {
  id: string;
  slug: string;
  name: string;
  name_urdu: string;
  description: string | null;
  description_urdu: string | null;
  is_active: boolean;
  sort_order: number;
  packages: Package[];
};

export type AuditEntry = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
};

// These mirror the API's limits. The server still validates everything itself.
export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters.").max(120),
  name_urdu: z.string().trim().min(2, "Enter at least 2 characters.").max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only."),
});
export type ServiceValues = z.infer<typeof serviceSchema>;

export const packageSchema = z.object({
  sessions_count: z.coerce
    .number<string>("Enter a number.")
    .int("Enter a whole number.")
    .min(1, "At least 1 session.")
    .max(100, "At most 100 sessions."),
  price_pkr: z.coerce
    .number<string>("Enter a number.")
    .int("Enter whole rupees.")
    .min(1, "Enter a price above 0.")
    .max(10_000_000, "This price is too high."),
});

export const priceSchema = packageSchema.shape.price_pkr;

export const commissionSchema = z.coerce
  .number<string>("Enter a number.")
  .min(0, "Must be 0% or more.")
  .max(100, "Must be 100% or less.")
  .refine((value) => Number.isInteger(value * 100), "Use at most 2 decimal places.");

const KEYS = {
  overview: ["admin", "overview"] as const,
  messages: ["admin", "messages"] as const,
  services: ["admin", "services"] as const,
  commission: ["admin", "commission"] as const,
  audit: ["admin", "audit"] as const,
};

export function useOverview() {
  return useQuery<Overview, ApiError>({
    queryKey: KEYS.overview,
    queryFn: () => apiGet<Overview>("/admin/overview"),
  });
}

export type MessageFilters = { page: number; status?: MessageStatus; search?: string };

export function useMessages(filters: MessageFilters) {
  return useQuery<Page<ContactMessage>, ApiError>({
    queryKey: [...KEYS.messages, filters],
    queryFn: () => apiGet<Page<ContactMessage>>("/admin/contact-messages", { ...filters, page_size: 20 }),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateMessage() {
  const queryClient = useQueryClient();
  return useMutation<ContactMessage, ApiError, { id: string; status: MessageStatus }>({
    mutationFn: ({ id, status }) => apiPatch<ContactMessage>(`/admin/contact-messages/${id}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEYS.messages });
      void queryClient.invalidateQueries({ queryKey: KEYS.overview });
      void queryClient.invalidateQueries({ queryKey: KEYS.audit });
    },
  });
}

export function useServices() {
  return useQuery<Service[], ApiError>({
    queryKey: KEYS.services,
    queryFn: () => apiGet<Service[]>("/admin/catalog/services"),
  });
}

function useCatalogMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, TVariables>({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEYS.services });
      void queryClient.invalidateQueries({ queryKey: KEYS.overview });
      void queryClient.invalidateQueries({ queryKey: KEYS.audit });
    },
  });
}

export function useCreateService() {
  return useCatalogMutation((values: ServiceValues) => apiPost("/admin/catalog/services", values));
}

export function useUpdateService() {
  return useCatalogMutation(({ id, ...changes }: { id: string; is_active: boolean }) =>
    apiPatch(`/admin/catalog/services/${id}`, changes),
  );
}

export function useCreatePackage() {
  return useCatalogMutation(
    ({ serviceId, ...values }: { serviceId: string; sessions_count: number; price_pkr: number }) =>
      apiPost(`/admin/catalog/services/${serviceId}/packages`, values),
  );
}

export function useUpdatePackage() {
  return useCatalogMutation(
    ({ id, ...changes }: { id: string; price_pkr?: number; is_active?: boolean }) =>
      apiPatch(`/admin/catalog/packages/${id}`, changes),
  );
}

export function useCommission() {
  return useQuery<{ commission_bps: number | null }, ApiError>({
    queryKey: KEYS.commission,
    queryFn: () => apiGet<{ commission_bps: number | null }>("/admin/catalog/commission"),
  });
}

export function useSetCommission() {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, number>({
    mutationFn: (bps) => apiPut("/admin/catalog/commission", { commission_bps: bps }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEYS.commission });
      void queryClient.invalidateQueries({ queryKey: KEYS.audit });
    },
  });
}

export function useAuditLogs(page: number) {
  return useQuery<Page<AuditEntry>, ApiError>({
    queryKey: [...KEYS.audit, page],
    queryFn: () => apiGet<Page<AuditEntry>>("/admin/audit-logs", { page, page_size: 25 }),
    placeholderData: keepPreviousData,
  });
}
