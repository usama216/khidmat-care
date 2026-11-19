"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  addMonths,
  formatDayLong,
  monthGrid,
  monthKey,
  monthLabel,
  todayKey,
  WEEKDAYS_MONDAY_FIRST,
} from "@/lib/dates";

/** "open": has free times. "full": every time is taken. "closed": not working, or out of range. */
export type DayState = "open" | "full" | "closed" | "loading";

/**
 * A month of days to choose from. Days with free times carry a dot; full and closed days are
 * shown but can't be chosen, so it's clear why a date isn't available.
 */
export function MonthCalendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  dayState,
  minMonth,
  maxMonth,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  selected: string | null;
  onSelect: (day: string) => void;
  dayState: (day: string) => DayState;
  minMonth: string;
  maxMonth: string;
}) {
  const today = todayKey();
  const days = monthGrid(month);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-stone-900" aria-live="polite">
          {monthLabel(month)}
        </h3>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous month"
            disabled={month <= minMonth}
            onClick={() => onMonthChange(addMonths(month, -1))}
            className="grid size-9 place-items-center rounded-full text-stone-700 ring-1 ring-stone-200 transition hover:bg-stone-50 disabled:opacity-35"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            disabled={month >= maxMonth}
            onClick={() => onMonthChange(addMonths(month, 1))}
            className="grid size-9 place-items-center rounded-full text-stone-700 ring-1 ring-stone-200 transition hover:bg-stone-50 disabled:opacity-35"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div role="grid" aria-label={monthLabel(month)} className="mt-4 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS_MONDAY_FIRST.map((name) => (
          <div key={name} role="columnheader" className="pb-1 text-xs font-medium text-stone-500">
            {name}
          </div>
        ))}
        {days.map((day) => {
          const inMonth = monthKey(day) === month;
          if (!inMonth) return <div key={day} aria-hidden="true" />;
          const state = dayState(day);
          const isSelected = selected === day;
          const choosable = state === "open";
          return (
            <button
              key={day}
              type="button"
              role="gridcell"
              disabled={!choosable}
              aria-selected={isSelected}
              aria-label={`${formatDayLong(day)}${state === "full" ? ", fully booked" : state === "closed" ? ", not available" : ""}`}
              onClick={() => onSelect(day)}
              className={cn(
                "relative mx-auto grid aspect-square w-full max-w-11 place-items-center rounded-full text-sm tabular-nums transition",
                isSelected
                  ? "bg-brand-700 font-semibold text-white"
                  : choosable
                    ? "font-semibold text-brand-900 bg-brand-50 hover:bg-brand-100"
                    : state === "loading"
                      ? "animate-pulse text-stone-300"
                      : "cursor-not-allowed text-stone-300",
                state === "full" && !isSelected && "line-through decoration-stone-300",
                day === today && !isSelected && "ring-1 ring-stone-400",
              )}
            >
              {Number(day.slice(8))}
              {choosable && !isSelected ? (
                <span aria-hidden="true" className="absolute bottom-1 size-1 rounded-full bg-brand-600" />
              ) : null}
            </button>
          );
        })}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-brand-100 ring-1 ring-brand-300" aria-hidden="true" />
          Times free
        </li>
        <li className="flex items-center gap-1.5">
          <span className="text-stone-300 line-through" aria-hidden="true">
            12
          </span>
          Fully booked
        </li>
        <li className="flex items-center gap-1.5">
          <span className="text-stone-300" aria-hidden="true">
            12
          </span>
          Not available
        </li>
      </ul>
    </div>
  );
}
