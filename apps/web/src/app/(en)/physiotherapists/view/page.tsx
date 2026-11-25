import type { Metadata } from "next";
import { PhysioProfilePage } from "@/components/pages/FindPhysioPages";

// One page serves every profile through ?id=, so it stays out of search results.
export const metadata: Metadata = {
  title: "Physiotherapist profile | Khidmat Home Care",
  robots: { index: false, follow: true },
};

export default function Page() {
  return <PhysioProfilePage />;
}
