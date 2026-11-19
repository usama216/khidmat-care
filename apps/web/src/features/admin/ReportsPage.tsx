"use client";

import { CalendarCheck2, CircleDollarSign, Hourglass, ShoppingBag, UserPlus, Wallet } from "lucide-react";
import { useState } from "react";
import { RecordLink, Section, Segmented, StatCard } from "@/components/admin/records";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/admin/ui";
import { BOOKING_STATUS_LABEL } from "@/features/portal/shared";
import type { BookingStatus } from "@/features/portal/api";
import { formatPkr } from "@/lib/format";
import { physioHref } from "./BookingsPage";
import { type Report, type ReportMonth, useReport } from "./operationsApi";

const RANGES = [
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
];

const monthName = new Intl.DateTimeFormat("en-PK", { month: "short", year: "2-digit", timeZone: "UTC" });
const label = (month: string) => monthName.format(new Date(`${month}-15T12:00:00Z`));

export function ReportsPage() {
  const [months, setMonths] = useState(6);
  const report = useReport(months);

  return (
    <>
      <PageHeader title="Reports" description="Orders, sessions, money and demand. Months follow Pakistan time." />
      <div className="mt-6">
        <Segmented label="Period" value={String(months)} options={RANGES} onChange={(value) => setMonths(Number(value))} />
      </div>
      {report.isPending ? (
        <div className="mt-6 space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : report.isError ? (
        <Card className="mt-6">
          <ErrorState onRetry={() => void report.refetch()} />
        </Card>
      ) : (
        <ReportBody data={report.data} />
      )}
    </>
  );
}

function ReportBody({ data }: { data: Report }) {
  const t = data.totals;
  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Orders" value={t.orders} icon={ShoppingBag} />
        <StatCard label="Sessions done" value={t.sessions_completed} icon={CalendarCheck2} tone="brand" />
        <StatCard label="Cash collected" value={formatPkr(t.collected_pkr)} hint="By physios, from patients" icon={Wallet} />
        <StatCard label="Commission" value={formatPkr(t.commission_pkr)} icon={CircleDollarSign} tone="brand" />
        <StatCard label="New patients" value={t.new_patients} icon={UserPlus} />
        <StatCard
          label="Needs physio now"
          value={t.needs_physio_now}
          hint={`${t.offers_expired} not answered in time · ${t.offers_rejected} declined`}
          icon={Hourglass}
          tone={t.needs_physio_now ? "attention" : "neutral"}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Section title="Orders by month" className="xl:col-span-2">
          <MonthBars rows={data.by_month} />
        </Section>
        <Section title="Orders by status" description="All time, as they stand now.">
          <Breakdown
            rows={(Object.keys(BOOKING_STATUS_LABEL) as BookingStatus[]).map((status) => ({
              name: BOOKING_STATUS_LABEL[status],
              value: data.status_counts[status] ?? 0,
            }))}
          />
        </Section>
      </div>

      <Section title="Month by month" className="mt-6" flush>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs text-stone-500">
                <th scope="col" className="px-5 py-2.5 text-start font-medium">Month</th>
                <th scope="col" className="px-5 py-2.5 text-end font-medium">Orders</th>
                <th scope="col" className="px-5 py-2.5 text-end font-medium">Completed</th>
                <th scope="col" className="px-5 py-2.5 text-end font-medium">Cancelled</th>
                <th scope="col" className="px-5 py-2.5 text-end font-medium">Sessions</th>
                <th scope="col" className="px-5 py-2.5 text-end font-medium">Collected</th>
                <th scope="col" className="px-5 py-2.5 text-end font-medium">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 tabular-nums">
              {[...data.by_month].reverse().map((row) => (
                <tr key={row.month}>
                  <th scope="row" className="px-5 py-2.5 text-start font-medium text-stone-900">{label(row.month)}</th>
                  <td className="px-5 py-2.5 text-end text-stone-700">{row.orders}</td>
                  <td className="px-5 py-2.5 text-end text-stone-700">{row.completed_orders}</td>
                  <td className="px-5 py-2.5 text-end text-stone-700">{row.cancelled_orders}</td>
                  <td className="px-5 py-2.5 text-end text-stone-700">{row.sessions_completed}</td>
                  <td className="px-5 py-2.5 text-end text-stone-700">{formatPkr(row.collected_pkr)}</td>
                  <td className="px-5 py-2.5 text-end font-medium text-stone-900">{formatPkr(row.commission_pkr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Demand by treatment" description="Orders placed in this period.">
          <Breakdown rows={data.by_service.map((row) => ({ name: row.name, value: row.orders }))} />
        </Section>
        <Section title="Demand by area" description="Where orders came from. Useful for where to recruit physios.">
          <Breakdown rows={data.by_area.map((row) => ({ name: row.name, value: row.orders }))} />
        </Section>
      </div>

      <Section title="Busiest physiotherapists" description="By sessions completed in this period." className="mt-6" flush>
        {data.top_physios.length === 0 ? (
          <EmptyState title="No completed sessions in this period" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs text-stone-500">
                  <th scope="col" className="px-5 py-2.5 text-start font-medium">Physiotherapist</th>
                  <th scope="col" className="px-5 py-2.5 text-end font-medium">Sessions</th>
                  <th scope="col" className="px-5 py-2.5 text-end font-medium">Collected</th>
                  <th scope="col" className="px-5 py-2.5 text-end font-medium">Commission</th>
                  <th scope="col" className="px-5 py-2.5 text-end font-medium">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 tabular-nums">
                {data.top_physios.map((row) => (
                  <tr key={row.provider_id}>
                    <td className="px-5 py-2.5">
                      <RecordLink href={physioHref(row.provider_id)}>{row.name ?? "Unnamed"}</RecordLink>
                    </td>
                    <td className="px-5 py-2.5 text-end text-stone-700">{row.sessions_completed}</td>
                    <td className="px-5 py-2.5 text-end text-stone-700">{formatPkr(row.collected_pkr)}</td>
                    <td className="px-5 py-2.5 text-end text-stone-700">{formatPkr(row.commission_pkr)}</td>
                    <td className="px-5 py-2.5 text-end text-stone-700">
                      {row.rating_count ? `${row.rating_avg.toFixed(1)} (${row.rating_count})` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

/** One series, so one hue and no legend: the section title names it. Exact values are in the table below. */
function MonthBars({ rows }: { rows: ReportMonth[] }) {
  const max = Math.max(1, ...rows.map((row) => row.orders));
  if (rows.every((row) => row.orders === 0)) return <EmptyState title="No orders in this period yet" />;
  return (
    <div>
      <ul className="flex h-56 items-end gap-2 border-b border-stone-200" aria-label="Orders placed each month">
        {rows.map((row) => (
          <li key={row.month} className="group relative flex h-full flex-1 flex-col justify-end">
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow group-hover:block group-focus-within:block">
              {label(row.month)}: {row.orders} orders, {row.sessions_completed} sessions, {formatPkr(row.commission_pkr)} commission
            </span>
            <span
              tabIndex={0}
              aria-label={`${label(row.month)}: ${row.orders} orders`}
              className="block w-full rounded-t-[4px] bg-brand-600 outline-none transition group-hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-800"
              style={{ height: `${Math.max(row.orders ? 2 : 0, (row.orders / max) * 100)}%` }}
            />
          </li>
        ))}
      </ul>
      <ul className="mt-2 flex gap-2 text-center text-xs text-stone-500" aria-hidden="true">
        {rows.map((row) => (
          <li key={row.month} className="flex-1 truncate">
            {label(row.month)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Breakdown({ rows }: { rows: { name: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.length === 0 || rows.every((row) => row.value === 0)) return <EmptyState title="Nothing to show yet" />;
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-stone-700">{row.name}</span>
            <span className="font-medium text-stone-900 tabular-nums">{row.value}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-stone-100">
            <div className="h-2 rounded-full bg-brand-600" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
