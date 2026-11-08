import type { Metadata } from "next";
import { Suspense } from "react";
import { BookPage } from "@/features/portal/BookPage";

export const metadata: Metadata = { title: "Book a home visit" };

export default function Page() {
  return <Suspense><BookPage /></Suspense>;
}
