import type { Metadata } from "next";
import { PhysioProfilePage } from "@/features/portal/PhysioPages";

export const metadata: Metadata = { title: "Your profile" };

export default function Page() {
  return <PhysioProfilePage />;
}
