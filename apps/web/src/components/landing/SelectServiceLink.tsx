"use client";

import { ArrowRight } from "lucide-react";
import type { ServiceId } from "@/content/types";

export const SELECT_SERVICE_EVENT = "kc:select-service";

// Jumps to the booking form with this service already selected.
export function SelectServiceLink({ serviceId, label }: { serviceId: ServiceId; label: string }) {
  return (
    <a
      href="#book"
      onClick={() => window.dispatchEvent(new CustomEvent<ServiceId>(SELECT_SERVICE_EVENT, { detail: serviceId }))}
      className="mt-6 inline-flex items-center gap-1.5 self-start rounded-full text-[0.95rem] font-semibold text-brand-700 transition hover:text-brand-900 after:absolute after:inset-0 after:rounded-[1.75rem]"
    >
      {label}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
    </a>
  );
}
