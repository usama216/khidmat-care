import type { Metadata } from "next";
import { PhysioCalendarPage } from "@/features/portal/PhysioCalendar";

export const metadata: Metadata = { title: "Calendar" };

export default function Page() {
  return <PhysioCalendarPage />;
}
