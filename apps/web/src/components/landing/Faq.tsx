import { ArrowRight, MessageCircleQuestion, Plus } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { localePath } from "@/lib/routes";
import { whatsappUrl } from "@/lib/whatsapp";
import { buttonClasses } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { JsonLd } from "@/components/site/blocks";

type Qa = { q: string; a: string };

/**
 * Questions and answers. On a page whose main content is these questions, `schema` adds the
 * FAQPage data search engines can show in results. Only one FAQPage block belongs on a page.
 */
export function Faq({
  t,
  items = t.faq.items,
  eyebrow = t.faq.eyebrow,
  title = t.faq.title,
  limit,
  seeAll = false,
  schema = false,
  whatsappMessage = t.hero.whatsappMessage,
}: {
  t: Dictionary;
  items?: Qa[];
  eyebrow?: string;
  title?: string;
  limit?: number;
  seeAll?: boolean;
  schema?: boolean;
  whatsappMessage?: string;
}) {
  const q = t.faq;
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <section id="faq" className="scroll-mt-20 border-t border-stone-200/70 bg-white py-24 sm:py-32">
      <div className="shell grid grid-cols-1 gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading eyebrow={eyebrow} title={title} />
          <div data-reveal className="mt-10 rounded-[1.75rem] bg-sand-50 p-6 ring-1 ring-sand-200/70">
            <MessageCircleQuestion className="size-7 text-brand-700" aria-hidden="true" />
            <p className="mt-3 text-lg font-semibold text-stone-900">{q.moreTitle}</p>
            <a
              href={whatsappUrl(whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("primary", "md", "mt-4")}
            >
              <WhatsAppIcon className="size-5" />
              {q.moreCta}
            </a>
          </div>
        </div>

        <div data-reveal>
          <div className="divide-y divide-stone-200 border-y border-stone-200">
            {shown.map((item) => (
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
          {seeAll ? (
            <a
              href={localePath(t.locale, "/faq/")}
              className="mt-8 inline-flex items-center gap-1.5 font-semibold text-brand-700 transition hover:text-brand-900"
            >
              {q.seeAll}
              <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>
      {schema ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: shown.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }}
        />
      ) : null}
    </section>
  );
}
