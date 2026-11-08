"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import {
  adminButton,
  adminInput,
  Card,
  EmptyState,
  errorMessage,
  ErrorState,
  formatDateTime,
  FormError,
  FormField,
  Modal,
  PageHeader,
  Pagination,
  TableSkeleton,
} from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import { formatPkr } from "@/lib/format";
import {
  useCancelBooking,
  useCancelMySession,
  useComplain,
  useMyBookings,
  useRateSession,
  type BookingView,
  type SessionView,
} from "./api";
import { EmergencyLine, PortalPage, RequireRole } from "./PortalShell";
import { ChoosePhysioDialog } from "./ChoosePhysioDialog";
import { PhysioPhoto } from "./FindPage";
import { BookingStatusBadge, ContactLine, ReasonDialog, SessionStatusBadge } from "./shared";

export function MyBookingsPage() {
  return (
    <PortalPage>
      <RequireRole role="PATIENT">{() => <BookingList />}</RequireRole>
    </PortalPage>
  );
}

function BookingList() {
  const [page, setPage] = useState(1);
  const bookings = useMyBookings(page);

  return (
    <>
      <PageHeader
        title="My orders"
        actions={
          <Link href="/find/" className={adminButton("primary")}>
            Book a physio
          </Link>
        }
      />
      <div className="mt-4 space-y-3">
        {bookings.isPending ? (
          <Card>
            <TableSkeleton rows={3} />
          </Card>
        ) : bookings.isError ? (
          <Card>
            <ErrorState onRetry={() => void bookings.refetch()} />
          </Card>
        ) : bookings.data.items.length === 0 ? (
          <Card>
            <EmptyState title="No orders yet" description="Find a physiotherapist to book your first visit." />
          </Card>
        ) : (
          <>
            {bookings.data.items.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
            <Card>
              <Pagination
                page={bookings.data.page}
                pageSize={bookings.data.page_size}
                total={bookings.data.total}
                onPageChange={setPage}
              />
            </Card>
          </>
        )}
        <EmergencyLine />
      </div>
    </>
  );
}

function BookingCard({ booking }: { booking: BookingView }) {
  const cancel = useCancelBooking();
  const complain = useComplain();
  const [dialog, setDialog] = useState<"cancel" | "complain" | "choose" | null>(null);
  const open = booking.status !== "CANCELLED" && booking.status !== "COMPLETED";
  const locked = booking.sessions.some(
    (session) => ["SCHEDULED", "ON_THE_WAY", "ARRIVED"].includes(session.status) && !session.can_cancel,
  );

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-stone-500">Order KC-{booking.number}</p>
        <BookingStatusBadge status={booking.status} />
      </div>
      <h2 className="mt-1 font-semibold text-stone-900">{booking.service_name}</h2>
      <p className="text-sm text-stone-600">
        For {booking.patient.name} · {booking.sessions_count} {booking.sessions_count === 1 ? "session" : "sessions"} ·{" "}
        {formatPkr(booking.price_total_pkr)} cash
      </p>
      {booking.status === "AWAITING_ACCEPTANCE" ? (
        <p className="mt-1 text-sm text-stone-600">Requested time: {formatDateTime(booking.preferred_start_at)}</p>
      ) : null}

      {booking.provider ? (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-stone-50 p-3">
          <PhysioPhoto url={booking.provider.photo_url} name={booking.provider.name ?? "Physio"} size="size-10" />
          <div className="text-sm">
            <p className="font-medium text-stone-900">{booking.provider.name}</p>
            <p className="text-stone-600">{booking.provider.qualification}</p>
          </div>
        </div>
      ) : null}

      {booking.status === "PENDING_ASSIGNMENT" ? (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
          The physio couldn&apos;t take this order. Please choose another.
          <button type="button" onClick={() => setDialog("choose")} className={adminButton("primary", "mt-2 w-full")}>
            Choose another physio
          </button>
        </div>
      ) : null}

      {booking.sessions.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {booking.sessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {open ? (
          <button
            type="button"
            disabled={locked}
            title={locked ? "A session starts within 2 hours" : undefined}
            onClick={() => setDialog("cancel")}
            className={adminButton("ghost")}
          >
            {locked ? "Can't cancel within 2 hours" : "Cancel order"}
          </button>
        ) : null}
        <button type="button" onClick={() => setDialog("complain")} className={adminButton("ghost")}>
          Report a problem
        </button>
      </div>

      {dialog === "cancel" ? (
        <ReasonDialog
          title="Cancel this order?"
          label="Why are you cancelling?"
          confirm="Cancel order"
          pending={cancel.isPending}
          error={cancel.error}
          onClose={() => setDialog(null)}
          onConfirm={(reason) =>
            cancel.mutate({ id: booking.id, reason }, { onSuccess: () => setDialog(null) })
          }
        />
      ) : null}
      {dialog === "choose" ? <ChoosePhysioDialog booking={booking} onClose={() => setDialog(null)} /> : null}
      {dialog === "complain" ? (
        <ReasonDialog
          title="Report a problem"
          label="What happened?"
          confirm="Send to our team"
          pending={complain.isPending}
          error={complain.error}
          onClose={() => setDialog(null)}
          onConfirm={(text) => complain.mutate({ id: booking.id, text }, { onSuccess: () => setDialog(null) })}
        />
      ) : null}
    </Card>
  );
}

function SessionRow({ session }: { session: SessionView }) {
  const cancel = useCancelMySession();
  const [dialog, setDialog] = useState<"cancel" | "rate" | null>(null);
  return (
    <li className="rounded-lg p-3 ring-1 ring-stone-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-stone-900">
          Session {session.sequence} · {formatDateTime(session.scheduled_at)}
        </p>
        <SessionStatusBadge status={session.status} />
      </div>
      <ContactLine session={session} who="physio" />
      {session.status === "COMPLETED" ? (
        <div className="mt-2 text-sm text-stone-600">
          {session.pain_score !== null ? <p>Pain score: {session.pain_score} out of 10</p> : null}
          {session.notes ? <p className="mt-1 whitespace-pre-wrap">{session.notes}</p> : null}
          {session.rating ? (
            <p className="mt-1 text-xs text-stone-500">You rated this {session.rating} out of 5.</p>
          ) : (
            <button type="button" onClick={() => setDialog("rate")} className={adminButton("secondary", "mt-2")}>
              Rate this session
            </button>
          )}
        </div>
      ) : null}
      {session.can_cancel ? (
        <button type="button" onClick={() => setDialog("cancel")} className={adminButton("ghost", "mt-2")}>
          Cancel this session
        </button>
      ) : null}
      {dialog === "cancel" ? (
        <ReasonDialog
          title="Cancel this session?"
          label="Why are you cancelling?"
          confirm="Cancel session"
          pending={cancel.isPending}
          error={cancel.error}
          onClose={() => setDialog(null)}
          onConfirm={(reason) => cancel.mutate({ id: session.id, reason }, { onSuccess: () => setDialog(null) })}
        />
      ) : null}
      {dialog === "rate" ? <RateDialog sessionId={session.id} onClose={() => setDialog(null)} /> : null}
    </li>
  );
}

function RateDialog({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const id = useId();
  const rate = useRateSession();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [invalid, setInvalid] = useState(false);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (rating === 0) {
      setInvalid(true);
      return;
    }
    rate.mutate({ id: sessionId, rating, comment: comment.trim() }, { onSuccess: onClose });
  };

  return (
    <Modal title="Rate this session" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-stone-700">Your rating</legend>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <label key={value} className="cursor-pointer p-1" aria-label={`${value} out of 5`}>
                <input
                  type="radio"
                  name="rating"
                  className="sr-only"
                  checked={rating === value}
                  onChange={() => {
                    setRating(value);
                    setInvalid(false);
                  }}
                />
                <Star
                  aria-hidden="true"
                  className={cn("size-7", value <= rating ? "fill-amber-400 text-amber-500" : "text-stone-300")}
                />
              </label>
            ))}
          </div>
          {invalid ? <p className="mt-1 text-xs font-medium text-red-600">Choose a rating.</p> : null}
        </fieldset>
        <FormField id={id} label="Comment (optional)">
          <textarea
            id={id}
            rows={3}
            maxLength={1000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className={`${adminInput} h-auto py-2`}
          />
        </FormField>
        <FormError message={rate.isError ? errorMessage(rate.error) : null} />
        <button type="submit" disabled={rate.isPending} className={adminButton("primary", "w-full")}>
          Send rating
        </button>
      </form>
    </Modal>
  );
}
