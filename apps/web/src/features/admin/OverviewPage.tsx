"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Inbox,
  MessageSquareWarning,
  Package,
  Stethoscope,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, ErrorState, PageHeader, Skeleton } from "@/components/admin/ui";
import { useCurrentUser } from "@/features/auth/auth";
import { useOverview, type Overview } from "./api";

type Tile = {
  label: string;
  value: (data: Overview) => number;
  detail: (data: Overview) => string;
  icon: LucideIcon;
  href?: string;
  permission?: string;
};

const TILES: Tile[] = [
  {
    label: "Physiotherapists to review",
    value: (d) => d.providers_pending,
    detail: (d) => `${d.providers_approved} approved`,
    icon: Stethoscope,
    href: "/admin/providers/",
    permission: "providers.verify",
  },
  {
    label: "Orders needing a physio",
    value: (d) => d.bookings_awaiting_assignment,
    detail: (d) => `${d.bookings_awaiting_acceptance} waiting for a reply, ${d.bookings_active} active`,
    icon: CalendarCheck,
    href: "/admin/bookings/",
    permission: "bookings.manage",
  },
  {
    label: "Top-ups to check",
    value: (d) => d.pending_topups,
    detail: () => "Payments from physiotherapists",
    icon: Wallet,
    href: "/admin/balances/",
    permission: "finance.manage",
  },
  {
    label: "Open complaints",
    value: (d) => d.open_complaints,
    detail: () => "Reported by patients",
    icon: MessageSquareWarning,
    href: "/admin/complaints/",
    permission: "complaints.manage",
  },
  {
    label: "New messages",
    value: (d) => d.new_messages,
    detail: (d) => `${d.messages_last_7_days} in the last 7 days`,
    icon: Inbox,
    href: "/admin/messages/",
    permission: "messages.manage",
  },
  {
    label: "Patients",
    value: (d) => d.patients,
    detail: () => "People booked for",
    icon: UsersRound,
    href: "/admin/patients/",
    permission: "bookings.manage",
  },
  {
    label: "Active services",
    value: (d) => d.active_services,
    detail: (d) => `${d.active_packages} priced packages`,
    icon: Package,
    href: "/admin/catalog/",
    permission: "catalog.manage",
  },
];

export function OverviewPage() {
  const overview = useOverview();
  const me = useCurrentUser();
  const permissions = me.data?.permissions ?? [];
  const canManageCatalog = permissions.includes("catalog.manage");
  const noPrices = canManageCatalog && overview.data && overview.data.active_packages === 0;
  // Staff see every count, but only get links to pages their role can open.
  const tiles = TILES.map((tile) =>
    tile.permission && !permissions.includes(tile.permission) ? { ...tile, href: undefined } : tile,
  );

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
          {tiles.map((tile) => (
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
