import type { CSSProperties } from "react";
import { ClipboardCheck, Eye, Lock, Mail, ShieldCheck, type LucideIcon } from "lucide-react";
import type { Dictionary } from "@/content/types";
import { site } from "@/config/site";
import { organization } from "@/lib/schema";
import { BookSection } from "@/components/landing/BookSection";
import { ContactSection } from "@/components/landing/ContactSection";
import { Faq } from "@/components/landing/Faq";
import { Families } from "@/components/landing/Families";
import { ForPhysios } from "@/components/landing/ForPhysios";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { WhyUs } from "@/components/landing/WhyUs";
import { ContactButtons, JsonLd, PageHero } from "@/components/site/blocks";
import { SiteShell } from "@/components/site/SiteShell";

function label(t: Dictionary, path: string) {
  return t.nav.links.find((link) => link.href === path)?.label ?? "";
}

export function HowItWorksPage({ t }: { t: Dictionary }) {
  return (
    <SiteShell t={t} path="/how-it-works/">
      <PageHero
        t={t}
        crumbs={[{ label: label(t, "/how-it-works/"), path: "/how-it-works/" }]}
        eyebrow={t.how.eyebrow}
        title={t.how.title}
        lead={t.why.subtitle}
      >
        <ContactButtons t={t} />
      </PageHero>
      <HowItWorks t={t} />
      <WhyUs t={t} />
      <Families t={t} />
      <BookSection t={t} />
    </SiteShell>
  );
}

export function FaqPage({ t }: { t: Dictionary }) {
  return (
    <SiteShell t={t} path="/faq/">
      <PageHero t={t} crumbs={[{ label: label(t, "/faq/"), path: "/faq/" }]} title={t.faq.title} lead={t.pages.faq.description} />
      <Faq t={t} schema />
      <ForPhysios t={t} />
    </SiteShell>
  );
}

export function ContactPage({ t }: { t: Dictionary }) {
  return (
    <SiteShell t={t} path="/contact/">
      <PageHero
        t={t}
        crumbs={[{ label: label(t, "/contact/"), path: "/contact/" }]}
        eyebrow={t.contact.eyebrow}
        title={t.contact.title}
        lead={t.contact.subtitle}
      >
        <ContactButtons t={t} />
        <a
          href={`mailto:${site.supportEmail}`}
          className="mt-5 inline-flex items-center gap-2 font-semibold text-brand-700 hover:underline"
        >
          <Mail className="size-4.5" aria-hidden="true" />
          <span lang="en" dir="ltr" className="font-sans">
            {site.supportEmail}
          </span>
        </a>
      </PageHero>
      <ContactSection t={t} />
      <BookSection t={t} />
      <JsonLd data={organization(t)} />
    </SiteShell>
  );
}

const VALUE_ICONS: LucideIcon[] = [ShieldCheck, Eye, ClipboardCheck, Lock];

export function AboutPage({ t }: { t: Dictionary }) {
  const a = t.about;
  return (
    <SiteShell t={t} path="/about/">
      <PageHero
        t={t}
        crumbs={[{ label: label(t, "/about/"), path: "/about/" }]}
        eyebrow={a.eyebrow}
        title={a.title}
        lead={a.intro}
      />
      <section className="py-24 sm:py-28">
        <div className="shell">
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {a.values.map((value, index) => {
              const Icon = VALUE_ICONS[index % VALUE_ICONS.length];
              return (
                <li
                  key={value.title}
                  data-reveal
                  style={{ "--reveal-delay": `${index * 80}ms` } as CSSProperties}
                  className="rounded-[1.75rem] bg-white p-7 ring-1 ring-stone-200/80"
                >
                  <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <h2 className="mt-6 text-lg font-semibold text-stone-900">{value.title}</h2>
                  <p className="mt-2 leading-relaxed text-stone-600">{value.desc}</p>
                </li>
              );
            })}
          </ul>

          <div data-reveal className="mt-6 rounded-[1.75rem] bg-brand-900 p-8 text-white sm:p-10">
            <h2 className="text-2xl font-semibold">{a.teamTitle}</h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-brand-100/85">{a.teamDesc}</p>
            <ContactButtons t={t} className="mt-7" />
            <a
              href={`mailto:${site.supportEmail}`}
              className="mt-5 inline-flex items-center gap-2 font-semibold text-brand-200 hover:underline"
            >
              <Mail className="size-4.5" aria-hidden="true" />
              <span lang="en" dir="ltr" className="font-sans">
                {site.supportEmail}
              </span>
            </a>
          </div>
        </div>
      </section>
      <WhyUs t={t} />
      <JsonLd data={organization(t)} />
    </SiteShell>
  );
}
