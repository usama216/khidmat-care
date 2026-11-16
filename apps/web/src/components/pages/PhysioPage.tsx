import type { CSSProperties } from "react";
import { BadgeCheck, Check, FileCheck2, ShieldCheck } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { whatsappUrl } from "@/lib/whatsapp";
import { Faq } from "@/components/landing/Faq";
import { buttonClasses } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { CtaBand, PageHero } from "@/components/site/blocks";
import { SiteShell } from "@/components/site/SiteShell";
import { ApplyLink, PhysioTerms } from "./PhysioTerms";

export function PhysioLandingPage({ t }: { t: Dictionary }) {
  const p = t.physioPage;
  const old = t.physios;

  return (
    <SiteShell t={t} path="/for-physiotherapists/">
      <PageHero
        t={t}
        crumbs={[{ label: t.nav.physios, path: "/for-physiotherapists/" }]}
        eyebrow={p.eyebrow}
        title={p.title}
        lead={p.subtitle}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <ApplyLink label={old.cta} />
          <a
            href={whatsappUrl(old.message)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses("secondary", "lg")}
          >
            <WhatsAppIcon className="size-5" />
            {old.ctaWhatsapp}
          </a>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-stone-600">
          {old.points.map((point) => (
            <li key={point} className="inline-flex items-center gap-2">
              <Check className="size-4 text-brand-600" strokeWidth={3} aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>
      </PageHero>

      <section className="py-24 sm:py-28">
        <div className="shell grid grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
          <div>
            <SectionHeading eyebrow={p.earnEyebrow} title={p.earnTitle} subtitle={p.earnDesc} />
            <ul data-reveal className="mt-8 space-y-3">
              {p.earnPoints.map((point) => (
                <li key={point} className="flex items-start gap-3 text-stone-700">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-700 text-white">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                  </span>
                  <span className="font-medium">{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div data-reveal>
            <PhysioTerms t={t} />
          </div>
        </div>
      </section>

      <section className="border-y border-stone-200/70 bg-white py-24 sm:py-28">
        <div className="shell">
          <SectionHeading eyebrow={p.stepsEyebrow} title={p.stepsTitle} align="center" />
          <ol className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {p.steps.map((step, index) => (
              <li
                key={step.title}
                data-reveal
                style={{ "--reveal-delay": `${index * 90}ms` } as CSSProperties}
                className="rounded-[1.75rem] bg-sand-50 p-7 ring-1 ring-sand-200/70"
              >
                <span className="grid size-10 place-items-center rounded-full bg-brand-700 text-white">
                  <span lang="en" className="font-sans font-bold">
                    {index + 1}
                  </span>
                </span>
                <h3 className="mt-5 text-lg font-semibold text-stone-900">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-stone-600">{step.desc}</p>
              </li>
            ))}
          </ol>
          <div data-reveal className="mt-12 flex justify-center">
            <ApplyLink label={old.cta} />
          </div>
        </div>
      </section>

      <section className="py-24 sm:py-28">
        <div className="shell grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div data-reveal className="rounded-[1.75rem] bg-white p-7 ring-1 ring-stone-200/80 sm:p-9">
            <h2 className="flex items-center gap-2.5 text-xl font-semibold text-stone-900">
              <FileCheck2 className="size-5 text-brand-700" aria-hidden="true" />
              {old.requirementsTitle}
            </h2>
            <ul className="mt-5 space-y-3">
              {old.requirements.map((requirement) => (
                <li
                  key={requirement}
                  className="flex items-center gap-3 rounded-2xl bg-sand-50 px-4 py-3 text-stone-700 ring-1 ring-sand-200/70"
                >
                  <BadgeCheck className="size-5 shrink-0 text-brand-600" aria-hidden="true" />
                  {requirement}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-stone-500">{old.note}</p>
          </div>
          <div
            data-reveal
            style={{ "--reveal-delay": "80ms" } as CSSProperties}
            className="rounded-[1.75rem] bg-white p-7 ring-1 ring-stone-200/80 sm:p-9"
          >
            <h2 className="flex items-center gap-2.5 text-xl font-semibold text-stone-900">
              <ShieldCheck className="size-5 text-brand-700" aria-hidden="true" />
              {p.rulesTitle}
            </h2>
            <ul className="mt-5 space-y-3">
              {p.rules.map((rule) => (
                <li key={rule} className="flex items-start gap-3 text-stone-700">
                  <Check className="mt-1 size-4 shrink-0 text-brand-600" strokeWidth={3} aria-hidden="true" />
                  {rule}
                </li>
              ))}
            </ul>
            <a
              href="/physio-agreement/"
              hrefLang="en"
              className="mt-6 inline-block font-semibold text-brand-700 underline-offset-4 hover:underline"
            >
              {p.agreementLink}
            </a>
          </div>
        </div>
      </section>

      <Faq t={t} items={p.faqs} eyebrow={t.nav.physios} title={p.faqTitle} schema whatsappMessage={old.message} />

      <CtaBand title={p.finalTitle} desc={p.finalDesc}>
        <ApplyLink label={old.cta} light />
        <a
          href={whatsappUrl(old.message)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-14 items-center justify-center gap-2.5 rounded-full px-7 font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/10"
        >
          <WhatsAppIcon className="size-5" />
          {old.ctaWhatsapp}
        </a>
      </CtaBand>
    </SiteShell>
  );
}
