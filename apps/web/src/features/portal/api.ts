"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ApiError, apiGet, apiPost, apiPut } from "@/lib/api";

export type Page<T> = { items: T[]; total: number; page: number; page_size: number };
export type Gender = "MALE" | "FEMALE";

export type CatalogPackage = { id: string; sessions_count: number; price_pkr: number };
export type CatalogService = {
  id: string;
  slug: string;
  name: string;
  name_urdu: string;
  description: string | null;
  packages: CatalogPackage[];
};
export type CatalogArea = { id: string; name: string; name_urdu: string };
export type Catalog = { services: CatalogService[]; areas: CatalogArea[] };

export type AvailabilitySlot = { day_of_week: number; start_minute: number; end_minute: number };

export type Physio = {
  id: string;
  name: string | null;
  gender: Gender;
  qualification: string;
  experience_years: number;
  bio: string | null;
  rating_avg: number;
  rating_count: number;
  photo_url: string | null;
  service_type_ids: string[];
  area_ids: string[];
  availability: AvailabilitySlot[];
};

export type PatientPerson = {
  id: string;
  name: string;
  gender: Gender;
  birth_year: number | null;
  relation: string;
};

export type SessionView = {
  id: string;
  sequence: number;
  scheduled_at: string;
  status: "SCHEDULED" | "ON_THE_WAY" | "ARRIVED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  pain_score: number | null;
  notes: string | null;
  can_cancel: boolean;
  contact_phone: string | null;
  contact_opens_at: string;
  rating: number | null;
};

export type BookingStatus = "PENDING_ASSIGNMENT" | "AWAITING_ACCEPTANCE" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export type BookingView = {
  id: string;
  number: number;
  status: BookingStatus;
  service_name: string;
  area_name: string;
  sessions_count: number;
  price_total_pkr: number;
  preferred_start_at: string;
  condition: string;
  address_line: string | null;
  patient: { name: string; gender: Gender; birth_year: number | null; relation: string };
  provider: {
    id: string;
    name: string | null;
    gender: Gender;
    qualification: string;
    experience_years: number;
    rating_avg: number;
    rating_count: number;
    photo_url: string | null;
  } | null;
  sessions: SessionView[];
  created_at: string;
  cancel_reason: string | null;
};

export type DocumentType = "CNIC_FRONT" | "CNIC_BACK" | "DEGREE" | "LICENSE" | "OTHER";

export type ProviderProfile = {
  id: string;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  status_reason: string | null;
  gender: Gender;
  cnic_masked: string;
  qualification: string;
  experience_years: number;
  bio: string | null;
  photo_file_id: string | null;
  photo_url: string | null;
  service_type_ids: string[];
  area_ids: string[];
  documents: { id: string; type: DocumentType; file_id: string }[];
  availability: AvailabilitySlot[];
  balance_pkr: number;
  minimum_balance_pkr: number;
  rating_avg: number;
  rating_count: number;
};

export type WalletSummary = {
  balance_pkr: number;
  minimum_balance_pkr: number;
  can_accept_orders: boolean;
  topup_instructions: string;
};
export type WalletTransaction = {
  id: string;
  type: "TOPUP" | "COMMISSION" | "ADJUSTMENT";
  amount_pkr: number;
  balance_after_pkr: number;
  note: string | null;
  created_at: string;
};
export type Topup = {
  id: string;
  amount_pkr: number;
  method: string;
  reference: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reject_reason: string | null;
  created_at: string;
};

const KEYS = {
  catalog: ["catalog"] as const,
  physios: ["physios"] as const,
  people: ["people"] as const,
  bookings: ["bookings"] as const,
  profile: ["provider", "profile"] as const,
  jobs: ["provider", "jobs"] as const,
  wallet: ["provider", "wallet"] as const,
};

export function useCatalog() {
  return useQuery<Catalog, ApiError>({ queryKey: KEYS.catalog, queryFn: () => apiGet<Catalog>("/catalog") });
}

export type PhysioFilters = { service_id?: string; area_id?: string; gender?: string };

export function usePhysios(filters: PhysioFilters) {
  return useQuery<Physio[], ApiError>({
    queryKey: [...KEYS.physios, filters],
    queryFn: () => apiGet<Physio[]>("/physios", filters),
    placeholderData: keepPreviousData,
  });
}

export function usePhysioSlots(physioId: string | undefined, day: string) {
  return useQuery<string[], ApiError>({
    queryKey: [...KEYS.physios, physioId, "slots", day],
    queryFn: () => apiGet<string[]>(`/physios/${physioId}/slots`, { day }),
    enabled: Boolean(physioId && day),
  });
}

export function usePeople(enabled = true) {
  return useQuery<PatientPerson[], ApiError>({
    queryKey: KEYS.people,
    queryFn: () => apiGet<PatientPerson[]>("/patients"),
    enabled,
  });
}

export function useAddPerson() {
  const client = useQueryClient();
  return useMutation<PatientPerson, ApiError, Omit<PatientPerson, "id">>({
    mutationFn: (values) => apiPost<PatientPerson>("/patients", values),
    onSuccess: () => void client.invalidateQueries({ queryKey: KEYS.people }),
  });
}

export type NewBooking = {
  patient_id: string;
  service_type_id: string;
  package_id: string;
  provider_id: string;
  address_line: string;
  area_id: string;
  start_at: string;
  condition: string;
};

function useBookingMutation<TVariables, TResult = unknown>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation<TResult, ApiError, TVariables>({
    mutationFn,
    onSuccess: () => void client.invalidateQueries({ queryKey: KEYS.bookings }),
  });
}

export function useCreateBooking() {
  return useBookingMutation((values: NewBooking) => apiPost<BookingView>("/bookings", values));
}

export function useMyBookings(page: number) {
  return useQuery<Page<BookingView>, ApiError>({
    queryKey: [...KEYS.bookings, page],
    queryFn: () => apiGet<Page<BookingView>>("/bookings", { page }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000, // The 2-hour number window opens by itself.
  });
}

export function useCancelBooking() {
  return useBookingMutation(({ id, reason }: { id: string; reason: string }) =>
    apiPost(`/bookings/${id}/cancel`, { reason }),
  );
}

export function useCancelMySession() {
  return useBookingMutation(({ id, reason }: { id: string; reason: string }) =>
    apiPost(`/bookings/sessions/${id}/cancel`, { reason }),
  );
}

export function useRateSession() {
  return useBookingMutation(({ id, rating, comment }: { id: string; rating: number; comment?: string }) =>
    apiPost(`/bookings/sessions/${id}/review`, { rating, comment: comment || undefined }),
  );
}

export function useComplain() {
  return useBookingMutation(({ id, text }: { id: string; text: string }) =>
    apiPost(`/bookings/${id}/complaints`, { text }),
  );
}

export function useChooseProvider() {
  return useBookingMutation(({ id, provider_id, start_at }: { id: string; provider_id: string; start_at: string }) =>
    apiPost(`/bookings/${id}/choose-provider`, { provider_id, start_at }),
  );
}

// Physiotherapist ---------------------------------------------------------------------------------

export function useProviderProfile() {
  return useQuery<ProviderProfile | null, ApiError>({
    queryKey: KEYS.profile,
    queryFn: () => apiGet<ProviderProfile | null>("/provider/profile"),
  });
}

function useProviderMutation<TVariables, TResult = unknown>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation<TResult, ApiError, TVariables>({
    mutationFn,
    onSuccess: () => void client.invalidateQueries({ queryKey: ["provider"] }),
  });
}

export type ProfileValues = {
  gender: Gender;
  cnic: string | null;
  qualification: string;
  experience_years: number;
  bio: string | null;
  photo_file_id: string | null;
  service_type_ids: string[];
  area_ids: string[];
};

export function useSaveProfile() {
  return useProviderMutation((values: ProfileValues) => apiPut<ProviderProfile>("/provider/profile", values));
}

export function useAttachDocument() {
  return useProviderMutation((values: { type: DocumentType; file_id: string }) =>
    apiPost("/provider/documents", values),
  );
}

export function useSubmitApplication() {
  return useProviderMutation(() => apiPost("/provider/submit", { accept_agreement: true }));
}

export function useSaveAvailability() {
  return useProviderMutation((slots: AvailabilitySlot[]) => apiPut("/provider/availability", { slots }));
}

export function useJobs(enabled: boolean) {
  return useQuery<Page<BookingView>, ApiError>({
    queryKey: KEYS.jobs,
    queryFn: () => apiGet<Page<BookingView>>("/provider/jobs", { page_size: 50 }),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useRespondToOffer() {
  return useProviderMutation(({ id, accept, reason }: { id: string; accept: boolean; reason?: string }) =>
    apiPost(`/provider/jobs/${id}/respond`, { accept, reason }),
  );
}

export function useScheduleSession() {
  return useProviderMutation(({ id, start_at }: { id: string; start_at: string }) =>
    apiPost(`/provider/jobs/${id}/sessions`, { start_at }),
  );
}

export function useAdvanceSession() {
  return useProviderMutation(
    ({ id, ...body }: { id: string; status: string; pain_score?: number; notes?: string }) =>
      apiPost(`/provider/sessions/${id}/status`, body),
  );
}

export function useCancelJobSession() {
  return useProviderMutation(({ id, reason }: { id: string; reason: string }) =>
    apiPost(`/provider/sessions/${id}/cancel`, { reason }),
  );
}

export function useWallet(enabled: boolean) {
  return useQuery<WalletSummary, ApiError>({
    queryKey: KEYS.wallet,
    queryFn: () => apiGet<WalletSummary>("/provider/wallet"),
    enabled,
  });
}

export function useWalletHistory(enabled: boolean) {
  return useQuery<Page<WalletTransaction>, ApiError>({
    queryKey: [...KEYS.wallet, "history"],
    queryFn: () => apiGet<Page<WalletTransaction>>("/provider/wallet/transactions"),
    enabled,
  });
}

export function useMyTopups(enabled: boolean) {
  return useQuery<Page<Topup>, ApiError>({
    queryKey: [...KEYS.wallet, "topups"],
    queryFn: () => apiGet<Page<Topup>>("/provider/wallet/topups"),
    enabled,
  });
}

export function useRequestTopup() {
  return useProviderMutation(
    (values: { amount_pkr: number; method: string; reference: string; proof_file_id: string }) =>
      apiPost("/provider/wallet/topups", values),
  );
}
