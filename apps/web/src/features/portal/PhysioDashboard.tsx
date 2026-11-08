"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bell,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDollarSign,
  Clock,
  MapPin,
  Star,
  Wallet,
} from "lucide-react";
import { Section, StatCard } from "@/components/admin/records";
import { adminButton, Card, EmptyState, ErrorState, Skeleton } from "@/components/admin/ui";
import { useCurrentUser } from "@/features/auth/auth";
import { cn } from "@/lib/cn";
import { formatPkr } from "@/lib/format";
import {
  type ProviderDashboard,
  type ProviderProfile,
  type UpcomingSession,
  useProviderDashboard,
  useProviderProfile,
} from "./api";
import { SessionStatusBadge } from "./shared";

const dayFormat = new Intl.DateTimeFormat("en-PK", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Karachi" });
const timeFormat = new Intl.DateTimeFormat("en-PK", { timeStyle: "short", timeZone: "Asia/Karachi" });
const shortDay = new Intl.DateTimeFormat("en-PK", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Karachi" });
const hourFormat = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Karachi" });

function greeting() {
  const hour = Number(hourFormat.format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "Dr Sana Malik" becomes "Dr Sana", and "Sana Malik" becomes "Sana". */
function shortName(name: string | null | undefined) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return /^dr\.?$/i.test(words[0]) && words[1] ? `${words[0]} ${words[1]}` : words[0];
}

function dayKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date(value));
}

export function PhysioDashboardPage() {
  const me = useCurrentUser();
  const profile = useProviderProfile();
  const dashboard = useProviderDashboard(Boolean(profile.data));
  const firstName = shortName(me.data?.name);

  if (profile.isPending) {
    return (
      <div role="status" aria-label="Loading" className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (profile.isError) return <ErrorState onRetry={() => void profile.refetch()} />;

  const approved = profile.data?.status === "APPROVED";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-stone-500">{dayFormat.format(new Date())}</p>
          <h1 className="mt-0.5 text-[1.6rem] font-semibold tracking-tight text-stone-900">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        {approved ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800 ring-1 ring-brand-100">
            <BadgeCheck className="size-4" aria-hidden="true" />
            Verified physiotherapist
          </span>
        ) : null}
      </div>

      {!approved ? <Onboarding profile={profile.data} /> : null}
      {dashboard.data ? <Alerts data={dashboard.data} /> : null}
      {profile.data ? <Numbers query={dashboard} /> : null}
    </>
  );
}

function Alerts({ data }: { data: ProviderDashboard }) {
  return (
    <div className="mt-5 space-y-3 empty:hidden">
      {data.new_offers > 0 ? (
        <Link
          href="/physio/jobs/"
          className="flex items-center gap-3 rounded-xl bg-brand-700 p-4 text-white shadow-sm transition hover:bg-brand-800"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/15">
            <Bell className="size-4" aria-hidden="true" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">
              {data.new_offers} new {data.new_offers === 1 ? "order is" : "orders are"} waiting for you
            </span>
            <span className="text-sm text-brand-100">Accept or decline so the patient isn&apos;t kept waiting.</span>
          </span>
          <ArrowRight className="size-4 shrink-0 rtl:-scale-x-100" aria-hidden="true" />
        </Link>
      ) : null}
      {data.status === "APPROVED" && !data.can_accept_orders ? (
        <Link
          href="/physio/balance/"
          className="flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-amber-950 ring-1 ring-amber-200 transition hover:bg-amber-100"
        >
          <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-sm">
            <strong className="font-semibold">You won&apos;t get new orders.</strong> Your balance is{" "}
            {formatPkr(data.balance_pkr)}, below the {formatPkr(data.minimum_balance_pkr)} minimum.
          </span>
          <span className="text-sm font-semibold">Top up</span>
        </Link>
      ) : null}
    </div>
  );
}

function Numbers({ query }: { query: ReturnType<typeof useProviderDashboard> }) {
  if (query.isError) {
    return (
      <Card className="mt-6">
        <ErrorState onRetry={() => void query.refetch()} />
      </Card>
    );
  }
  const data = query.data;
  const loading = !data;

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Balance"
          value={data ? formatPkr(data.balance_pkr) : ""}
          hint={data ? `Minimum ${formatPkr(data.minimum_balance_pkr)}` : undefined}
          icon={Wallet}
          tone={data && !data.can_accept_orders ? "attention" : "brand"}
          href="/physio/balance/"
          loading={loading}
        />
        <StatCard
          label="Today"
          value={data ? `${data.sessions_today} ${data.sessions_today === 1 ? "session" : "sessions"}` : ""}
          hint={data ? `${data.sessions_upcoming} coming up` : undefined}
          icon={CalendarClock}
          href="/physio/jobs/"
          loading={loading}
        />
        <StatCard
          label="Collected this month"
          value={data ? formatPkr(data.collected_this_month_pkr) : ""}
          hint={data ? `${data.completed_this_month} sessions · ${formatPkr(data.commission_this_month_pkr)} commission` : undefined}
          icon={Banknote}
          loading={loading}
        />
        <StatCard
          label="Rating"
          value={data ? (data.rating_count ? `${data.rating_avg.toFixed(1)} / 5` : "New") : ""}
          hint={data ? `${data.rating_count} ratings · ${data.sessions_completed} sessions done` : undefined}
          icon={Star}
          loading={loading}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Section
          className="lg:col-span-2"
          title="Coming up"
          description="Your next sessions. Numbers appear 2 hours before each one."
          flush
          actions={
            <Link href="/physio/jobs/" className={adminButton("ghost")}>
              All jobs
            </Link>
          }
        >
          {loading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : data.upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarCheck2}
              title="No sessions scheduled"
              description="Keep your availability up to date so patients can book you."
            />
          ) : (
            <UpcomingList sessions={data.upcoming} />
          )}
        </Section>

        <div className="space-y-6">
          <Section title="This month">
            {loading ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              <dl className="space-y-3 text-sm">
                <Row label="Cash collected" value={formatPkr(data.collected_this_month_pkr)} />
                <Row label="Commission" value={`− ${formatPkr(data.commission_this_month_pkr)}`} />
                <div className="border-t border-stone-200 pt-3">
                  <Row
                    label="You keep"
                    value={formatPkr(data.collected_this_month_pkr - data.commission_this_month_pkr)}
                    strong
                  />
                </div>
                <p className="text-xs text-stone-500">
                  From {data.completed_this_month} completed {data.completed_this_month === 1 ? "session" : "sessions"}.
                </p>
              </dl>
            )}
          </Section>
          <Card className="p-5">
            <h2 className="font-semibold text-stone-900">Quick actions</h2>
            <div className="mt-3 grid gap-2">
              <Link href="/physio/availability/" className={adminButton("secondary", "justify-start")}>
                <Clock className="size-4" aria-hidden="true" />
                Update working hours
              </Link>
              <Link href="/physio/balance/" className={adminButton("secondary", "justify-start")}>
                <CircleDollarSign className="size-4" aria-hidden="true" />
                Top up balance
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={strong ? "font-semibold text-stone-900" : "text-stone-600"}>{label}</dt>
      <dd className={cn("tabular-nums", strong ? "text-base font-semibold text-stone-900" : "font-medium text-stone-900")}>
        {value}
      </dd>
    </div>
  );
}

function UpcomingList({ sessions }: { sessions: UpcomingSession[] }) {
  const today = dayKey(new Date());
  return (
    <ul className="divide-y divide-stone-100">
      {sessions.map((session) => {
        const isToday = dayKey(session.scheduled_at) === today;
        return (
          <li key={session.session_id}>
            <Link href="/physio/jobs/" className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-stone-50">
              <div
                className={cn(
                  "w-20 shrink-0 rounded-lg px-2 py-1.5 text-center",
                  isToday ? "bg-brand-700 text-white" : "bg-stone-100 text-stone-700",
                )}
              >
                <p className="text-[0.7rem] font-medium uppercase">{isToday ? "Today" : shortDay.format(new Date(session.scheduled_at))}</p>
                <p className="text-sm font-semibold tabular-nums">{timeFormat.format(new Date(session.scheduled_at))}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-stone-900">
                  {session.patient_name}
                  <span className="font-normal text-stone-500"> · {session.service_name}</span>
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-stone-500">
                  <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                  {session.area_name} · Session {session.sequence} of {session.sessions_count} · KC-{session.booking_number}
                </p>
              </div>
              <span className="hidden sm:block">
                <SessionStatusBadge status={session.status} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Onboarding({ profile }: { profile: ProviderProfile | null | undefined }) {
  const documents = new Set(profile?.documents.map((document) => document.type));
  const submitted = profile ? ["PENDING", "APPROVED", "SUSPENDED"].includes(profile.status) : false;
  const steps = [
    { label: "Create your profile", done: Boolean(profile), href: "/physio/profile/" },
    { label: "Add your photo", done: Boolean(profile?.photo_file_id), href: "/physio/profile/" },
    {
      label: "Upload your CNIC and degree",
      done: documents.has("CNIC_FRONT") && documents.has("CNIC_BACK") && documents.has("DEGREE"),
      href: "/physio/profile/",
    },
    { label: "Set your working hours", done: Boolean(profile?.availability.length), href: "/physio/availability/" },
    { label: "Submit for review", done: submitted, href: "/physio/profile/" },
    { label: "Verification and a short meeting with our team", done: profile?.status === "APPROVED", href: null },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const next = steps.find((step) => !step.done);

  if (profile?.status === "SUSPENDED" || profile?.status === "REJECTED") {
    return (
      <div className="mt-6 flex items-start gap-3 rounded-xl bg-red-50 p-5 text-red-950 ring-1 ring-red-100">
        <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-semibold">
            {profile.status === "SUSPENDED" ? "Your account is suspended." : "Your application wasn't approved."}
          </p>
          {profile.status_reason ? <p className="mt-1">Reason: {profile.status_reason}</p> : null}
          {profile.status === "REJECTED" ? (
            <Link href="/physio/profile/" className={adminButton("primary", "mt-3")}>
              Update and resubmit
            </Link>
          ) : (
            <p className="mt-1">Message our support on WhatsApp if you think this is a mistake.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-linear-to-r from-brand-50 to-white p-5">
        <div>
          <h2 className="font-semibold text-stone-900">
            {submitted ? "Your application is being reviewed" : "Get ready to receive patients"}
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            {submitted
              ? "Our team checks your documents and arranges a short meeting. We'll approve you after that."
              : `${doneCount} of ${steps.length} steps done.`}
          </p>
        </div>
        {next?.href ? (
          <Link href={next.href} className={adminButton("primary")}>
            {next.label}
            <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <div className="h-1 bg-stone-100">
        <div className="h-full bg-brand-600 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="grid grid-cols-1 gap-x-6 gap-y-3 p-5 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-2.5 text-sm">
            {step.done ? (
              <CheckCircle2 className="size-5 shrink-0 text-brand-700" aria-hidden="true" />
            ) : (
              <Circle className="size-5 shrink-0 text-stone-300" aria-hidden="true" />
            )}
            {step.done || !step.href ? (
              <span className={step.done ? "text-stone-500 line-through decoration-stone-300" : "text-stone-800"}>
                {step.label}
              </span>
            ) : (
              <Link href={step.href} className="font-medium text-stone-900 hover:underline">
                {step.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
