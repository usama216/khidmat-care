"use client";

// Small shared pieces for showing physiotherapists. The list itself lives at /physiotherapists/.

import { UserRound } from "lucide-react";
import { storageUrl } from "@/lib/upload";
import type { AvailabilitySlot } from "./api";

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
