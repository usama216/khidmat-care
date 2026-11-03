import { MessageCircleQuestion, Plus } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { whatsappUrl } from "@/lib/whatsapp";
import { buttonClasses } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

export function Faq({ t }: { t: Dictionary }) {
  const q = t.faq;
  return (
    <section id="faq" className="scroll-mt-20 border-t border-stone-200/70 bg-white py-24 sm:py-32">
      <div className="shell grid grid-cols-1 gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading eyebrow={q.eyebrow} title={q.title} />
          <div data-reveal className="mt-10 rounded-[1.75rem] bg-sand-50 p-6 ring-1 ring-sand-200/70">
            <MessageCircleQuestion className="size-7 text-brand-700" aria-hidden="true" />
            <p className="mt-3 text-lg font-semibold text-stone-900">{q.moreTitle}</p>
            <a
              href={whatsappUrl(t.hero.whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("primary", "md", "mt-4")}
            >
              <WhatsAppIcon className="size-5" />
              {q.moreCta}
            </a>
          </div>
        </div>

        <div data-reveal className="divide-y divide-stone-200 border-y border-stone-200">
          {q.items.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-start text-lg font-semibold text-stone-900 transition hover:text-brand-800 [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sand-100 text-stone-700 ring-1 ring-sand-200 transition duration-300 group-open:rotate-45 group-open:bg-brand-700 group-open:text-white group-open:ring-brand-700">
                  <Plus className="size-4.5" aria-hidden="true" />
                </span>
              </summary>
              <p className="-mt-1 max-w-2xl pb-7 pe-12 leading-relaxed text-stone-600">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
