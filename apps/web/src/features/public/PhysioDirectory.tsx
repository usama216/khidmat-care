"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Sparkles, UsersRound } from "lucide-react";
import { AdminProviders } from "@/components/admin/AdminProviders";
import { buttonClasses } from "@/components/ui/button";
import {
  type Catalog,
  type MatchQuery,
  type VisitType,
  useCatalog,
  useMatchPhysios,
  usePhysios,
} from "@/features/portal/api";
import { PhysioPhoto } from "@/features/portal/FindPage";
import { cn } from "@/lib/cn";
import { addDays, formatDayShort, formatTime, lahoreIso, todayKey } from "@/lib/dates";
import { formatPkr } from "@/lib/format";
import { PhysioCard, physioProfileHref, Rating } from "./PhysioCard";

const field =
  "h-12 w-full rounded-2xl bg-white px-4 text-[0.95rem] text-stone-900 ring-1 ring-stone-300/80 outline-none transition focus:ring-2 focus:ring-brand-600";

export function PhysioDirectory() {
  return (
    <AdminProviders>
      <Directory />
    </AdminProviders>
  );
}

function Directory() {
  const catalog = useCatalog();
  const [service, setService] = useState("");
  const [area, setArea] = useState("");
  const [visit, setVisit] = useState("");
  const [gender, setGender] = useState("");
  const physios = usePhysios({
    service_id: service || undefined,
    area_id: area || undefined,
    visit_type: visit || undefined,
    gender: gender || undefined,
  });
  const serviceNames = new Map((catalog.data?.services ?? []).map((item) => [item.id, item.name]));

  return (
    <>
      <section className="shell py-12 sm:py-16" aria-labelledby="directory-title">
        <h2 id="directory-title" className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
          Choose your physiotherapist
        </h2>
        <p className="mt-2 max-w-2xl text-stone-600">
          Every physiotherapist is verified by our team. See their fee and free times, then pick a slot.
        </p>

        <div
          className={cn(
            "mt-8 grid grid-cols-1 gap-3 rounded-3xl bg-sand-100/70 p-4 sm:grid-cols-2",
            catalog.data?.clinic_visits ? "lg:grid-cols-4" : "lg:grid-cols-3",
          )}
        >
          <select aria-label="Problem or specialization" value={service} onChange={(e) => setService(e.target.value)} className={field}>
            <option value="">All specializations</option>
            {catalog.data?.services.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)} className={field}>
            <option value="">All areas of Lahore</option>
            {catalog.data?.areas.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {catalog.data?.clinic_visits ? (
            <select aria-label="Home or clinic" value={visit} onChange={(e) => setVisit(e.target.value)} className={field}>
              <option value="">Home or clinic</option>
              <option value="HOME">Home visit</option>
              <option value="CLINIC">Clinic visit</option>
            </select>
          ) : null}
          <select aria-label="Physiotherapist" value={gender} onChange={(e) => setGender(e.target.value)} className={field}>
            <option value="">Female or male physio</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
          </select>
        </div>

        <div className="mt-8" aria-live="polite">
          {physios.isPending ? (
            <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((key) => (
                <li key={key} className="h-64 animate-pulse rounded-3xl bg-stone-100" />
              ))}
            </ul>
          ) : physios.isError ? (
            <p className="rounded-3xl bg-red-50 p-6 text-red-800">
              The list couldn&apos;t load. Please refresh the page, or message us on WhatsApp.
            </p>
          ) : physios.data.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-stone-300 p-10 text-center">
              <UsersRound className="mx-auto size-8 text-stone-400" aria-hidden="true" />
              <p className="mt-3 font-semibold text-stone-900">No physiotherapist matches these filters yet</p>
              <p className="mt-1 text-sm text-stone-600">Try another area, or tell us what you need below and our team will find someone.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {physios.data.map((physio) => (
                <PhysioCard
                  key={physio.id}
                  physio={physio}
                  services={serviceNames}
                  query={{ service: service || undefined, area: area || undefined, visit: visit || undefined }}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {catalog.data ? <MatchSection catalog={catalog.data} /> : null}
    </>
  );
}

const WINDOWS = [
  { value: "any", label: "Any time", from: 0, to: 1440 },
  { value: "morning", label: "Morning (before 12)", from: 0, to: 720 },
  { value: "afternoon", label: "Afternoon (12 to 5)", from: 720, to: 1020 },
  { value: "evening", label: "Evening (after 5)", from: 1020, to: 1440 },
] as const;

/** "I just need a physio": everyone who fits the problem, area and time, with their free slots. */
function MatchSection({ catalog }: { catalog: Catalog }) {
  const today = todayKey();
  const days = Array.from({ length: 14 }, (_, index) => addDays(today, index));
  const [service, setService] = useState("");
  const [area, setArea] = useState("");
  const [day, setDay] = useState(addDays(today, 1));
  const [timeWindow, setTimeWindow] = useState<(typeof WINDOWS)[number]["value"]>("any");
  const [visit, setVisit] = useState<VisitType>("HOME");
  const [query, setQuery] = useState<MatchQuery | null>(null);
  const [missing, setMissing] = useState(false);
  const matches = useMatchPhysios(query);
  const chosenWindow = WINDOWS.find((item) => item.value === timeWindow) ?? WINDOWS[0];

  const search = () => {
    if (!service || !area) {
      setMissing(true);
      return;
    }
    setMissing(false);
    setQuery({
      service_id: service,
      area_id: area,
      day,
      from_minute: chosenWindow.from,
      to_minute: chosenWindow.to,
      visit_type: visit,
    });
  };

  // Without a match, the request goes to our team at the start of the chosen window.
  const requestStart = lahoreIso(day, timeWindow === "any" ? 600 : Math.max(chosenWindow.from, 540));
  const requestHref = `/book/?${new URLSearchParams({
    request: "1",
    service,
    area,
    start: requestStart,
  })}`;

  return (
    <section id="match" className="border-t border-stone-200/70 bg-sand-50" aria-labelledby="match-title">
      <div className="shell py-14 sm:py-20">
        <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-brand-700 uppercase">
          <Sparkles className="size-4" aria-hidden="true" />
          Not sure who to choose?
        </p>
        <h2 id="match-title" className="mt-3 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
          Tell us what you need. We&apos;ll show who&apos;s free.
        </h2>
        <p className="mt-2 max-w-2xl text-stone-600">
          We match your problem, area and time with physiotherapists who treat it, cover your area and have a free slot.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            search();
          }}
          className="mt-8 grid grid-cols-1 gap-3 rounded-3xl bg-white p-4 ring-1 ring-stone-200 sm:grid-cols-2 lg:grid-cols-6"
        >
          <select aria-label="Problem" value={service} onChange={(e) => setService(e.target.value)} className={cn(field, "lg:col-span-2")}>
            <option value="">What&apos;s the problem?</option>
            {catalog.services.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select aria-label="Your area" value={area} onChange={(e) => setArea(e.target.value)} className={field}>
            <option value="">Your area</option>
            {catalog.areas.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select aria-label="Date" value={day} onChange={(e) => setDay(e.target.value)} className={field}>
            {days.map((item) => (
              <option key={item} value={item}>
                {item === today ? "Today" : formatDayShort(item)}
              </option>
            ))}
          </select>
          <select
            aria-label="Time of day"
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value as typeof timeWindow)}
            className={field}
          >
            {WINDOWS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {catalog.clinic_visits ? (
            <select aria-label="Home or clinic" value={visit} onChange={(e) => setVisit(e.target.value as VisitType)} className={field}>
              <option value="HOME">Home visit</option>
              <option value="CLINIC">Clinic visit</option>
            </select>
          ) : null}
          <button type="submit" className={buttonClasses("primary", "md", "h-12 w-full")}>
            <Search className="size-4.5" aria-hidden="true" />
            Find who&apos;s free
          </button>
          {missing ? (
            <p role="alert" className="text-sm font-medium text-red-700 sm:col-span-2 lg:col-span-6">
              Choose the problem and your area first.
            </p>
          ) : null}
        </form>

        <div className="mt-8" aria-live="polite">
          {query === null ? null : matches.isPending ? (
            <div className="h-40 animate-pulse rounded-3xl bg-stone-100" />
          ) : matches.isError ? (
            <p className="rounded-3xl bg-red-50 p-6 text-red-800">Something went wrong. Please try again.</p>
          ) : matches.data.length === 0 ? (
            <div className="rounded-3xl bg-white p-6 ring-1 ring-stone-200 sm:p-8">
              <p className="text-lg font-semibold text-stone-900">No one is free at that time</p>
              <p className="mt-1 text-stone-600">
                Try another day or time. Or send your request to our team, and we&apos;ll find a physiotherapist for you.
              </p>
              {visit === "HOME" ? (
                <Link href={requestHref} className={buttonClasses("primary", "md", "mt-5")}>
                  Send my request to the team
                </Link>
              ) : null}
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-stone-600">
                {matches.data.length} {matches.data.length === 1 ? "physiotherapist is" : "physiotherapists are"} free on{" "}
                {formatDayShort(query.day)}. Pick a time to book.
              </p>
              <ul className="space-y-4">
                {matches.data.map(({ physio, slots }) => (
                  <li key={physio.id} className="rounded-3xl bg-white p-5 ring-1 ring-stone-200">
                    <div className="flex flex-wrap items-center gap-4">
                      <PhysioPhoto url={physio.photo_url} name={physio.name ?? "Physiotherapist"} size="size-14" />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={physioProfileHref(physio.id, { service: query.service_id, area: query.area_id, visit })}
                          className="font-semibold text-stone-900 hover:underline"
                        >
                          {physio.name}
                        </Link>
                        <p className="text-sm text-stone-600">
                          {physio.qualification} · {physio.experience_years} years ·{" "}
                          {physio.fee_pkr ? `${formatPkr(physio.fee_pkr)} per session` : ""}
                        </p>
                        <Rating physio={physio} />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {slots.map((slot) => (
                        <Link
                          key={slot}
                          href={`/book/?${new URLSearchParams({
                            physio: physio.id,
                            start: slot,
                            service: query.service_id,
                            area: query.area_id,
                            visit,
                          })}`}
                          className="rounded-xl px-3.5 py-2 text-sm font-semibold text-brand-900 tabular-nums ring-1 ring-brand-200 transition hover:bg-brand-50 hover:ring-brand-400"
                        >
                          {formatTime(slot)}
                        </Link>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
