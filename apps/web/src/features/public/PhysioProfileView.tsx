"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, Clock, MapPin, Star } from "lucide-react";
import { AdminProviders } from "@/components/admin/AdminProviders";
import { BookingCalendar } from "@/components/calendar/BookingCalendar";
import { buttonClasses } from "@/components/ui/button";
import { type PhysioProfile, type VisitType, useCatalog, usePhysioProfile } from "@/features/portal/api";
import { PhysioPhoto } from "@/features/portal/FindPage";
import { cn } from "@/lib/cn";
import { dayKey, formatDayLong, formatTime } from "@/lib/dates";
import { formatPkr } from "@/lib/format";
import { Rating, VisitBadges } from "./PhysioCard";

export function PhysioProfileView() {
  return (
    <AdminProviders>
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile />
      </Suspense>
    </AdminProviders>
  );
}

function ProfileSkeleton() {
  return (
    <div className="shell py-12" role="status" aria-label="Loading">
      <div className="h-28 animate-pulse rounded-3xl bg-stone-100" />
      <div className="mt-6 h-96 animate-pulse rounded-3xl bg-stone-100" />
    </div>
  );
}

function Profile() {
  const params = useSearchParams();
  const id = params.get("id");
  const profile = usePhysioProfile(id);

  if (!id) return <Missing />;
  if (profile.isPending) return <ProfileSkeleton />;
  if (profile.isError) return <Missing notFound={profile.error.status === 404} />;
  return (
    <ProfileBody
      physio={profile.data}
      service={params.get("service") ?? undefined}
      area={params.get("area") ?? undefined}
      visit={(params.get("visit") as VisitType | null) ?? undefined}
    />
  );
}

function Missing({ notFound = true }: { notFound?: boolean }) {
  return (
    <div className="shell py-20 text-center">
      <p className="text-xl font-semibold text-stone-900">
        {notFound ? "This physiotherapist isn't taking bookings right now" : "Something went wrong"}
      </p>
      <p className="mt-2 text-stone-600">
        {notFound ? "Please choose another physiotherapist." : "Please refresh the page."}
      </p>
      <Link href="/physiotherapists/" className={buttonClasses("primary", "md", "mt-6")}>
        See all physiotherapists
      </Link>
    </div>
  );
}

function ProfileBody({
  physio,
  service,
  area,
  visit,
}: {
  physio: PhysioProfile;
  service?: string;
  area?: string;
  visit?: VisitType;
}) {
  const router = useRouter();
  const catalog = useCatalog();
  const name = physio.name ?? "Physiotherapist";
  const [visitType, setVisitType] = useState<VisitType>(
    visit && (visit === "HOME" ? physio.visit_home : physio.visit_clinic) ? visit : physio.visit_home ? "HOME" : "CLINIC",
  );
  const [startAt, setStartAt] = useState<string | null>(null);

  const serviceNames = new Map((catalog.data?.services ?? []).map((item) => [item.id, item.name]));
  const areaNames = new Map((catalog.data?.areas ?? []).map((item) => [item.id, item.name]));
  const treats = physio.service_type_ids.map((value) => serviceNames.get(value)).filter(Boolean);
  const areas = physio.area_ids.map((value) => areaNames.get(value)).filter(Boolean);

  const continueHref = startAt
    ? `/book/?${new URLSearchParams({
        physio: physio.id,
        start: startAt,
        visit: visitType,
        ...(service && physio.service_type_ids.includes(service) ? { service } : {}),
        ...(area && visitType === "HOME" && physio.area_ids.includes(area) ? { area } : {}),
      })}`
    : null;

  return (
    <>
      <section className="border-b border-stone-200/70 bg-[radial-gradient(60rem_30rem_at_85%_-10%,var(--color-brand-100),transparent_70%)]">
        <div className="shell py-10 sm:py-14">
          <Link href="/physiotherapists/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900">
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
            All physiotherapists
          </Link>
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
            <PhysioPhoto url={physio.photo_url} name={name} size="size-28" />
            <div className="min-w-0 flex-1">
              <h1 className="flex flex-wrap items-center gap-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
                {name}
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-sm font-medium text-brand-800">
                  <BadgeCheck className="size-4" aria-hidden="true" />
                  Verified
                </span>
              </h1>
              <p className="mt-2 text-lg text-stone-700">
                {physio.qualification} · {physio.experience_years} {physio.experience_years === 1 ? "year" : "years"} of experience
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Rating physio={physio} />
                <span className="inline-flex items-center gap-1 text-sm text-stone-600">
                  <Clock className="size-4" aria-hidden="true" />
                  {physio.slot_minutes}-minute sessions
                </span>
                <VisitBadges physio={physio} />
              </div>
            </div>
            <div className="rounded-3xl bg-white px-6 py-4 ring-1 ring-stone-200">
              <p className="text-sm text-stone-500">Fee per session</p>
              <p className="text-2xl font-semibold text-stone-900 tabular-nums">
                {physio.fee_pkr ? formatPkr(physio.fee_pkr) : "-"}
              </p>
              <p className="text-xs text-stone-500">Paid in cash after each visit</p>
            </div>
          </div>
        </div>
      </section>

      <section className="shell py-10 sm:py-14" aria-labelledby="book-title">
        <div className="rounded-3xl bg-white p-5 ring-1 ring-stone-200 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="book-title" className="text-2xl font-semibold tracking-tight text-stone-900">
                Choose a date and time
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                Only free times can be chosen. Your time is held for you while {name} confirms.
              </p>
            </div>
            {physio.visit_home && physio.visit_clinic ? (
              <div role="group" aria-label="Visit type" className="flex gap-1 rounded-full bg-stone-100 p-1">
                {(["HOME", "CLINIC"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={visitType === value}
                    onClick={() => setVisitType(value)}
                    className={cn(
                      "h-9 rounded-full px-4 text-sm font-semibold transition",
                      visitType === value ? "bg-white text-stone-900 shadow-sm" : "text-stone-600",
                    )}
                  >
                    {value === "HOME" ? "Home visit" : "Clinic visit"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="mt-6">
            <BookingCalendar physioId={physio.id} value={startAt} onChange={setStartAt} />
          </div>
          <div className="mt-6 flex flex-col gap-3 border-t border-stone-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-stone-700" aria-live="polite">
              {startAt ? (
                <>
                  <span className="font-semibold text-stone-900">
                    {formatDayLong(dayKey(startAt))}, {formatTime(startAt)}
                  </span>{" "}
                  · {visitType === "HOME" ? "Home visit" : "Clinic visit"}
                </>
              ) : (
                "No time chosen yet"
              )}
            </p>
            <button
              type="button"
              disabled={!continueHref}
              onClick={() => continueHref && router.push(continueHref)}
              className={buttonClasses("primary", "lg")}
            >
              Continue to book
            </button>
          </div>
        </div>
      </section>

      <section className="shell grid grid-cols-1 gap-6 pb-16 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {physio.bio ? (
            <div className="rounded-3xl bg-white p-6 ring-1 ring-stone-200">
              <h2 className="text-lg font-semibold text-stone-900">About</h2>
              <p className="mt-2 whitespace-pre-line text-stone-700">{physio.bio}</p>
            </div>
          ) : null}
          <div className="rounded-3xl bg-white p-6 ring-1 ring-stone-200">
            <h2 className="text-lg font-semibold text-stone-900">Ratings from patients</h2>
            {physio.reviews.length === 0 ? (
              <p className="mt-2 text-stone-600">No ratings yet. Ratings appear after completed sessions.</p>
            ) : (
              <ul className="mt-3 divide-y divide-stone-100">
                {physio.reviews.map((review) => (
                  <li key={review.created_at} className="py-3">
                    <p className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5`}>
                      {Array.from({ length: 5 }, (_, index) => (
                        <Star
                          key={index}
                          aria-hidden="true"
                          className={cn("size-4", index < review.rating ? "fill-amber-400 text-amber-400" : "text-stone-300")}
                        />
                      ))}
                      <span className="ms-2 text-xs text-stone-500">Verified patient · {formatDayLong(dayKey(review.created_at))}</span>
                    </p>
                    {review.comment ? <p dir="auto" className="mt-1 text-stone-700">{review.comment}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-3xl bg-white p-6 ring-1 ring-stone-200">
            <h2 className="text-lg font-semibold text-stone-900">Treats</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {treats.map((item) => (
                <li key={item} className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-white p-6 ring-1 ring-stone-200">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
              <MapPin className="size-4.5 text-stone-500" aria-hidden="true" />
              Where
            </h2>
            {physio.visit_home ? (
              <p className="mt-2 text-sm text-stone-700">
                <span className="font-medium">Home visits in: </span>
                {areas.join(", ")}
              </p>
            ) : null}
            {physio.visit_clinic && physio.clinic_area_id ? (
              <p className="mt-2 text-sm text-stone-700">
                <span className="font-medium">Clinic in: </span>
                {areaNames.get(physio.clinic_area_id)}. The full address is shared once your visit is confirmed.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
