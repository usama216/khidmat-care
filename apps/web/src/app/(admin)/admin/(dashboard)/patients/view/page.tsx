import type { Metadata } from "next";
import { Suspense } from "react";
import { PatientDetailPage } from "@/features/admin/PatientsPage";

export const metadata: Metadata = { title: "Patient" };

export default function Page() {
  return (
    <Suspense>
      <PatientDetailPage />
    </Suspense>
  );
}
