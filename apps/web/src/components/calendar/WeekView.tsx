"use client";

import Link from "next/link";
import { Ban, ChevronLeft, ChevronRight, Hourglass, Trash2 } from "lucide-react";
import type { CalendarEvent, CalendarView, TimeOff } from "@/features/portal/api";
import { cn } from "@/lib/cn";
import {
  addDays,
  dayKey,
  formatDayShort,
  formatTime,
  lahoreIso,
  minuteLabel,
  todayKey,
  weekday,
  weekStart,
} from "@/lib/dates";

const EVENT_STYLE: Record<string, string> = {
  AWAITING: "bg-amber-50 ring-amber-300 text-amber-950",
  SCHEDULED: "bg-brand-50 ring-brand-300 text-brand-950",
  ON_THE_WAY: "bg-brand-100 ring-brand-400 text-brand-950",
  ARRIVED: "bg-brand-100 ring-brand-400 text-brand-950",
  COMPLETED: "bg-stone-100 ring-stone-300 text-stone-700",
  CANCELLED: "bg-white ring-stone-200 text-stone-400 line-through",
  NO_SHOW: "bg-white ring-stone-200 text-stone-400 line-through",
};

const STATUS_TEXT: Record<string, string> = {
  AWAITING: "Pending: reply needed",
  SCHEDULED: "Confirmed",
  ON_THE_WAY: "On the way",
  ARRIVED: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export function WeekNavigator({ start, onChange }: { start: string; onChange: (start: string) => void }) {
  const end = addDays(start, 6);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1">
        <button
          type="button"
          aria-label="Previous week"
          onClick={() => onChange(addDays(start, -7))}
          className="grid size-9 place-items-center rounded-lg text-stone-700 ring-1 ring-stone-200 transition hover:bg-stone-50"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Next week"
          onClick={() => onChange(addDays(start, 7))}
          className="grid size-9 place-items-center rounded-lg text-stone-700 ring-1 ring-stone-200 transition hover:bg-stone-50"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => onChange(weekStart(todayKey()))}
        className="h-9 rounded-lg px-3 text-sm font-medium text-stone-700 ring-1 ring-stone-200 transition hover:bg-stone-50"
      >
        This week
      </button>
      <p className="text-sm font-semibold text-stone-900" aria-live="polite">
        {formatDayShort(start)} to {formatDayShort(end)}
      </p>
    </div>
  );
}

function hoursFor(view: CalendarView, day: string) {
  const rows = view.weekly_hours.filter((row) => row.day_of_week === weekday(day));
  if (rows.length === 0) return "Day off";
  return rows.map((row) => `${minuteLabel(row.start_minute)} to ${minuteLabel(row.end_minute)}`).join(", ");
}

function timeOffLabel(item: TimeOff, day: string) {
  const dayStart = lahoreIso(day, 0);
  const dayEnd = lahoreIso(addDays(day, 1), 0);
  const starts = new Date(item.start_at) <= new Date(dayStart);
  const ends = new Date(item.end_at) >= new Date(dayEnd);
  if (starts && ends) return "All day";
  return `${starts ? "Until" : formatTime(item.start_at)}${starts ? "" : " to"} ${ends ? "end of day" : formatTime(item.end_at)}`;
}

/**
 * One week of sessions, offers waiting for a reply and blocked time. Each day lists its working
 * hours so a quiet day reads as "free" rather than "nothing loaded".
 */
export function WeekView({
  view,
  eventHref,
  onRemoveTimeOff,
  removing,
}: {
  view: CalendarView;
  eventHref: (event: CalendarEvent) => string;
  onRemoveTimeOff?: (item: TimeOff) => void;
  removing?: string | null;
}) {
  const today = todayKey();
  const days = Array.from({ length: view.days }, (_, index) => addDays(view.start, index));

  return (
    <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
      {days.map((day) => {
        const events = view.events.filter((event) => dayKey(event.start_at) === day);
        const blocks = view.time_off.filter(
          (item) => new Date(item.start_at) < new Date(lahoreIso(addDays(day, 1), 0)) && new Date(item.end_at) > new Date(lahoreIso(day, 0)),
        );
        const past = day < today;
        return (
          <li
            key={day}
            className={cn(
              "flex min-h-40 flex-col rounded-xl bg-white p-3 ring-1",
              day === today ? "ring-2 ring-brand-600" : "ring-stone-200",
              past && "bg-stone-50/60",
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className={cn("text-sm font-semibold", day === today ? "text-brand-800" : "text-stone-900")}>
                {formatDayShort(day)}
              </p>
              {day === today ? <span className="text-xs font-medium text-brand-700">Today</span> : null}
            </div>
            <p className="mt-0.5 text-xs text-stone-500">{hoursFor(view, day)}</p>

            <ul className="mt-3 flex flex-1 flex-col gap-2">
              {blocks.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg bg-[repeating-linear-gradient(135deg,var(--color-stone-100),var(--color-stone-100)_6px,white_6px,white_12px)] p-2 text-xs text-stone-700 ring-1 ring-stone-300"
                >
                  <p className="flex items-center gap-1 font-semibold">
                    <Ban className="size-3.5" aria-hidden="true" />
                    Blocked · {timeOffLabel(item, day)}
                  </p>
                  {item.reason ? <p className="mt-0.5 text-stone-600">{item.reason}</p> : null}
                  {onRemoveTimeOff && new Date(item.end_at) > new Date() ? (
                    <button
                      type="button"
                      disabled={removing === item.id}
                      onClick={() => onRemoveTimeOff(item)}
                      className="mt-1 inline-flex items-center gap-1 font-medium text-red-700 hover:underline disabled:opacity-50"
                    >
                      <Trash2 className="size-3" aria-hidden="true" />
                      Open again
                    </button>
                  ) : null}
                </li>
              ))}
              {events.map((event) => (
                <li key={`${event.kind}-${event.session_id ?? event.booking_id}`}>
                  <Link
                    href={eventHref(event)}
                    className={cn("block rounded-lg p-2 text-xs ring-1 transition hover:brightness-95", EVENT_STYLE[event.status])}
                  >
                    <p className="font-semibold tabular-nums">
                      {formatTime(event.start_at)} to {formatTime(event.end_at)}
                    </p>
                    <p className="mt-0.5 font-medium">{event.patient_name}</p>
                    <p className="opacity-80">
                      {event.service_name} · {event.visit_type === "CLINIC" ? "Clinic" : event.area_name}
                    </p>
                    <p className="mt-1 flex items-center gap-1 opacity-80">
                      {event.kind === "OFFER" ? <Hourglass className="size-3" aria-hidden="true" /> : null}
                      KC-{event.booking_number}
                      {event.sequence ? ` · ${event.sequence} of ${event.sessions_count}` : ""} · {STATUS_TEXT[event.status]}
                    </p>
                    {event.hold_expires_at ? (
                      <p className="mt-0.5 font-semibold">Reply by {formatTime(event.hold_expires_at)}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
              {events.length === 0 && blocks.length === 0 ? (
                <li className="text-xs text-stone-400">{past ? "Nothing booked" : "No bookings yet"}</li>
              ) : null}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

export function CalendarLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded bg-amber-50 ring-1 ring-amber-300" aria-hidden="true" />
        Pending (needs your reply)
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded bg-brand-50 ring-1 ring-brand-300" aria-hidden="true" />
        Confirmed
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded bg-stone-100 ring-1 ring-stone-300" aria-hidden="true" />
        Completed
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded bg-[repeating-linear-gradient(135deg,var(--color-stone-200),var(--color-stone-200)_3px,white_3px,white_6px)] ring-1 ring-stone-300" aria-hidden="true" />
        Blocked
      </li>
    </ul>
  );
}
