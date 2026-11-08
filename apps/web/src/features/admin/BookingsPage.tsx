"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { RecordLink, Segmented } from "@/components/admin/records";
import {
  adminInput,
  Card,
  EmptyState,
  ErrorState,
  formatDateTime,
  PageHeader,
  Pagination,
  TableSkeleton,
} from "@/components/admin/ui";
import type { BookingStatus } from "@/features/portal/api";
import { BookingStatusBadge } from "@/features/portal/shared";
import { cn } from "@/lib/cn";
import { formatPkr } from "@/lib/format";
import { type BookingFilters, type StaffBooking, useAdminBookings } from "./operationsApi";

const FILTERS: { value: BookingStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "AWAITING_ACCEPTANCE", label: "Waiting" },
  { value: "PENDING_ASSIGNMENT", label: "Needs physio" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const orderHref = (id: string) => `/admin/bookings/view/?id=${id}`;
export const physioHref = (id: string) => `/admin/providers/view/?id=${id}`;
export const patientHref = (id: string) => `/admin/patients/view/?id=${id}`;

export function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value.trim()), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function BookingsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<BookingStatus | undefined>();
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput);

  return (
    <>
      <PageHeader title="Orders" description="Every booking. Open one to see its full record, money and history." />
      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 p-4">
          <Segmented
            label="Filter by status"
            value={status}
            options={FILTERS}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
          <div className="relative ms-auto w-full sm:w-56">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Find an order number"
              placeholder="Order number, e.g. KC-1001"
              maxLength={20}
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setPage(1);
              }}
              className={cn(adminInput, "ps-9")}
            />
          </div>
        </div>
        <OrdersTable filters={{ page, status, search: search || undefined }} onPageChange={setPage} />
      </Card>
    </>
  );
}

/** The orders table, reused on physiotherapist and patient records. */
export function OrdersTable({
  filters,
  onPageChange,
  hide,
  empty = "No orders here yet",
}: {
  filters: BookingFilters;
  onPageChange: (page: number) => void;
  hide?: "patient" | "physio";
  empty?: string;
}) {
  const bookings = useAdminBookings(filters);
  const items = bookings.data?.items ?? [];

  if (bookings.isPending) return <TableSkeleton rows={4} />;
  if (bookings.isError) return <ErrorState onRetry={() => void bookings.refetch()} />;
  if (items.length === 0) return <EmptyState title={empty} />;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-xs text-stone-500">
              <th scope="col" className="px-5 py-2.5 text-start font-medium">Order</th>
              {hide !== "patient" ? <th scope="col" className="px-5 py-2.5 text-start font-medium">Patient</th> : null}
              {hide !== "physio" ? (
                <th scope="col" className="px-5 py-2.5 text-start font-medium">Physiotherapist</th>
              ) : null}
              <th scope="col" className="px-5 py-2.5 text-start font-medium">Status</th>
              <th scope="col" className="px-5 py-2.5 text-end font-medium">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.map((item) => (
              <OrderRow key={item.id} item={item} hide={hide} />
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={bookings.data.page}
        pageSize={bookings.data.page_size}
        total={bookings.data.total}
        onPageChange={onPageChange}
      />
    </>
  );
}

function OrderRow({ item, hide }: { item: StaffBooking; hide?: "patient" | "physio" }) {
  const done = item.sessions.filter((session) => session.status === "COMPLETED").length;
  return (
    <tr className="transition hover:bg-stone-50">
      <td className="px-5 py-3">
        <RecordLink href={orderHref(item.id)} className="text-stone-900">
          KC-{item.number}
        </RecordLink>
        <p className="text-xs text-stone-500">
          {item.service_name} · {formatDateTime(item.created_at)}
        </p>
      </td>
      {hide !== "patient" ? (
        <td className="px-5 py-3 text-stone-700">
          {item.patient.name}
          <p className="text-xs text-stone-500">{item.area_name}</p>
        </td>
      ) : null}
      {hide !== "physio" ? (
        <td className="px-5 py-3 text-stone-700">
          {item.provider ? (
            <RecordLink href={physioHref(item.provider.id)} className="text-stone-700">
              {item.provider.name ?? "Unnamed"}
            </RecordLink>
          ) : (
            <span className="text-stone-400">Not assigned</span>
          )}
        </td>
      ) : null}
      <td className="px-5 py-3">
        <BookingStatusBadge status={item.status} />
        <p className="mt-1 text-xs text-stone-500 tabular-nums">
          {done} of {item.sessions_count} {item.sessions_count === 1 ? "session" : "sessions"} done
        </p>
      </td>
      <td className="px-5 py-3 text-end text-stone-700 tabular-nums">{formatPkr(item.price_total_pkr)}</td>
    </tr>
  );
}
