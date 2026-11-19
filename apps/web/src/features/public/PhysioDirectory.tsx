"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles, UsersRound } from "lucide-react";
import { AdminProviders } from "@/components/admin/AdminProviders";
import { buttonClasses } from "@/components/ui/button";
import { type Catalog, useCatalog, usePhysios } from "@/features/portal/api";
import { cn } from "@/lib/cn";
import { addDays, formatDayShort, lahoreIso, minuteLabel, todayKey } from "@/lib/dates";
import { PhysioCard } from "./PhysioCard";

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
              <p className="mt-1 text-sm text-stone-600">Try another area, or send a request below and physiotherapists near you will respond.</p>
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

      {catalog.data ? <RequestSection catalog={catalog.data} /> : null}
    </>
  );
}

// Times a request can ask for, every hour from 7 am to 9 pm.
const REQUEST_TIMES = Array.from({ length: 15 }, (_, index) => 420 + index * 60);

/**
 * "I just need a physio": the patient says what, where and when, and sends a request. Every
 * physiotherapist who treats that problem in that area gets a WhatsApp, and the first to pick it
 * is booked. No list of physios here: that's what the section above is for.
 */
function RequestSection({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const today = todayKey();
  const days = Array.from({ length: 14 }, (_, index) => addDays(today, index));
  const [service, setService] = useState("");
  const [area, setArea] = useState("");
  const [day, setDay] = useState(addDays(today, 1));
  const [minute, setMinute] = useState(17 * 60);
  const [missing, setMissing] = useState(false);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!service || !area) {
      setMissing(true);
      return;
    }
    const query = new URLSearchParams({ request: "1", service, area, start: lahoreIso(day, minute) });
    router.push(`/book/?${query}`);
  };

  return (
    <section id="request" className="border-t border-stone-200/70 bg-sand-50" aria-labelledby="request-title">
      <div className="shell py-14 sm:py-20">
        <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-brand-700 uppercase">
          <Sparkles className="size-4" aria-hidden="true" />
          Not sure who to choose?
        </p>
        <h2 id="request-title" className="mt-3 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
          Send a request. Physiotherapists near you will respond.
        </h2>
        <p className="mt-2 max-w-2xl text-stone-600">
          Tell us the problem, your area and a time. We alert verified physiotherapists who treat it in your area, and
          the first one to pick your request is booked. You&apos;ll see their name and fee straight away.
        </p>

        <form
          onSubmit={onSubmit}
          onChange={() => setMissing(false)}
          className="mt-8 grid grid-cols-1 gap-3 rounded-3xl bg-white p-4 ring-1 ring-stone-200 sm:grid-cols-2 lg:grid-cols-5"
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
          <select aria-label="Time" value={minute} onChange={(e) => setMinute(Number(e.target.value))} className={field}>
            {REQUEST_TIMES.map((value) => (
              <option key={value} value={value}>
                {minuteLabel(value)}
              </option>
            ))}
          </select>
          <button type="submit" className={buttonClasses("primary", "md", "h-12 w-full sm:col-span-2 lg:col-span-5")}>
            <Send className="size-4.5" aria-hidden="true" />
            Continue to send my request
          </button>
          {missing ? (
            <p role="alert" className="text-sm font-medium text-red-700 sm:col-span-2 lg:col-span-5">
              Choose the problem and your area first.
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
