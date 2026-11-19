"use client";

import { useState } from "react";
import { usePhysioSchedule } from "@/features/portal/api";
import { addDays, addMonths, daysBetween, formatDayLong, monthKey, todayKey } from "@/lib/dates";
import { MonthCalendar, type DayState } from "./MonthCalendar";
import { SlotPicker } from "./SlotPicker";

const HORIZON_DAYS = 60;

/**
 * Pick a date, then a time, from a physiotherapist's real calendar: weekly hours, time off,
 * booked sessions and orders still waiting for a reply are all taken into account.
 */
export function BookingCalendar({
  physioId,
  value,
  onChange,
  initialDay,
}: {
  physioId: string;
  value: string | null;
  onChange: (startAt: string | null) => void;
  initialDay?: string;
}) {
  const today = todayKey();
  const last = addDays(today, HORIZON_DAYS);
  const [month, setMonth] = useState(monthKey(initialDay ?? today));
  const [day, setDay] = useState<string | null>(initialDay ?? null);

  const monthStart = `${month}-01`;
  const from = monthStart < today ? today : monthStart;
  const to = `${addMonths(month, 1)}-01`;
  const schedule = usePhysioSchedule(physioId, from, Math.max(1, Math.min(42, daysBetween(from, to))));
  const byDay = new Map((schedule.data ?? []).map((plan) => [plan.day, plan.slots]));

  const dayState = (key: string): DayState => {
    if (key < today || key > last) return "closed";
    if (schedule.isPending || (schedule.isPlaceholderData && !byDay.has(key))) return "loading";
    const slots = byDay.get(key) ?? [];
    if (slots.length === 0) return "closed";
    return slots.some((slot) => slot.available) ? "open" : "full";
  };

  const slots = day ? (byDay.get(day) ?? []) : [];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,20rem)_1fr]">
      <MonthCalendar
        month={month}
        onMonthChange={(next) => {
          setMonth(next);
          setDay(null);
          onChange(null);
        }}
        selected={day}
        onSelect={(next) => {
          setDay(next);
          onChange(null);
        }}
        dayState={dayState}
        minMonth={monthKey(today)}
        maxMonth={monthKey(last)}
      />
      <div className="min-w-0">
        {schedule.isError ? (
          <p className="text-sm text-red-700">Times couldn&apos;t load. Please refresh the page.</p>
        ) : day ? (
          <>
            <h3 className="mb-3 font-semibold text-stone-900">{formatDayLong(day)}</h3>
            <SlotPicker slots={slots} value={value} onChange={onChange} />
          </>
        ) : (
          <div className="grid h-full min-h-40 place-items-center rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
            Choose a date with a dot to see the free times.
          </div>
        )}
      </div>
    </div>
  );
}
