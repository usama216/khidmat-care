"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, CircleAlert, Inbox, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[1.45rem] font-semibold tracking-tight text-stone-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-stone-500">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl bg-white ring-1 ring-stone-200", className)}>{children}</div>;
}

type Tone = "neutral" | "good" | "attention";

const tones: Record<Tone, string> = {
  neutral: "bg-stone-100 text-stone-700 ring-stone-200",
  good: "bg-brand-50 text-brand-800 ring-brand-100",
  attention: "bg-amber-50 text-amber-900 ring-amber-200",
};

// Status always carries a text label, so it never relies on color alone.
export function Badge({ tone = "neutral", icon: Icon, children }: { tone?: Tone; icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1", tones[tone])}>
      {Icon ? <Icon className="size-3" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800",
  secondary: "bg-white text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50",
  ghost: "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
};

export function adminButton(variant: ButtonVariant = "secondary", className?: string) {
  return cn(
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50",
    buttonVariants[variant],
    className,
  );
}

export const adminInput =
  "block h-9 w-full rounded-lg border-0 bg-white px-3 text-sm text-stone-900 ring-1 ring-stone-300 transition placeholder:text-stone-400 focus:ring-2 focus:ring-brand-600 focus:outline-none aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-500";

export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-stone-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-100">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-stone-200/70", className)} />;
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3 p-5">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ title, description, icon: Icon = Inbox }: { title: string; description?: string; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-stone-100 text-stone-500">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-medium text-stone-900">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-stone-500">{description}</p> : null}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-16 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-red-50 text-red-600">
        <CircleAlert className="size-5" aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-medium text-stone-900">This couldn&apos;t be loaded</p>
      <p className="mt-1 text-sm text-stone-500">Check your connection and try again.</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className={adminButton("secondary", "mt-4")}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-4 border-t border-stone-200 px-5 py-3 text-sm text-stone-500">
      <p>
        {first}–{last} of {total}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={adminButton("secondary", "w-9 px-0")}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          className={adminButton("secondary", "w-9 px-0")}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  side = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  side?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  // The native dialog handles focus trapping, Escape and the backdrop.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-label={title}
      className={cn(
        "bg-white shadow-2xl backdrop:bg-stone-950/40",
        side
          ? "ms-auto me-0 my-0 h-dvh max-h-dvh w-full max-w-lg"
          : "m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl",
      )}
    >
      <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
        <h2 className="font-semibold text-stone-900">{title}</h2>
        <button type="button" aria-label="Close" onClick={onClose} className={adminButton("ghost", "w-9 px-0")}>
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}

const dateTimeFormat = new Intl.DateTimeFormat("en-PK", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Karachi",
});

export function formatDateTime(value: string) {
  return dateTimeFormat.format(new Date(value));
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error && typeof error === "object" && "code" in error && "message" in error) {
    const { code, message } = error as { code: string; message: string };
    if (code === "network_error") return "Couldn't reach the server. Check your connection and try again.";
    if (code !== "internal_error" && code !== "unknown_error") return message;
  }
  return fallback;
}
