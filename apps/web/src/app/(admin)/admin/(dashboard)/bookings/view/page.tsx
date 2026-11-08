import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingDetailPage } from "@/features/admin/BookingDetailPage";

export const metadata: Metadata = { title: "Order" };

export default function Page() {
  return (
    <Suspense>
      <BookingDetailPage />
    </Suspense>
  );
}
