import { MapPin, Phone } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { site } from "@/config/site";
import { ContactForm } from "@/features/contact/ContactForm";
import { whatsappUrl } from "@/lib/whatsapp";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

export function ContactSection({ t }: { t: Dictionary }) {
  const c = t.contact;
  return (
    <section id="contact" className="scroll-mt-20 py-24 sm:py-32">
      <div className="shell grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <div>
          <SectionHeading eyebrow={c.eyebrow} title={c.title} subtitle={c.subtitle} />
          <ul data-reveal className="mt-10 space-y-3">
            <li>
              <a
                href={whatsappUrl(t.hero.whatsappMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 rounded-2xl bg-white p-4 font-semibold text-stone-800 ring-1 ring-stone-200/80 transition hover:ring-brand-200"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <WhatsAppIcon className="size-5" />
                </span>
                {t.book.whatsapp}
              </a>
            </li>
            <li>
              <a
                href={`tel:${site.phone}`}
                className="flex items-center gap-4 rounded-2xl bg-white p-4 font-semibold text-stone-800 ring-1 ring-stone-200/80 transition hover:ring-brand-200"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <Phone className="size-5" aria-hidden="true" />
                </span>
                <span lang="en" dir="ltr" className="font-sans">
                  {site.phoneDisplay}
                </span>
              </a>
            </li>
            <li className="flex items-center gap-4 rounded-2xl bg-white p-4 font-semibold text-stone-800 ring-1 ring-stone-200/80">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <MapPin className="size-5" aria-hidden="true" />
              </span>
              {t.footer.location}
            </li>
          </ul>
        </div>

        <div
          data-reveal
          className="relative rounded-[2rem] bg-white p-6 shadow-[0_40px_90px_-50px_rgba(7,38,34,0.45)] ring-1 ring-stone-200/80 sm:p-9"
        >
          <ContactForm t={t} />
        </div>
      </div>
    </section>
  );
}
