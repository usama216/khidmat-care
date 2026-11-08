import type { Metadata } from "next";
import { ProvidersPage } from "@/features/admin/ProvidersPage";

export const metadata: Metadata = { title: "Physiotherapists" };

export default function Page() {
  return <ProvidersPage />;
}
