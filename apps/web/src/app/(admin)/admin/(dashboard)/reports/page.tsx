import type { Metadata } from "next";
import { ReportsPage } from "@/features/admin/ReportsPage";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return <ReportsPage />;
}
