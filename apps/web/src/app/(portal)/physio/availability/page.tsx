import type { Metadata } from "next";
import { PhysioAvailabilityPage } from "@/features/portal/PhysioPages";

export const metadata: Metadata = { title: "Availability" };

export default function Page() {
  return <PhysioAvailabilityPage />;
}
