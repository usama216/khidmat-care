"use client";

import { useState } from "react";
import { Check, CircleDot, Hourglass, Star, X } from "lucide-react";
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
import { useComplaints, useLowRatings, useUpdateComplaint, type ComplaintRow } from "./operationsApi";

const BADGES = {
  OPEN: (
    <Badge tone="attention" icon={CircleDot}>
      Open
    </Badge>
  ),
  IN_PROGRESS: (
    <Badge tone="attention" icon={Hourglass}>
      In progress
    </Badge>
  ),
  RESOLVED: (
    <Badge tone="good" icon={Check}>
      Resolved
    </Badge>
  ),
  DISMISSED: <Badge icon={X}>Dismissed</Badge>,
};

export function ComplaintsPage() {
  const [page, setPage] = useState(1);
  const complaints = useComplaints({ page });
  const lowRatings = useLowRatings();
  const items = complaints.data?.items ?? [];

  return (
    <>
      <PageHeader title="Complaints" description="Problems reported by patients, and low ratings to follow up." />
      <Card className="mt-6">
        {complaints.isPending ? (
          <TableSkeleton rows={3} />
        ) : complaints.isError ? (
          <ErrorState onRetry={() => void complaints.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="No complaints" />
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
      <Card className="mt-3">
        {lowRatings.data && lowRatings.data.length > 0 ? (
          <ul className="divide-y divide-stone-100">
            {lowRatings.data.map((rating) => (
              <li key={rating.id} className="flex items-start gap-3 p-4 text-sm sm:px-5">
                <span className="flex shrink-0 items-center gap-1 font-semibold text-stone-900 tabular-nums">
                  <Star className="size-3.5 text-stone-400" aria-hidden="true" />
                  {rating.rating} of 5
                </span>
                <span className="min-w-0 text-stone-600">
                  {rating.comment ?? "No comment"}
                  <span className="block text-xs text-stone-500">{formatDateTime(rating.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No low ratings" />
        )}
      </Card>
    </>
  );
}

function ComplaintItem({ complaint }: { complaint: ComplaintRow }) {
  const update = useUpdateComplaint();
  const [closing, setClosing] = useState<"RESOLVED" | "DISMISSED" | null>(null);
  const open = complaint.status === "OPEN" || complaint.status === "IN_PROGRESS";

  return (
    <li className="p-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {BADGES[complaint.status]}
        <span className="text-xs text-stone-500">{formatDateTime(complaint.created_at)}</span>
      </div>
      <p dir="auto" className="mt-2 text-sm whitespace-pre-wrap text-stone-800">
        {complaint.text}
      </p>
      {complaint.resolution ? <p className="mt-1 text-sm text-stone-500">Decision: {complaint.resolution}</p> : null}
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
