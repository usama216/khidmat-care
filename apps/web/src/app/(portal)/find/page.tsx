import type { Metadata } from "next";
import { FindPage } from "@/features/portal/FindPage";

export const metadata: Metadata = { title: "Find a physiotherapist" };

export default function Page() {
  return <FindPage />;
}
