"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeCheck,
  Briefcase,
  CalendarClock,
  LayoutDashboard,
  LogOut,
  Menu,
  UserRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { adminButton, ErrorState, Skeleton } from "@/components/admin/ui";
import { LogoMark } from "@/components/ui/Logo";
import { useCurrentUser, useLogout, type CurrentUser } from "@/features/auth/auth";
import { cn } from "@/lib/cn";
import { formatPkr } from "@/lib/format";
import { useProviderDashboard, useProviderProfile } from "./api";
import { homeFor } from "./PortalShell";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/physio/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/physio/jobs/", label: "Jobs", icon: Briefcase },
  { href: "/physio/availability/", label: "Availability", icon: CalendarClock },
  { href: "/physio/balance/", label: "Balance", icon: Wallet },
  { href: "/physio/profile/", label: "Profile", icon: UserRound },
];

/** The physiotherapist's workspace. Only decides what to show; the API checks the role on every call. */
export function PhysioShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useCurrentUser();

  useEffect(() => {
    if (!me.isSuccess) return;
    if (!me.data) router.replace(`/login/?next=${encodeURIComponent(pathname)}`);
    else if (me.data.role !== "PROVIDER") router.replace(homeFor(me.data));
  }, [me.isSuccess, me.data, pathname, router]);

  if (me.isError) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <ErrorState onRetry={() => void me.refetch()} />
      </main>
    );
  }
  if (me.data?.role !== "PROVIDER") {
    return (
      <div role="status" aria-label="Loading" className="flex min-h-dvh">
        <div className="hidden w-60 border-e border-stone-200 bg-white p-4 lg:block">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-6 h-40 w-full" />
        </div>
      </div>
    );
  }
  return <Shell user={me.data}>{children}</Shell>;
}

function Shell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const profile = useProviderProfile();
  const approved = profile.data?.status === "APPROVED";
  const dashboard = useProviderDashboard(Boolean(profile.data));
  const [open, setOpen] = useState(false);
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const offers = dashboard.data?.new_offers ?? 0;

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/physio/" className="flex h-14 items-center gap-2.5 border-b border-stone-200 px-4">
        <LogoMark className="size-7" />
        <span className="font-bold tracking-tight text-stone-900">Khidmat Care</span>
        <span className="ms-auto rounded bg-brand-50 px-1.5 py-0.5 text-[0.7rem] font-semibold text-brand-800">
          Physio
        </span>
      </Link>
      <nav aria-label="Physiotherapist" className="flex-1 space-y-0.5 p-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = normalized === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition",
                active ? "bg-brand-50 text-brand-800" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
              {href === "/physio/jobs/" && offers > 0 ? (
                <span className="ms-auto rounded-full bg-brand-700 px-1.5 text-xs font-semibold text-white">
                  <span className="sr-only">New offers: </span>
                  {offers}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      {dashboard.data ? (
        <Link
          href="/physio/balance/"
          onClick={() => setOpen(false)}
          className={cn(
            "mx-3 mb-3 rounded-xl p-3 ring-1 transition",
            dashboard.data.can_accept_orders
              ? "bg-stone-50 ring-stone-200 hover:bg-stone-100"
              : "bg-amber-50 ring-amber-200 hover:bg-amber-100",
          )}
        >
          <p className="text-xs font-medium text-stone-500">Balance</p>
          <p className="text-lg font-semibold text-stone-900 tabular-nums">{formatPkr(dashboard.data.balance_pkr)}</p>
          {!dashboard.data.can_accept_orders ? (
            <p className="text-xs font-medium text-amber-900">Top up to get new orders</p>
          ) : null}
        </Link>
      ) : null}
      <div className="border-t border-stone-200 p-3">
        <div className="flex items-center gap-2 px-3 py-1.5 text-sm">
          <span className="truncate font-medium text-stone-800">{user.name ?? user.phone}</span>
          {approved ? <BadgeCheck className="size-4 shrink-0 text-brand-700" aria-label="Verified" /> : null}
        </div>
        <button
          type="button"
          onClick={() => logout.mutate(undefined, { onSettled: () => router.replace("/login/") })}
          disabled={logout.isPending}
          className={adminButton("ghost", "w-full justify-start")}
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-stone-50">
      <aside className="fixed inset-y-0 start-0 hidden w-60 border-e border-stone-200 bg-white lg:block">{sidebar}</aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-stone-950/40"
          />
          <aside className="absolute inset-y-0 start-0 w-64 bg-white shadow-xl">{sidebar}</aside>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className={adminButton("secondary", "absolute start-[17rem] top-3 w-9 px-0")}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="lg:ps-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-stone-200 bg-white px-4 lg:hidden">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className={adminButton("secondary", "relative w-9 px-0")}
          >
            <Menu className="size-4" aria-hidden="true" />
            {offers > 0 ? (
              <span className="absolute -end-1 -top-1 size-2.5 rounded-full bg-brand-600 ring-2 ring-white" />
            ) : null}
          </button>
          <LogoMark className="size-7" />
          <span className="font-bold tracking-tight text-stone-900">Physio</span>
          {dashboard.data ? (
            <Link href="/physio/balance/" className="ms-auto text-sm font-semibold text-stone-800 tabular-nums">
              {formatPkr(dashboard.data.balance_pkr)}
            </Link>
          ) : null}
        </header>
        <main className="mx-auto max-w-6xl p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
