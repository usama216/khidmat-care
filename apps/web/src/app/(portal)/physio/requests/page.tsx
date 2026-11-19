import type { Metadata } from "next";
import { PhysioRequestsPage } from "@/features/portal/PhysioRequests";

export const metadata: Metadata = { title: "Open requests" };

export default function Page() {
  return <PhysioRequestsPage />;
}
