import type { Metadata } from "next";
import { PhysioJobsPage } from "@/features/portal/PhysioPages";

export const metadata: Metadata = { title: "Jobs" };

export default function Page() {
  return <PhysioJobsPage />;
}
