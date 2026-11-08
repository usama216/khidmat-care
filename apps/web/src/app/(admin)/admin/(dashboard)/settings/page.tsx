import type { Metadata } from "next";
import { SettingsPage } from "@/features/admin/FinancePages";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return <SettingsPage />;
}
