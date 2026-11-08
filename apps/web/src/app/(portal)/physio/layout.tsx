import type { ReactNode } from "react";
import { PhysioShell } from "@/features/portal/PhysioShell";

export default function PhysioLayout({ children }: { children: ReactNode }) {
  return <PhysioShell>{children}</PhysioShell>;
}
