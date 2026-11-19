"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, Building2, CalendarClock, Home, Inbox } from "lucide-react";
import {
  adminButton,
  Card,
  EmptyState,
  errorMessage,
  ErrorState,
  formatDateTime,
  PageHeader,
  Skeleton,
} from "@/components/admin/ui";
import { formatPkr } from "@/lib/format";
import { type OpenRequest, useOpenRequests, usePickRequest, useProviderProfile } from "./api";
import { ApplicationBanner } from "./PhysioPages";

function age(birthYear: number | null) {
  return birthYear ? `, ${new Date().getFullYear() - birthYear} years` : "";
}

/**
 * Requests near the physiotherapist that nobody has yet. The first to pick one gets it, already
 * confirmed; for everyone else it disappears from this list.
 */
export function PhysioRequestsPage() {
  const profile = useProviderProfile();
  const approved = profile.data?.status === "APPROVED";
  const requests = useOpenRequests(approved);

  if (profile.isPending) return <Skeleton className="h-96 w-full" />;
  return (
    <>
      <PageHeader
        title="Open requests"
        description="Patients near you who need a physiotherapist. The first to pick a request gets it. Patient details appear once it's yours."
      />
      {!approved ? (
        <ApplicationBanner profile={profile.data} />
      ) : requests.isPending ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : requests.isError ? (
        <Card className="mt-4">
          <ErrorState onRetry={() => void requests.refetch()} />
        </Card>
      ) : requests.data.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={Inbox}
            title="No open requests right now"
            description="When a patient near you needs your treatment, it appears here and we send you a WhatsApp."
          />
        </Card>
      ) : (
        <ul className="mt-4 space-y-3">
          {requests.data.map((item) => (
            <RequestCard key={item.id} item={item} />
          ))}
        </ul>
      )}
      {approved && profile.data && !profile.data.whatsapp_alerts ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
          <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            WhatsApp alerts are off, so you&apos;ll only see requests here.{" "}
            <Link href="/physio/profile/" className="font-semibold underline">
              Turn them on
            </Link>
          </span>
        </p>
      ) : null}
    </>
  );
}

function RequestCard({ item }: { item: OpenRequest }) {
  const pick = usePickRequest();
  const router = useRouter();
  const taken = pick.error?.code === "request_taken";

  return (
    <li>
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-stone-500">Request KC-{item.number}</p>
            <h2 className="mt-0.5 text-lg font-semibold text-stone-900">{item.service_name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-700">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-4 text-stone-400" aria-hidden="true" />
                {formatDateTime(item.preferred_start_at)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                {item.visit_type === "CLINIC" ? (
                  <Building2 className="size-4 text-stone-400" aria-hidden="true" />
                ) : (
                  <Home className="size-4 text-stone-400" aria-hidden="true" />
                )}
                {item.visit_type === "CLINIC" ? "At your clinic" : `Home visit in ${item.area_name}`}
              </span>
            </p>
            <p className="mt-1 text-sm text-stone-600">
              Patient: {item.patient_gender === "FEMALE" ? "female" : "male"}
              {age(item.patient_birth_year)} · {item.sessions_count} {item.sessions_count === 1 ? "session" : "sessions"}
            </p>
          </div>
          {item.price_total_pkr ? (
            <p className="sm:text-end">
              <span className="block text-xs text-stone-500">You collect</span>
              <span className="text-lg font-semibold text-stone-900 tabular-nums">{formatPkr(item.price_total_pkr)}</span>
            </p>
          ) : null}
        </div>
        <p dir="auto" className="mt-3 rounded-lg bg-stone-50 p-3 text-sm text-stone-700">
          {item.condition}
        </p>

        {taken ? (
          <p role="status" className="mt-3 rounded-lg bg-stone-100 p-3 text-sm text-stone-700">
            Another physiotherapist picked this request first.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!item.can_pick || pick.isPending}
              // It's confirmed straight away, so the job, with its address, is the next stop.
              onClick={() => pick.mutate(item.id, { onSuccess: () => router.push("/physio/jobs/?picked=1") })}
              className={adminButton("primary")}
            >
              {pick.isPending ? "Picking..." : "Pick this request"}
            </button>
            {item.reason ? <p className="text-sm text-amber-800">{item.reason}</p> : null}
            {pick.isError && !taken ? <p className="text-sm text-red-700">{errorMessage(pick.error)}</p> : null}
          </div>
        )}
      </Card>
    </li>
  );
}
