"use client";

import { useState } from "react";
import { BadgeCheck, Ban, CircleDot, Clock, Search, Star, X } from "lucide-react";
import { RecordLink, Segmented } from "@/components/admin/records";
import {
  adminInput,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  formatDateTime,
  PageHeader,
  Pagination,
  TableSkeleton,
} from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import { formatPkr } from "@/lib/format";
import { physioHref, useDebounced } from "./BookingsPage";
import { type ProviderStatus, useProviders } from "./operationsApi";

const FILTERS: { value: ProviderStatus | undefined; label: string }[] = [
  { value: "PENDING", label: "To review" },
  { value: "APPROVED", label: "Approved" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "REJECTED", label: "Rejected" },
  { value: "DRAFT", label: "Not submitted" },
  { value: undefined, label: "All" },
];

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
  const search = useDebounced(searchInput);
  const providers = useProviders({ page, status, search: search || undefined });
  const items = providers.data?.items ?? [];

  return (
    <>
      <PageHeader title="Physiotherapists" description="Check applications, and manage who can take orders." />
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
          <div className="relative ms-auto w-full sm:w-64">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search physiotherapists"
              placeholder="Search name or phone"
              maxLength={100}
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setPage(1);
              }}
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
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">Name</th>
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">Qualification</th>
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">Status</th>
                    <th scope="col" className="px-5 py-2.5 text-end font-medium">Rating</th>
                    <th scope="col" className="px-5 py-2.5 text-end font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.map((item) => (
                    <tr key={item.id} className="transition hover:bg-stone-50">
                      <td className="px-5 py-3">
                        <RecordLink href={physioHref(item.id)} className="text-stone-900">
                          {item.name ?? item.phone}
                        </RecordLink>
                        <p className="text-xs text-stone-500 tabular-nums">{item.phone}</p>
                      </td>
                      <td className="px-5 py-3 text-stone-600">
                        {item.qualification}, {item.experience_years} years
                      </td>
                      <td className="px-5 py-3">
                        <ProviderStatusBadge status={item.status} />
                        {item.submitted_at ? (
                          <p className="mt-1 text-xs text-stone-500">Applied {formatDateTime(item.submitted_at)}</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-end text-stone-700 tabular-nums">
                        {item.rating_avg > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                            {item.rating_avg.toFixed(1)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td
                        className={cn(
                          "px-5 py-3 text-end tabular-nums",
                          item.balance_pkr < 0 ? "font-medium text-red-700" : "text-stone-700",
                        )}
                      >
                        {formatPkr(item.balance_pkr)}
                      </td>
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
    </>
  );
}
