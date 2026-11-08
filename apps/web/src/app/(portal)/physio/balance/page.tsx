import type { Metadata } from "next";
import { PhysioBalancePage } from "@/features/portal/PhysioPages";

export const metadata: Metadata = { title: "Balance" };

export default function Page() {
  return <PhysioBalancePage />;
}
