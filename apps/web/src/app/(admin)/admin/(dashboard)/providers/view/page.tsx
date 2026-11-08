import type { Metadata } from "next";
import { Suspense } from "react";
import { ProviderDetailPage } from "@/features/admin/ProviderDetailPage";

export const metadata: Metadata = { title: "Physiotherapist" };

export default function Page() {
  return (
    <Suspense>
      <ProviderDetailPage />
    </Suspense>
  );
}
