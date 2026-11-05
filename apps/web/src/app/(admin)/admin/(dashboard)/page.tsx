import type { Metadata } from "next";
import { OverviewPage } from "@/features/admin/OverviewPage";

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return <OverviewPage />;
}
