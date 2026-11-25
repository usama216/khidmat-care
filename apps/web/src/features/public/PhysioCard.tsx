"use client";

import Link from "next/link";
import { BadgeCheck, Building2, Home, Star } from "lucide-react";
import type { Physio } from "@/features/portal/api";
import { PhysioPhoto } from "@/features/portal/FindPage";
import { formatPkr } from "@/lib/format";
import { buttonClasses } from "@/components/ui/button";

export const physioProfileHref = (id: string, extra?: Record<string, string | undefined>) => {
  const query = new URLSearchParams({ id });
  for (const [key, value] of Object.entries(extra ?? {})) if (value) query.set(key, value);
  return `/physiotherapists/view/?${query}`;
};

export function Rating({ physio }: { physio: Pick<Physio, "rating_avg" | "rating_count"> }) {
  if (physio.rating_count === 0) {
    return <span className="text-sm text-stone-500">New on Khidmat Home Care</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm text-stone-700">
      <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
      <span className="font-semibold">{physio.rating_avg.toFixed(1)}</span>
      <span className="text-stone-500">({physio.rating_count} {physio.rating_count === 1 ? "rating" : "ratings"})</span>
    </span>
  );
}

export function VisitBadges({ physio }: { physio: Pick<Physio, "visit_home" | "visit_clinic"> }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {physio.visit_home ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
          <Home className="size-3.5" aria-hidden="true" />
          Home visits
        </span>
      ) : null}
      {physio.visit_clinic ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2.5 py-1 text-xs font-medium text-stone-800">
          <Building2 className="size-3.5" aria-hidden="true" />
          Clinic visits
        </span>
      ) : null}
    </span>
  );
}

export function PhysioCard({
  physio,
  services,
  query,
}: {
  physio: Physio;
  services: Map<string, string>;
  query?: Record<string, string | undefined>;
}) {
  const name = physio.name ?? "Physiotherapist";
  const href = physioProfileHref(physio.id, query);
  const treats = physio.service_type_ids.map((id) => services.get(id)).filter(Boolean);
  return (
    <li className="flex flex-col rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-stone-200/80 transition hover:ring-brand-300">
      <div className="flex gap-4">
        <PhysioPhoto url={physio.photo_url} name={name} size="size-20" />
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-1.5 text-lg font-semibold text-stone-900">
            <Link href={href} className="hover:underline">
              {name}
            </Link>
            <BadgeCheck className="size-4.5 text-brand-700" aria-label="Verified" />
          </h3>
          <p className="text-sm text-stone-600">
            {physio.qualification} · {physio.experience_years} {physio.experience_years === 1 ? "year" : "years"}
          </p>
          <div className="mt-1">
            <Rating physio={physio} />
          </div>
        </div>
      </div>
      {treats.length > 0 ? (
        <p className="mt-4 text-sm text-stone-600">
          <span className="font-medium text-stone-800">Treats: </span>
          {treats.join(", ")}
        </p>
      ) : null}
      <div className="mt-3">
        <VisitBadges physio={physio} />
      </div>
      <div className="mt-5 flex flex-1 items-end justify-between gap-3">
        <p>
          <span className="block text-xs text-stone-500">Per session</span>
          <span className="text-lg font-semibold text-stone-900 tabular-nums">
            {physio.fee_pkr ? formatPkr(physio.fee_pkr) : "-"}
          </span>
        </p>
        <Link href={href} className={buttonClasses("primary", "md")}>
          See times
        </Link>
      </div>
    </li>
  );
}
