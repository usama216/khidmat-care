"use client";

import { useId, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  CalendarCheck2,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileText,
  Phone,
  Plus,
  ShieldCheck,
  Star,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { z } from "zod";
import {
  BackLink,
  DetailGrid,
  DetailItem,
  RecordLink,
  RecordSkeleton,
  Section,
  StatCard,
  Tabs,
} from "@/components/admin/records";
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
  Pagination,
  TableSkeleton,
} from "@/components/admin/ui";
import { useCan } from "@/features/auth/auth";
import { useCatalog } from "@/features/portal/api";
import { availabilitySummary, PhysioPhoto } from "@/features/portal/FindPage";
import { ReasonDialog } from "@/features/portal/shared";
import { cn } from "@/lib/cn";
import { formatPkr } from "@/lib/format";
import { useRecordHistory } from "./api";
import { OrdersTable, orderHref } from "./BookingsPage";
import { ComplaintItem, ReviewItem } from "./ComplaintsPage";
import { TopupStatusBadge } from "./FinancePages";
import {
  type ProviderDetail,
  useAdjustBalance,
  useComplaints,
  useDecideProvider,
  useLedger,
  useProviderDetail,
  useReviews,
  useSetCheck,
  useTopups,
} from "./operationsApi";
import { ProviderStatusBadge } from "./ProvidersPage";
import { useOpenFile } from "./useOpenFile";

const CHECK_LABELS: Record<string, string> = {
  documents: "Documents are complete and readable",
  cnic: "CNIC checked against the original",
  degree: "Degree checked against the original",
  interview: "Met in person",
  agreement: "Signed agreement received",
};

const DOCUMENT_LABELS: Record<string, string> = {
  CNIC_FRONT: "CNIC front",
  CNIC_BACK: "CNIC back",
  DEGREE: "Physiotherapy degree",
  LICENSE: "License or registration",
  OTHER: "Other document",
};

type Tab = "overview" | "orders" | "balance" | "feedback" | "history";

export function ProviderDetailPage() {
  const id = useSearchParams().get("id");
  const detail = useProviderDetail(id);

  if (!id) return <EmptyState title="No physiotherapist chosen" />;
  if (detail.isPending) return <RecordSkeleton />;
  if (detail.isError) {
    const status = detail.error.status;
    return (
      <>
        <BackLink href="/admin/providers/" label="Physiotherapists" />
        <Card className="mt-4">
          {status === 404 ? (
            <EmptyState title="This physiotherapist wasn't found" />
          ) : status === 403 ? (
            <EmptyState title="Your role can't open physiotherapist records" description="Ask an admin if it should." />
          ) : (
            <ErrorState onRetry={() => void detail.refetch()} />
          )}
        </Card>
      </>
    );
  }
  return <ProviderRecord data={detail.data} />;
}

function ProviderRecord({ data }: { data: ProviderDetail }) {
  const can = useCan();
  const [tab, setTab] = useState<Tab>("overview");
  const seesReviews = can("complaints.manage") || can("providers.verify");
  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: "overview", label: "Overview" },
    ...(can("bookings.manage") ? [{ value: "orders" as const, label: "Orders", count: data.stats.orders_total }] : []),
    ...(can("finance.manage") ? [{ value: "balance" as const, label: "Balance" }] : []),
    ...(seesReviews ? [{ value: "feedback" as const, label: "Ratings & complaints", count: data.rating_count }] : []),
    ...(can("audit.view") ? [{ value: "history" as const, label: "History" }] : []),
  ];

  return (
    <>
      <BackLink href="/admin/providers/" label="Physiotherapists" />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <PhysioPhoto url={data.photo_url} name={data.name ?? "physiotherapist"} />
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[1.45rem] font-semibold tracking-tight text-stone-900">{data.name ?? "Unnamed"}</h1>
              <ProviderStatusBadge status={data.status} />
            </div>
            <p className="mt-0.5 text-sm text-stone-500">
              {data.qualification} · {data.experience_years} years · {data.gender === "FEMALE" ? "Female" : "Male"}
            </p>
            <a href={`tel:${data.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-stone-700 tabular-nums hover:underline">
              <Phone className="size-3.5" aria-hidden="true" />
              {data.phone}
            </a>
          </div>
        </div>
        <Decisions data={data} />
      </div>
      {data.status_reason ? (
        <p className="mt-4 rounded-lg bg-stone-100 p-3 text-sm text-stone-700 ring-1 ring-stone-200">
          <span className="font-medium">Reason given:</span> {data.status_reason}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Balance"
          value={formatPkr(data.balance_pkr)}
          hint={data.balance_pkr < 0 ? "Owes commission" : "Prepaid for commission"}
          icon={Wallet}
          tone={data.balance_pkr < 0 ? "danger" : "brand"}
        />
        <StatCard
          label="Rating"
          value={data.rating_count ? `${data.rating_avg.toFixed(1)} / 5` : "-"}
          hint={`${data.rating_count} ${data.rating_count === 1 ? "rating" : "ratings"}`}
          icon={Star}
        />
        <StatCard
          label="Sessions done"
          value={data.stats.sessions_completed}
          hint={`${data.stats.sessions_cancelled} cancelled or missed`}
          icon={CalendarCheck2}
        />
        <StatCard
          label="Orders"
          value={data.stats.orders_total}
          hint={`${data.stats.orders_active} active · ${data.stats.offers_rejected} declined`}
          icon={BadgeCheck}
        />
      </div>

      <div className="mt-6">
        <Tabs label="Record sections" value={tab} tabs={tabs} onChange={setTab} />
      </div>
      <div className="mt-6">
        {tab === "overview" ? <OverviewTab data={data} /> : null}
        {tab === "orders" ? <OrdersTab providerId={data.id} /> : null}
        {tab === "balance" ? <BalanceTab data={data} /> : null}
        {tab === "feedback" ? <FeedbackTab providerId={data.id} complaints={can("complaints.manage")} /> : null}
        {tab === "history" ? <HistoryTab providerId={data.id} /> : null}
      </div>
    </>
  );
}

function Decisions({ data }: { data: ProviderDetail }) {
  const decide = useDecideProvider();
  const [dialog, setDialog] = useState<"reject" | "suspend" | null>(null);
  const pending = data.status === "PENDING";
  const allDone = data.required_checks.every((check) => data.verification_checks[check]);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {pending ? (
          <>
            <button type="button" onClick={() => setDialog("reject")} className={adminButton("secondary")}>
              Reject
            </button>
            <button
              type="button"
              disabled={!allDone || decide.isPending}
              title={allDone ? undefined : "Complete every check first"}
              onClick={() => decide.mutate({ id: data.id, decision: "approve" })}
              className={adminButton("primary")}
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              Approve
            </button>
          </>
        ) : null}
        {data.status === "APPROVED" ? (
          <button type="button" onClick={() => setDialog("suspend")} className={adminButton("secondary")}>
            Suspend
          </button>
        ) : null}
        {data.status === "SUSPENDED" ? (
          <button
            type="button"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ id: data.id, decision: "reactivate" })}
            className={adminButton("primary")}
          >
            Reactivate
          </button>
        ) : null}
      </div>
      {pending && !allDone ? <p className="text-xs text-stone-500">Approve unlocks when every check is ticked.</p> : null}
      {decide.isError && !dialog ? <FormError message={errorMessage(decide.error)} /> : null}
      {dialog ? (
        <ReasonDialog
          title={dialog === "reject" ? "Reject this application?" : "Suspend this physiotherapist?"}
          label="Reason (the physiotherapist will see this)"
          confirm={dialog === "reject" ? "Reject" : "Suspend"}
          pending={decide.isPending}
          error={decide.error}
          onClose={() => setDialog(null)}
          onConfirm={(reason) => decide.mutate({ id: data.id, decision: dialog, reason }, { onSuccess: () => setDialog(null) })}
        />
      ) : null}
    </div>
  );
}

function OverviewTab({ data }: { data: ProviderDetail }) {
  const catalog = useCatalog();
  const setCheck = useSetCheck();
  const files = useOpenFile();
  const services = catalog.data?.services.filter((s) => data.service_type_ids.includes(s.id)).map((s) => s.name);
  const areas = catalog.data?.areas.filter((a) => data.area_ids.includes(a.id)).map((a) => a.name);
  const done = data.required_checks.filter((check) => data.verification_checks[check]).length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Section title="Profile">
          <DetailGrid>
            <DetailItem label="CNIC (each view is logged)">
              <span className="tabular-nums">{data.cnic.replace(/^(\d{5})(\d{7})(\d)$/, "$1-$2-$3")}</span>
            </DetailItem>
            <DetailItem label="Joined">{formatDateTime(data.joined_at)}</DetailItem>
            <DetailItem label="Applied">{data.submitted_at ? formatDateTime(data.submitted_at) : "Not yet"}</DetailItem>
            <DetailItem label="Approved">{data.approved_at ? formatDateTime(data.approved_at) : "-"}</DetailItem>
            <DetailItem label="Agreement accepted">
              {data.agreement_accepted_at ? formatDateTime(data.agreement_accepted_at) : "Not yet"}
            </DetailItem>
            <DetailItem label="Treatments">{services?.length ? services.join(", ") : "-"}</DetailItem>
            <DetailItem label="Areas" wide>
              {areas?.length ? areas.join(", ") : "-"}
            </DetailItem>
            <DetailItem label="Availability" wide>
              <span className="font-normal">{availabilitySummary(data.availability)}</span>
            </DetailItem>
            {data.bio ? (
              <DetailItem label="About" wide>
                <span dir="auto" className="font-normal whitespace-pre-wrap">
                  {data.bio}
                </span>
              </DetailItem>
            ) : null}
          </DetailGrid>
        </Section>
      </div>
      <div className="space-y-6">
        <Section title="Verification" description={`${done} of ${data.required_checks.length} checks done`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${(done / Math.max(1, data.required_checks.length)) * 100}%` }}
            />
          </div>
          <ul className="mt-4 space-y-2.5">
            {data.required_checks.map((check) => {
              const at = data.verification_checks[check];
              const editable = data.status === "PENDING";
              return (
                <li key={check}>
                  <label className={cn("flex items-start gap-2.5 text-sm", editable ? "cursor-pointer" : undefined)}>
                    {editable ? (
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-brand-700"
                        checked={Boolean(at)}
                        disabled={setCheck.isPending}
                        onChange={(event) => setCheck.mutate({ id: data.id, check, done: event.target.checked })}
                      />
                    ) : at ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
                    ) : (
                      <Circle className="mt-0.5 size-4 shrink-0 text-stone-300" aria-hidden="true" />
                    )}
                    <span>
                      <span className="text-stone-800">{CHECK_LABELS[check] ?? check}</span>
                      {at ? <span className="block text-xs text-stone-500">{formatDateTime(at)}</span> : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {setCheck.isError ? (
            <div className="mt-3">
              <FormError message={errorMessage(setCheck.error)} />
            </div>
          ) : null}
        </Section>
        <Section title="Documents" flush>
          {data.documents.length === 0 ? (
            <p className="px-5 py-4 text-sm text-stone-500">None uploaded.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {data.documents.map((document) => (
                <li key={document.id}>
                  <button
                    type="button"
                    onClick={() => void files.open(document.file_id)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-start text-sm transition hover:bg-stone-50"
                  >
                    <FileText className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
                    <span className="flex-1 font-medium text-stone-800">{DOCUMENT_LABELS[document.type] ?? document.type}</span>
                    <ExternalLink className="size-4 text-stone-400" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {files.error ? (
            <div className="px-5 pb-4">
              <FormError message={files.error} />
            </div>
          ) : null}
        </Section>
      </div>
    </div>
  );
}

function OrdersTab({ providerId }: { providerId: string }) {
  const [page, setPage] = useState(1);
  return (
    <Card>
      <OrdersTable
        filters={{ page, page_size: 10, provider_id: providerId }}
        onPageChange={setPage}
        hide="physio"
        empty="No orders yet"
      />
    </Card>
  );
}

const LEDGER_LABEL = { TOPUP: "Top-up", COMMISSION: "Commission", ADJUSTMENT: "Correction" };

function BalanceTab({ data }: { data: ProviderDetail }) {
  const [page, setPage] = useState(1);
  const [adjusting, setAdjusting] = useState(false);
  const ledger = useLedger(data.id, page);
  const topups = useTopups({ page: 1, page_size: 10, provider_id: data.id });
  const files = useOpenFile("The proof couldn't be opened.");
  const rows = ledger.data?.items ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Section
        className="lg:col-span-2"
        title="Ledger"
        description="Every change to the balance. Rows are never edited; mistakes get a correction."
        flush
        actions={
          <button type="button" onClick={() => setAdjusting(true)} className={adminButton("secondary")}>
            <Plus className="size-4" aria-hidden="true" />
            Correction
          </button>
        }
      >
        {ledger.isPending ? (
          <TableSkeleton rows={4} />
        ) : ledger.isError ? (
          <ErrorState onRetry={() => void ledger.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No balance activity yet" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">Entry</th>
                    <th scope="col" className="px-5 py-2.5 text-end font-medium">Amount</th>
                    <th scope="col" className="px-5 py-2.5 text-end font-medium">Balance after</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-stone-900">
                          {LEDGER_LABEL[row.type]}
                          {row.booking_id && row.booking_number ? (
                            <>
                              {" · "}
                              <RecordLink href={orderHref(row.booking_id)}>
                                KC-{row.booking_number}, session {row.session_sequence}
                              </RecordLink>
                            </>
                          ) : null}
                        </p>
                        <p className="text-xs text-stone-500">
                          {formatDateTime(row.created_at)}
                          {row.created_by_name ? ` · by ${row.created_by_name}` : ""}
                        </p>
                        {row.note ? <p className="text-xs text-stone-600">{row.note}</p> : null}
                      </td>
                      <td
                        className={cn(
                          "px-5 py-3 text-end font-medium tabular-nums",
                          row.amount_pkr > 0 ? "text-brand-800" : "text-stone-900",
                        )}
                      >
                        {row.amount_pkr > 0 ? "+" : "−"}
                        {formatPkr(Math.abs(row.amount_pkr))}
                      </td>
                      <td className="px-5 py-3 text-end text-stone-600 tabular-nums">{formatPkr(row.balance_after_pkr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={ledger.data.page}
              pageSize={ledger.data.page_size}
              total={ledger.data.total}
              onPageChange={setPage}
            />
          </>
        )}
      </Section>
      <Section title="Top-ups" flush actions={<RecordLink href="/admin/balances/">All top-ups</RecordLink>}>
        {topups.data && topups.data.items.length > 0 ? (
          <ul className="divide-y divide-stone-100">
            {topups.data.items.map((topup) => (
              <li key={topup.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-stone-900 tabular-nums">{formatPkr(topup.amount_pkr)}</span>
                  <TopupStatusBadge status={topup.status} />
                </div>
                <p className="mt-0.5 text-xs text-stone-500">
                  {topup.method} · {topup.reference} · {formatDateTime(topup.created_at)}
                </p>
                <button
                  type="button"
                  onClick={() => void files.open(topup.proof_file_id)}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:underline"
                >
                  View proof <ExternalLink className="size-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-stone-500">{topups.isPending ? "Loading..." : "No top-ups yet."}</p>
        )}
        {files.error ? (
          <div className="px-5 pb-4">
            <FormError message={files.error} />
          </div>
        ) : null}
      </Section>
      {adjusting ? <AdjustDialog providerId={data.id} onClose={() => setAdjusting(false)} /> : null}
    </div>
  );
}

const adjustSchema = z.object({
  amount: z.coerce
    .number<string>("Enter an amount.")
    .int("Enter whole rupees.")
    .refine((value) => value !== 0, "Enter an amount other than 0.")
    .refine((value) => Math.abs(value) <= 1_000_000, "This amount is too high."),
  note: z.string().trim().min(3, "Explain the correction.").max(500),
});

function AdjustDialog({ providerId, onClose }: { providerId: string; onClose: () => void }) {
  const id = useId();
  const adjust = useAdjustBalance();
  const [direction, setDirection] = useState<"add" | "deduct">("add");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; note?: string }>({});

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = adjustSchema.safeParse({ amount, note });
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({ amount: fields.amount?.[0], note: fields.note?.[0] });
      return;
    }
    setErrors({});
    const value = Math.abs(parsed.data.amount) * (direction === "add" ? 1 : -1);
    adjust.mutate({ id: providerId, amount_pkr: value, note: parsed.data.note }, { onSuccess: onClose });
  };

  return (
    <Modal title="Correct the balance" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <p className="text-sm text-stone-600">
          Use this only to fix a mistake. The correction is added to the ledger with your name and the reason.
        </p>
        <div role="group" aria-label="Direction" className="grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1">
          {(["add", "deduct"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={direction === value}
              onClick={() => setDirection(value)}
              className={cn(
                "h-8 rounded-md text-sm font-medium transition",
                direction === value ? "bg-white text-stone-900 shadow-sm" : "text-stone-600",
              )}
            >
              {value === "add" ? "Add to balance" : "Deduct from balance"}
            </button>
          ))}
        </div>
        <FormField id={`${id}-amount`} label="Amount (PKR)" error={errors.amount}>
          <input
            id={`${id}-amount`}
            inputMode="numeric"
            autoFocus
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-invalid={Boolean(errors.amount)}
            className={adminInput}
          />
        </FormField>
        <FormField id={`${id}-note`} label="Reason" error={errors.note}>
          <textarea
            id={`${id}-note`}
            rows={3}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            aria-invalid={Boolean(errors.note)}
            className={`${adminInput} h-auto py-2`}
          />
        </FormField>
        <FormError message={adjust.isError ? errorMessage(adjust.error) : null} />
        <button type="submit" disabled={adjust.isPending} className={adminButton("primary", "w-full")}>
          Save correction
        </button>
      </form>
    </Modal>
  );
}

function FeedbackTab({ providerId, complaints }: { providerId: string; complaints: boolean }) {
  const [reviewPage, setReviewPage] = useState(1);
  const [complaintPage, setComplaintPage] = useState(1);
  const reviews = useReviews({ page: reviewPage, provider_id: providerId });
  const complaintList = useComplaints({ page: complaintPage, page_size: 10, provider_id: providerId }, complaints);

  return (
    <div className={cn("grid grid-cols-1 gap-6", complaints ? "lg:grid-cols-2" : undefined)}>
      <Section title="Ratings" flush>
        {reviews.isPending ? (
          <TableSkeleton rows={3} />
        ) : reviews.isError ? (
          <ErrorState onRetry={() => void reviews.refetch()} />
        ) : reviews.data.items.length === 0 ? (
          <EmptyState title="No ratings yet" />
        ) : (
          <>
            <ul className="divide-y divide-stone-100">
              {reviews.data.items.map((review) => (
                <ReviewItem key={review.id} review={review} showPhysio={false} />
              ))}
            </ul>
            <Pagination
              page={reviews.data.page}
              pageSize={reviews.data.page_size}
              total={reviews.data.total}
              onPageChange={setReviewPage}
            />
          </>
        )}
      </Section>
      {complaints ? (
        <Section title="Complaints" flush>
          {complaintList.isPending ? (
            <TableSkeleton rows={3} />
          ) : complaintList.isError ? (
            <ErrorState onRetry={() => void complaintList.refetch()} />
          ) : complaintList.data.items.length === 0 ? (
            <EmptyState title="No complaints" />
          ) : (
            <>
              <ul className="divide-y divide-stone-100">
                {complaintList.data.items.map((complaint) => (
                  <ComplaintItem key={complaint.id} complaint={complaint} showPhysio={false} />
                ))}
              </ul>
              <Pagination
                page={complaintList.data.page}
                pageSize={complaintList.data.page_size}
                total={complaintList.data.total}
                onPageChange={setComplaintPage}
              />
            </>
          )}
        </Section>
      ) : null}
    </div>
  );
}

const HISTORY_LABELS: Record<string, { label: string; icon: LucideIcon }> = {
  "provider.submitted": { label: "Application submitted", icon: FileText },
  "provider.check_updated": { label: "Verification check updated", icon: CheckCircle2 },
  "provider.approve": { label: "Approved", icon: ShieldCheck },
  "provider.reject": { label: "Rejected", icon: ShieldCheck },
  "provider.suspend": { label: "Suspended", icon: ShieldCheck },
  "provider.reactivate": { label: "Reactivated", icon: ShieldCheck },
  "provider.details_viewed": { label: "Record opened (CNIC shown)", icon: FileText },
  "wallet.adjusted": { label: "Balance corrected", icon: Wallet },
};

function HistoryTab({ providerId }: { providerId: string }) {
  const history = useRecordHistory("provider", providerId, true);
  const entries = history.data?.items ?? [];
  return (
    <Section title="History" description="Staff actions on this record, newest first." flush>
      {history.isPending ? (
        <TableSkeleton rows={4} />
      ) : history.isError ? (
        <ErrorState onRetry={() => void history.refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState title="Nothing recorded yet" />
      ) : (
        <ul className="divide-y divide-stone-100">
          {entries.map((entry) => {
            const known = HISTORY_LABELS[entry.action];
            const Icon = known?.icon ?? FileText;
            const meta = entry.metadata ?? {};
            const extra =
              entry.action === "provider.check_updated"
                ? `${CHECK_LABELS[String(meta.check)] ?? String(meta.check)}: ${meta.done ? "ticked" : "unticked"}`
                : typeof meta.amount_pkr === "number"
                  ? [formatPkr(meta.amount_pkr), meta.note].filter(Boolean).join(": ")
                  : typeof meta.reason === "string"
                    ? meta.reason
                    : null;
            return (
              <li key={entry.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                <Icon className="mt-0.5 size-4 shrink-0 text-stone-400" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-stone-900">{known?.label ?? entry.action}</p>
                  {extra ? <p className="text-stone-600">{extra}</p> : null}
                  <p className="text-xs text-stone-500">
                    {formatDateTime(entry.created_at)}
                    {entry.actor_name ? ` · ${entry.actor_name}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

