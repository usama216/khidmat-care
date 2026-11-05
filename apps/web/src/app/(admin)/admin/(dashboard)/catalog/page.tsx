import type { Metadata } from "next";
import { CatalogPage } from "@/features/admin/CatalogPage";

export const metadata: Metadata = { title: "Services & pricing" };

export default function Page() {
  return <CatalogPage />;
}
