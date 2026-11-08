"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ApiError, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";
import type { Page } from "./api";
import type { AvailabilitySlot, BookingStatus, BookingView } from "@/features/portal/api";

export type ProviderStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export type ProviderRow = {
  id: string;
  name: string | null;
  phone: string;
  status: ProviderStatus;
  gender: "MALE" | "FEMALE";
  qualification: string;
  experience_years: number;
  balance_pkr: number;
  rating_avg: number;
  submitted_at: string | null;
};

export type ProviderDetail = ProviderRow & {
  cnic: string;
  status_reason: string | null;
  bio: string | null;
  photo_url: string | null;
  service_type_ids: string[];
  area_ids: string[];
  documents: { id: string; type: string; file_id: string }[];
  availability: AvailabilitySlot[];
  verification_checks: Record<string, string>;
  required_checks: string[];
  agreement_accepted_at: string | null;
};

export type StaffBooking = BookingView & {
  commission_bps: number;
  booker_name: string | null;
  booker_phone: string | null;
  provider_phone: string | null;
};

export type TopupRow = {
  id: string;
  provider_id: string;
  amount_pkr: number;
  method: string;
  reference: string;
  proof_file_id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reject_reason: string | null;
  created_at: string;
};

export type ComplaintRow = {
  id: string;
  booking_id: string;
  text: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";
  resolution: string | null;
  created_at: string;
};

export type LowRating = { id: string; rating: number; comment: string | null; created_at: string; provider_id: string };

export type PlatformSettings = {
  commission_bps: number | null;
  minimum_balance_pkr: number;
  topup_instructions: string;
};

const KEYS = {
  providers: ["admin", "providers"] as const,
  bookings: ["admin", "bookings"] as const,
  topups: ["admin", "topups"] as const,
  complaints: ["admin", "complaints"] as const,
  settings: ["admin", "settings"] as const,
};

function useAdminMutation<TVariables, TResult = unknown>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation<TResult, ApiError, TVariables>({
    mutationFn,
    // Every staff action can change the counts, the lists and the audit log.
    onSuccess: () => void client.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useProviders(filters: { page: number; status?: ProviderStatus; search?: string }) {
  return useQuery<Page<ProviderRow>, ApiError>({
    queryKey: [...KEYS.providers, filters],
    queryFn: () => apiGet<Page<ProviderRow>>("/admin/providers", filters),
    placeholderData: keepPreviousData,
  });
}

export function useProviderDetail(id: string | null) {
  return useQuery<ProviderDetail, ApiError>({
    queryKey: [...KEYS.providers, "detail", id],
    queryFn: () => apiGet<ProviderDetail>(`/admin/providers/${id}`),
    enabled: Boolean(id),
    // Each load shows the CNIC and is written to the audit log, so it only loads when opened.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    gcTime: 0,
  });
}

type CheckChange = { id: string; check: string; done: boolean };

export function useSetCheck() {
  const client = useQueryClient();
  return useMutation<{ verification_checks: Record<string, string> }, ApiError, CheckChange, ProviderDetail | undefined>({
    mutationFn: ({ id, check, done }) => apiPut(`/admin/providers/${id}/checks/${check}`, { done }),
    // The tick shows straight away, and goes back if the server refuses.
    onMutate: async ({ id, check, done }) => {
      const key = [...KEYS.providers, "detail", id];
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<ProviderDetail>(key);
      if (previous) {
        const checks = { ...previous.verification_checks };
        if (done) checks[check] = new Date().toISOString();
        else delete checks[check];
        client.setQueryData<ProviderDetail>(key, { ...previous, verification_checks: checks });
      }
      return previous;
    },
    onError: (_error, { id }, previous) => {
      if (previous) client.setQueryData([...KEYS.providers, "detail", id], previous);
    },
    onSuccess: (result, { id }) => {
      // Updated directly, because reloading this page would log another CNIC view.
      client.setQueryData<ProviderDetail>([...KEYS.providers, "detail", id], (current) =>
        current ? { ...current, verification_checks: result.verification_checks } : current,
      );
    },
  });
}

export function useDecideProvider() {
  return useAdminMutation(
    ({ id, decision, reason }: { id: string; decision: "approve" | "reject" | "suspend" | "reactivate"; reason?: string }) =>
      apiPost(`/admin/providers/${id}/${decision}`, decision === "reject" || decision === "suspend" ? { reason } : undefined),
  );
}

export function fileUrl(fileId: string) {
  return apiGet<{ url: string }>(`/files/${fileId}/url`);
}

export function useAdminBookings(filters: { page: number; status?: BookingStatus }) {
  return useQuery<Page<StaffBooking>, ApiError>({
    queryKey: [...KEYS.bookings, filters],
    queryFn: () => apiGet<Page<StaffBooking>>("/admin/bookings", filters),
    placeholderData: keepPreviousData,
  });
}

export function useAssignProvider() {
  return useAdminMutation(({ id, provider_id, start_at }: { id: string; provider_id: string; start_at: string }) =>
    apiPost(`/admin/bookings/${id}/assign`, { provider_id, start_at }),
  );
}

export function useCloseSession() {
  return useAdminMutation(({ id, status, reason }: { id: string; status: "CANCELLED" | "NO_SHOW"; reason: string }) =>
    apiPost(`/admin/bookings/sessions/${id}/close`, { status, reason }),
  );
}

export function useTopups(filters: { page: number; status?: TopupRow["status"] }) {
  return useQuery<Page<TopupRow>, ApiError>({
    queryKey: [...KEYS.topups, filters],
    queryFn: () => apiGet<Page<TopupRow>>("/admin/wallet/topups", filters),
    placeholderData: keepPreviousData,
  });
}

export function useReviewTopup() {
  return useAdminMutation(({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
    apiPost(`/admin/wallet/topups/${id}/review`, { approve, reason }),
  );
}

export function useComplaints(filters: { page: number; status?: ComplaintRow["status"] }) {
  return useQuery<Page<ComplaintRow>, ApiError>({
    queryKey: [...KEYS.complaints, filters],
    queryFn: () => apiGet<Page<ComplaintRow>>("/admin/complaints", filters),
    placeholderData: keepPreviousData,
  });
}

export function useLowRatings() {
  return useQuery<LowRating[], ApiError>({
    queryKey: [...KEYS.complaints, "low-ratings"],
    queryFn: () => apiGet<LowRating[]>("/admin/low-ratings"),
  });
}

export function useUpdateComplaint() {
  return useAdminMutation(({ id, status, resolution }: { id: string; status: ComplaintRow["status"]; resolution?: string }) =>
    apiPatch(`/admin/complaints/${id}`, { status, resolution }),
  );
}

export function useSettings() {
  return useQuery<PlatformSettings, ApiError>({
    queryKey: KEYS.settings,
    queryFn: () => apiGet<PlatformSettings>("/admin/settings"),
  });
}

export function useSaveSettings() {
  return useAdminMutation((values: Partial<PlatformSettings>) =>
    apiPatch<PlatformSettings>("/admin/settings", values),
  );
}
