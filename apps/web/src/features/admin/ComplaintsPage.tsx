"use client";

import { useState } from "react";
import { Check, CircleDot, Hourglass, Phone, Star, X } from "lucide-react";
import { RecordLink, Segmented } from "@/components/admin/records";
import {
  adminButton,
  Badge,
  Card,
  EmptyState,
  errorMessage,
  ErrorState,
  formatDateTime,
  FormError,
  PageHeader,
  Pagination,
  TableSkeleton,
} from "@/components/admin/ui";
import { ReasonDialog } from "@/features/portal/shared";
import { orderHref, physioHref } from "./BookingsPage";
import {
  type ComplaintRow,
  type ComplaintStatus,
  type Review,
  useComplaints,
  useLowRatings,
  useUpdateComplaint,
} from "./operationsApi";

export function ComplaintBadge({ status }: { status: ComplaintStatus }) {
  switch (status) {
    case "OPEN":
      return (
        <Badge tone="attention" icon={CircleDot}>
          Open
        </Badge>
      );
    case "IN_PROGRESS":
      return (
        <Badge tone="attention" icon={Hourglass}>
          In progress
        </Badge>
      );
    case "RESOLVED":
      return (
        <Badge tone="good" icon={Check}>
          Resolved
        </Badge>
      );
    default:
      return <Badge icon={X}>Dismissed</Badge>;
  }
}

const FILTERS: { value: ComplaintStatus | undefined; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "DISMISSED", label: "Dismissed" },
  { value: undefined, label: "All" },
];

export function ComplaintsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ComplaintStatus | undefined>("OPEN");
  const complaints = useComplaints({ page, status });
  const lowRatings = useLowRatings();
  const items = complaints.data?.items ?? [];

  return (
    <>
      <PageHeader title="Complaints" description="Problems reported by patients, and low ratings to follow up." />
      <Card className="mt-6">
        <div className="border-b border-stone-200 p-4">
          <Segmented
            label="Filter by status"
            value={status}
            options={FILTERS}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
        </div>
        {complaints.isPending ? (
          <TableSkeleton rows={3} />
        ) : complaints.isError ? (
          <ErrorState onRetry={() => void complaints.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title={status === "OPEN" ? "No open complaints" : "No complaints here"} />
        ) : (
          <>
            <ul className="divide-y divide-stone-100">
              {items.map((complaint) => (
                <ComplaintItem key={complaint.id} complaint={complaint} />
              ))}
            </ul>
            <Pagination
              page={complaints.data.page}
              pageSize={complaints.data.page_size}
              total={complaints.data.total}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <h2 className="mt-8 font-semibold text-stone-900">Low ratings</h2>
      <p className="text-sm text-stone-500">Sessions rated 2 stars or below.</p>
      <Card className="mt-3">
        {lowRatings.data && lowRatings.data.length > 0 ? (
          <ul className="divide-y divide-stone-100">
            {lowRatings.data.map((rating) => (
              <ReviewItem key={rating.id} review={rating} />
            ))}
          </ul>
        ) : (
          <EmptyState title="No low ratings" />
        )}
      </Card>
    </>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          className={index < rating ? "size-3.5 fill-amber-400 text-amber-400" : "size-3.5 text-stone-300"}
        />
      ))}
    </span>
  );
}

export function ReviewItem({ review, showPhysio = true }: { review: Review; showPhysio?: boolean }) {
  return (
    <li className="px-5 py-3.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Stars rating={review.rating} />
        <span className="text-xs text-stone-500">{formatDateTime(review.created_at)}</span>
      </div>
      <p dir="auto" className="mt-1.5 text-stone-800">
        {review.comment ?? <span className="text-stone-500">No comment</span>}
      </p>
      <p className="mt-1 text-xs text-stone-500">
        {review.reviewer_name ?? "A patient"}
        {review.booking_id && review.booking_number ? (
          <>
            {" · "}
            <RecordLink href={orderHref(review.booking_id)}>
              KC-{review.booking_number}, session {review.session_sequence}
            </RecordLink>
          </>
        ) : null}
        {showPhysio ? (
          <>
            {" · "}
            <RecordLink href={physioHref(review.provider_id)}>{review.provider_name ?? "Physio"}</RecordLink>
          </>
        ) : null}
      </p>
    </li>
  );
}

export function ComplaintItem({ complaint, showPhysio = true }: { complaint: ComplaintRow; showPhysio?: boolean }) {
  const update = useUpdateComplaint();
  const [closing, setClosing] = useState<"RESOLVED" | "DISMISSED" | null>(null);
  const open = complaint.status === "OPEN" || complaint.status === "IN_PROGRESS";

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <ComplaintBadge status={complaint.status} />
          {complaint.booking_number ? (
            <RecordLink href={orderHref(complaint.booking_id)}>
              KC-{complaint.booking_number}
              {complaint.session_sequence ? `, session ${complaint.session_sequence}` : ""}
            </RecordLink>
          ) : null}
        </div>
        <span className="text-xs text-stone-500">{formatDateTime(complaint.created_at)}</span>
      </div>
      <p dir="auto" className="mt-2 text-sm whitespace-pre-wrap text-stone-800">
        {complaint.text}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
        <span>
          From <span className="font-medium text-stone-700">{complaint.raised_by_name ?? "a patient"}</span>
        </span>
        {complaint.raised_by_phone ? (
          <a href={`tel:${complaint.raised_by_phone}`} className="inline-flex items-center gap-1 tabular-nums hover:underline">
            <Phone className="size-3" aria-hidden="true" />
            {complaint.raised_by_phone}
          </a>
        ) : null}
        {showPhysio && complaint.provider_id ? (
          <span>
            About <RecordLink href={physioHref(complaint.provider_id)}>{complaint.provider_name ?? "the physio"}</RecordLink>
          </span>
        ) : null}
      </p>
      {complaint.resolution ? (
        <p className="mt-2 rounded-lg bg-stone-50 p-2.5 text-sm text-stone-700 ring-1 ring-stone-200">
          <span className="font-medium">Decision:</span> {complaint.resolution}
        </p>
      ) : null}
      {open ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {complaint.status === "OPEN" ? (
            <button
              type="button"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: complaint.id, status: "IN_PROGRESS" })}
              className={adminButton("secondary")}
            >
              Start working on it
            </button>
          ) : null}
          <button type="button" onClick={() => setClosing("RESOLVED")} className={adminButton("primary")}>
            Resolve
          </button>
          <button type="button" onClick={() => setClosing("DISMISSED")} className={adminButton("ghost")}>
            Dismiss
          </button>
        </div>
      ) : null}
      <div className="mt-2 empty:hidden">
        {update.isError && !closing ? <FormError message={errorMessage(update.error)} /> : null}
      </div>
      {closing ? (
        <ReasonDialog
          title={closing === "RESOLVED" ? "Resolve this complaint" : "Dismiss this complaint"}
          label="What was decided?"
          confirm="Save"
          pending={update.isPending}
          error={update.error}
          onClose={() => setClosing(null)}
          onConfirm={(resolution) =>
            update.mutate({ id: complaint.id, status: closing, resolution }, { onSuccess: () => setClosing(null) })
          }
        />
      ) : null}
    </li>
  );
}
