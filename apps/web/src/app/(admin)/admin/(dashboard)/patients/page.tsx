import type { Metadata } from "next";
import { PatientsPage } from "@/features/admin/PatientsPage";

export const metadata: Metadata = { title: "Patients" };

export default function Page() {
  return <PatientsPage />;
}
