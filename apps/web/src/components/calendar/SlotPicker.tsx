"use client";

import { cn } from "@/lib/cn";
import { formatTime, partOfDay } from "@/lib/dates";

export type PickerSlot = { start_at: string; available: boolean };

const PARTS = ["Morning", "Afternoon", "Evening"] as const;

/**
 * Times on one day, grouped into morning, afternoon and evening. Taken times stay visible but
 * can't be chosen, so patients see the physiotherapist is in demand rather than a gap.
 */
export function SlotPicker({
  slots,
  value,
  onChange,
  name = "slot",
}: {
  slots: PickerSlot[];
  value: string | null;
  onChange: (startAt: string) => void;
  name?: string;
}) {
  if (slots.length === 0) {
    return <p className="text-sm text-stone-500">No times on this day. Please choose another date.</p>;
  }
  return (
    <div className="space-y-4">
      {PARTS.map((part) => {
        const group = slots.filter((slot) => partOfDay(slot.start_at) === part);
        if (group.length === 0) return null;
        return (
          <fieldset key={part}>
            <legend className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">{part}</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {group.map((slot) => {
                const checked = value === slot.start_at;
                return (
                  <label
                    key={slot.start_at}
                    className={cn(
                      "relative flex h-11 items-center justify-center rounded-xl text-sm font-semibold tabular-nums ring-1 transition",
                      !slot.available
                        ? "cursor-not-allowed bg-stone-50 text-stone-400 ring-stone-200"
                        : checked
                          ? "cursor-pointer bg-brand-700 text-white ring-brand-700"
                          : "cursor-pointer bg-white text-brand-900 ring-brand-200 hover:bg-brand-50 hover:ring-brand-400",
                    )}
                  >
                    <input
                      type="radio"
                      name={name}
                      className="sr-only"
                      disabled={!slot.available}
                      checked={checked}
                      onChange={() => onChange(slot.start_at)}
                    />
                    {slot.available ? (
                      formatTime(slot.start_at)
                    ) : (
                      <span className="flex flex-col items-center leading-tight">
                        <span className="line-through">{formatTime(slot.start_at)}</span>
                        <span className="text-[0.65rem] font-medium">Booked</span>
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
