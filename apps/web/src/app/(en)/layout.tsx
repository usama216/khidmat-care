import type { ReactNode } from "react";
import "../globals.css";
import { RootDocument } from "@/components/RootDocument";
import { en } from "@/content/en";
import { buildMetadata } from "@/lib/metadata";

export { viewport } from "@/lib/metadata";
export const metadata = buildMetadata(en);

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return <RootDocument t={en}>{children}</RootDocument>;
}
