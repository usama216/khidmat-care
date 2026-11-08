import type { Metadata } from "next";
import { BookingsPage } from "@/features/admin/BookingsPage";

export const metadata: Metadata = { title: "Orders" };

export default function Page() {
  return <BookingsPage />;
}
