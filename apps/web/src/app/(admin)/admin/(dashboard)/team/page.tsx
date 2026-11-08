import type { Metadata } from "next";
import { TeamPage } from "@/features/admin/TeamPage";

export const metadata: Metadata = { title: "Team" };

export default function Page() {
  return <TeamPage />;
}
