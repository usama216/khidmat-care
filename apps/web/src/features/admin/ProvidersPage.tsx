"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Ban, CircleDot, Clock, ExternalLink, Search, X } from "lucide-react";
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
  Modal,
  PageHeader,
  Pagination,
  Skeleton,
  TableSkeleton,
} from "@/components/admin/ui";
import { availabilitySummary } from "@/features/portal/FindPage";
import { ReasonDialog } from "@/features/portal/shared";
import { cn } from "@/lib/cn";
import { formatPkr } from "@/lib/format";
import { storageUrl } from "@/lib/upload";
import {
  fileUrl,
  useDecideProvider,
  useProviderDetail,
  useProviders,
  useSetCheck,
  type ProviderStatus,
} from "./operationsApi";

const FILTERS: { value: ProviderStatus | undefined; label: string }[] = [
  { value: "PENDING", label: "To review" },
  { value: "APPROVED", label: "Approved" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "REJECTED", label: "Rejected" },
  { value: undefined, label: "All" },
];

const CHECK_LABELS: Record<string, string> = {
  documents: "Documents are complete and readable",
  cnic: "CNIC checked against the original",
  degree: "Degree checked against the original",
  interview: "Met in person",
  agreement: "Signed agreement received",
};

export function ProviderStatusBadge({ status }: { status: ProviderStatus }) {
  switch (status) {
    case "PENDING":
      return (
        <Badge tone="attention" icon={Clock}>
          To review
        </Badge>
      );
    case "APPROVED":
      return (
        <Badge tone="good" icon={BadgeCheck}>
          Approved
        </Badge>
      );
    case "SUSPENDED":
      return <Badge icon={Ban}>Suspended</Badge>;
    case "REJECTED":
      return <Badge icon={X}>Rejected</Badge>;
    default:
      return <Badge icon={CircleDot}>Not submitted</Badge>;
  }
}

export function ProvidersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ProviderStatus | undefined>("PENDING");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const providers = useProviders({ page, status, search: search || undefined });
  const items = providers.data?.items ?? [];

  return (
    <>
      <PageHeader title="Physiotherapists" description="Check applications, and manage who can take orders." />
      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 p-4">
          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1 rounded-lg bg-stone-100 p-1">
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
          <div className="relative ms-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search physiotherapists"
              placeholder="Search name or phone"
              maxLength={100}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className={cn(adminInput, "ps-9")}
            />
          </div>
        </div>
        {providers.isPending ? (
          <TableSkeleton />
        ) : providers.isError ? (
          <ErrorState onRetry={() => void providers.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title={status === "PENDING" ? "No applications to review" : "No physiotherapists found"} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">Name</th>
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">Qualification</th>
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">Status</th>
                    <th scope="col" className="px-5 py-2.5 text-end font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.map((item) => (
                    <tr key={item.id} className="transition hover:bg-stone-50">
                      <td className="px-5 py-3">
                        <button type="button" onClick={() => setOpenId(item.id)} className="text-start font-medium text-stone-900 hover:underline">
                          {item.name ?? item.phone}
                        </button>
                        <p className="text-xs text-stone-500 tabular-nums">{item.phone}</p>
                      </td>
                      <td className="px-5 py-3 text-stone-600">
                        {item.qualification}, {item.experience_years} years
                      </td>
                      <td className="px-5 py-3">
                        <ProviderStatusBadge status={item.status} />
                      </td>
                      <td className="px-5 py-3 text-end text-stone-700 tabular-nums">{formatPkr(item.balance_pkr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={providers.data.page}
              pageSize={providers.data.page_size}
              total={providers.data.total}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
      {openId ? <ProviderDrawer id={openId} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

function ProviderDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useProviderDetail(id);
  const setCheck = useSetCheck();
  const decide = useDecideProvider();
  const [dialog, setDialog] = useState<"reject" | "suspend" | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const data = detail.data;
  const pending = data?.status === "PENDING";
  const allDone = data?.required_checks.every((check) => data.verification_checks[check]);

  const openFile = async (fileId: string) => {
    setFileError(null);
    // Opened before the request finishes, so pop-up blockers allow it.
    const tab = window.open("", "_blank");
    try {
      const { url } = await fileUrl(fileId);
      if (tab) tab.location.href = storageUrl(url);
    } catch (error) {
      tab?.close();
      setFileError(errorMessage(error, "This document couldn't be opened."));
    }
  };

  return (
    <Modal title={data?.name ?? "Physiotherapist"} onClose={onClose} side>
      {detail.isPending ? (
        <div role="status" aria-label="Loading" className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : detail.isError || !data ? (
        <ErrorState onRetry={() => void detail.refetch()} />
      ) : (
        <div className="space-y-5 text-sm">
          <div className="flex items-center gap-3">
            {data.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={storageUrl(data.photo_url)} alt={`Photo of ${data.name}`} className="size-16 rounded-xl object-cover" />
            ) : null}
            <div>
              <ProviderStatusBadge status={data.status} />
              {data.status_reason ? <p className="mt-1 text-xs text-stone-500">{data.status_reason}</p> : null}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <Info label="Phone" value={data.phone} />
            <Info label="CNIC (viewing is logged)" value={data.cnic} />
            <Info label="Qualification" value={data.qualification} />
            <Info label="Experience" value={`${data.experience_years} years`} />
            <Info label="Gender" value={data.gender === "FEMALE" ? "Female" : "Male"} />
            <Info label="Balance" value={formatPkr(data.balance_pkr)} />
            <Info label="Submitted" value={data.submitted_at ? formatDateTime(data.submitted_at) : "-"} />
            <Info label="Agreement accepted" value={data.agreement_accepted_at ? formatDateTime(data.agreement_accepted_at) : "-"} />
          </dl>
          <p className="text-xs text-stone-500">
            <span className="font-medium text-stone-700">Availability: </span>
            {availabilitySummary(data.availability)}
          </p>

          <section>
            <h3 className="font-semibold text-stone-900">Documents</h3>
            {data.documents.length === 0 ? <p className="mt-1 text-stone-500">None uploaded.</p> : null}
            <ul className="mt-2 space-y-2">
              {data.documents.map((document) => (
                <li key={document.id}>
                  <button type="button" onClick={() => void openFile(document.file_id)} className={adminButton("secondary", "w-full justify-between")}>
                    {document.type.replace("_", " ")}
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 empty:hidden">{fileError ? <FormError message={fileError} /> : null}</div>
          </section>

          {pending ? (
            <section>
              <h3 className="font-semibold text-stone-900">Verification checklist</h3>
              <ul className="mt-2 space-y-2">
                {data.required_checks.map((check) => (
                  <li key={check}>
                    <label className="flex items-center gap-2 text-stone-700">
                      <input
                        type="checkbox"
                        checked={Boolean(data.verification_checks[check])}
                        disabled={setCheck.isPending}
                        onChange={(event) => setCheck.mutate({ id: data.id, check, done: event.target.checked })}
                      />
                      {CHECK_LABELS[check] ?? check}
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-2 empty:hidden">{setCheck.isError ? <FormError message={errorMessage(setCheck.error)} /> : null}</div>
            </section>
          ) : null}

          <FormError message={decide.isError && !dialog ? errorMessage(decide.error) : null} />
          <div className="flex flex-wrap gap-2">
            {pending ? (
              <>
                <button
                  type="button"
                  disabled={!allDone || decide.isPending}
                  title={allDone ? undefined : "Complete every check first"}
                  onClick={() => decide.mutate({ id: data.id, decision: "approve" })}
                  className={adminButton("primary")}
                >
                  Approve
                </button>
                <button type="button" onClick={() => setDialog("reject")} className={adminButton("secondary")}>
                  Reject
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
        </div>
      )}
      {dialog && data ? (
        <ReasonDialog
          title={dialog === "reject" ? "Reject this application?" : "Suspend this physiotherapist?"}
          label="Reason (the physiotherapist will see this)"
          confirm={dialog === "reject" ? "Reject" : "Suspend"}
          pending={decide.isPending}
          error={decide.error}
          onClose={() => setDialog(null)}
          onConfirm={(reason) =>
            decide.mutate({ id: data.id, decision: dialog, reason }, { onSuccess: () => setDialog(null) })
          }
        />
      ) : null}
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="font-medium text-stone-900 tabular-nums">{value}</dd>
    </div>
  );
}
