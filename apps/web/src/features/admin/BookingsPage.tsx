"use client";

import { useState } from "react";
import {
  adminButton,
  Card,
  EmptyState,
  ErrorState,
  formatDateTime,
  Modal,
  PageHeader,
  Pagination,
  TableSkeleton,
} from "@/components/admin/ui";
import type { BookingStatus, SessionView } from "@/features/portal/api";
import { ChoosePhysioDialog } from "@/features/portal/ChoosePhysioDialog";
import { BookingStatusBadge, ReasonDialog, SessionStatusBadge } from "@/features/portal/shared";
import { cn } from "@/lib/cn";
import { formatPkr } from "@/lib/format";
import { useAdminBookings, useCloseSession, type StaffBooking } from "./operationsApi";

const FILTERS: { value: BookingStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "AWAITING_ACCEPTANCE", label: "Waiting" },
  { value: "PENDING_ASSIGNMENT", label: "Needs physio" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function BookingsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<BookingStatus | undefined>();
  const [openId, setOpenId] = useState<string | null>(null);
  const bookings = useAdminBookings({ page, status });
  const items = bookings.data?.items ?? [];
  const open = items.find((item) => item.id === openId);

  return (
    <>
      <PageHeader title="Orders" description="Every booking, with both sides' contact details for support." />
      <Card className="mt-6">
        <div className="border-b border-stone-200 p-4">
          <div role="group" aria-label="Filter by status" className="flex w-fit flex-wrap gap-1 rounded-lg bg-stone-100 p-1">
            {FILTERS.map((filter) => (
              <button
                key={filter.label}
                type="button"
                aria-pressed={status === filter.value}
                onClick={() => {
                  setStatus(filter.value);
                  setPage(1);
                }}
                className={cn(
                  "h-7 rounded-md px-3 text-sm font-medium transition",
                  status === filter.value ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        {bookings.isPending ? (
          <TableSkeleton />
        ) : bookings.isError ? (
          <ErrorState onRetry={() => void bookings.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="No orders here yet" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">Order</th>
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">Patient</th>
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">Physiotherapist</th>
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">Status</th>
                    <th scope="col" className="px-5 py-2.5 text-end font-medium">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.map((item) => (
                    <tr key={item.id} className="transition hover:bg-stone-50">
                      <td className="px-5 py-3">
                        <button type="button" onClick={() => setOpenId(item.id)} className="text-start font-medium text-stone-900 hover:underline">
                          KC-{item.number}
                        </button>
                        <p className="text-xs text-stone-500">{item.service_name}</p>
                      </td>
                      <td className="px-5 py-3 text-stone-600">
                        {item.patient.name}
                        <p className="text-xs text-stone-500">{item.area_name}</p>
                      </td>
                      <td className="px-5 py-3 text-stone-600">{item.provider?.name ?? "-"}</td>
                      <td className="px-5 py-3">
                        <BookingStatusBadge status={item.status} />
                      </td>
                      <td className="px-5 py-3 text-end text-stone-700 tabular-nums">{formatPkr(item.price_total_pkr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={bookings.data.page}
              pageSize={bookings.data.page_size}
              total={bookings.data.total}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
      {open ? <BookingDrawer booking={open} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

function BookingDrawer({ booking, onClose }: { booking: StaffBooking; onClose: () => void }) {
  const [assigning, setAssigning] = useState(false);
  const assignable = booking.status === "PENDING_ASSIGNMENT" || booking.status === "AWAITING_ACCEPTANCE";
  return (
    <Modal title={`Order KC-${booking.number}`} onClose={onClose} side>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BookingStatusBadge status={booking.status} />
          {assignable ? (
            <button type="button" onClick={() => setAssigning(true)} className={adminButton("primary")}>
              Assign a physio
            </button>
          ) : null}
        </div>
        {assigning ? <ChoosePhysioDialog booking={booking} staff onClose={() => setAssigning(false)} /> : null}
        <dl className="grid grid-cols-2 gap-3">
          <Info label="Treatment" value={booking.service_name} />
          <Info label="Sessions" value={String(booking.sessions_count)} />
          <Info label="Patient" value={booking.patient.name} />
          <Info label="Area" value={booking.area_name} />
          <Info label="Booked by" value={`${booking.booker_name ?? ""} ${booking.booker_phone ?? ""}`} />
          <Info label="Physiotherapist" value={`${booking.provider?.name ?? "-"} ${booking.provider_phone ?? ""}`} />
          <Info label="Total price" value={formatPkr(booking.price_total_pkr)} />
          <Info label="Commission" value={`${booking.commission_bps / 100}%`} />
        </dl>
        <p className="text-stone-600">{booking.address_line}</p>
        <p dir="auto" className="rounded-lg bg-stone-50 p-3 text-stone-700 ring-1 ring-stone-200">
          {booking.condition}
        </p>
        {booking.cancel_reason ? <p className="text-stone-600">Cancelled: {booking.cancel_reason}</p> : null}
        <section>
          <h3 className="font-semibold text-stone-900">Sessions</h3>
          {booking.sessions.length === 0 ? <p className="mt-1 text-stone-500">Not scheduled yet.</p> : null}
          <ul className="mt-2 space-y-2">
            {booking.sessions.map((session) => (
              <AdminSession key={session.id} session={session} />
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}

function AdminSession({ session }: { session: SessionView }) {
  const close = useCloseSession();
  const [dialog, setDialog] = useState<"CANCELLED" | "NO_SHOW" | null>(null);
  const open = ["SCHEDULED", "ON_THE_WAY", "ARRIVED"].includes(session.status);

  return (
    <li className="rounded-lg p-3 ring-1 ring-stone-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-stone-900">
          Session {session.sequence} · {formatDateTime(session.scheduled_at)}
        </span>
        <SessionStatusBadge status={session.status} />
      </div>
      {session.pain_score !== null ? <p className="mt-1 text-stone-600">Pain score: {session.pain_score} of 10</p> : null}
      {session.notes ? <p className="mt-1 text-stone-600">{session.notes}</p> : null}
      {open ? (
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => setDialog("CANCELLED")} className={adminButton("ghost")}>
            Cancel session
          </button>
          <button type="button" onClick={() => setDialog("NO_SHOW")} className={adminButton("ghost")}>
            Mark no-show
          </button>
        </div>
      ) : null}
      {dialog ? (
        <ReasonDialog
          title={dialog === "NO_SHOW" ? "Mark as no-show?" : "Cancel this session?"}
          label="Reason (saved in the audit log)"
          confirm="Confirm"
          pending={close.isPending}
          error={close.error}
          onClose={() => setDialog(null)}
          onConfirm={(reason) =>
            close.mutate({ id: session.id, status: dialog, reason }, { onSuccess: () => setDialog(null) })
          }
        />
      ) : null}
    </li>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="font-medium text-stone-900">{value}</dd>
    </div>
  );
}
