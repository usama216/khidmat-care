"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, Skeleton } from "./ui";

/** Building blocks for record pages and dashboards, shared by staff and physiotherapist screens. */

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-stone-500 transition hover:text-stone-900"
    >
      <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
      {label}
    </Link>
  );
}

type StatTone = "neutral" | "brand" | "attention" | "danger";

const statIconTones: Record<StatTone, string> = {
  neutral: "bg-stone-100 text-stone-600",
  brand: "bg-brand-50 text-brand-700",
  attention: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  href,
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: StatTone;
  href?: string;
  loading?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-stone-600">{label}</p>
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", statIconTones[tone])}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-3 h-8 w-20" />
          <Skeleton className="mt-2 h-4 w-28" />
        </>
      ) : (
        <>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-900 tabular-nums">{value}</p>
          {hint ? <p className="mt-1 text-sm text-stone-500">{hint}</p> : null}
        </>
      )}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="group block rounded-xl bg-white p-4 ring-1 ring-stone-200 transition hover:shadow-sm hover:ring-stone-300"
    >
      {body}
    </Link>
  ) : (
    <Card className="p-4">{body}</Card>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  flush,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Lets lists and tables run edge to edge. */
  flush?: boolean;
}) {
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-3.5">
        <div>
          <h2 className="font-semibold text-stone-900">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-stone-500">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className={flush ? undefined : "p-5"}>{children}</div>
    </Card>
  );
}

export function DetailGrid({ children, columns = 2 }: { children: ReactNode; columns?: 2 | 3 }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4", columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
      {children}
    </dl>
  );
}

export function DetailItem({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-full" : undefined}>
      <dt className="text-xs font-medium text-stone-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium break-words text-stone-900">{children ?? "-"}</dd>
    </div>
  );
}

export function RecordLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("font-medium text-brand-800 underline-offset-2 hover:underline", className)}>
      {children}
    </Link>
  );
}

/** A full-width row link, used for lists that open a record. */
export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-stone-50">
      <div className="min-w-0 flex-1">{children}</div>
      <ChevronRight
        className="size-4 shrink-0 text-stone-300 transition group-hover:text-stone-500 rtl:-scale-x-100"
        aria-hidden="true"
      />
    </Link>
  );
}

export function Segmented<T extends string | undefined>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-stone-100 p-1">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition",
            value === option.value ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900",
          )}
        >
          {option.label}
          {option.count ? (
            <span className="rounded-full bg-brand-700 px-1.5 text-[0.7rem] leading-4 font-semibold text-white tabular-nums">
              {option.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  label,
  value,
  tabs,
  onChange,
}: {
  label: string;
  value: T;
  tabs: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-stone-200">
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={cn(
              "-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition",
              selected
                ? "border-brand-700 text-brand-800"
                : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800",
            )}
          >
            {tab.label}
            {tab.count ? (
              <span className="rounded-full bg-stone-100 px-1.5 text-xs text-stone-600 tabular-nums">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export type TimelineItem ={ key: string; at: string; title: ReactNode; detail?: ReactNode; icon: LucideIcon; tone?: StatTone };

export function Timeline({ items, format }: { items: TimelineItem[]; format: (at: string) => string }) {
  return (
    <ol className="relative space-y-5">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <li key={item.key} className="relative flex gap-3">
            {index < items.length - 1 ? (
              <span aria-hidden="true" className="absolute start-3.5 top-8 -bottom-5 w-px bg-stone-200" />
            ) : null}
            <span
              className={cn(
                "relative grid size-7 shrink-0 place-items-center rounded-full ring-4 ring-white",
                statIconTones[item.tone ?? "neutral"],
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-medium text-stone-900">{item.title}</p>
              {item.detail ? <p className="mt-0.5 text-sm break-words text-stone-600">{item.detail}</p> : null}
              <p className="mt-0.5 text-xs text-stone-500">
                <time dateTime={item.at}>{format(item.at)}</time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function RecordSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function Initials({ name, className }: { name: string | null | undefined; className?: string }) {
  const letters = (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-800 ring-1 ring-brand-100",
        className,
      )}
    >
      {letters || "?"}
    </span>
  );
}
