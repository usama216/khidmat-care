import type { CSSProperties } from "react";
import { BadgeCheck, Check, ReceiptText, RefreshCw, ShieldCheck, TrendingDown, UserRound, type LucideIcon } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { SectionHeading } from "@/components/ui/SectionHeading";

const icons: LucideIcon[] = [UserRound, ReceiptText, TrendingDown, RefreshCw];

export function WhyUs({ t }: { t: Dictionary }) {
  const w = t.why;
  return (
    <section className="py-24 sm:py-32">
      <div className="shell">
        <SectionHeading eyebrow={w.eyebrow} title={w.title} subtitle={w.subtitle} />

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
          <article
            data-reveal
            className="relative overflow-hidden rounded-[2rem] bg-brand-900 p-8 text-white sm:col-span-2 sm:p-10 lg:col-span-1 lg:row-span-2"
          >
            <div
              aria-hidden="true"
              className="absolute -end-24 -top-24 size-72 rounded-full bg-brand-500/30 blur-3xl"
            />
            <div className="relative flex h-full flex-col">
              <span className="grid size-14 place-items-center rounded-2xl bg-white/10 text-brand-200 ring-1 ring-white/15">
                <ShieldCheck className="size-7" />
              </span>
              <h3 className="mt-7 text-2xl font-semibold text-balance">{w.featured.title}</h3>
              <p className="mt-3 leading-relaxed text-brand-100/80">{w.featured.desc}</p>

              <ul className="mt-8 space-y-3 lg:mt-auto lg:pt-10">
                {w.featured.checklist.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3.5 ring-1 ring-white/10"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-400 text-brand-950">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                    <span className="font-medium">{item}</span>
                    <BadgeCheck className="ms-auto size-5 shrink-0 text-brand-300" aria-hidden="true" />
                  </li>
                ))}
              </ul>
            </div>
          </article>

          {w.items.map((item, i) => {
            const Icon = icons[i];
            return (
              <article
                key={item.title}
                data-reveal
                style={{ "--reveal-delay": `${(i % 2) * 100}ms` } as CSSProperties}
                className="rounded-[2rem] bg-white p-8 ring-1 ring-stone-200/80"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-sand-100 text-brand-800 ring-1 ring-sand-200">
                  <Icon className="size-6" />
                </span>
                <h3 className="mt-6 text-xl font-semibold text-stone-900">{item.title}</h3>
                <p className="mt-2.5 leading-relaxed text-stone-600">{item.desc}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
