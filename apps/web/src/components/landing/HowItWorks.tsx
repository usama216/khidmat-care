import type { CSSProperties } from "react";
import { HomeIcon, MessageCircle, UserCheck } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { whatsappUrl } from "@/lib/whatsapp";
import { buttonClasses } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

const icons = [MessageCircle, UserCheck, HomeIcon];

export function HowItWorks({ t }: { t: Dictionary }) {
  return (
    <section id="how" className="scroll-mt-20 border-y border-stone-200/70 bg-white py-24 sm:py-32">
      <div className="shell">
        <SectionHeading eyebrow={t.how.eyebrow} title={t.how.title} align="center" />

        <div className="relative mt-16 sm:mt-20">
          <div
            aria-hidden="true"
            className="absolute inset-x-[17%] top-8 hidden h-px bg-[repeating-linear-gradient(90deg,var(--color-brand-300)_0_8px,transparent_8px_16px)] lg:block"
          />
          <ol className="relative grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-10">
            {t.how.steps.map((step, i) => {
              const Icon = icons[i];
              return (
                <li
                  key={step.title}
                  data-reveal
                  style={{ "--reveal-delay": `${i * 120}ms` } as CSSProperties}
                  className="flex flex-col items-center text-center"
                >
                  <div className="relative">
                    <span className="grid size-16 place-items-center rounded-full bg-brand-700 text-white shadow-[0_15px_30px_-10px_rgba(23,99,87,0.6)] ring-[10px] ring-white">
                      <Icon className="size-7" />
                    </span>
                    <span
                      lang="en"
                      className="absolute -end-1 -top-1 grid size-7 place-items-center rounded-full bg-accent-400 font-sans text-sm font-bold text-brand-950 ring-4 ring-white"
                    >
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-7 text-xl font-semibold text-stone-900">{step.title}</h3>
                  <p className="mt-3 max-w-sm leading-relaxed text-stone-600">{step.desc}</p>
                </li>
              );
            })}
          </ol>
        </div>

        <div data-reveal className="mt-16 flex justify-center">
          <a
            href={whatsappUrl(t.hero.whatsappMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses("primary", "lg")}
          >
            <WhatsAppIcon className="size-5" />
            {t.how.cta}
          </a>
        </div>
      </div>
    </section>
  );
}
