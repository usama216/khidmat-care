"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { adminButton, Skeleton } from "@/components/admin/ui";
import { LogoMark } from "@/components/ui/Logo";
import { isStaff, useCurrentUser, useLogout, type CurrentUser } from "@/features/auth/auth";
import { cn } from "@/lib/cn";

const NAV: Record<string, { href: string; label: string }[]> = {
  PATIENT: [
    { href: "/find/", label: "Find a physio" },
    { href: "/my/bookings/", label: "My orders" },
  ],
  PROVIDER: [
    { href: "/physio/", label: "Jobs" },
    { href: "/physio/availability/", label: "Availability" },
    { href: "/physio/balance/", label: "Balance" },
    { href: "/physio/profile/", label: "Profile" },
  ],
};

export function homeFor(user: CurrentUser) {
  if (isStaff(user)) return "/admin/";
  return user.role === "PROVIDER" ? "/physio/" : "/my/bookings/";
}

export function PortalHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const me = useCurrentUser();
  const logout = useLogout();
  const user = me.data;
  const links = user ? (NAV[user.role] ?? []) : [{ href: "/find/", label: "Find a physio" }];

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight text-stone-900">
          <LogoMark className="size-7" />
          <span className="hidden sm:inline">Khidmat Care</span>
        </Link>
        <nav aria-label="Main" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
                pathname === link.href ? "bg-brand-50 text-brand-800" : "text-stone-600 hover:bg-stone-100",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {user ? (
          <button
            type="button"
            aria-label="Sign out"
            disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSettled: () => router.replace("/login/") })}
            className={adminButton("ghost", "w-9 px-0 sm:w-auto sm:px-3")}
          >
            <LogOut className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        ) : (
          <Link href="/login/" className={adminButton("secondary")}>
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

export function PortalPage({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-dvh bg-stone-50">
      <PortalHeader />
      <main className={cn("mx-auto p-4 sm:p-6", wide ? "max-w-5xl" : "max-w-3xl")}>{children}</main>
    </div>
  );
}

// Shows a page only to the right role. The API enforces the same rule on every request.
export function RequireRole({
  role,
  children,
}: {
  role: "PATIENT" | "PROVIDER";
  children: (user: CurrentUser) => ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useCurrentUser();

  useEffect(() => {
    if (!me.isSuccess) return;
    if (!me.data) {
      // Keeps the chosen physiotherapist, so signing in returns to the same booking.
      const here = `${pathname}${window.location.search}`;
      router.replace(`/login/?next=${encodeURIComponent(here)}`);
    }
    else if (me.data.role !== role) router.replace(homeFor(me.data));
  }, [me.isSuccess, me.data, role, pathname, router]);

  if (me.data?.role !== role) {
    return (
      <div role="status" aria-label="Loading" className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  return <>{children(me.data)}</>;
}

export function EmergencyLine() {
  return (
    <p className="text-sm text-stone-600">
      <strong className="font-semibold text-red-800">Medical emergency?</strong> Call{" "}
      <a href="tel:1122" className="font-semibold text-red-800 underline">
        1122
      </a>{" "}
      straight away. Khidmat Care is for planned treatment at home.
    </p>
  );
}
