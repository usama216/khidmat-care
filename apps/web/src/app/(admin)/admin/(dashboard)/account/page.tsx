import type { Metadata } from "next";
import { AccountPage } from "@/features/auth/AccountPage";

export const metadata: Metadata = { title: "Your account" };

export default function Page() {
  return <AccountPage />;
}
