import { Phone } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { site } from "@/config/site";
import { whatsappUrl } from "@/lib/whatsapp";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { BookingForm } from "./BookingForm";
import { EmergencyNotice } from "./EmergencyNotice";

export function BookSection({ t }: { t: Dictionary }) {
  const b = t.book;
  return (
    <section id="book" className="scroll-mt-20 py-24 sm:py-32">
      <div className="shell grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading eyebrow={b.eyebrow} title={b.title} subtitle={b.subtitle} />

          <div data-reveal className="mt-10 rounded-[1.75rem] bg-white p-6 ring-1 ring-stone-200/80 sm:p-7">
            <h3 className="text-lg font-semibold text-stone-900">{b.talkTitle}</h3>
            <p className="mt-1.5 text-stone-600">{b.talkDesc}</p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <a
                href={whatsappUrl(t.hero.whatsappMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl bg-brand-50 p-4 font-semibold text-brand-800 ring-1 ring-brand-100 transition hover:bg-brand-100"
              >
                <WhatsAppIcon className="size-6 shrink-0" />
                {b.whatsapp}
              </a>
              <a
                href={`tel:${site.phone}`}
                className="flex items-center gap-3 rounded-2xl bg-sand-50 p-4 font-semibold text-stone-800 ring-1 ring-stone-200 transition hover:bg-sand-100"
              >
                <Phone className="size-5 shrink-0" />
                <span>
                  {b.call}
                  <span lang="en" dir="ltr" className="block font-sans text-sm font-medium text-stone-500">
                    {site.phoneDisplay}
                  </span>
                </span>
              </a>
            </div>
          </div>

          <EmergencyNotice t={t} className="mt-5" />
        </div>

        <div
          data-reveal
          className="rounded-[2rem] bg-white p-6 shadow-[0_40px_90px_-50px_rgba(7,38,34,0.45)] ring-1 ring-stone-200/80 sm:p-9"
        >
          <BookingForm t={t} />
        </div>
      </div>
    </section>
  );
}
