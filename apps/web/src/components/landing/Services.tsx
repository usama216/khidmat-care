import type { CSSProperties } from "react";
import { Bone, Brain, Dumbbell, Footprints, HandHeart, PersonStanding, type LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { serviceIds, type Dictionary, type ServiceId } from "@/content/types";
import { localePath, servicePath } from "@/lib/routes";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const serviceIcons: Record<ServiceId, LucideIcon> = {
  "post-surgery": Bone,
  stroke: Brain,
  "back-neck": PersonStanding,
  "knee-joint": Footprints,
  elderly: HandHeart,
  sports: Dumbbell,
};

export function Services({
  t,
  exclude,
  heading = true,
  title,
}: {
  t: Dictionary;
  exclude?: ServiceId;
  heading?: boolean;
  title?: string;
}) {
  return (
    <section id="services" className="scroll-mt-20 py-24 sm:py-32">
      <div className="shell">
        {heading ? (
          <SectionHeading
            eyebrow={t.services.eyebrow}
            title={title ?? t.services.title}
            subtitle={title ? undefined : t.services.subtitle}
          />
        ) : null}

        <ul className={heading ? "mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" : "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"}>
          {serviceIds.filter((id) => id !== exclude).map((id, i) => {
            const Icon = serviceIcons[id];
            const item = t.services.items[id];
            return (
              <li key={id} data-reveal style={{ "--reveal-delay": `${(i % 3) * 80}ms` } as CSSProperties}>
                <article className="group relative flex h-full flex-col rounded-[1.75rem] bg-white p-7 ring-1 ring-stone-200/80 transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(10,47,51,0.35)] hover:ring-brand-200">
                  <div className="grid size-13 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition duration-300 group-hover:bg-brand-700 group-hover:text-white group-hover:ring-brand-700">
                    <Icon className="size-6" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-stone-900">{item.title}</h3>
                  <p className="mt-2.5 flex-1 leading-relaxed text-stone-600">{item.desc}</p>
                  <a
                    href={localePath(t.locale, servicePath(id))}
                    className="mt-6 inline-flex items-center gap-1.5 self-start rounded-full text-[0.95rem] font-semibold text-brand-700 transition hover:text-brand-900 after:absolute after:inset-0 after:rounded-[1.75rem]"
                  >
                    {t.services.learnMore}
                    <span className="sr-only">: {item.title}</span>
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
                  </a>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
