import type { Metadata } from "next";
import { FinancePage } from "@/features/admin/FinancePages";

export const metadata: Metadata = { title: "Balances" };

export default function Page() {
  return <FinancePage />;
}
