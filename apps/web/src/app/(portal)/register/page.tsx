import type { Metadata } from "next";
import { Suspense } from "react";
import { PortalRegister } from "@/features/portal/AuthPages";

export const metadata: Metadata = { title: "Create your account" };

export default function Page() {
  return <Suspense><PortalRegister /></Suspense>;
}
