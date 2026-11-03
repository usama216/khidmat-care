import { BadgeCheck, Check, FileCheck2, Stethoscope } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { whatsappUrl } from "@/lib/whatsapp";
import { buttonClasses } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

export function ForPhysios({ t }: { t: Dictionary }) {
  const p = t.physios;
  return (
    <section id="physios" className="scroll-mt-20 pb-24 sm:pb-32">
      <div className="shell">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-linear-to-br from-brand-50 via-white to-sand-100 p-8 ring-1 ring-brand-100 sm:p-12 lg:p-16">
          <Stethoscope
            aria-hidden="true"
            className="pointer-events-none absolute -end-10 -bottom-10 size-72 text-brand-100 rtl:-scale-x-100"
            strokeWidth={1}
          />
          <div className="relative grid grid-cols-1 gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <SectionHeading eyebrow={p.eyebrow} title={p.title} subtitle={p.desc} />
              <ul data-reveal className="mt-8 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {p.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-stone-700">
                    <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-brand-700 text-white">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                    <span className="font-medium">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div data-reveal className="rounded-[1.75rem] bg-white p-7 shadow-[0_30px_70px_-40px_rgba(7,38,34,0.4)] ring-1 ring-stone-200/80">
              <h3 className="flex items-center gap-2.5 text-lg font-semibold text-stone-900">
                <FileCheck2 className="size-5 text-brand-700" aria-hidden="true" />
                {p.requirementsTitle}
              </h3>
              <ul className="mt-5 space-y-3">
                {p.requirements.map((req) => (
                  <li key={req} className="flex items-center gap-3 rounded-2xl bg-sand-50 px-4 py-3 text-stone-700 ring-1 ring-sand-200/70">
                    <BadgeCheck className="size-5 shrink-0 text-brand-600" aria-hidden="true" />
                    {req}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm text-stone-500">{p.note}</p>
              <a
                href={whatsappUrl(p.message)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses("primary", "lg", "mt-6 w-full")}
              >
                <WhatsAppIcon className="size-5" />
                {p.cta}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
