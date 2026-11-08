import type { Metadata } from "next";
import { MyBookingsPage } from "@/features/portal/MyBookingsPage";

export const metadata: Metadata = { title: "My orders" };

export default function Page() {
  return <MyBookingsPage />;
}
