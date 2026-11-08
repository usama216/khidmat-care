"use client";

import { useId, useState, type FormEvent } from "react";
import { BadgeCheck, Clock, ExternalLink, X } from "lucide-react";
import { z } from "zod";
import {
  adminButton,
  adminInput,
  Badge,
  Card,
  EmptyState,
  errorMessage,
  ErrorState,
  formatDateTime,
  FormError,
  FormField,
  PageHeader,
  Pagination,
  Skeleton,
  TableSkeleton,
} from "@/components/admin/ui";
import { ReasonDialog } from "@/features/portal/shared";
import { cn } from "@/lib/cn";
import { formatPkr } from "@/lib/format";
import { RecordLink } from "@/components/admin/records";
import { physioHref } from "./BookingsPage";
import {
  useReviewTopup,
  useSaveSettings,
  useSettings,
  useTopups,
  type PlatformSettings,
  type TopupRow,
} from "./operationsApi";
import { useOpenFile } from "./useOpenFile";

const FILTERS: { value: TopupRow["status"] | undefined; label: string }[] = [
  { value: "PENDING", label: "To review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: undefined, label: "All" },
];

export function FinancePage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TopupRow["status"] | undefined>("PENDING");
  const topups = useTopups({ page, status });
  const items = topups.data?.items ?? [];

  return (
    <>
      <PageHeader title="Balances" description="Check payments before adding them to a physiotherapist's balance." />
      <Card className="mt-6">
        <div className="border-b border-stone-200 p-4">
          <div role="group" aria-label="Filter by status" className="flex w-fit gap-1 rounded-lg bg-stone-100 p-1">
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
        {topups.isPending ? (
          <TableSkeleton />
        ) : topups.isError ? (
          <ErrorState onRetry={() => void topups.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="No top-ups here" />
        ) : (
          <>
            <ul className="divide-y divide-stone-100">
              {items.map((topup) => (
                <TopupItem key={topup.id} topup={topup} />
              ))}
            </ul>
            <Pagination
              page={topups.data.page}
              pageSize={topups.data.page_size}
              total={topups.data.total}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </>
  );
}

export function TopupStatusBadge({ status }: { status: TopupRow["status"] }) {
  if (status === "PENDING") {
    return (
      <Badge tone="attention" icon={Clock}>
        To review
      </Badge>
    );
  }
  if (status === "APPROVED") {
    return (
      <Badge tone="good" icon={BadgeCheck}>
        Approved
      </Badge>
    );
  }
  return <Badge icon={X}>Rejected</Badge>;
}

function TopupItem({ topup }: { topup: TopupRow }) {
  const review = useReviewTopup();
  const [rejecting, setRejecting] = useState(false);
  const proof = useOpenFile("The proof couldn't be opened.");
  const proofError = proof.error;
  const viewProof = () => proof.open(topup.proof_file_id);

  return (
    <li className="p-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-48 flex-1 text-sm">
          <p className="font-semibold text-stone-900 tabular-nums">
            {formatPkr(topup.amount_pkr)}
            <span className="font-normal text-stone-500"> from </span>
            <RecordLink href={physioHref(topup.provider_id)}>{topup.provider_name ?? "a physiotherapist"}</RecordLink>
          </p>
          <p className="text-xs text-stone-500">
            {topup.method} · {topup.reference} · {formatDateTime(topup.created_at)}
          </p>
          {topup.reviewed_at ? (
            <p className="text-xs text-stone-500">
              Reviewed {formatDateTime(topup.reviewed_at)}
              {topup.reviewed_by_name ? ` by ${topup.reviewed_by_name}` : ""}
            </p>
          ) : null}
          {topup.reject_reason ? <p className="mt-0.5 text-xs text-red-700">{topup.reject_reason}</p> : null}
        </div>
        <TopupStatusBadge status={topup.status} />
        <button type="button" onClick={() => void viewProof()} className={adminButton("secondary")}>
          Proof
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </button>
        {topup.status === "PENDING" ? (
          <>
            <button
              type="button"
              disabled={review.isPending}
              onClick={() => review.mutate({ id: topup.id, approve: true })}
              className={adminButton("primary")}
            >
              Approve
            </button>
            <button type="button" onClick={() => setRejecting(true)} className={adminButton("ghost")}>
              Reject
            </button>
          </>
        ) : null}
      </div>
      <div className="mt-2 empty:hidden">
        {proofError ? <FormError message={proofError} /> : null}
        {review.isError && !rejecting ? <FormError message={errorMessage(review.error)} /> : null}
      </div>
      {rejecting ? (
        <ReasonDialog
          title="Reject this top-up?"
          label="Reason (the physiotherapist will see this)"
          confirm="Reject"
          pending={review.isPending}
          error={review.error}
          onClose={() => setRejecting(false)}
          onConfirm={(reason) =>
            review.mutate({ id: topup.id, approve: false, reason }, { onSuccess: () => setRejecting(false) })
          }
        />
      ) : null}
    </li>
  );
}

// Settings -----------------------------------------------------------------------------------------

export function SettingsPage() {
  const settings = useSettings();
  return (
    <>
      <PageHeader title="Settings" description="Applied to new orders. Existing orders keep the commission they were placed with." />
      {settings.isPending ? (
        <Skeleton className="mt-6 h-72 max-w-xl" />
      ) : settings.isError ? (
        <Card className="mt-6">
          <ErrorState onRetry={() => void settings.refetch()} />
        </Card>
      ) : (
        <SettingsForm initial={settings.data} />
      )}
    </>
  );
}

const settingsSchema = z.object({
  commission: z.coerce
    .number<string>("Enter a number.")
    .min(0, "Must be 0% or more.")
    .max(100, "Must be 100% or less.")
    .refine((value) => Number.isInteger(value * 100), "Use at most 2 decimal places."),
  minimum: z.coerce
    .number<string>("Enter a number.")
    .int("Enter whole rupees.")
    .min(0, "Must be 0 or more.")
    .max(1_000_000, "This amount is too high."),
  instructions: z.string().trim().max(2000, "Keep this under 2000 characters."),
});

function SettingsForm({ initial }: { initial: PlatformSettings }) {
  const id = useId();
  const save = useSaveSettings();
  const [commission, setCommission] = useState(initial.commission_bps === null ? "" : String(initial.commission_bps / 100));
  const [minimum, setMinimum] = useState(String(initial.minimum_balance_pkr));
  const [instructions, setInstructions] = useState(initial.topup_instructions);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saved, setSaved] = useState(false);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    const parsed = settingsSchema.safeParse({ commission, minimum, instructions });
    if (!parsed.success || commission.trim() === "") {
      const fields = parsed.success ? {} : parsed.error.flatten().fieldErrors;
      setErrors({
        commission: commission.trim() === "" ? "Enter a percentage." : (fields as Record<string, string[]>).commission?.[0],
        minimum: (fields as Record<string, string[]>).minimum?.[0],
        instructions: (fields as Record<string, string[]>).instructions?.[0],
      });
      return;
    }
    setErrors({});
    save.mutate(
      {
        commission_bps: Math.round(parsed.data.commission * 100),
        minimum_balance_pkr: parsed.data.minimum,
        topup_instructions: parsed.data.instructions,
      },
      { onSuccess: () => setSaved(true) },
    );
  };

  return (
    <Card className="mt-6 max-w-xl p-5">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField id={`${id}-commission`} label="Commission (%)" hint="Cut from the physiotherapist's balance after each session." error={errors.commission}>
          <input
            id={`${id}-commission`}
            inputMode="decimal"
            value={commission}
            onChange={(event) => setCommission(event.target.value)}
            aria-invalid={Boolean(errors.commission)}
            className={adminInput}
          />
        </FormField>
        <FormField id={`${id}-minimum`} label="Minimum balance (PKR)" hint="Below this, a physiotherapist gets no new orders." error={errors.minimum}>
          <input
            id={`${id}-minimum`}
            inputMode="numeric"
            value={minimum}
            onChange={(event) => setMinimum(event.target.value)}
            aria-invalid={Boolean(errors.minimum)}
            className={adminInput}
          />
        </FormField>
        <FormField id={`${id}-instructions`} label="Top-up payment details" hint="Shown to physiotherapists, e.g. your JazzCash, Easypaisa or bank account." error={errors.instructions}>
          <textarea
            id={`${id}-instructions`}
            rows={4}
            maxLength={2000}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            aria-invalid={Boolean(errors.instructions)}
            className={`${adminInput} h-auto py-2`}
          />
        </FormField>
        <FormError message={save.isError ? errorMessage(save.error) : null} />
        {saved ? <p role="status" className="text-sm font-medium text-brand-800">Settings saved.</p> : null}
        <button type="submit" disabled={save.isPending} className={adminButton("primary")}>
          {save.isPending ? "Saving..." : "Save settings"}
        </button>
      </form>
    </Card>
  );
}
