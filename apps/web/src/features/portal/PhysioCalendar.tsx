"use client";

import { useId, useState, type FormEvent } from "react";
import { CalendarOff, Info } from "lucide-react";
import { Tabs } from "@/components/admin/records";
import {
  adminButton,
  adminInput,
  Card,
  errorMessage,
  ErrorState,
  FormError,
  FormField,
  Modal,
  PageHeader,
  Skeleton,
} from "@/components/admin/ui";
import { CalendarLegend, WeekNavigator, WeekView } from "@/components/calendar/WeekView";
import { cn } from "@/lib/cn";
import { addDays, formatDayShort, lahoreIso, minuteLabel, todayKey, weekStart } from "@/lib/dates";
import {
  type SlotMinutes,
  useAddTimeOff,
  useDeleteTimeOff,
  useProviderCalendar,
  useProviderProfile,
  useSavePractice,
} from "./api";
import { AvailabilityForm, ApplicationBanner } from "./PhysioPages";

type Tab = "calendar" | "hours";

export function PhysioCalendarPage() {
  const profile = useProviderProfile();
  const [tab, setTab] = useState<Tab>("calendar");

  if (profile.isPending) return <Skeleton className="h-96 w-full" />;
  if (profile.isError) return <ErrorState onRetry={() => void profile.refetch()} />;
  if (!profile.data) {
    return (
      <>
        <PageHeader title="Calendar" />
        <ApplicationBanner profile={null} />
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Calendar"
        description="Your visits, orders waiting for a reply and blocked time. Patients only see your free times. Times are Pakistan time."
      />
      <div className="mt-4">
        <Tabs
          label="Calendar sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "calendar", label: "Week" },
            { value: "hours", label: "Weekly hours and session length" },
          ]}
        />
      </div>
      <div className="mt-4">
        {tab === "calendar" ? (
          <WeekCalendar />
        ) : (
          <div className="space-y-4">
            <SlotLengthCard current={profile.data.slot_minutes} />
            <AvailabilityForm key={profile.data.id} initial={profile.data.availability} embedded />
          </div>
        )}
      </div>
    </>
  );
}

function WeekCalendar() {
  const [start, setStart] = useState(() => weekStart(todayKey()));
  const calendar = useProviderCalendar(start, 7);
  const remove = useDeleteTimeOff();
  const [blocking, setBlocking] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <WeekNavigator start={start} onChange={setStart} />
        <button type="button" onClick={() => setBlocking(true)} className={adminButton("secondary")}>
          <CalendarOff className="size-4" aria-hidden="true" />
          Block time
        </button>
      </div>
      <div className="mt-3">
        <CalendarLegend />
      </div>
      <FormError message={remove.isError ? errorMessage(remove.error) : null} />
      <div className="mt-4">
        {calendar.isPending ? (
          <Skeleton className="h-72 w-full" />
        ) : calendar.isError ? (
          <ErrorState onRetry={() => void calendar.refetch()} />
        ) : (
          <WeekView
            view={calendar.data}
            eventHref={() => "/physio/jobs/"}
            onRemoveTimeOff={(item) => remove.mutate(item.id)}
            removing={remove.isPending ? remove.variables : null}
          />
        )}
      </div>
      {calendar.data && calendar.data.weekly_hours.length === 0 ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          You haven&apos;t set weekly hours yet, so patients can&apos;t book you. Open &quot;Weekly hours&quot; above to add them.
        </p>
      ) : null}
      {blocking ? <BlockTimeDialog onClose={() => setBlocking(false)} /> : null}
    </>
  );
}

const TIMES = Array.from({ length: 49 }, (_, index) => index * 30); // 12am to 12am, every 30 minutes.

function BlockTimeDialog({ onClose }: { onClose: () => void }) {
  const id = useId();
  const add = useAddTimeOff();
  const today = todayKey();
  const [mode, setMode] = useState<"days" | "hours">("days");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [startMinute, setStartMinute] = useState(16 * 60);
  const [endMinute, setEndMinute] = useState(18 * 60);
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    let startAt: string;
    let endAt: string;
    if (mode === "days") {
      if (to < from) {
        setInvalid("The last day can't be before the first day.");
        return;
      }
      startAt = lahoreIso(from, 0);
      endAt = lahoreIso(addDays(to, 1), 0);
    } else {
      if (endMinute <= startMinute) {
        setInvalid("The end time must be after the start time.");
        return;
      }
      startAt = lahoreIso(from, startMinute);
      endAt = endMinute === 1440 ? lahoreIso(addDays(from, 1), 0) : lahoreIso(from, endMinute);
    }
    setInvalid(null);
    add.mutate({ start_at: startAt, end_at: endAt, reason: reason.trim() || undefined }, { onSuccess: onClose });
  };

  return (
    <Modal title="Block time" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <p className="text-sm text-stone-600">
          Patients won&apos;t be able to book you in this time. Visits already booked stay, so move or cancel them first.
        </p>
        <div role="group" aria-label="What to block" className="grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1">
          {(
            [
              { value: "days", label: "Whole days" },
              { value: "hours", label: "Some hours" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={mode === option.value}
              onClick={() => setMode(option.value)}
              className={cn(
                "h-8 rounded-md text-sm font-medium transition",
                mode === option.value ? "bg-white text-stone-900 shadow-sm" : "text-stone-600",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {mode === "days" ? (
          <div className="grid grid-cols-2 gap-3">
            <FormField id={`${id}-from`} label="From">
              <input id={`${id}-from`} type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} className={adminInput} />
            </FormField>
            <FormField id={`${id}-to`} label="To (including)">
              <input id={`${id}-to`} type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} className={adminInput} />
            </FormField>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField id={`${id}-day`} label="Day">
              <input id={`${id}-day`} type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} className={adminInput} />
            </FormField>
            <FormField id={`${id}-start`} label="From">
              <select id={`${id}-start`} value={startMinute} onChange={(e) => setStartMinute(Number(e.target.value))} className={adminInput}>
                {TIMES.slice(0, -1).map((minute) => (
                  <option key={minute} value={minute}>
                    {minuteLabel(minute)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id={`${id}-end`} label="To">
              <select id={`${id}-end`} value={endMinute} onChange={(e) => setEndMinute(Number(e.target.value))} className={adminInput}>
                {TIMES.slice(1).map((minute) => (
                  <option key={minute} value={minute}>
                    {minute === 1440 ? "Midnight" : minuteLabel(minute)}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        )}
        <FormField id={`${id}-reason`} label="Note for yourself (optional)" hint="e.g. Leave, family event. Patients don't see this.">
          <input id={`${id}-reason`} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} className={adminInput} />
        </FormField>
        <p className="text-xs text-stone-500">
          {mode === "days"
            ? from === to
              ? `Blocks all of ${formatDayShort(from)}.`
              : `Blocks ${formatDayShort(from)} to ${formatDayShort(to)}.`
            : `Blocks ${formatDayShort(from)}, ${minuteLabel(startMinute)} to ${endMinute === 1440 ? "midnight" : minuteLabel(endMinute)}.`}
        </p>
        <FormError message={invalid ?? (add.isError ? errorMessage(add.error) : null)} />
        <button type="submit" disabled={add.isPending} className={adminButton("primary", "w-full")}>
          {add.isPending ? "Blocking..." : "Block this time"}
        </button>
      </form>
    </Modal>
  );
}

const LENGTHS: SlotMinutes[] = [30, 45, 60];

function SlotLengthCard({ current }: { current: SlotMinutes }) {
  const save = useSavePractice();
  const [value, setValue] = useState<SlotMinutes>(current);
  const changed = value !== current;
  return (
    <Card className="p-4">
      <h2 className="font-semibold text-stone-900">Session length</h2>
      <p className="mt-0.5 text-sm text-stone-600">
        Patients choose from times this far apart. Orders already booked keep their length.
      </p>
      <div role="radiogroup" aria-label="Session length" className="mt-3 flex flex-wrap gap-2">
        {LENGTHS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            role="radio"
            aria-checked={value === minutes}
            onClick={() => setValue(minutes)}
            className={cn(
              "h-10 rounded-lg px-4 text-sm font-semibold ring-1 transition",
              value === minutes ? "bg-brand-50 text-brand-900 ring-2 ring-brand-600" : "text-stone-700 ring-stone-200 hover:bg-stone-50",
            )}
          >
            {minutes} minutes
          </button>
        ))}
        <button
          type="button"
          disabled={!changed || save.isPending}
          onClick={() => save.mutate({ slot_minutes: value })}
          className={adminButton("primary", "ms-auto")}
        >
          Save length
        </button>
      </div>
      <FormError message={save.isError ? errorMessage(save.error) : null} />
      {save.isSuccess && !changed ? <p role="status" className="mt-2 text-sm font-medium text-brand-800">Session length saved.</p> : null}
    </Card>
  );
}
