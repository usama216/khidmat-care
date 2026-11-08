import type { Metadata } from "next";
import { Suspense } from "react";
import { PortalLogin } from "@/features/portal/AuthPages";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return <Suspense><PortalLogin /></Suspense>;
}
