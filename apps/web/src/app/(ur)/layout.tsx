import type { ReactNode } from "react";
import "../globals.css";
import { RootDocument } from "@/components/RootDocument";
import { ur } from "@/content/ur";
import { buildMetadata } from "@/lib/metadata";

export { viewport } from "@/lib/metadata";
export const metadata = buildMetadata(ur);

export default function UrduLayout({ children }: { children: ReactNode }) {
  return <RootDocument t={ur}>{children}</RootDocument>;
}
