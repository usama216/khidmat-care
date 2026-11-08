"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck2, CircleDollarSign, Phone, Search, ShoppingBag, UsersRound, XCircle } from "lucide-react";
import {
  BackLink,
  DetailGrid,
  DetailItem,
  Initials,
  RecordLink,
  RecordSkeleton,
  Section,
  StatCard,
} from "@/components/admin/records";
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
import { OrdersTable, patientHref, useDebounced } from "./BookingsPage";
import { type PatientAccountDetail, usePatientAccount, usePatientAccounts } from "./operationsApi";

const RELATION: Record<string, string> = {
  SELF: "Account holder",
  PARENT: "Parent",
  SPOUSE: "Spouse",
  CHILD: "Child",
  SIBLING: "Sibling",
  OTHER: "Other",
};

export function PatientsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput);
  const accounts = usePatientAccounts({ page, search: search || undefined });
  const items = accounts.data?.items ?? [];

  return (
    <>
      <PageHeader title="Patients" description="Accounts that book care, and the people they book for." />
      <Card className="mt-6">
        <div className="flex border-b border-stone-200 p-4">
          <div className="relative w-full sm:w-72">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search patients"
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
        {accounts.isPending ? (
          <TableSkeleton />
        ) : accounts.isError ? (
          <ErrorState onRetry={() => void accounts.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title={search ? "No patients match this search" : "No patients yet"} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">Account</th>
                    <th scope="col" className="px-5 py-2.5 text-start font-medium">Joined</th>
                    <th scope="col" className="px-5 py-2.5 text-end font-medium">People</th>
                    <th scope="col" className="px-5 py-2.5 text-end font-medium">Orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.map((item) => (
                    <tr key={item.id} className="transition hover:bg-stone-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Initials name={item.name} className="size-8 text-xs" />
                          <div>
                            <RecordLink href={patientHref(item.id)} className="text-stone-900">
                              {item.name ?? item.phone}
                            </RecordLink>
                            <p className="text-xs text-stone-500 tabular-nums">{item.phone}</p>
                          </div>
                          {!item.is_active ? <Badge>Inactive</Badge> : null}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-stone-600">{formatDateTime(item.created_at)}</td>
                      <td className="px-5 py-3 text-end text-stone-700 tabular-nums">{item.people_count}</td>
                      <td className="px-5 py-3 text-end text-stone-700 tabular-nums">{item.orders_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={accounts.data.page}
              pageSize={accounts.data.page_size}
              total={accounts.data.total}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </>
  );
}

export function PatientDetailPage() {
  const id = useSearchParams().get("id");
  const detail = usePatientAccount(id);

  if (!id) return <EmptyState title="No patient chosen" />;
  if (detail.isPending) return <RecordSkeleton />;
  if (detail.isError) {
    return (
      <>
        <BackLink href="/admin/patients/" label="Patients" />
        <Card className="mt-4">
          {detail.error.status === 404 ? (
            <EmptyState title="This patient account wasn't found" />
          ) : (
            <ErrorState onRetry={() => void detail.refetch()} />
          )}
        </Card>
      </>
    );
  }
  return <PatientRecord data={detail.data} />;
}

function PatientRecord({ data }: { data: PatientAccountDetail }) {
  const [page, setPage] = useState(1);
  return (
    <>
      <BackLink href="/admin/patients/" label="Patients" />
      <div className="mt-3 flex items-center gap-4">
        <Initials name={data.name} className="size-14 text-lg" />
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[1.45rem] font-semibold tracking-tight text-stone-900">{data.name ?? "Unnamed"}</h1>
            {!data.is_active ? <Badge>Inactive</Badge> : null}
          </div>
          <a href={`tel:${data.phone}`} className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-stone-700 tabular-nums hover:underline">
            <Phone className="size-3.5" aria-hidden="true" />
            {data.phone}
          </a>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Orders" value={data.orders_count} hint={`${data.active_orders} open`} icon={ShoppingBag} />
        <StatCard label="Completed" value={data.completed_orders} icon={CalendarCheck2} tone="brand" />
        <StatCard label="Cancelled" value={data.cancelled_orders} icon={XCircle} />
        <StatCard label="Paid for care" value={formatPkr(data.spent_pkr)} hint="Completed orders" icon={CircleDollarSign} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="border-b border-stone-200 px-5 py-3.5">
            <h2 className="font-semibold text-stone-900">Orders</h2>
          </div>
          <OrdersTable
            filters={{ page, page_size: 10, booked_by: data.id }}
            onPageChange={setPage}
            empty="No orders yet"
          />
        </Card>
        <div className="space-y-6">
          <Section title="Account">
            <DetailGrid>
              <DetailItem label="Joined">{formatDateTime(data.created_at)}</DetailItem>
              <DetailItem label="Email">{data.email ?? "-"}</DetailItem>
            </DetailGrid>
          </Section>
          <Section title="People cared for" flush>
            {data.people.length === 0 ? (
              <p className="px-5 py-4 text-sm text-stone-500">No one added yet.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {data.people.map((person) => (
                  <li key={person.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <UsersRound className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
                    <div>
                      <p className="font-medium text-stone-900">{person.name}</p>
                      <p className="text-xs text-stone-500">
                        {[
                          RELATION[person.relation] ?? person.relation,
                          person.gender === "FEMALE" ? "Female" : "Male",
                          person.birth_year ? `${new Date().getFullYear() - person.birth_year} years` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
