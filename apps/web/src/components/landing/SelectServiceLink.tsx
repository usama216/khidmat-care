"use client";

import { ArrowRight } from "lucide-react";
import type { ServiceId } from "@/content/types";
import { cn } from "@/lib/cn";
import { buttonClasses } from "@/components/ui/button";

export const SELECT_SERVICE_EVENT = "kc:select-service";

/**
 * Jumps to the booking form on the same page with this service already selected.
 * "card" makes a whole service card clickable; "button" is a standalone light button.
 */
export function SelectServiceLink({
  serviceId,
  label,
  variant = "card",
}: {
  serviceId: ServiceId;
  label: string;
  variant?: "card" | "button";
}) {
  return (
    <a
      href="#book"
      onClick={() => window.dispatchEvent(new CustomEvent<ServiceId>(SELECT_SERVICE_EVENT, { detail: serviceId }))}
      className={cn(
        "group",
        variant === "card"
          ? "mt-6 inline-flex items-center gap-1.5 self-start rounded-full text-[0.95rem] font-semibold text-brand-700 transition hover:text-brand-900 after:absolute after:inset-0 after:rounded-[1.75rem]"
          : buttonClasses("light", "md"),
      )}
    >
      {label}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
    </a>
  );
}
