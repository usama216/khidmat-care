"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck, Inbox, Package, Stethoscope, UsersRound, type LucideIcon } from "lucide-react";
import { Card, ErrorState, PageHeader, Skeleton } from "@/components/admin/ui";
import { useOverview, type Overview } from "./api";

type Tile = {
  label: string;
  value: (data: Overview) => number;
  detail: (data: Overview) => string;
  icon: LucideIcon;
  href?: string;
};

const TILES: Tile[] = [
  {
    label: "New messages",
    value: (d) => d.new_messages,
    detail: (d) => `${d.messages_last_7_days} in the last 7 days`,
    icon: Inbox,
    href: "/admin/messages/",
  },
  {
    label: "Physiotherapists awaiting approval",
    value: (d) => d.providers_pending,
    detail: (d) => `${d.providers_approved} approved`,
    icon: Stethoscope,
  },
  {
    label: "Bookings to assign",
    value: (d) => d.bookings_awaiting_assignment,
    detail: (d) => `${d.bookings_active} active`,
    icon: CalendarCheck,
  },
  { label: "Patients", value: (d) => d.patients, detail: () => "Registered patients", icon: UsersRound },
  {
    label: "Active services",
    value: (d) => d.active_services,
    detail: (d) => `${d.active_packages} priced packages`,
    icon: Package,
    href: "/admin/catalog/",
  },
];

export function OverviewPage() {
  const overview = useOverview();
  const noPrices = overview.data && overview.data.active_packages === 0;

  return (
    <>
      <PageHeader title="Overview" description="What needs attention today." />

      {noPrices ? (
        <Link
          href="/admin/catalog/"
          className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200 transition hover:bg-amber-100"
        >
          <span>
            <strong className="font-semibold">Package prices aren&apos;t set yet.</strong> Add them before taking
            bookings.
          </span>
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </Link>
      ) : null}

      {overview.isError ? (
        <Card className="mt-6">
          <ErrorState onRetry={() => void overview.refetch()} />
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {TILES.map((tile) => (
            <StatTile key={tile.label} tile={tile} data={overview.data} />
          ))}
        </div>
      )}
    </>
  );
}

function StatTile({ tile, data }: { tile: Tile; data?: Overview }) {
  const Icon = tile.icon;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-stone-600">{tile.label}</p>
        <Icon className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
      </div>
      {data ? (
        <>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 tabular-nums">{tile.value(data)}</p>
          <p className="mt-1 text-sm text-stone-500">{tile.detail(data)}</p>
        </>
      ) : (
        <>
          <Skeleton className="mt-3 h-9 w-16" />
          <Skeleton className="mt-2 h-4 w-32" />
        </>
      )}
    </>
  );
  return tile.href ? (
    <Link href={tile.href} className="block rounded-xl bg-white p-5 ring-1 ring-stone-200 transition hover:ring-stone-300">
      {body}
    </Link>
  ) : (
    <Card className="p-5">{body}</Card>
  );
}
