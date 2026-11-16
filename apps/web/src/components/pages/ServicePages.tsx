import type { CSSProperties } from "react";
import { CalendarClock, Check, ClipboardList } from "lucide-react";
import { type Dictionary, type ServiceId } from "@/content/types";
import { site } from "@/config/site";
import { localePath, servicePath } from "@/lib/routes";
import { BookSection } from "@/components/landing/BookSection";
import { Faq } from "@/components/landing/Faq";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { SelectServiceLink } from "@/components/landing/SelectServiceLink";
import { Services, serviceIcons } from "@/components/landing/Services";
import { WhyUs } from "@/components/landing/WhyUs";
import { ContactButtons, JsonLd, PageHero } from "@/components/site/blocks";
import { SiteShell } from "@/components/site/SiteShell";

export function ServicesIndexPage({ t }: { t: Dictionary }) {
  return (
    <SiteShell t={t} path="/services/">
      <PageHero
        t={t}
        crumbs={[{ label: t.nav.links[0]?.label ?? "", path: "/services/" }]}
        eyebrow={t.services.eyebrow}
        title={t.services.title}
        lead={t.services.subtitle}
      >
        <ContactButtons t={t} />
      </PageHero>
      <Services t={t} heading={false} />
      <WhyUs t={t} />
      <BookSection t={t} />
    </SiteShell>
  );
}

export function ServiceDetailPage({ t, id }: { t: Dictionary; id: ServiceId }) {
  const item = t.services.items[id];
  const page = t.servicePage.pages[id];
  const labels = t.servicePage;
  const Icon = serviceIcons[id];
  const message = labels.whatsappMessage.replace("{service}", item.title);
  const path = servicePath(id);

  return (
    <SiteShell t={t} path={path}>
      <PageHero
        t={t}
        crumbs={[
          { label: t.nav.links[0]?.label ?? "", path: "/services/" },
          { label: item.title, path },
        ]}
        eyebrow={t.hero.eyebrow}
        title={page.headline}
        lead={page.intro}
      >
        <ContactButtons t={t} message={message} />
      </PageHero>

      <section className="py-20 sm:py-24">
        <div className="shell grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div data-reveal className="rounded-[1.75rem] bg-white p-7 ring-1 ring-stone-200/80 sm:p-9">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <h2 className="mt-6 text-2xl font-semibold text-stone-900">{labels.conditionsTitle}</h2>
            <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {page.conditions.map((condition) => (
                <li key={condition} className="flex items-start gap-2.5 text-stone-700">
                  <Check className="mt-1 size-4 shrink-0 text-brand-600" strokeWidth={3} aria-hidden="true" />
                  {condition}
                </li>
              ))}
            </ul>
          </div>

          <div
            data-reveal
            style={{ "--reveal-delay": "80ms" } as CSSProperties}
            className="rounded-[1.75rem] bg-white p-7 ring-1 ring-stone-200/80 sm:p-9"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <ClipboardList className="size-6" aria-hidden="true" />
            </span>
            <h2 className="mt-6 text-2xl font-semibold text-stone-900">{labels.sessionTitle}</h2>
            <ol className="mt-5 space-y-3">
              {page.session.map((step, index) => (
                <li key={step} className="flex items-start gap-3 text-stone-700">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white">
                    <span lang="en" className="font-sans">
                      {index + 1}
                    </span>
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div
            data-reveal
            className="flex flex-col gap-6 rounded-[1.75rem] bg-brand-900 p-7 text-white sm:flex-row sm:items-center sm:p-9 lg:col-span-2"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-brand-200">
              <CalendarClock className="size-6" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <h2 className="text-xl font-semibold">{labels.durationTitle}</h2>
              <p className="mt-2 leading-relaxed text-brand-100/85">{page.duration}</p>
            </div>
            <span className="shrink-0">
              <SelectServiceLink serviceId={id} label={labels.bookTreatment} variant="button" />
            </span>
          </div>
        </div>
      </section>

      <HowItWorks t={t} more />
      <Faq t={t} items={page.faqs} eyebrow={item.title} title={labels.faqTitle} schema whatsappMessage={message} />
      <BookSection t={t} />

      <Services t={t} exclude={id} title={labels.otherServices} />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: page.headline,
          serviceType: item.title,
          description: page.meta.description,
          url: `${site.url}${localePath(t.locale, path)}`,
          areaServed: { "@type": "City", name: "Lahore" },
          provider: { "@id": `${site.url}/#organization` },
          audience: { "@type": "PeopleAudience", geographicArea: { "@type": "City", name: "Lahore" } },
          category: "Physiotherapy",
        }}
      />
    </SiteShell>
  );
}
