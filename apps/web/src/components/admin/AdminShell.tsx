"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Inbox, LayoutDashboard, LogOut, Menu, ScrollText, Tags, X, type LucideIcon } from "lucide-react";
import { useCurrentUser, useLogout } from "@/features/auth/auth";
import { useOverview } from "@/features/admin/api";
import { LogoMark } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";
import { adminButton, ErrorState, Skeleton } from "./ui";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin/", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/messages/", label: "Messages", icon: Inbox },
  { href: "/admin/catalog/", label: "Services & pricing", icon: Tags },
  { href: "/admin/audit/", label: "Audit log", icon: ScrollText },
];

// This guard only decides what to show. The API checks the session and role on every request.
export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const me = useCurrentUser();
  const allowed = me.data?.role === "ADMIN";

  useEffect(() => {
    if (me.isSuccess && !allowed) router.replace("/admin/login/");
  }, [me.isSuccess, allowed, router]);

  if (me.isError) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <ErrorState onRetry={() => void me.refetch()} />
      </main>
    );
  }
  if (!allowed) {
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

  return <Shell name={me.data?.name ?? me.data?.email ?? "Admin"}>{children}</Shell>;
}

function Shell({ name, children }: { name: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const overview = useOverview();
  const [open, setOpen] = useState(false);

  const signOut = () => logout.mutate(undefined, { onSettled: () => router.replace("/admin/login/") });
  const newMessages = overview.data?.new_messages ?? 0;
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 border-b border-stone-200 px-4">
        <LogoMark className="size-7" />
        <span className="font-bold tracking-tight text-stone-900">Khidmat Care</span>
        <span className="ms-auto rounded bg-stone-100 px-1.5 py-0.5 text-[0.7rem] font-semibold text-stone-600">
          Admin
        </span>
      </div>
      <nav aria-label="Admin" className="flex-1 space-y-0.5 p-3">
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
              {href === "/admin/messages/" && newMessages > 0 ? (
                <span className="ms-auto rounded-full bg-brand-700 px-1.5 text-xs font-semibold text-white">
                  <span className="sr-only">New messages: </span>
                  {newMessages}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-stone-200 p-3">
        <p className="truncate px-3 text-sm font-medium text-stone-900">{name}</p>
        <button
          type="button"
          onClick={signOut}
          disabled={logout.isPending}
          className={adminButton("ghost", "mt-1 w-full justify-start")}
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh">
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
            className={adminButton("secondary", "w-9 px-0")}
          >
            <Menu className="size-4" aria-hidden="true" />
          </button>
          <LogoMark className="size-7" />
          <span className="font-bold tracking-tight text-stone-900">Admin</span>
        </header>
        <main className="mx-auto max-w-6xl p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
