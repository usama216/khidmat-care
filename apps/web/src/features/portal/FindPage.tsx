"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Star, UserRound } from "lucide-react";
import { adminButton, adminInput, Card, EmptyState, ErrorState, PageHeader, TableSkeleton } from "@/components/admin/ui";
import { storageUrl } from "@/lib/upload";
import { usePhysios, useCatalog, type AvailabilitySlot, type Physio } from "./api";
import { EmergencyLine, PortalPage } from "./PortalShell";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function minuteLabel(minute: number) {
  const hour = Math.floor(minute / 60);
  const suffix = hour >= 12 && hour < 24 ? "pm" : "am";
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return `${shown}${minute % 60 ? `:${String(minute % 60).padStart(2, "0")}` : ""}${suffix}`;
}

export function availabilitySummary(rows: AvailabilitySlot[]) {
  if (rows.length === 0) return "No hours set";
  const days = [...new Set(rows.map((row) => row.day_of_week))].sort();
  return days
    .map((day) => {
      const times = rows
        .filter((row) => row.day_of_week === day)
        .map((row) => `${minuteLabel(row.start_minute)}-${minuteLabel(row.end_minute)}`)
        .join(", ");
      return `${DAYS[day]} ${times}`;
    })
    .join(" · ");
}

export function PhysioPhoto({ url, name, size = "size-16" }: { url: string | null; name: string; size?: string }) {
  if (url) {
    // Signed storage links can't go through next/image in a static export.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={storageUrl(url)} alt={`Photo of ${name}`} className={`${size} shrink-0 rounded-xl object-cover`} />;
  }
  return (
    <span className={`${size} grid shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-400`}>
      <UserRound className="size-6" aria-hidden="true" />
    </span>
  );
}

export function FindPage() {
  const catalog = useCatalog();
  const [service, setService] = useState("");
  const [area, setArea] = useState("");
  const [gender, setGender] = useState("");
  const physios = usePhysios({
    service_id: service || undefined,
    area_id: area || undefined,
    gender: gender || undefined,
  });
  const serviceNames = new Map((catalog.data?.services ?? []).map((item) => [item.id, item.name]));

  return (
    <PortalPage wide>
      <PageHeader title="Find a physiotherapist" description="Verified physiotherapists who visit you at home in Lahore." />
      <Card className="mt-5 grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        <select aria-label="Treatment" value={service} onChange={(e) => setService(e.target.value)} className={adminInput}>
          <option value="">All treatments</option>
          {catalog.data?.services.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)} className={adminInput}>
          <option value="">All areas</option>
          {catalog.data?.areas.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select aria-label="Physiotherapist" value={gender} onChange={(e) => setGender(e.target.value)} className={adminInput}>
          <option value="">Female or male</option>
          <option value="FEMALE">Female</option>
          <option value="MALE">Male</option>
        </select>
      </Card>

      {physios.isPending ? (
        <Card className="mt-4">
          <TableSkeleton rows={3} />
        </Card>
      ) : physios.isError ? (
        <Card className="mt-4">
          <ErrorState onRetry={() => void physios.refetch()} />
        </Card>
      ) : physios.data.length === 0 ? (
        <Card className="mt-4">
          <EmptyState title="No physiotherapists match" description="Try another area or treatment." />
        </Card>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {physios.data.map((physio) => (
            <PhysioCard key={physio.id} physio={physio} services={serviceNames} presetService={service} />
          ))}
        </ul>
      )}
      <div className="mt-6">
        <EmergencyLine />
      </div>
    </PortalPage>
  );
}

function PhysioCard({
  physio,
  services,
  presetService,
}: {
  physio: Physio;
  services: Map<string, string>;
  presetService: string;
}) {
  const name = physio.name ?? "Physiotherapist";
  const href = `/book/?physio=${physio.id}${presetService ? `&service=${presetService}` : ""}`;
  return (
    <li className="flex flex-col rounded-xl bg-white p-4 ring-1 ring-stone-200">
      <div className="flex gap-3">
        <PhysioPhoto url={physio.photo_url} name={name} />
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-1.5 font-semibold text-stone-900">
            {name}
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-800">
              <BadgeCheck className="size-3.5" aria-hidden="true" />
              Verified
            </span>
          </h2>
          <p className="text-sm text-stone-600">
            {physio.qualification} · {physio.experience_years} years · {physio.gender === "FEMALE" ? "Female" : "Male"}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-stone-600">
            <Star className="size-3.5 text-stone-400" aria-hidden="true" />
            {physio.rating_count > 0 ? `${physio.rating_avg.toFixed(1)} (${physio.rating_count})` : "New"}
          </p>
        </div>
      </div>
      {physio.bio ? <p className="mt-3 text-sm text-stone-600">{physio.bio}</p> : null}
      <p className="mt-3 text-xs text-stone-500">
        <span className="font-medium text-stone-700">Treats: </span>
        {physio.service_type_ids.map((id) => services.get(id)).filter(Boolean).join(", ")}
      </p>
      <p className="mt-1 flex-1 text-xs text-stone-500">
        <span className="font-medium text-stone-700">Available: </span>
        {availabilitySummary(physio.availability)}
      </p>
      <Link href={href} className={adminButton("primary", "mt-4 w-full")}>
        Book {name}
      </Link>
    </li>
  );
}
