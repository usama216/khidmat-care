import type { Metadata } from "next";
import { PhysioDashboardPage } from "@/features/portal/PhysioDashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return <PhysioDashboardPage />;
}
