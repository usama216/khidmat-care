import { Siren } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { cn } from "@/lib/cn";

export function EmergencyNotice({
  t,
  tone = "light",
  className,
}: {
  t: Dictionary;
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-4 rounded-[1.5rem] p-5 ring-1",
        dark ? "bg-red-500/10 ring-red-400/20" : "bg-red-50 ring-red-100",
        className,
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-600 text-white">
        <Siren className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className={cn("font-semibold", dark ? "text-white" : "text-red-900")}>{t.emergency.title}</p>
        <p className={cn("mt-0.5 text-[0.95rem]", dark ? "text-red-100/80" : "text-red-800/90")}>{t.emergency.text}</p>
        <a
          href="tel:1122"
          className="mt-2 inline-flex items-center rounded-full bg-red-600 px-4 py-1.5 text-sm font-bold text-white transition hover:bg-red-700"
        >
          {t.emergency.call}
        </a>
      </div>
    </div>
  );
}
