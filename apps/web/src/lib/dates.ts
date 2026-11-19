/**
 * Calendar dates in Lahore time. A "day key" is "YYYY-MM-DD" for a day in Pakistan, whatever the
 * visitor's own clock says. Pakistan has no daylight saving, so the offset is always +05:00.
 */

export const TIMEZONE = "Asia/Karachi";
const OFFSET = "+05:00";

const keyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE });
const timeFormat = new Intl.DateTimeFormat("en-PK", { timeStyle: "short", timeZone: TIMEZONE });
const dayLongFormat = new Intl.DateTimeFormat("en-PK", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const dayShortFormat = new Intl.DateTimeFormat("en-PK", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const monthFormat = new Intl.DateTimeFormat("en-PK", { month: "long", year: "numeric", timeZone: "UTC" });

export const WEEKDAYS_MONDAY_FIRST = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The day key of a moment, in Lahore. */
export function dayKey(moment: Date | string = new Date()): string {
  return keyFormat.format(typeof moment === "string" ? new Date(moment) : moment);
}

export function todayKey() {
  return dayKey(new Date());
}

/** Noon UTC on that day: safe for date arithmetic and formatting without timezone surprises. */
function utcNoon(key: string) {
  return new Date(`${key}T12:00:00Z`);
}

export function addDays(key: string, days: number): string {
  const date = utcNoon(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((utcNoon(to).getTime() - utcNoon(from).getTime()) / 86_400_000);
}

/** 0 = Sunday ... 6 = Saturday, matching the API's weekly hours. */
export function weekday(key: string) {
  return utcNoon(key).getUTCDay();
}

/** The Monday on or before a day. */
export function weekStart(key: string) {
  return addDays(key, -((weekday(key) + 6) % 7));
}

export function monthKey(key: string) {
  return key.slice(0, 7);
}

export function addMonths(month: string, count: number): string {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + count, 1, 12));
  return date.toISOString().slice(0, 7);
}

export function monthLabel(month: string) {
  return monthFormat.format(utcNoon(`${month}-01`));
}

/** Six full weeks, Monday first, covering the month. */
export function monthGrid(month: string): string[] {
  const first = weekStart(`${month}-01`);
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

export function formatDayLong(key: string) {
  return dayLongFormat.format(utcNoon(key));
}

export function formatDayShort(key: string) {
  return dayShortFormat.format(utcNoon(key));
}

export function formatTime(moment: string | Date) {
  return timeFormat.format(typeof moment === "string" ? new Date(moment) : moment);
}

/** The ISO time for a minute of a day in Lahore, e.g. ("2026-11-20", 960) -> 4 pm that day. */
export function lahoreIso(key: string, minute: number): string {
  const hours = String(Math.floor(minute / 60)).padStart(2, "0");
  const minutes = String(minute % 60).padStart(2, "0");
  return `${key}T${hours}:${minutes}:00${OFFSET}`;
}

/** Minutes since midnight in Lahore. */
export function minuteOfDay(moment: string | Date): number {
  const date = typeof moment === "string" ? new Date(moment) : moment;
  const local = new Date(date.getTime() + 5 * 3_600_000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export function minuteLabel(minute: number) {
  const hour = Math.floor(minute / 60) % 24;
  const suffix = hour >= 12 ? "pm" : "am";
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return `${shown}${minute % 60 ? `:${String(minute % 60).padStart(2, "0")}` : ""}${suffix}`;
}

/** Morning, afternoon or evening, for grouping times. */
export function partOfDay(moment: string): "Morning" | "Afternoon" | "Evening" {
  const minute = minuteOfDay(moment);
  if (minute < 12 * 60) return "Morning";
  if (minute < 17 * 60) return "Afternoon";
  return "Evening";
}
