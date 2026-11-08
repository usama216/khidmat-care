"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ApiError, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";
import type { Page } from "./api";
import type {
  AvailabilitySlot,
  BookingStatus,
  BookingView,
  PatientPerson,
  SessionView,
} from "@/features/portal/api";

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

export type ProviderStats = {
  sessions_completed: number;
  sessions_cancelled: number;
  orders_total: number;
  orders_active: number;
  offers_rejected: number;
};

export type ProviderDetail = ProviderRow & {
  user_id: string;
  rating_count: number;
  joined_at: string;
  approved_at: string | null;
  stats: ProviderStats;
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
  provider_name: string | null;
  provider_phone: string | null;
  amount_pkr: number;
  method: string;
  reference: string;
  proof_file_id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reject_reason: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type LedgerRow = {
  id: string;
  type: "TOPUP" | "COMMISSION" | "ADJUSTMENT";
  amount_pkr: number;
  balance_after_pkr: number;
  note: string | null;
  created_at: string;
  booking_id: string | null;
  booking_number: number | null;
  session_sequence: number | null;
  created_by_name: string | null;
};

export type ComplaintStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";

export type ComplaintRow = {
  id: string;
  booking_id: string;
  booking_number: number | null;
  session_id: string | null;
  session_sequence: number | null;
  text: string;
  status: ComplaintStatus;
  resolution: string | null;
  resolved_at: string | null;
  raised_by_name: string | null;
  raised_by_phone: string | null;
  provider_id: string | null;
  provider_name: string | null;
  created_at: string;
};

export type Review = {
  id: string;
  session_id: string;
  provider_id: string;
  provider_name: string | null;
  booking_id: string | null;
  booking_number: number | null;
  session_sequence: number | null;
  reviewer_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type TimelineType =
  | "ORDER_PLACED"
  | "OFFERED"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN"
  | "SESSION"
  | "RATED"
  | "COMPLAINT_RAISED"
  | "COMPLAINT_CLOSED"
  | "ORDER_CANCELLED";

export type StaffSessionDetail = {
  id: string;
  sequence: number;
  provider_id: string;
  provider_name: string | null;
  scheduled_at: string;
  status: SessionView["status"];
  arrived_at: string | null;
  completed_at: string | null;
  pain_score: number | null;
  notes: string | null;
  cancel_reason: string | null;
  price_pkr: number;
  commission_pkr: number;
  commission_charged: boolean;
  rating: number | null;
  review_comment: string | null;
};

export type StaffBookingDetail = {
  booking: StaffBooking;
  patient_id: string;
  booked_by_id: string;
  provider_id: string | null;
  preferred_gender: "MALE" | "FEMALE" | null;
  lat: number | null;
  lng: number | null;
  cancelled_at: string | null;
  updated_at: string;
  commission_total_pkr: number;
  commission_charged_pkr: number;
  sessions: StaffSessionDetail[];
  assignments: {
    provider_id: string;
    provider_name: string | null;
    status: "OFFERED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
    reject_reason: string | null;
    offered_at: string;
    responded_at: string | null;
    assigned_by_name: string | null;
  }[];
  complaints: {
    id: string;
    text: string;
    status: ComplaintStatus;
    resolution: string | null;
    created_at: string;
    resolved_at: string | null;
  }[];
  timeline: {
    at: string;
    type: TimelineType;
    actor_name: string | null;
    session_sequence: number | null;
    status: string | null;
    note: string | null;
  }[];
};

export type PatientAccountRow = {
  id: string;
  name: string | null;
  phone: string;
  is_active: boolean;
  created_at: string;
  people_count: number;
  orders_count: number;
};

export type PatientAccountDetail = PatientAccountRow & {
  email: string | null;
  active_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  spent_pkr: number;
  people: PatientPerson[];
};

export type PlatformSettings = {
  commission_bps: number | null;
  minimum_balance_pkr: number;
  topup_instructions: string;
};

const KEYS = {
  providers: ["admin", "providers"] as const,
  bookings: ["admin", "bookings"] as const,
  topups: ["admin", "topups"] as const,
  ledger: ["admin", "ledger"] as const,
  complaints: ["admin", "complaints"] as const,
  reviews: ["admin", "reviews"] as const,
  patients: ["admin", "patients"] as const,
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

export type BookingFilters = {
  page: number;
  page_size?: number;
  status?: BookingStatus;
  search?: string;
  provider_id?: string;
  booked_by?: string;
};

export function useAdminBookings(filters: BookingFilters, enabled = true) {
  return useQuery<Page<StaffBooking>, ApiError>({
    queryKey: [...KEYS.bookings, filters],
    queryFn: () => apiGet<Page<StaffBooking>>("/admin/bookings", filters),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useBookingDetail(id: string | null) {
  return useQuery<StaffBookingDetail, ApiError>({
    queryKey: [...KEYS.bookings, "detail", id],
    queryFn: () => apiGet<StaffBookingDetail>(`/admin/bookings/${id}`),
    enabled: Boolean(id),
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

export function useTopups(
  filters: { page: number; page_size?: number; status?: TopupRow["status"]; provider_id?: string },
  enabled = true,
) {
  return useQuery<Page<TopupRow>, ApiError>({
    queryKey: [...KEYS.topups, filters],
    queryFn: () => apiGet<Page<TopupRow>>("/admin/wallet/topups", filters),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useLedger(providerId: string, page: number, enabled = true) {
  return useQuery<Page<LedgerRow>, ApiError>({
    queryKey: [...KEYS.ledger, providerId, page],
    queryFn: () =>
      apiGet<Page<LedgerRow>>(`/admin/wallet/providers/${providerId}/transactions`, { page, page_size: 10 }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAdjustBalance() {
  return useAdminMutation(({ id, amount_pkr, note }: { id: string; amount_pkr: number; note: string }) =>
    apiPost(`/admin/wallet/providers/${id}/adjust`, { amount_pkr, note }),
  );
}

export function useReviewTopup() {
  return useAdminMutation(({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
    apiPost(`/admin/wallet/topups/${id}/review`, { approve, reason }),
  );
}

export function useComplaints(
  filters: { page: number; page_size?: number; status?: ComplaintStatus; provider_id?: string },
  enabled = true,
) {
  return useQuery<Page<ComplaintRow>, ApiError>({
    queryKey: [...KEYS.complaints, filters],
    queryFn: () => apiGet<Page<ComplaintRow>>("/admin/complaints", filters),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useLowRatings() {
  return useQuery<Review[], ApiError>({
    queryKey: [...KEYS.complaints, "low-ratings"],
    queryFn: () => apiGet<Review[]>("/admin/low-ratings"),
  });
}

export function useReviews(filters: { page: number; provider_id?: string }, enabled = true) {
  return useQuery<Page<Review>, ApiError>({
    queryKey: [...KEYS.reviews, filters],
    queryFn: () => apiGet<Page<Review>>("/admin/reviews", { ...filters, page_size: 10 }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function usePatientAccounts(filters: { page: number; search?: string }) {
  return useQuery<Page<PatientAccountRow>, ApiError>({
    queryKey: [...KEYS.patients, filters],
    queryFn: () => apiGet<Page<PatientAccountRow>>("/admin/patients", filters),
    placeholderData: keepPreviousData,
  });
}

export function usePatientAccount(id: string | null) {
  return useQuery<PatientAccountDetail, ApiError>({
    queryKey: [...KEYS.patients, "detail", id],
    queryFn: () => apiGet<PatientAccountDetail>(`/admin/patients/${id}`),
    enabled: Boolean(id),
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
