import type { Metadata } from "next";
import { Suspense } from "react";
import { MyBookingsPage } from "@/features/portal/MyBookingsPage";

export const metadata: Metadata = { title: "My orders" };

export default function Page() {
  return (
    <Suspense>
      <MyBookingsPage />
    </Suspense>
  );
}
